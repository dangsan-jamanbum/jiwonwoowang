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
const cargoItems = [
  {id:'cargo-pnc-001',name:'수출 컨테이너 화물',x:-7.3,z:-55.6,yaw:0,carrierId:null,delivered:false},
  {id:'cargo-pnc-002',name:'팔레트 화물',x:-9.5,z:-55.1,yaw:.18,carrierId:null,delivered:false},
  {id:'cargo-pnc-003',name:'목재 포장 화물',x:-5.1,z:-55.1,yaw:-.18,carrierId:null,delivered:false}
];
const delayByCall = new Map();
const cargoEvents = [];
let calls = [
  { id:'demo-pnc-001', terminal:'pnc', name:'ATD 부산항 연습선', voy:'DEMO-001', outboundVoy:'DEMO-001', inboundVoy:'DEMO-001', carrierVoy:'DEMO-001', berth:'연습 부두', berthPhase:'alongside', etd:null, etb:null, atd:null, atdVerified:false, isDemo:true },
  { id:'demo-pnit-001', terminal:'pnit', name:'ATD 북항 연습선', voy:'DEMO-002', outboundVoy:'DEMO-002', inboundVoy:'DEMO-002', carrierVoy:'DEMO-002', berth:'연습 부두', berthPhase:'alongside', etd:null, etb:null, atd:null, atdVerified:false, isDemo:true }
];

const PNC_BERTH_URL='https://svc.pncport.com/info/CMS/Ship/Info.pnc?mCode=MN014';
const PNC_CACHE_MS=2*60*1000;
let pncCache={checkedAt:0,calls:[],source:{kind:'demo',stale:true,label:'공식 자료 연결 전'}};
let pncRefresh=null;

function decodeHtml(value){
  return String(value??'').replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function cellText(html){
  return decodeHtml(String(html??'').replace(/<br\s*\/?\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).trim();
}
function pncDate(value){
  const s=String(value??'').trim();
  if(!s||s==='-'||s==='N/A')return null;
  if(/^20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s))return new Date(s.replace(' ','T')+':00+09:00').toISOString();
  const d=new Date(s);
  return Number.isNaN(d.getTime())?null:d.toISOString();
}
function normalizePncCalls(rawCalls){
  const checkedAt=new Date().toISOString();
  return rawCalls.map((c)=>{
    const loading=c.loading||{};
    const terminalVoy=String(c.terminalVoy||c.voy||'').trim();
    const code=(terminalVoy.split('/')[0]||terminalVoy).trim();
    const year=(terminalVoy.match(/(20\d{2})/)||[])[1]||String(new Date().getFullYear());
    const carrier=String(c.carrierVoy||c.voy||'').split('/');
    const etb=c.etb||null,etd=c.etd||null;
    return {
      ...c,id:c.id||'official.busan.pnc.'+code+'.'+year,terminal:'pnc',port:'busan',
      name:String(c.name||'').trim(),voy:c.outboundVoy||carrier[1]||carrier[0]||code,
      carrierVoy:c.carrierVoy||c.voy||'',terminalVoy,inboundVoy:c.inboundVoy||carrier[0]||'',
      outboundVoy:c.outboundVoy||carrier[1]||carrier[0]||'',berth:c.berth||'미정',
      etb,etd,atb:c.atb||null,atd:c.atd||null,atdVerified:!!c.atdVerified,
      berthPhase:c.berthPhase||'scheduled',rawStatus:c.rawStatus||'예정',
      status:c.status||'접안 예정',isDemo:false,
      loading:{...loading,plan:loading.plan??null,workTotal:loading.workTotal??null,
        completed:loading.completed??null,remainingVan:loading.remainingVan??null,
        remainingMoves:loading.remainingMoves??null},
      source:c.source||'부산신항만 PNC 선석배정현황',
      sourceUrl:c.sourceUrl||PNC_BERTH_URL,updatedAt:c.updatedAt||null,
      checkedAt:c.checkedAt||checkedAt
    };
  }).filter(c=>c.name&&c.terminalVoy);
}
function parsePncSchedule(payload){
  const source=String(payload??'').trim();
  // API/중계 응답이 calls 배열 JSON으로 오는 경우 원본 필드를 보존한다.
  const jsonStart=source.indexOf('{');
  if(jsonStart>=0){
    try{
      const parsed=JSON.parse(source.slice(jsonStart));
      const rows=Array.isArray(parsed)?parsed:parsed.calls;
      if(Array.isArray(rows)&&rows.length)return normalizePncCalls(rows);
    }catch{}
  }
  // PNC MN014 실제 표는 No.부터 업데이트 일시까지 17개 열로 제공된다.
  // td 개수/첫 열의 태그 형태가 바뀌어도 모선코드(예: ANEM-003/2026)를 기준으로 찾는다.
  const htmlRows=[...source.matchAll(/<tr\\b[^>]*>([\\s\\S]*?)<\\/tr>/gi)];
  const found=[];
  for(const row of htmlRows){
    const cells=[...row[1].matchAll(/<t[dh]\\b[^>]*>([\\s\\S]*?)<\\/t[dh]>/gi)].map(m=>cellText(m[1]));
    const codeIndex=cells.findIndex(v=>/^[A-Z0-9-]+\\s*\\/\\s*20\\d{2}$/i.test(v));
    if(codeIndex<1)continue;
    const name=cells[codeIndex-1]||'';
    const terminalVoy=cells[codeIndex]||'';
    const carrierVoy=cells[codeIndex+1]||'';
    const operator=cells[codeIndex+2]||'';
    const route=cells[codeIndex+3]||'';
    if(!name||!carrierVoy)continue;
    const [inboundVoy='',outboundVoy='']=carrierVoy.split('/').map(v=>v.trim());
    const etb=pncDate(cells[codeIndex+5]);
    const etd=pncDate(cells[codeIndex+6]);
    const terminalCode=terminalVoy.split('/')[0].trim();
    const year=(terminalVoy.match(/20\\d{2}/)||[])[0];
    const discharge=Number(String(cells[codeIndex+9]||'').replace(/,/g,''))||0;
    const load=Number(String(cells[codeIndex+10]||'').replace(/,/g,''))||0;
    const berth=cells[codeIndex+7]||'미정';
    const checkedAt=new Date().toISOString();
    found.push({
      id:'official.busan.pnc.'+terminalCode+'.'+year,name,voy:outboundVoy||inboundVoy,
      carrierVoy,terminalVoy,inboundVoy,outboundVoy,operator,route,port:'busan',terminal:'pnc',
      berth,loading:{plan:load,workTotal:null,completed:null,remainingVan:null,
        remainingMoves:null,workUnit:null,completedUnit:null,
        planSourceUrl:PNC_BERTH_URL,workSourceUrl:null,checkedAt,workCheckedAt:null},
      eta:null,etb,atb:null,etd,atd:null,atdVerified:false,berthPhase:'scheduled',
      rawStatus:'예정',status:'접안 예정',isDemo:false,
      source:'부산신항만 PNC 선석배정현황',sourceUrl:PNC_BERTH_URL,
      updatedAt:pncDate(cells[codeIndex+14]),checkedAt,atbSourceUrl:null
    });
  }
  const unique=[...new Map(found.map(c=>[c.id,c])).values()];
  if(unique.length)return unique;
  // 일부 응답은 태그 대신 표의 텍스트만 포함하므로 행 텍스트도 보조로 검사한다.
  const text=cellText(source.replace(/<\\/(?:tr|td|th|div|p)>/gi,'\\n'));
  const lines=text.split(/\\n+/).map(v=>v.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
    const match=lines[i].match(/^(.+?)\\s+([A-Z0-9-]+\\/20\\d{2})\\s+([A-Z0-9/]+)\\s+([A-Z]{2,4})\\s+([A-Z0-9 ]+)\\s+(Port|Star)\\s+(20\\d{2}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2})\\s+(20\\d{2}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2})\\s+(B\\d+)/i);
    if(!match)continue;
    const [,name,terminalVoy,carrierVoy,operator,route,,etbText,etdText,berth]=match;
    const [inboundVoy='',outboundVoy='']=carrierVoy.split('/');
    const terminalCode=terminalVoy.split('/')[0],year=(terminalVoy.match(/20\\d{2}/)||[])[0];
    found.push({id:'official.busan.pnc.'+terminalCode+'.'+year,name,terminal:'pnc',port:'busan',
      terminalVoy,carrierVoy,inboundVoy,outboundVoy,voy:outboundVoy||inboundVoy,operator,route,berth,
      etb:pncDate(etbText),etd:pncDate(etdText),atb:null,atd:null,atdVerified:false,
      berthPhase:'scheduled',rawStatus:'예정',status:'접안 예정',isDemo:false,
      loading:{plan:null,workTotal:null,completed:null,remainingVan:null,remainingMoves:null},
      source:'부산신항만 PNC 선석배정현황',sourceUrl:PNC_BERTH_URL,checkedAt:new Date().toISOString()});
  }
  const fallbackUnique=[...new Map(found.map(c=>[c.id,c])).values()];
  if(!fallbackUnique.length)throw new Error('공식 PNC 페이지 응답에서 선박 표 행을 찾지 못했습니다. 응답 형식 또는 접근 제한을 확인해야 합니다.');
  return fallbackUnique;
}

function pncFallback(){
  return [];
}
function updateCalls(){
  const pnc=pncCache.calls;
  const pnit=calls.filter(c=>c.terminal==='pnit');
  calls=[...pnc,...pnit];
}
async function getPncSchedule(force=false){
  if(!force&&Date.now()-pncCache.checkedAt<PNC_CACHE_MS){updateCalls();return pncCache;}
  if(pncRefresh)return pncRefresh;
  pncRefresh=(async()=>{
    try{
      const response=await fetch(PNC_BERTH_URL,{headers:{
        'User-Agent':'Mozilla/5.0 (compatible; ATD-Harbor/1.0)',
        'Accept':'text/html,application/json;q=0.9,*/*;q=0.8',
        'Referer':'https://svc.pncport.com/info/CMS/Ship/Info.pnc?mCode=MN014'
      },signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('PNC 응답 '+response.status);
      const body=await response.text();
      const parsed=parsePncSchedule(body);
      const checkedAt=new Date().toISOString();
      pncCache={checkedAt:Date.now(),calls:parsed,source:{kind:'official',label:'부산신항 PNC 운영사 공식 선석배정현황',checkedAt,updatedAt:checkedAt,stale:false,partial:false,url:PNC_BERTH_URL}};
    }catch(error){
      console.warn('[PNC schedule] official lookup failed:',error.message);
      const checkedAt=new Date().toISOString();
      pncCache={...pncCache,checkedAt:Date.now(),source:{
        kind:pncCache.calls.length?'official':'unavailable',
        label:pncCache.calls.length?'공식 자료 갱신 지연 · 마지막 수신 자료':'PNC 공식 자료 연결 실패',
        checkedAt,updatedAt:pncCache.source?.updatedAt||null,
        stale:true,partial:false,error:'공식 PNC 자료를 새로 가져오지 못했습니다.'
      }};
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
  const requested=url.searchParams.get('call');
  const selected=terminalCalls.find(c=>!requested||c.id===requested)||terminalCalls[0]||null;
  const terminalStatus={calls:terminalCalls.map(c=>({...c,delayDays:delayByCall.get(c.id)||0})),yardTrucks:[],source,
    delayDays:selected?(delayByCall.get(selected.id)||0):0,
    delayEvents:selected?cargoEvents.filter(e=>e.callId===selected.id).slice(-4).reverse():[]};
  const peers=[...presence.values()].filter(p=>p.terminal===terminal);
  return {profile:session.profile?profileFor(session):null,selected,terminal,terminals:[{id:'pnc',name:'부산신항'},{id:'pnit',name:'부산북항'}],calls:terminalCalls,terminalStatus,room:selected?roomFor(session,selected.id):{participants:0,pushes:0,pulls:0,peers:[],recent:[]},wishes:wishes.filter(w=>w.callId===selected?.id),nearby:[],changes:[],confirmedDepartures:[],weather:{code:'clear'},source,online:peers.length+1};
}
function stateForCallId(url){return url.searchParams.get('call')||calls.find(c=>c.terminal===(url.searchParams.get('terminal')||'pnc'))?.id||'';}
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
      const rows=calls.filter(c=>c.terminal===terminal).map(c=>({...c,delayDays:delayByCall.get(c.id)||0}));
      return json(res,200,{terminal,calls:rows,yardTrucks:[],source,delayDays:rows.length?(delayByCall.get(rows[0].id)||0):0,delayEvents:cargoEvents.filter(e=>rows.some(c=>c.id===e.callId)).slice(-4).reverse()});
    }
    if(req.method==='GET' && route==='cargo'){
      const callId=url.searchParams.get('call')||stateForCallId(url);
      return json(res,200,{selfId:session.id,items:cargoItems.filter(v=>!v.delivered),delayDays:delayByCall.get(callId)||0,events:cargoEvents.filter(e=>e.callId===callId).slice(-8).reverse()});
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
      if(route==='cargo'){
        const item=cargoItems.find(v=>v.id===body.itemId&&!v.delivered);
        if(!item)return json(res,404,{error:'화물을 찾을 수 없습니다.'});
        const callId=String(body.callId||'');
        if(!calls.some(c=>c.id===callId)){
          await getPncSchedule();
          if(!calls.some(c=>c.id===callId))return json(res,404,{error:'모선을 먼저 선택해 주세요.'});
        }
        if(body.mode==='pickup'){
          if(item.carrierId&&item.carrierId!==session.id)return json(res,409,{error:'다른 작업자가 이미 운반 중인 화물입니다.'});
          item.carrierId=session.id;
        }else if(body.mode==='drop'){
          if(item.carrierId!==session.id)return json(res,409,{error:'현재 들고 있는 화물이 아닙니다.'});
          const x=Number(body.x),z=Number(body.z);
          if(!Number.isFinite(x)||!Number.isFinite(z))return json(res,400,{error:'내려놓을 위치가 올바르지 않습니다.'});
          item.carrierId=null;item.x=x;item.z=z;
          const delivered=Math.hypot(x-10.8,z-5)<=4.5;
          item.delivered=delivered;
          const deltaDays=delivered?-1:1;
          const total=(delayByCall.get(callId)||0)+deltaDays;
          delayByCall.set(callId,total);
          const event={id:randomUUID(),callId,itemId:item.id,itemName:item.name,actor:profileFor(session).name,
            mode:'delivery',delivered,deltaDays,totalDays:total,createdAt:new Date().toISOString()};
          cargoEvents.push(event);if(cargoEvents.length>300)cargoEvents.shift();
        }else return json(res,400,{error:'지원하지 않는 화물 작업입니다.'});
        return json(res,200,{selfId:session.id,items:cargoItems.filter(v=>!v.delivered),delayDays:delayByCall.get(callId)||0,
          events:cargoEvents.filter(e=>e.callId===callId).slice(-8).reverse(),
          message:body.mode==='pickup'?'화물을 들었습니다. 출항 부두에 내려놓으면 지연이 1일 줄어듭니다.':item.delivered?'선적 완료! 출항 지연이 1일 줄었습니다.':'화물을 지정 선적 구역 밖에 내려놓아 지연이 1일 늘었습니다.'});
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
        return json(res,200,{selfId,selfName:entry.name,serverTime:Date.now(),online:peers.length,
          cargoItems:cargoItems.filter(v=>!v.delivered),
          peers:peers.filter(p=>p.selfId!==selfId).map(p=>({id:p.selfId,avatarId:p.selfId,name:p.name,style:p.style,x:p.x||0,y:p.y||0,z:p.z||0,yaw:p.yaw||0,motion:p.motion||'idle',cargoId:p.cargoId||null,actionId:p.actionId||null,updatedAt:p.seenAt}))});
      }
    }
    return json(res,404,{error:'지원하지 않는 API입니다.'});
  }catch(error){console.error(error);return json(res,400,{error:'요청을 처리하지 못했습니다.'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log('ATD Harbor server listening on '+PORT));
