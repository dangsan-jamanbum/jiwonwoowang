import {quantity,loadingState} from './terminal-marquee.js';
const node = (tag, cls, text) => {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== undefined) element.textContent = String(text);
  return element;
};
const button = (label, cls, click) => {
  const item = node('button', cls, label);
  item.type = 'button';
  if (click) item.addEventListener('click', click);
  return item;
};
function external(label, url) {
  let target; try { target = new URL(url); } catch { return node('span', '', label); }
  if (target.protocol !== 'https:') return node('span', '', label);
  const link = node('a', '', label);
  Object.assign(link, {href:target.href, target:'_blank', rel:'noopener noreferrer'});
  return link;
}
const terminalLabel = (id, state) => state.terminals?.find(t => t.id === id)?.name || String(id || '').toUpperCase();
const voyage = call => [call?.name, call?.voy].filter(Boolean).join(' ');
function kstDate(iso) {
  const stamp = Date.parse(iso);
  return Number.isFinite(stamp) ? new Date(stamp + 32400000).toISOString().slice(0,10) : '';
}
const slots = {eta:'입항 예정',etb:'접안 예정',atb:'실제 접안',etd:'출항 예정',atd:'실제 출항'};
const fail = (ctx, e) => ctx.toast?.(e?.message || '불러오지 못했어요. 다시 시도해 주세요.');
function metric(label, value, title) {
  const el=node('div');
  el.append(node('small','',label),node('b','',value));
  if(title) el.title=title;
  return el;
}
function sourceLine(state, ctx) {
  const el = node('p','sourceline'), source = state.source || {};
  let line = source.kind==='demo' ? '체험 시간표 · 표시한 일정은 예시입니다.' : (source.label || '운항 정보');
  if(source.updatedAt) line += ' · 원문 갱신 '+ctx.fmt(source.updatedAt)+' KST';
  if(source.checkedAt) line += ' · 확인 '+ctx.fmt(source.checkedAt)+' KST';
  if(source.stale) line += ' · 최근 수신 데이터';
  el.append(document.createTextNode(line));
  const official = state.officialSource || (source.url ? source : null);
  if(official?.url) el.append(document.createTextNode(' · '),external('터미널 공식 시간표',official.url));
  const ws = state.weather;
  el.append(node('br'),document.createTextNode(ws? ('부산신항 '+ws.label+' '+ws.temperature+'°C · '+ctx.fmt(ws.validAt)+' 예보 · '):'기상청 예보 미연결'));
  if(ws?.sourceUrl) el.append(external(ws.source || '기상청',ws.sourceUrl));
  return el;
}
function scheduleTable(cb, sort) {
  const table=node('table','schedules'), head=table.createTHead().insertRow();
  ['모선 / 항차',sort==='eta'?'ETA':'ETB','ETD'].forEach(label=>{const th=node('th','',label);th.scope='col';head.append(th);});
  const body=table.createTBody();
  return {table, add(call,selected,ctx) {
    const row=body.insertRow(); if(selected) row.className='selected';
    const cell=row.insertCell(), choose=button(call.name,'',()=>cb(call));
    choose.setAttribute('aria-label',voyage(call)+' 선택');
    cell.append(choose,node('small','',[call.voy,call.terminal.toUpperCase(),call.isDemo?'예시':''].filter(Boolean).join(' · ')));
    for (const key of [sort==='eta'?'eta':'etb','etd']) row.insertCell().textContent=ctx.fmt(call[key]);
  }};
}
async function action(ctx, btn, fn) {
  if(btn.disabled) return;
  btn.disabled=true;
  try { return await fn(); }
  catch(e) { fail(ctx,e); }
  finally { if(btn.isConnected) btn.disabled=false; }
}

export function renderControl(container,ctx) {
  const root=node('section','panel-pad');
  const search=node('form','searchline'), input=node('input','searchbox');
  Object.assign(input,{type:'search',placeholder:'선박명 또는 선박명 + 항차',maxLength:120,autocomplete:'off'});
  input.setAttribute('aria-label','부산항 전체 터미널에서 모선 찾기');
  const submit=node('button','navy-btn','검색');submit.type='submit';search.append(input,submit);
  const filters=node('div','filterbar'), terminal=node('select'), sort=node('select');
  terminal.setAttribute('aria-label','터미널'); sort.setAttribute('aria-label','일정 기준');
  [['etd','출항 예정순 · ETD'],['etb','접안 예정순 · ETB'],['eta','입항 예정순 · ETA']].forEach(([id,title])=>sort.append(new Option(title,id)));
  const bookmarks=button('☆ 즐겨찾기','pick'), more=button('날짜 선택','pick');
  const left=node('div','pick-row'), right=node('div','pick-row');
  left.append(terminal,sort);right.append(bookmarks,more,button('선적 현황판','pick',()=>ctx.open('board')));filters.append(left,right);
  const dates=node('div','pick-row'), date=node('input','searchbox');
  date.type='date';date.setAttribute('aria-label','한국 시간 기준 일정 날짜');
  dates.hidden=true;dates.style.display='none';dates.append(date,button('날짜 해제','pick',()=>{date.value='';paint(true);}));
  const hint=node('p','sourceline');hint.style.margin='7px 0';hint.setAttribute('aria-live','polite');
  const schedule=node('div','tablewrap'),details=node('div'),footer=node('div');
  const together=node('p','sourceline','선명과 항차는 내 화면에만 표시됩니다. 모선이 달라도 부산항 공동 부두에서 함께 응원해요.');
  root.append(together,search,filters,dates,hint,schedule,details,footer);container.replaceChildren(root);
  let closed=false, favoritesOnly=false, allResults=[], featured=new Map(), timer=0, request=0, loading=false, error='';
  let prevRows='',prevDetail='',prevSource='',prevTerminals='';
  const missing=new Set();
  function choose(call) {
    if(!call || closed) return;
    Promise.resolve(ctx.selectCall(call.id,call.terminal)).then(async()=>{if(closed)return;await ctx.join();if(!closed)paint(true);}).catch(e=>!closed && fail(ctx,e));
  }
  function resolveFavorites(state) {
    const ids=state.profile?.favorites || [];
    for(const id of ids) {
      if(featured.has(id) || missing.has(id)) continue;
      missing.add(id);
      ctx.api('state?call='+encodeURIComponent(id)).then(list=>{
        if(closed) return;
        if(list.selected?.id===id) featured.set(id,list.selected);
        paint();
      }).catch(()=>{ if(!closed) missing.delete(id); });
    }
  }
  function showDetail(state) {
    const call=state.selected;
    if(!call) { details.replaceChildren();return; }
    const card=node('section','scheddetail');card.append(node('h3','',voyage(call)));
    const info=node('p','sourceline',[terminalLabel(call.terminal,state),call.berth?call.berth+'번 선석':null,call.atd?'출항 확인':call.status,call.isDemo?'예시 항차':null].filter(Boolean).join(' · '));
    info.style.marginTop='4px';card.append(info);
    const times=node('div','metrics');
    for(const key of ['eta','etb',...(call.atb?['atb']:[]),'etd','atd']) times.append(metric(key.toUpperCase(),ctx.fmt(call[key]),slots[key]));
    card.append(times);
    if(!call.isDemo){
      const w=call.loading||{}, header=node('h4','','선적 현황 · '+loadingState(call)),figures=node('div','metrics');
      for(const [title,value] of [['적하 계획',w.plan],['작업물량',w.workTotal],['완료'+(w.completedUnit?' ('+w.completedUnit+')':''),w.completed],['잔량 (VAN)',w.remainingVan],['잔여 작업 (MOVES)',w.remainingMoves]])figures.append(metric(title,quantity(value)));
      card.append(header,figures);
      if(w.workSourceUrl){
        const note=node('p','sourceline');note.append(external('본선작업현황 원문',w.workSourceUrl));
        if(w.workCheckedAt)note.append(document.createTextNode(' · 확인 '+ctx.fmt(w.workCheckedAt)+' KST'));
        card.append(note);
      }
    }

    if ((call.carrierVoy && call.carrierVoy!==call.voy) || call.terminalVoy) card.append(node('p','sourceline',[call.carrierVoy?'선사 항차 '+call.carrierVoy:'',call.terminalVoy?'터미널 항차 '+call.terminalVoy:''].filter(Boolean).join(' · ')));
    const actions=node('div','row-actions');
    if (!call.atd && call.berthPhase!=='departed') {
      const enter=button('내 모선으로 선택하고 함께 밀기','coral');
      enter.addEventListener('click',()=>action(ctx,enter,async()=>{await ctx.selectCall(call.id,call.terminal);if(await ctx.join())ctx.open('departure');}));
      actions.append(enter);
    }
    const favored=state.profile?.favorites?.includes(call.id);
    const favorite=button(favored?'★ 즐겨찾기 해제':'☆ 즐겨찾기','secondary');favorite.setAttribute('aria-pressed',String(!!favored));
    favorite.addEventListener('click',()=>action(ctx,favorite,async()=>{await ctx.favorite(call.id);paint(true);}));
    actions.append(favorite);card.append(actions);
    if (state.changes?.length) {
      const history=node('details','sourceline'), heading=node('summary','','일정 변경 기록 '+state.changes.length+'건');
      history.append(heading);for (const rev of state.changes) {
        const changes=Object.keys(slots).filter(k=>(rev.previous?.[k] || '')!==(rev.updated?.[k] || ''));
        history.append(node('p','',ctx.fmt(rev.changedAt)+' · '+changes.map(k=>k.toUpperCase()+' '+ctx.fmt(rev.previous[k])+' → '+ctx.fmt(rev.updated[k])).join(' / ')));
      }card.append(history);
    }
    details.replaceChildren(card);
  }
  function paint(force=false) {
    if(closed) return;
    const state=ctx.getState() || {}, q=input.value.trim(), ids=state.profile?.favorites || [];
    const termsKey=JSON.stringify(state.terminals || []);
    if(termsKey!==prevTerminals || !terminal.options.length) {
      prevTerminals=termsKey;terminal.replaceChildren();
      for(const t of (state.terminals || [])) terminal.append(new Option(t.name,t.id));
      terminal.append(new Option('부산항 전체','all'));
    }
    terminal.value=q || favoritesOnly?'all':state.terminal || 'pnc';terminal.disabled=!!q || favoritesOnly;
    const allOption=[...terminal.options].find(opt=>opt.value==='all');if(allOption) allOption.hidden=!terminal.disabled;
    bookmarks.setAttribute('aria-pressed',String(favoritesOnly));
    const known=[...(state.calls || []),...allResults,...(state.selected?[state.selected]:[])];
    for(const c of known) featured.set(c.id,c);
    if(favoritesOnly) resolveFavorites(state);
    const currentCalls=new Map((state.calls || []).map(c=>[c.id,c]));
    let calls = q ? allResults.map(c=>currentCalls.get(c.id) || c) : favoritesOnly ? ids.map(id=>currentCalls.get(id) || featured.get(id)).filter(Boolean) : state.calls || [];
    if(favoritesOnly&&q) calls=calls.filter(c=>ids.includes(c.id));
    if(date.value) calls=calls.filter(c=>kstDate(c[sort.value])===date.value);
    calls=[...calls].sort((a,b)=>String(a[sort.value] || '9999').localeCompare(String(b[sort.value] || '9999')));
    hint.textContent=loading?'부산항 터미널을 검색하고 있어요…':error || (q?'부산항 전체 검색':favoritesOnly?'저장한 모선':'앞으로 12일')+' · '+calls.length+'척 · 한국 시간(KST)';
    const rowsKey=JSON.stringify([calls.map(c=>[c.id,c.name,c.voy,c.etb,c.etd,c.eta,c.participants]),sort.value,state.selected?.id,loading,error,favoritesOnly,q]);
    if(force || rowsKey!==prevRows) {
      prevRows=rowsKey;
      if(calls.length) {
        const t=scheduleTable(choose,sort.value);calls.forEach(c=>t.add(c,c.id===state.selected?.id,ctx));schedule.replaceChildren(t.table);
      } else {
        const text=loading?'검색 중':error?'검색을 다시 시도해 주세요.':favoritesOnly?'이 조건에 맞는 즐겨찾기가 없어요.':q?'일치하는 모선이 없어요. 선박명 일부로 다시 검색해 보세요.':'이 날짜에 표시할 항차가 없어요.';
        schedule.replaceChildren(node('div','empty',text));
      }
    }
    const detailKey=JSON.stringify([state.selected,state.profile?.favorites,state.room?.selfJoined,state.changes]);
    if(force || detailKey!==prevDetail) {prevDetail=detailKey;showDetail(state);}
    const sourceKey=JSON.stringify([state.source,state.weather,state.officialSource]);
    if(force || sourceKey!==prevSource) {prevSource=sourceKey;footer.replaceChildren(sourceLine(state,ctx));}
  }
  async function find() {
    const q=input.value.trim(), seq=++request;
    if (!q) {allResults=[];loading=false;error='';paint();return;}
    loading=true;error='';allResults=[];paint();
    try {
      const found=await ctx.api('search?q='+encodeURIComponent(q));
      if(!closed && seq===request) allResults=found.calls || [];
    } catch(e) {if(!closed && seq===request) error=e?.message || '검색 정보를 불러오지 못했어요.';}
    finally {if(!closed && seq===request) {loading=false;paint();}}
  }
  input.addEventListener('input',()=>{
    clearTimeout(timer);++request;error='';allResults=[];loading=!!input.value.trim();paint();timer=setTimeout(find,220);
  });
  search.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);find();});
  terminal.addEventListener('change',()=>{Promise.resolve(ctx.setTerminal(terminal.value)).then(()=>paint(true)).catch(e=>fail(ctx,e));});
  sort.addEventListener('change',()=>paint(true));
  bookmarks.addEventListener('click',()=>{favoritesOnly=!favoritesOnly;paint(true);});
  more.addEventListener('click',()=>{dates.hidden=!dates.hidden;dates.style.display=dates.hidden?'none':'flex';more.setAttribute('aria-expanded',String(!dates.hidden));if(!dates.hidden) date.focus();});
  more.setAttribute('aria-expanded','false');
  date.addEventListener('input',()=>paint());
  paint(true);
  const cleanup=()=>{closed=true;++request;clearTimeout(timer);};
  cleanup.refresh=paint;return cleanup;
}
