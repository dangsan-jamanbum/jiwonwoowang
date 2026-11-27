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
let calls = [
  { id:'demo-pnc-001', terminal:'pnc', name:'ATD 부산항 연습선', voy:'DEMO-001', outboundVoy:'DEMO-001', inboundVoy:'DEMO-001', carrierVoy:'DEMO-001', berth:'연습 부두', berthPhase:'alongside', etd:null, etb:null, atd:null, atdVerified:false, isDemo:true },
  { id:'demo-pnit-001', terminal:'pnit', name:'ATD 북항 연습선', voy:'DEMO-002', outboundVoy:'DEMO-002', inboundVoy:'DEMO-002', carrierVoy:'DEMO-002', berth:'연습 부두', berthPhase:'alongside', etd:null, etb:null, atd:null, atdVerified:false, isDemo:true }
];

const PNC_BERTH_URL='https://svc.pncport.com/info/CMS/Ship/showberthCLT.pnc?cltCode=&mCode=MN019';
const PNC_CACHE_MS=2*60*1000;
let pncCache={checkedAt:0,calls:[],source:{kind:'demo',stale:false,label:'실시간 연결 대기'}};
let pncRefresh=null;

function decodeHtml(value){
  return String(value||'').replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function parsePncSchedule(html){
  const plain=decodeHtml(String(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?>|<\/(?:tr|td|th|div|p|li|h[1-6])\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' '));
  const lines=plain.split(/\r?\n/).map(v=>v.replace(/\s+/g,' ').trim()).filter(Boolean);
  const found=[];
  const voyRe=/^([A-Z0-9-]{4,})\s*\/\s*(20\d{2})$/i;
  for(let i=1;i<lines.length-3;i++){
    const match=lines[i].match(voyRe);
    if(!match)continue;
    const name=lines[i-1].replace(/\s+/g,' ').trim();
    const route=lines[i+1]||'';
    const stats=lines.slice(i+2,i+6).join(' ').match(/D\s*:\s*\(?([\d,]+)\)?[\s,;]*L\s*:\s*\(?([\d,]+)\)?[\s,;]*S\s*:\s*\(?([\d,]+)\)?[\s,;]*Y\s*:\s*\(?([\d,]+)\)?/i);
    if(!/^[A-Z0-9][A-Z0-9 .'-]{2,60}$/i.test(name)||!route.includes('/'))continue;
    const n=v=>Number(String(v||'').replace(/,/g,''));
    const discharge=stats?n(stats[1]):null,load=stats?n(stats[2]):null,shift=stats?n(stats[3]):null,yard=stats?n(stats[4]):null;
    const code=route.split('/').pop().trim().toUpperCase();
    found.push({
      id:'pnc-'+match[1].toLowerCase(),terminal:'pnc',name,voy:match[1],outboundVoy:match[1],inboundVoy:match[1],carrierVoy:match[1],
      berth:'PNC 선석 배정',berthPhase:'planned',etb:null,etd:null,atd:null,atdVerified:false,isDemo:false,
      operator:route.split('/')[0]||'',route:route.split('/').slice(1,-1).join('/')||'',scheduleCode:code,
      loading:{plan:load,completed:null,remainingVan:null,discharge,shift,yard,workTotal:(discharge??0)+(load??0)}
    });
  }
  const unique=[...new Map(found.map(c=>[c.id,c])).values()];
  if(!unique.length)throw new Error('PNC 선석 배정표에서 선박 항목을 찾지 못했습니다.');
  return unique;
}
function pncFallback(){
  const now=Date.now();
  return [
    {id:'demo-pnc-fallback-001',terminal:'pnc',name:'ATD PNC 시범 컨테이너선',voy:'DEMO-101',outboundVoy:'DEMO-101',inboundVoy:'DEMO-101',carrierVoy:'DEMO-101',berth:'예시 선석 1',berthPhase:'planned',etb:null,etd:null,atd:null,atdVerified:false,isDemo:true,loading:{plan:1200,completed:640,remainingVan:560,workTotal:1200}},
    {id:'demo-pnc-fallback-002',terminal:'pnc',name:'ATD 신항 연습선',voy:'DEMO-102',outboundVoy:'DEMO-102',inboundVoy:'DEMO-102',carrierVoy:'DEMO-102',berth:'예시 선석 2',berthPhase:'berthed',etb:null,etd:null,atd:null,atdVerified:false,isDemo:true,loading:{plan:860,completed:420,remainingVan:440,workTotal:860}},
    {id:'demo-pnc-fallback-003',terminal:'pnc',name:'ATD 항만 훈련선',voy:'DEMO-103',outboundVoy:'DEMO-103',inboundVoy:'DEMO-103',carrierVoy:'DEMO-103',berth:'예시 선석 3',berthPhase:'planned',etb:null,etd:null,atd:null,atdVerified:false,isDemo:true,loading:{plan:540,completed:0,remainingVan:540,workTotal:540}}
  ];
}
function updateCalls(){
  const pnc=pncCache.calls.length?pncCache.calls:pncFallback();
  const pnit=calls.filter(c=>c.terminal==='pnit');
  calls=[...pnc,...pnit];
}
async function getPncSchedule(force=false){
  if(!force&&Date.now()-pncCache.checkedAt<PNC_CACHE_MS){updateCalls();return pncCache;}
  if(pncRefresh)return pncRefresh;
  pncRefresh=(async()=>{
    try{
      const response=await fetch(PNC_BERTH_URL,{headers:{'User-Agent':'Mozilla/5.0 ATD-Harbor/1.0','Accept':'text/html'},signal:AbortSignal.timeout(9000)});
      if(!response.ok)throw new Error('PNC 응답 '+response.status);
      const html=await response.text();
      const parsed=parsePncSchedule(html);
      const checkedAt=new Date().toISOString();
      pncCache={checkedAt:Date.now(),calls:parsed,source:{kind:'official',label:'부산신항 PNC 운영사 공개 선석 배정표',checkedAt,updatedAt:checkedAt,stale:false,partial:false,url:PNC_BERTH_URL}};
    }catch(error){
      console.warn('[PNC schedule] live lookup failed:',error.message);
      const checkedAt=new Date().toISOString();
      pncCache={checkedAt:Date.now(),calls:pncFallback(),source:{kind:'demo',label:'실시간 연결 대기 · 예시 자료',checkedAt,updatedAt:checkedAt,stale:false,partial:true,error:'공식 자료를 가져오지 못해 예시 자료를 표시합니다.'}};
    }
    updateCalls();
    return pncCache;
  })().finally(()=>{pncRefresh=null;});
  return pncRefresh;
}

function cookieSession(req, res){
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
async function stateFor(session,url){
  const terminal=['pnc','pnit'].includes(url.searchParams.get('terminal'))?url.searchParams.get('terminal'):'pnc';
  const pnc=await getPncSchedule();
  const terminalCalls=calls.filter(c=>c.terminal===terminal);
  const source=terminal==='pnc'?pnc.source:{kind:'demo',label:'부산북항 예시 일정',checkedAt:new Date().toISOString(),stale:false};
  const terminalStatus={calls:terminalCalls,yardTrucks:[],source};
  const requested=url.searchParams.get('call');
  const selected=terminalCalls.find(c=>!requested||c.id===requested)||terminalCalls[0]||null;
  const peers=[...presence.values()].filter(p=>p.terminal===terminal);
  return {profile:session.profile?profileFor(session):null,selected,terminal,terminals:[{id:'pnc',name:'부산신항'},{id:'pnit',name:'부산북항'}],calls:terminalCalls,terminalStatus,room:selected?roomFor(session,selected.id):{participants:0,pushes:0,pulls:0,peers:[],recent:[]},wishes:wishes.filter(w=>w.callId===selected?.id),nearby:[],changes:[],confirmedDepartures:[],weather:{code:'clear'},source,online:peers.length+1};
}
function sendStatic(req,res){
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/favicon.ico')pathname='/favicon.svg';
  const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  const file=path.resolve(ROOT,relative);
  if(!file.startsWith(ROOT+path.sep) && file!==path.join(ROOT,'index.html')) return json(res,403,{error:'접근할 수 없습니다.'});
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()) return json(res,404,{error:'파일을 찾을 수 없습니다.'});
    const ext=path.extname(file).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.ico':'image/x-icon','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=300'});
    fs.createReadStream(file).pipe(res);
  });
}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-ATD-Browser','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});return res.end();}
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/api/')) return sendStatic(req,res);
  // Pass both request and response: cookieSession writes Set-Cookie to res.
  const session = cookieSession(req, res);
  try{
    const route=url.pathname.slice(5);
    if(req.method==='GET' && route==='state') return json(res,200,await stateFor(session,url));
    if(req.method==='GET' && route==='terminal-board'){
      const terminal=url.searchParams.get('terminal')==='pnit'?'pnit':'pnc';
      const pnc=await getPncSchedule();
      const source=terminal==='pnc'?pnc.source:{kind:'demo',label:'부산북항 예시 일정',checkedAt:new Date().toISOString(),stale:false};
      return json(res,200,{terminal,calls:calls.filter(c=>c.terminal===terminal),yardTrucks:[],source});
    }
    if(req.method==='GET' && route==='search'){
      const q=(url.searchParams.get('q')||'').toLowerCase();
      await getPncSchedule(); return json(res,200,{calls:calls.filter(c=>(c.name+' '+c.voy).toLowerCase().includes(q))});
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
        await getPncSchedule(); if(!calls.some(c=>c.id===body.callId))return json(res,404,{error:'항차를 찾을 수 없습니다.'});
        session.joined.add(body.callId);return json(res,200,{ok:true});
      }
      if(route==='favorite'){
        if(body.value)session.favorites=[...new Set([...session.favorites,body.callId])];
        else session.favorites=session.favorites.filter(x=>x!==body.callId);
        if(session.profile)session.profile.favorites=[...session.favorites];
        return json(res,200,{ok:true});
      }
      if(route==='wish'){
        await getPncSchedule(); if(!calls.some(c=>c.id===body.callId))return json(res,404,{error:'항차를 찾을 수 없습니다.'});
        const item={id:randomUUID(),...body,author:profileFor(session).name,createdAt:new Date().toISOString()};
        wishes.push(item);return json(res,200,{ok:true,wish:item});
      }
      if(route==='action'){
        await getPncSchedule(); const call=calls.find(c=>c.id===body.callId);
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
