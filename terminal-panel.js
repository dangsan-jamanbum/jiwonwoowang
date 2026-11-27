import {boardData,loadingState,quantity} from './terminal-marquee.js';
const phases={scheduled:'접안 예정',berthed:'접안 중',departed:'출항',unknown:'미확인'};
const make=(tag,value,cls)=>{
  const item=document.createElement(tag);
  if(value!=null)item.textContent=value;
  if(cls)item.className=cls;
  return item;
};
function link(label,url){
  if(typeof url!=='string'||!url.startsWith('https://'))return make('span',label);
  const a=make('a',label);Object.assign(a,{href:url,target:'_blank',rel:'noopener noreferrer'});return a;
}
export function renderTerminalPanel(host,ctx){
  const section=make('section',null,'terminal-detail'),top=make('div',null,'terminal-boardbar'),
    name=make('strong'),terminal=make('select'),meta=make('p',null,'terminal-meta'),
    list=make('div',null,'terminal-roster'),sourceLine=make('p',null,'terminal-meta');
  terminal.setAttribute('aria-label','선적 현황 터미널');
  for(const port of ctx.getState().terminals||[])terminal.add(new Option(port.name,port.id));
  terminal.onchange=async()=>{try{await ctx.setTerminal(terminal.value);paint();}catch(error){ctx.toast(error.message);paint();}};
  top.append(name,terminal);section.append(top,meta,list,sourceLine);host.replaceChildren(section);
  let signature='';
  function paint(){
    const state=ctx.getBoardState(),board=boardData(state),data=state.terminalStatus,source=data?.source||{};
    const key=JSON.stringify([state.terminal,source,data?.yardTrucks,board.rows.map(c=>[c.id,c.berth,c.berthPhase,c.etd,c.loading])]);
    if(signature===key)return;signature=key;
    if(!terminal.options.length)for(const port of state.terminals||[])terminal.add(new Option(port.name,port.id));
    name.textContent='선적 현황 · '+board.statusText;terminal.value=state.terminal;
    const stamp=source.checkedAt||source.updatedAt,trucks=data?.yardTrucks;
    meta.textContent=[stamp?'시간표 확인 '+ctx.fmt(stamp)+' KST':'공식 자료 연결 대기',
      Number.isFinite(trucks?.inbound)&&Number.isFinite(trucks?.outbound)?'야드 반입 '+trucks.inbound+'대 · 반출 '+trucks.outbound+'대':null].filter(Boolean).join('  ·  ');
    list.replaceChildren();
    if(board.rows.length){
      const table=make('table'),head=table.createTHead().insertRow(),body=table.createTBody();
      for(const title of ['모선 / 수출 항차','적하 계획','작업물량','적하 완료','잔량 (VAN)','잔여 작업 (MOVES)','선적 상태','부두 / 일정']){
        const th=make('th',title);th.scope='col';head.append(th);
      }
      for(const c of board.rows){
        const tr=body.insertRow(),v=tr.insertCell(),w=c.loading||{};
        v.append(make('b',c.name),make('small',c.voy||c.terminalVoy||'—'));
        tr.insertCell().textContent=quantity(w.plan);
        tr.insertCell().textContent=quantity(w.workTotal)+(w.workUnit?' '+w.workUnit:'');
        tr.insertCell().textContent=quantity(w.completed)+(w.completedUnit&&w.completed!=null?' '+w.completedUnit:'');
        tr.insertCell().textContent=quantity(w.remainingVan);
        tr.insertCell().textContent=quantity(w.remainingMoves);
        const stateCell=tr.insertCell();stateCell.append(make('b',loadingState(c)));
        if(w.workSourceUrl && w.workCheckedAt){
          const detail=make('small');detail.append(link('원문 · '+ctx.fmt(w.workCheckedAt)+' KST',w.workSourceUrl));stateCell.append(detail);
        }
        const berth=tr.insertCell();berth.append(make('span',[c.berth,phases[c.berthPhase]].filter(Boolean).join(' · ')),
          make('small','ETB '+ctx.fmt(c.etb)+' / ETD '+ctx.fmt(c.etd)));
      }
      list.append(table);
    }else{list.append(make('p',source.kind==='official'?'표시할 선적 자료가 없습니다.':'터미널 공식 선적 자료 수신을 기다립니다.'));}
    sourceLine.replaceChildren();
    if(board.rows.length)sourceLine.append(document.createTextNode('— 미수신 · VAN은 컨테이너 수, MOVES는 작업 횟수입니다. 단위 표기가 없는 수치는 원문 그대로입니다. '));
    if(source.url)sourceLine.append(link('선적 계획 원문',source.url));
    if(source.loadingUrl)sourceLine.append(document.createTextNode(' · '),link('본선작업현황 원문',source.loadingUrl));
  }
  paint();const dispose=()=>{};dispose.refresh=paint;return dispose;
}
