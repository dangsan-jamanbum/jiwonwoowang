import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const ROOT = process.cwd();
const sessions = new Map();
const presence = new Map();
const chats = [];
const wishes = [];
const calls = [
  { id:'demo-pnc-001', terminal:'pnc', name:'ATD 부산항 연습선', voy:'DEMO-001', outboundVoy:'DEMO-001', inboundVoy:'DEMO-001', carrierVoy:'DEMO-001', berth:'연습 부두', berthPhase:'alongside', etd:null, etb:null, atd:null, atdVerified:false, isDemo:true },
  { id:'demo-pnit-001', terminal:'pnit', name:'ATD 북항 연습선', voy:'DEMO-002', outboundVoy:'DEMO-002', inboundVoy:'DEMO-002', carrierVoy:'DEMO-002', berth:'연습 부두', berthPhase:'alongside', etd:null, etb:null, atd:null, atdVerified:false, isDemo:true }
];

function cookieSession(req,res){
  const raw = req.headers.cookie || '';
  let id = raw.split(';').map(v=>v.trim()).find(v=>v.startsWith('atd-session='))?.slice(12);
  if(!id || !/^[a-zA-Z0-9_-]{12,80}$/.test(id)){
    id = randomUUID().replaceAll('-','');
    res.setHeader('Set-Cookie', `atd-session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  }
  if(!sessions.has(id)) sessions.set(id,{ id, profile:null, favorites:[], joined:new Set(), actions:[], pushes:0, pulls:0 });
  return sessions.get(id);
}
function json(res,status,data){
  const body=JSON.stringify(data);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-ATD-Browser','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
  res.end(body);
}
async function readBody(req){
  let raw=''; for await (const chunk of req) { raw+=chunk; if(raw.length>64*1024) throw new Error('요청이 너무 큽니다.'); }
  return raw ? JSON.parse(raw) : {};
}
function profileFor(session){
  if(!session.profile) session.profile={name:'항구 손님',style:'cardigan',favorites:[]};
  session.profile.favorites=[...session.favorites];
  return session.profile;
}
function roomFor(session,callId){
  const others=[...presence.values()].filter(p=>p.sessionId!==session.id && p.callId===callId);
  return { participants:others.length+(session.joined.has(callId)?1:0), pushes:session.pushes, pulls:session.pulls, yourPushes:session.pushes, yourPulls:session.pulls, selfJoined:session.joined.has(callId), peers:others.map(p=>({avatarId:p.selfId,name:p.name,x:p.x||0,y:p.y||0,z:p.z||0,yaw:p.yaw||0,motion:p.motion||'idle'})), recent:[] };
}
function stateFor(session,url){
  const terminal=['pnc','pnit'].includes(url.searchParams.get('terminal'))?url.searchParams.get('terminal'):'pnc';
  const requested=url.searchParams.get('call');
  const selected=calls.find(c=>c.terminal===terminal && (!requested || c.id===requested)) || calls.find(c=>c.terminal===terminal) || null;
  const peers=[...presence.values()].filter(p=>p.terminal===terminal);
  return { profile:session.profile?profileFor(session):null, selected, terminal, terminals:[{id:'pnc',name:'부산신항'}, {id:'pnit',name:'부산북항'}], calls:calls.filter(c=>c.terminal===terminal), room:selected?roomFor(session,selected.id):{participants:0,pushes:0,pulls:0,peers:[],recent:[]}, wishes:wishes.filter(w=>w.callId===selected?.id), nearby:[], changes:[], confirmedDepartures:[], weather:{code:'clear'}, source:{kind:'demo',stale:false}, online:peers.length+1 };
}
function sendStatic(req,res){
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  const file=path.resolve(ROOT,relative);
  if(!file.startsWith(ROOT+path.sep) && file!==path.join(ROOT,'index.html')) return json(res,403,{error:'접근할 수 없습니다.'});
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()) return json(res,404,{error:'파일을 찾을 수 없습니다.'});
    const ext=path.extname(file).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=300'});
    fs.createReadStream(file).pipe(res);
  });
}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-ATD-Browser','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});return res.end();}
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/api/')) return sendStatic(req,res);
  const session=cookieSession(req);
  try{
    const route=url.pathname.slice(5);
    if(req.method==='GET' && route==='state') return json(res,200,stateFor(session,url));
    if(req.method==='GET' && route==='terminal-board'){
      const terminal=url.searchParams.get('terminal')==='pnit'?'pnit':'pnc';
      return json(res,200,{terminal,calls:calls.filter(c=>c.terminal===terminal),yardTrucks:[],source:{kind:'demo',stale:false}});
    }
    if(req.method==='GET' && route==='search'){
      const q=(url.searchParams.get('q')||'').toLowerCase();
      return json(res,200,{calls:calls.filter(c=>(c.name+' '+c.voy).toLowerCase().includes(q))});
    }
    if(req.method==='GET' && route==='chat'){
      const after=Number(url.searchParams.get('after')||0),terminal=url.searchParams.get('terminal')||'busan';
      return json(res,200,{messages:chats.filter(m=>m.id>after&&m.terminal===terminal).slice(-80)});
    }
    if(req.method==='POST'){
      const body=await readBody(req);
      if(route==='guest') return json(res,200,{profile:profileFor(session)});
      if(route==='profile'){
        const p=profileFor(session);p.name=String(body.name||p.name).slice(0,24);p.style=String(body.style||p.style).slice(0,32);
        return json(res,200,{profile:p});
      }
      if(route==='join'){
        if(!calls.some(c=>c.id===body.callId))return json(res,404,{error:'항차를 찾을 수 없습니다.'});
        session.joined.add(body.callId);return json(res,200,{ok:true});
      }
      if(route==='favorite'){
        if(body.value)session.favorites=[...new Set([...session.favorites,body.callId])];
        else session.favorites=session.favorites.filter(x=>x!==body.callId);
        if(session.profile)session.profile.favorites=[...session.favorites];
        return json(res,200,{ok:true});
      }
      if(route==='wish'){
        if(!calls.some(c=>c.id===body.callId))return json(res,404,{error:'항차를 찾을 수 없습니다.'});
        const item={id:randomUUID(),...body,author:profileFor(session).name,createdAt:new Date().toISOString()};
        wishes.push(item);return json(res,200,{ok:true,wish:item});
      }
      if(route==='action'){
        const call=calls.find(c=>c.id===body.callId);
        if(!call)return json(res,404,{error:'항차를 찾을 수 없습니다.'});
        session.actions.push({mode:body.mode,callId:body.callId,at:Date.now()});
        if(body.mode==='push')session.pushes++;
        if(body.mode==='pull')session.pulls++;
        return json(res,200,{ok:true});
      }
      if(route==='chat'){
        const message={id:chats.length?chats[chats.length-1].id+1:1,terminal:String(body.terminal||'busan'),text:String(body.text||'').trim().slice(0,300),avatarId:session.id,name:profileFor(session).name,createdAt:new Date().toISOString()};
        if(!message.text)return json(res,400,{error:'메시지를 입력해 주세요.'});
        chats.push(message);if(chats.length>500)chats.shift();return json(res,200,{ok:true,message});
      }
      if(route==='presence'){
        const selfId=session.id,entry={...body,sessionId:session.id,selfId,name:session.profile?.name||'항구 손님',seenAt:Date.now()};
        presence.set(selfId,entry);
        for(const [id,p] of presence)if(Date.now()-p.seenAt>10000)presence.delete(id);
        const peers=[...presence.values()].filter(p=>p.terminal===body.terminal&&p.callId===body.callId);
        return json(res,200,{selfId,selfName:entry.name,serverTime:Date.now(),online:peers.length,peers:peers.filter(p=>p.selfId!==selfId).map(p=>({avatarId:p.selfId,name:p.name,x:p.x||0,y:p.y||0,z:p.z||0,yaw:p.yaw||0,motion:p.motion||'idle',actionId:p.actionId||null}))});
      }
    }
    return json(res,404,{error:'지원하지 않는 API입니다.'});
  }catch(error){console.error(error);return json(res,400,{error:'요청을 처리하지 못했습니다.'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log('ATD Harbor server listening on '+PORT));
