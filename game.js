import {mountHarborChat} from './harbor-chat.js?v=22';
import {sessionHeaders} from './browser-session.js';
import {connectPresence} from './presence-client.js?v=23';
import {mountConversations} from './conversations.js?v=19';
import {renderShrine} from './shrine.js';
import {renderControl} from './control.js?v=23';
import {renderTerminalPanel} from './terminal-panel.js';
import {ico,hydrateIcons} from './icons.js';
import {crewIdentity,crewPortrait,editCrewProfile} from './crew-profile.js';

const $ = (q,root=document)=>root.querySelector(q);
const dialog=$('#panel'), body=$('#panel-content');
const text = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'});
const clockFmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const fmt=v=>{if(!v||!Number.isFinite(Date.parse(v)))return '—';const p=Object.fromEntries(dt.formatToParts(new Date(v)).map(x=>[x.type,x.value]));return p.month+'.'+p.day+' '+p.hour+':'+p.minute;};
function clock(){ $('#kst').innerHTML=clockFmt.format(new Date())+' <small>KST</small>'; }
clock(); setInterval(clock,10000);hydrateIcons();
const empty={profile:null,selected:null,terminal:'pnc',terminals:[],calls:[],room:{participants:0,pushes:0,pulls:0,peers:[],recent:[]},wishes:[],nearby:[],changes:[],source:{}};
let state=empty, active='', cleanup=null, sound=false, audio, toastTimer, serial=0,mode='push', lastFocus=null, guestRequest=null;
const entry=new URLSearchParams(location.search);
let selectedId=entry.get('call')||'',terminal=['pnc','pnit'].includes(entry.get('terminal'))?entry.get('terminal'):'',pendingRefresh=null;
let invocationCallId='',pendingInvocation=null;
try{invocationCallId||=localStorage.getItem('atd.own-call')||'';if(!selectedId&&invocationCallId)selectedId=invocationCallId;}catch{}
let hasSession=false,presence=null,selfAvatarId=null,recentGesture=null,previousTerminal=null;
try{sound=localStorage.getItem('atd.sound')==='on';}catch{}
let world=null, worldReady=null, playing=false, nearby=null, actionBusy=false, dockAnimating=false, lastVictory='', lookToken=0;
let scheduleFailed=false, dockLog=null, shrineNearby=null,seatState={seated:false,available:false};
const app=$('#harbor-app'), loading=$('#loading'), hud=$('#walk-hud');
const places={departure:['출항 부두','','hand'],arrival:['수입 부두','모선 당기기','anchor'],shrine:['기원 신전','출항 삼창','star'],control:['선적 안내소','선적 안내 듣기','radar'],departureOffice:['출항 공표소','출항 공표 듣기','radio'],eomuk:['부산 어묵','어묵 먹기','coffee'],shark:['북항이','낚시 / 상어 줍기','focus'],smoking:['흡연 구역','담배 피우기','bench'],yard:['컨테이너 야드','','containers']};
const dialogue=mountConversations($('#dialogue-host'),{getState:()=>state,onOpen:(zone,options)=>zone==='shrine'?cheerGuardian(options?.initialGuardian):openPanel(zone,null,options),onClose:()=>{renderHud();focusWorld();}});
let chatTerminal=null;
const openingMessages=[];
function showChat(message,mine){
  if(message.terminal!==chatTerminal)return;
  if(world?.available){world.sayChat?.(message.avatarId,message.text,mine||selfAvatarId===message.avatarId);return;}
  if(openingMessages.length>=64)openingMessages.shift();
  openingMessages.push({message,mine});
}
const chat=mountHarborChat(hud,{api,onClose:focusWorld,onMessage:showChat});
function setChatTerminal(id){
  id='busan';
  if(chatTerminal!==id){openingMessages.length=0;chatTerminal=id;}
  chat.setTerminal(id);
}
setChatTerminal('busan');
function focusWorld(){if(playing&&!dialog.open)$('#world canvas[tabindex], #world [tabindex]')?.focus({preventScroll:true});}
function dockMode(id){return id==='arrival'?'pull':id==='departure'?'push':null;}
function dockCall(kind){
  if(scheduleFailed || state.source?.stale || !hasSession || (terminal && terminal!==state.terminal))return null;
  return kind==='pull'||kind==='push'?invocationCall():null;
}
function callName(call,kind){const voy=kind==='pull'?call.inboundVoy:call.outboundVoy;return [call.name,voy||call.voy||call.carrierVoy||call.terminalVoy].filter(Boolean).join(' ');}
function timing(call,kind){return call.atd?'ATD '+fmt(call.atd):kind==='pull'?'ETB '+fmt(call.etb):'ETD '+fmt(call.etd);}
function setNearby(id){
  if(nearby!==id){
    dialogue.hide();nearby=id;presence?.wake();
    const next=dockMode(id);
    if(next&&mode!==next){
      if(next==='pull'&&!selectedId&&state.selected)selectedId=state.selected.id;
      mode=next;refresh().catch(()=>{});
    }
  }
  renderHud();
}
function shrineDirection(){return mode==='pull'?'import':'export';}
function shrineGuardian(){
  if(shrineNearby?.kind==='guardian'||shrineNearby?.kind==='court')return shrineNearby.id||'yi';
  if(shrineNearby?.kind==='wish')return shrineNearby.id==='left'?'poseidon':'njord';
  return 'yi';
}
function personalCall(){
  const call=state.selected;
  return call?.id===invocationCallId && call.terminal===state.terminal && (!terminal||call.terminal===terminal)?call:null;
}
function invocationCall(){
  const call=personalCall();
  return call&&!call.atd&&call.berthPhase!=='departed'?call:null;
}
function shrineCallLabel(call){
  if(call.inboundVoy && call.outboundVoy && call.inboundVoy!==call.outboundVoy){
    return call.name+' · 입항 '+call.inboundVoy+' / 출항 '+call.outboundVoy;
  }
  return callName(call,mode);
}
function renderHud(){
  const item=places[nearby], kind=dockMode(nearby), call=kind?dockCall(kind):state.selected;
  let title='내 모선 찾기',schedule='모선 관제소',detail='';
  if(kind){
    title='내 모선 선택';
    schedule='부산항 공동 부두';
    detail='내 모선을 선택하고 모두와 같은 배를 응원해요.';
  }
  if(call){
    title=callName(call,kind);
    schedule=(call.isDemo?'예시 일정':'운항 일정')+' · '+timing(call,kind);
    if(kind==='pull')detail='다른 모선을 기다리는 사람들과 함께 당겨요.';
    if(kind==='push')detail='선체를 누르거나 가까이 걸어가세요.';
  }
  if(scheduleFailed){schedule='일정 연결 대기';detail='터미널 일정에 연결할 수 없어요.';}
  else if(!hasSession||(terminal&&terminal!==state.terminal)){schedule='일정 확인 중';detail='터미널 일정을 확인하고 있어요.';}
  else if(kind&&state.source?.stale){schedule='최신 일정 확인 대기';detail='터미널의 최신 접안 상태를 기다리고 있어요.';}
  $('#hud-vessel').textContent=title;$('#hud-schedule').textContent=schedule;
  const busy=cheerInFlight||Boolean(activeCheer&&activeCheer.until>Date.now());
  const atShrine=Boolean(shrineNearby)||nearby==='shrine'||busy;
  const own=atShrine?invocationCall():null,direction=shrineDirection();
  $('#context-action').classList.toggle('off',(!kind&&!item?.[1]&&!atShrine)||dialogue.isOpen()||!!dialog.open);
  $('#interact').hidden=atShrine?false:!item?.[1]||(kind==='pull'&&!call);
  $('#interact').disabled=atShrine?busy:actionBusy||dockAnimating;
  const actionLabel=atShrine?(direction==='import'?'입항 삼창':'출항 삼창'):item?.[1]||'';
  const iconOnly=!atShrine&&(nearby==='smoking'||nearby==='eomuk');
  $('#interact').setAttribute('aria-label',actionLabel);
  $('#interact').dataset.iconOnly=String(iconOnly);
  $('#interact-label').textContent=actionLabel;
  $('#interact-label').hidden=iconOnly;
  $('#interact-key').hidden=iconOnly;
  $('#smoke-icon').hidden=!iconOnly||nearby!=='smoking';
  $('#eomuk-icon').hidden=!iconOnly||nearby!=='eomuk';
  $('#shrine-alternate').hidden=!atShrine;
  $('#shrine-alternate').disabled=busy;
  $('#shrine-alternate').textContent=direction==='import'?'출항 삼창':'입항 삼창';
  $('#shrine-shortcuts').hidden=!atShrine||busy;
  $('#loc-detail').textContent=atShrine?(cheerStage||(own?'내 모선 · '+shrineCallLabel(own):'삼창할 내 모선을 먼저 선택해 주세요.')):kind?detail:'';
  $('#quay-details').hidden=!kind||!call;
  const seat=$('#seat-toggle');
  if(seat){seat.hidden=!(seatState.seated||seatState.available)||!!dialog.open;seat.textContent=seatState.seated?'일어나기':'벤치에 앉기';seat.disabled=actionBusy||dockAnimating||busy;}
}
async function ensureWorld(){
 if(world)return world;if(worldReady)return worldReady;
 worldReady=(async()=>{
  const cargoState=await api('cargo?call='+encodeURIComponent(state.selected?.id||''));
  if(cargoState.selfId)selfAvatarId=cargoState.selfId;
  const m=await import('./walk3d.js?v=33');
  world=m.mountWalk3D($('#world'),{
    profile:state.profile||{name:'나',style:'cardigan'},active:true,onHint:toast,
    cargoItems:cargoState.items||[],cargoSelfId:cargoState.selfId,
    onFishCaught:()=>{api('fishing',{mode:'caught'}).catch(()=>{});},
    onFishCooked:()=>{api('fishing',{mode:'cooked'}).catch(()=>{});},
     onFishEaten:()=>{api('fishing',{mode:'eaten'}).catch(()=>{});},
    onCargoAction:async(mode,itemId,position)=>{
      const call=state.selected;
      if(!call)throw new Error('먼저 운반할 모선을 선택해 주세요.');
      const result=await api('cargo',{mode,itemId,callId:call.id,x:position.x,z:position.z});
      selfAvatarId=result.selfId||selfAvatarId;
      world?.setCargo?.(result.items,result.selfId);
      if(mode==='drop')toast(result.message+' (출항 지연 '+(result.delayDays>0?'+':'')+result.delayDays+'일)');
      return result;
    },
    onNearby:setNearby,
    getSelfId:()=>selfAvatarId,
    onSeatChange:next=>{seatState=next;presence?.wake();renderHud();},
    onDepartureAnnouncement:speakDeparture,
    onShrineNearby:target=>{shrineNearby=target;renderHud();},
    onShrineInteraction:(kind,id)=>{
      if(!playing||dialog.open)return;
      if(kind==='wish')openPanel('shrine',null,{focus:'wall',wallSide:id});
      else if(kind==='guardian'){if(dialogue.show('shrine',id))renderHud();}
    },
    onTerminalBoard:()=>openPanel('board'),
    onCheerEnd:()=>{activeCheer=null;presence?.wake();renderHud();},
    onOwnCheerBeat:speakCheer,
    onDockContact:performWorldAction,
    onDockGestureEnd:finishDockGesture,
    onZone:id=>{if(playing&&!dialog.open)encounter(id);}
  });
  if(!world?.available)throw Error('3D renderer unavailable');
  updateBase();for(const {message,mine} of openingMessages.splice(0))showChat(message,mine);return world;
 })().catch(e=>{worldReady=null;throw e;});return worldReady;
}
async function startWalking(){
 const retry=$('#retry-world');retry.hidden=true;
 try{
  await ensureWorld();playing=true;app.dataset.playing='true';loading.hidden=true;hud.hidden=false;
  world.setActive(!dialog.open);startPresence();renderHud();focusWorld();return true;
 }catch(error){
  console.error('Busan harbor startup',error);
  $('#loading-status').textContent='터미널을 불러오지 못했어요.';retry.hidden=false;return false;
 }
}
$('#retry-world').onclick=startWalking;
async function travel(id){
 if(!places[id])return;const token=++lookToken;dialogue.hide();if(dialog.open)close();
 if(!playing&&!(await startWalking()))return;if(token!==lookToken)return;
 world.setActive?.(true);
 try{const r=await world.goTo(id,false);if(token!==lookToken||!r?.arrived||!playing||dialog.open)return;
 setNearby(id);if(id==='control')encounter(id);else focusWorld();}
 catch(e){toast('산책로를 다시 선택해 주세요.');}
}
function encounter(id=nearby){
 if(!playing||dialog.open)return;
 if(id==='shark'){
   world?.watchShark?.();focusWorld();return;
 }
 if(id==='eomuk'){
   if(world?.interactSharkAtStall?.()){focusWorld();return;}
   if(world?.eatFishcake?.())presence?.wake();
   focusWorld();return;
 }
 if(id==='departureOffice'){
   if(!world?.replayDeparture?.())toast('실제 출항이 확인된 모선의 공표를 기다리고 있어요.');
   focusWorld();return;
 }
 if(id==='smoking'){
   if(world?.smoke?.())presence?.wake();
   focusWorld();return;
 }
 if(id==='shrine')return;
 if(!id||id==='yard')return;
 if(dockMode(id))return;
 if(dialogue.show(id))renderHud();
}
function open(id){if(['arrival','departure'].includes(id))travel(id);else openPanel(id);}
$('#guide-map').onclick=()=>openPanel('map');
function interact(){
 if(shrineNearby||nearby==='shrine'){cheerGuardian(shrineGuardian());return;}
 if(world?.interactNearShrine?.())return;
 if(nearby==='arrival'){const call=dockCall('pull');if(call)performWorldAction('pull',call.id);return;}
 encounter();
}
$('#interact').onclick=interact;
const seatButton=$('#seat-toggle');
if(seatButton)seatButton.onclick=async()=>{await world?.toggleSeat?.();presence?.wake();focusWorld();};
$('#shrine-alternate').onclick=()=>cheerGuardian(shrineGuardian(),shrineDirection()==='import'?'export':'import');
$('#shrine-write').onclick=()=>goToWish(shrineNearby?.kind==='wish'?shrineNearby.id:world?.getPresence?.()?.x<-5.15?'right':'left');
$('#shrine-talk').onclick=()=>{if(dialogue.show('shrine',shrineGuardian()))renderHud();};
$('#quay-details').onclick=()=>{const kind=dockMode(nearby),call=dockCall(kind);if(call)openDockLog(call,kind);};
function syncSound(){const b=$('#sound');b.innerHTML=ico(sound?'sound':'mute');b.setAttribute('aria-label',sound?'효과음 끄기':'효과음 켜기');b.title=b.getAttribute('aria-label');}
function playSound(id='step'){
  const hz=({pull:220,celebrate:523,wish:440,coffee:347,step:345})[id];
  if(!sound||!hz)return;try{
  audio||=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});
  const osc=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;osc.type='sine';
  osc.frequency.setValueAtTime(hz,t);osc.frequency.exponentialRampToValueAtTime(hz*1.35,t+.14);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.10,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.21);
  osc.connect(g);g.connect(audio.destination);osc.start(t);osc.stop(t+.22);
}catch{}}
function speakCheer(call,beat,direction){
  const speech=window.speechSynthesis;
  if(!sound || !speech || !window.SpeechSynthesisUtterance)return;
  const voice=speech.getVoices().find(v=>v.localService && /^ko([_-]|$)/i.test(v.lang));
  if(!voice)return;
  if(beat===0)speech.cancel();
  const words=new window.SpeechSynthesisUtterance(beat===0?[call.name,call.voy].filter(Boolean).join(' '):direction==='import'?'입항!':'출항!');
  words.voice=voice;words.lang=voice.lang;words.rate=1.12;words.volume=.75;speech.speak(words);
}
function speakDeparture(call){
  const speech=window.speechSynthesis;
  if(!sound||!speech||!window.SpeechSynthesisUtterance)return;
  const voice=speech.getVoices().find(v=>v.localService&&/^ko([_-]|$)/i.test(v.lang));
  if(!voice)return;
  const words=new window.SpeechSynthesisUtterance(callName(call,'push')+'. 출항 확인! 수고하셨습니다.');
  words.voice=voice;words.lang=voice.lang;words.rate=.98;words.volume=.8;speech.speak(words);
}
function toggleSound(){sound=!sound;if(!sound)window.speechSynthesis?.cancel();try{localStorage.setItem('atd.sound',sound?'on':'off');}catch{}syncSound();playSound('step');toast(sound?'효과음을 켰습니다.':'효과음을 껐습니다.');}
syncSound();$('#sound').onclick=toggleSound;
function toast(msg){
  clearTimeout(toastTimer);const out=$('#toast');out.textContent=msg;out.classList.toggle('on',!dialog.open);
  dialog.querySelector('.toast-panel')?.remove();
  if(dialog.open){const e=document.createElement('div');e.className='toast-panel';e.setAttribute('role','status');e.textContent=msg;dialog.append(e);}
  toastTimer=setTimeout(()=>{out.classList.remove('on');dialog.querySelector('.toast-panel')?.remove();},2800);
}
async function api(path, payload){
  const headers=sessionHeaders();
  if(payload!==undefined)headers['Content-Type']='application/json';
  const res=await fetch('/api/'+path,{
    method:payload===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers,
    body:payload===undefined?undefined:JSON.stringify(payload)
  });
  const result=await res.json().catch(()=>({error:'항구 서버에 연결할 수 없습니다.'}));
  if(!res.ok||result.error)throw new Error(result.error||'잠시 후 다시 시도해 주세요.');return result;
}
let boardRequest=0, firstBoard=null;
function getBoardState(){
  return firstBoard?{...state,terminal:firstBoard.terminal,terminalStatus:firstBoard.data}:state;
}
function primeBoard(id){
  const token=++boardRequest;
  firstBoard={terminal:id,data:{calls:[],source:{kind:'unavailable'}}};
  world?.setBoard?.(getBoardState());
  api('terminal-board?terminal='+encodeURIComponent(id)).then(data=>{
    if(token!==boardRequest || !Array.isArray(data.calls) || !data.source)return;
    firstBoard={terminal:id,data};world?.setBoard?.(getBoardState());
    if(active==='board')cleanup?.refresh?.();
  }).catch(()=>{});
}
function terminalName(id){return state.terminals.find(t=>t.id===id)?.name||id?.toUpperCase()||'—';}
function refresh(){const seq=++serial,profileAtRequest=state.profile;const params=new URLSearchParams({mode});if(terminal)params.set('terminal',terminal);if(selectedId)params.set('call',selectedId);
  const req=api('state?'+params).then(res=>{if(seq!==serial)return state;
    const old=state.selected;
    if(state.profile && state.profile!==profileAtRequest)res.profile=state.profile;
    state=res;hasSession=true;++boardRequest;firstBoard=null;scheduleFailed=false;
    if(previousTerminal!==state.terminal){previousTerminal=state.terminal;setChatTerminal(state.terminal);recentGesture=null;presence?.wake();}
    updateBase();cleanup?.refresh?.();
    if(old&&state.selected?.id===old.id&&!old.atd&&state.selected.atdVerified&&state.selected.atd&&!state.selected.isDemo&&state.room.selfJoined){
      if(playing)celebrateConfirmed(state.selected);
    }return state;
    }).catch(err=>{if(seq===serial){scheduleFailed=true;updateBase();}throw err;});
  pendingRefresh=req;req.then(()=>{if(pendingRefresh===req)pendingRefresh=null;},()=>{if(pendingRefresh===req)pendingRefresh=null;});return req;
}
function updateBase(){
 world?.setBoard?.(getBoardState());
 if(Array.isArray(state.confirmedDepartures))world?.setDepartures?.(state.confirmedDepartures,state.terminal);
 world?.setWishes?.(state.selected,state.wishes);
 const p=state.profile, portrait=crewPortrait(p?.style,true);
 const image=$('.my-id img');if(!image.src.endsWith(portrait))image.src=portrait;
 const identity=crewIdentity(p?.style),label=identity.department+' '+identity.name+' · 나의 사원증';
 image.alt=identity.name;$('.my-id').title=label;$('.my-id').setAttribute('aria-label',label);
 world?.setProfile?.(p||{name:'나',style:'cardigan'});world?.setWeather?.(state.weather?.code||null);
 const departure=dockCall('push'),arrival=dockCall('pull');
 world?.bindVessels?.({departure,arrival,personal:personalCall()});
 renderHud();if(active==='log')updateDockLog();
}
function celebrateConfirmed(s){
 if(!s?.atdVerified||!s.atd||s.isDemo||lastVictory===s.id)return;lastVictory=s.id;
 world?.celebrate?.(s);toast('모선이 무사히 출항했습니다.');playSound('celebrate');
}
async function selectCall(id,term){
 selectedId=id;terminal=term||'';updateBase();await refresh();
 const selected=state.selected;
 if(selected?.id!==id){toast('이 항차를 찾을 수 없어요. 모선을 다시 선택해 주세요.');return state;}
 if(pendingInvocation && (selected.atd||selected.berthPhase==='departed')){
   toast('이미 출항한 모선이에요. 삼창할 다른 항차를 선택해 주세요.');return state;
 }
 invocationCallId=id;try{localStorage.setItem('atd.own-call',id);}catch{}
 const u=new URL(location.href);u.searchParams.set('call',id);history.replaceState(null,'',u);updateBase();
 if(pendingInvocation&&dialog.open&&active==='control'){
   const intent=pendingInvocation;pendingInvocation=null;close();
   await cheerGuardian(intent.guardianId,intent.direction);
 }
 return state;
}
async function setTerminal(id){primeBoard(id);selectedId='';invocationCallId='';try{localStorage.removeItem('atd.own-call');}catch{}terminal=id;updateBase();const u=new URL(location.href);u.searchParams.delete('call');history.replaceState(null,'',u);return refresh();}
async function participationProfile(){
  if(state.profile)return state.profile;
  if(!guestRequest){
    // Only an explicit participation action creates a guest card. The server
    // uses the existing browser identity and preserves a concurrently saved name.
    guestRequest=api('guest',{}).then(({profile})=>{
      if(!profile)throw new Error('참여 정보를 불러오지 못했어요.');
      if(!state.profile){state.profile=profile;updateBase();}
      return state.profile;
    }).finally(()=>{guestRequest=null;});
  }
  return guestRequest;
}
async function refreshAfterWrite(){
  // A confirmed write stays successful if the read-back is temporarily offline.
  try{await refresh();}catch{}
}
async function join(){
  const call=state.selected;
  if(!call){toast('모선을 먼저 찾아주세요.');return false;}
  if(call.atd)return false;
  if(state.room.selfJoined)return true;
  await participationProfile();
  if(state.selected?.id!==call.id)return false;
  await api('join',{callId:call.id});await refreshAfterWrite();return state.selected?.id===call.id;
}
async function favorite(id){
  const profile=await participationProfile();
  const value=!profile.favorites?.includes(id);
  await api('favorite',{callId:id,value});await refreshAfterWrite();
  toast(value?'즐겨찾기에 담았습니다.':'즐겨찾기에서 뺐습니다.');return true;
}
async function postWish(note,guardian,side='left',kind='wish'){
  const id=state.selected?.id;if(!id){toast('기원을 남길 모선을 먼저 골라주세요.');return false;}
  if(state.selected.atd)return false;
  try{
    const requestId=crypto.randomUUID();
    await participationProfile();
    await api('wish',{callId:id,text:note,guardian,side,kind,requestId});
    await refreshAfterWrite();return true;
  }catch(err){toast(err.message);return false;}
}
let cheerInFlight=false, activeCheer=null,cheerStage='';
async function cheerGuardian(guardianId=shrineGuardian(),direction=shrineDirection()){
  if(cheerInFlight || activeCheer?.until>Date.now())return false;
  const selected=invocationCall();
  if(!selected){
    pendingInvocation={guardianId,direction};openPanel('control');
    toast(state.selected?.atd||state.selected?.berthPhase==='departed'?'이미 출항한 모선이에요. 삼창할 항차를 골라 주세요.':'삼창할 모선명과 항차를 골라 주세요.');
    return false;
  }
  const scope=++lookToken;
  const canBegin=()=>{
    if(scope!==lookToken||dialog.open)return false;
    if(invocationCall()?.id!==selected.id){toast('내 모선의 상태가 바뀌었어요. 삼창할 항차를 다시 선택해 주세요.');return false;}
    if(!world.canCheerHere()){toast('수호자 앞에서 삼창을 다시 눌러 주세요.');return false;}
    return true;
  };
  cheerInFlight=true;cheerStage='수호자 앞으로 가는 중…';renderHud();
  try{
    dialogue.hide();close();
    if(!playing && !(await startWalking()))return false;
    world.setActive(true);
    if(!await world.approachGuardian(guardianId)){
      if(scope===lookToken&&!dialog.open)toast('수호자 앞으로 가는 길이 끊겼어요. 삼창을 다시 눌러 주세요.');
      return false;
    }
    if(!canBegin())return false;
    cheerStage='모선의 출항 상태를 확인하고 있어요.';renderHud();
    await participationProfile();
    if(!canBegin())return false;
    const requestId=crypto.randomUUID();
    await api('action',{mode:'cheer',callId:selected.id,requestId,direction});
    if(scope!==lookToken||dialog.open||invocationCall()?.id!==selected.id||!world.canCheerHere()){
      if(scope===lookToken&&!dialog.open)toast('기원은 기록됐어요. 수호자 앞에서 다시 삼창할 수 있어요.');
      return false;
    }
    const ritualCall={...selected,voy:(direction==='import'?selected.inboundVoy:selected.outboundVoy)||selected.voy||selected.carrierVoy||selected.terminalVoy};
    if(!await world.cheer(ritualCall,{requestId,guardianId,direction})){
      toast('기원은 기록됐어요. 수호자 앞에서 삼창을 다시 눌러 주세요.');return false;
    }
    activeCheer={id:requestId,callId:selected.id,until:Date.now()+3900};
    presence?.wake();focusWorld();return true;
  }catch(err){toast(err.message||'삼창을 시작하지 못했어요. 다시 눌러 주세요.');return false;}
  finally{cheerInFlight=false;cheerStage='';renderHud();}
}
async function goToWish(side){
  const scope=++lookToken;dialogue.hide();close();
  if(!playing&&!(await startWalking()))return false;
  world.setActive(true);
  if(!await world.goToWish(side)||lookToken!==scope||dialog.open)return false;
  openPanel('shrine',null,{focus:'wall',wallSide:side});return true;
}
const ctx={cheerGuardian,goToWish,getDirection:()=>mode==='pull'?'import':'export',getBoardState,getState:()=>state,api,selectCall,setTerminal,join,favorite,open,close,postWish,playSound,toast,fmt,text};
function dispose(){cleanup?.();cleanup=null;dialog.querySelector('.toast-panel')?.remove();body.replaceChildren();}
function finishClose(){if(dialog.open)return;pendingInvocation=null;dispose();active='';dialog.className='';world?.setActive?.(playing);renderHud();if(playing)focusWorld();else lastFocus?.focus?.({preventScroll:true});lastFocus=null;}
function close(){if(dialog.open)dialog.close();}
dialog.addEventListener('close',finishClose);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
$('#close-panel').onclick=close;
const panels={
 board:['BUSAN NEW PORT','터미널 선적 현황'],
 control:['VESSEL CONTROL','모선 관제소'],shrine:['','컨테이너에 기원문 붙이기'],
 map:['HARBOR MAP','부산항 산책 지도'],log:['VOYAGE LOG','이 모선의 응원 기록'],profile:['','나의 사원증']
};
const accountButton=$('.my-id');
function openPanel(zone,trigger=null,shrineOptions={}){
 if(!panels[zone]||(zone==='profile'&&(!accountButton||trigger!==accountButton)))return;if(zone!=='control')pendingInvocation=null;chat.close();dialogue.hide();world?.setActive?.(false);
 if(!dialog.open)lastFocus=document.activeElement;
 dispose();active=zone;dialog.className=zone==='shrine'?'shrine-dialog':zone==='profile'?'profile-dialog':'';
 $('#panel-kicker').textContent=panels[zone][0];$('#panel-title').textContent=panels[zone][1];
 if(!dialog.open)dialog.showModal();dialog.scrollTop=0;body.className='';
 if(zone==='control'){cleanup=renderControl(body,ctx);}
 if(zone==='board'){cleanup=renderTerminalPanel(body,ctx);}
 if(zone==='shrine'){cleanup=renderShrine(body,ctx,shrineOptions);}
 if(zone==='profile'){cleanup=profile();}
 if(zone==='map')showMap();if(zone==='log')logPanel();renderHud();
 hydrateIcons(body);
 if(['board','control','arrival','departure','shrine'].includes(zone))refresh().catch(e=>toast(e.message));
}
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{
 if(b===accountButton)openPanel('profile',b);else open(b.dataset.open);
}));

function profile(){
  const cleanup=editCrewProfile(body,{
    getProfile:()=>state.profile,
    save:async ({name,style})=>{
      const base=await participationProfile();
      const res=await api('profile',{name:name || base.name,style:style || base.style});
      state.profile=res.profile;
      updateBase();
      presence?.wake();
      refresh().catch(()=>{});
    },
    done:()=>{close();toast('캐릭터 설정을 저장했어요.');},
    showError:toast
  });
  const guide=document.createElement('details');guide.className='profile-guide';
  guide.innerHTML='<summary>'+ico('help')+'게임 도움말</summary><div class="howto">'+
    '<p><b>걷고 둘러보기</b><br>WASD나 방향키로 걷고 화면을 드래그해 둘러보세요. 터치 화면에서는 조이스틱으로 움직이거나 바닥을 눌러 걸어요.</p>'+
    '<p><b>장소 찾기</b><br>나침반이나 M으로 지도를 열어 목적지를 선택하세요. 장소에 도착하면 화면의 행동 버튼이나 E를 눌러요.</p>'+
    '<p><b>모선 찾기</b><br>선박명과 항차로 내 모선을 선택하세요. 예시 일정에는 별도 표시가 붙어요.</p>'+
    '<p><b>배 밀고 당기기</b><br>출항 부두에서는 선체를 누르거나 바짝 다가가 두 손으로 밀어요. 수입 부두에서는 ‘모선 당기기’를 눌러 다음 접안을 응원해요.</p>'+
    '<p><b>신전에서 삼창하기</b><br>수호자 앞에서 ‘입항 삼창’ 또는 ‘출항 삼창’을 누르세요. 모선명과 항차를 먼저 한 번 부르고, 이어서 세 번 만세하며 매번 “입항!” 또는 “출항!”을 외쳐요.</p>'+
    '<button type="button" class="secondary" id="help-sound"></button></div>';
  body.append(guide);
  const soundButton=$('#help-sound');
  const soundLabel=()=>{soundButton.textContent='효과음 '+(sound?'끄기':'켜기');};
  soundLabel();soundButton.onclick=()=>{toggleSound();soundLabel();};
  return cleanup;
}
async function shareCall(){
 const data=logSnapshot(),s=data?.selected;if(!s)return;const r=data.room,url=new URL(location.href);url.searchParams.set('terminal',s.terminal);url.searchParams.set('call',s.id);
 const copy=callName(s,dockLog?.kind)+' | 부산항\n'+(s.isDemo?'예시 일정 · ':'')+timing(s,dockLog?.kind)+' KST\n내 배 밀기 '+r.yourPushes+'회 · 내 모선 당기기 '+r.yourPulls+'회\n같은 배를 탔으니, 함께 밀어 보내는 곳.\n'+url.href;
 try{await navigator.clipboard.writeText(copy);toast('응원 기록과 모선 링크를 복사했습니다.');}catch{
 const ta=document.createElement('textarea');ta.className='share-fallback';ta.value=copy;ta.readOnly=true;ta.setAttribute('aria-label','공유할 응원 기록');body.append(ta);ta.select();toast('응원 문구를 선택했습니다. 복사해서 공유하세요.');}
}
function presenceCallId(){
 if(activeCheer?.until>Date.now())return activeCheer.callId;
 if(recentGesture?.terminal===state.terminal && recentGesture.until>Date.now())return recentGesture.callId;
 const kind=dockMode(nearby);
 return kind?dockCall(kind)?.id||null:state.selected?.id||null;
}
function startPresence(){
 if(presence)return;
 presence=connectPresence({
  getRoom:()=>hasSession?{terminal:state.terminal,callId:presenceCallId()}:null,
  getPose:()=>{
    const pose=world?.getPresence?.();if(!pose)return null;
    if(['smoke','sit','sit-smoke','eat'].includes(pose.motion))return pose;
    if(activeCheer && activeCheer.callId===state.selected?.id && activeCheer.until>Date.now() && pose.motion==='cheer')
      return {...pose,motion:'cheer',actionId:activeCheer.id};
    if(recentGesture?.callId===presenceCallId()&&recentGesture?.until>Date.now()&&pose.motion!=='walk'){
      return {...pose,motion:recentGesture.motion,actionId:recentGesture.actionId};
    }
    return {...pose,style:state.profile?.style||'cardigan',motion:['push','pull'].includes(pose.motion)?'idle':pose.motion,actionId:null};
  },
  onPeers:(rows,serverTime,snapshot)=>{world?.setLivePeers?.(rows,serverTime);if(snapshot?.cargoItems)world?.setCargo?.(snapshot.cargoItems,snapshot.selfId);if(typeof snapshot?.sashimiPlateFull==='boolean')world?.setSashimiPlate?.(snapshot.sashimiPlateFull,!!snapshot.sharkEaten,!!snapshot.sharkCaught);},
  onStatus:status=>{selfAvatarId=status.selfId;}
 });
}
function showMap(){
 const map=Object.entries(places).map(([id,[name,,icon]])=>{
   const point=world?.getZonePosition?.(id);
   if(!point)return '';
   // The chart runs along the waterfront. Its east axis points down the page.
   const left=(288-3.82*point.z)/766*100,top=(156+2.66*point.x)/320*100;
   return '<button class="atlas-pin" style="left:'+left+'%;top:'+top+'%" aria-label="'+name+'까지 걷기" data-travel="'+id+'">'+ico(icon)+'</button>';
 }).join('');
 const lines=Object.entries(places).map(([id,[name,,icon]])=>'<button data-travel="'+id+'">'+ico(icon)+name+'<small>걸어가기</small></button>').join('');
 body.innerHTML='<div class="atlas"><div class="atlas-image">'+map+'</div><div class="atlas-list">'+lines+'</div><div class="row-actions"><button class="secondary" data-menu="control">모선 검색</button><button class="secondary" data-menu="board">선적 현황</button></div></div>';
 body.querySelectorAll('[data-travel]').forEach(b=>b.onclick=()=>travel(b.dataset.travel));
 body.querySelectorAll('[data-menu]').forEach(b=>b.onclick=()=>openPanel(b.dataset.menu));
}
function openDockLog(call,kind){
 dockLog={id:call.id,terminal:call.terminal,kind,data:null,pending:false,error:''};
 openPanel('log');updateDockLog();
}
function logSnapshot(){
 if(!dockLog)return state;
 if(dockLog.id===state.selected?.id&&dockLog.kind===mode)return state;
 return dockLog.data;
}
async function updateDockLog(){
 const target=dockLog;
 if(!target||logSnapshot()===state){logPanel();return;}
 if(target.pending)return;
 target.pending=true;
 try{
   const data=await api('state?'+new URLSearchParams({call:target.id,terminal:target.terminal,mode:target.kind}));
   if(data.selected?.id!==target.id||data.terminal!==target.terminal)throw Error('이 항차의 기록을 찾을 수 없어요.');
   target.data=data;target.error='';
 }catch(e){target.error=e.message;target.data=null;}
 finally{target.pending=false;if(active==='log'&&dockLog===target)logPanel();}
}
function logPanel(){
 const data=logSnapshot(),s=data?.selected,r=data?.room;
 if(!s){body.innerHTML='<div class="panel-pad">'+text(dockLog?.error||'항차의 응원 기록을 확인하고 있어요.')+'</div>';return;}
 body.innerHTML='<div class="panel-pad formstack"><div><h3>'+text(callName(s,dockLog?.kind))+'</h3><p class="sourceline">'+text(terminalName(s.terminal))+' · '+(s.isDemo?'예시 일정':'공식 일정')+' · '+timing(s,dockLog?.kind)+' KST</p></div><div class="metrics"><div><small>내 배 밀기</small><b>'+(r.yourPushes||0)+'회</b></div><div><small>내 모선 당기기</small><b>'+(r.yourPulls||0)+'회</b></div></div>'+'<div class="row-actions"><button id="log-share" class="secondary">'+ico('share')+'응원 기록 복사</button><button id="log-control" class="navy-btn">관제소 열기</button></div></div>';
 $('#log-share').onclick=shareCall;$('#log-control').onclick=()=>openPanel('control');
}
function syncDockButton(){$('#interact').disabled=actionBusy||dockAnimating;}
async function recordGesture({callId,mode,requestId,terminal:callTerminal}){
 await participationProfile();
 if(dockCall(mode)?.id!==callId)return false;
 await api('action',{callId,mode,requestId});
 if(state.terminal===callTerminal){
   recentGesture={callId,terminal:callTerminal,motion:mode,actionId:requestId,until:Date.now()+1600};
   presence?.wake();
 }
 await refreshAfterWrite();return true;
}
function finishDockGesture(){
 dockAnimating=false;syncDockButton();
}
async function performWorldAction(kind,expectedCallId){
 if(!playing || dialog.open || dialogue.isOpen() || actionBusy || dockAnimating)return false;
 const call=dockCall(kind);
 if(!call){if(!personalCall())openPanel('control');return false;}
 if(call.id!==expectedCallId)return false;
 actionBusy=true;syncDockButton();
 try{
   if(!await world.actAtDock(kind))return false;
   dockAnimating=true;
   if(dockCall(kind)?.id!==call.id)return false;
   if(kind==='pull')playSound('pull');
   return await recordGesture({callId:call.id,terminal:call.terminal,mode:kind,requestId:crypto.randomUUID()});
 }catch(e){toast(e.message);await refreshAfterWrite();return false;}
 finally{actionBusy=false;syncDockButton();}
}
window.addEventListener('keydown',e=>{
 if(e.repeat||e.isComposing||e.altKey||e.metaKey||e.ctrlKey||e.defaultPrevented||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
 if(dialog.open)return;
 if(!playing||dialogue.isOpen())return;
 if(e.code==='KeyM'){e.preventDefault();openPanel('map');}
 if(e.code==='KeyE'){
  if(world?.hasCargoInteraction?.()){e.preventDefault();world.interactCargo?.();return;}
  if(shrineNearby||(nearby&&nearby!=='departure')){e.preventDefault();interact();}
 }
});
if(terminal||!selectedId)primeBoard(terminal||'pnc');
startWalking();refresh().catch(()=>{});setInterval(()=>{if(!document.hidden&&!pendingRefresh)refresh().catch(()=>{});},5000);
