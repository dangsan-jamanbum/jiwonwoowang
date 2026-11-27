// The central quay ends at z=-31.35. This wall stands beyond that edge in
// the wider northern forecourt, on the same X axis as the four guardians.
export const TERMINAL_WALL=Object.freeze({x:-5.15,z:-36.4,width:24.4,height:8.4,screenY:5.1,footDepth:1.46});
const wallHalfWidth=(TERMINAL_WALL.width+1.02)/2;
export const TERMINAL_WALL_BOUNDS=Object.freeze({
  minX:TERMINAL_WALL.x-wallHalfWidth,maxX:TERMINAL_WALL.x+wallHalfWidth,
  minZ:TERMINAL_WALL.z-TERMINAL_WALL.footDepth/2,maxZ:TERMINAL_WALL.z+TERMINAL_WALL.footDepth/2,
  top:TERMINAL_WALL.screenY+TERMINAL_WALL.height/2+.38
});
const kst=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function timeLabel(input){
  if(!input || !Number.isFinite(Date.parse(input)))return '—';
  const part=Object.fromEntries(kst.formatToParts(new Date(input)).map(p=>[p.type,p.value]));
  return part.month+'/'+part.day+' '+part.hour+':'+part.minute;
}
const digits=new Intl.NumberFormat('ko-KR');
export const quantity=value=>Number.isSafeInteger(value)&&value>=0?digits.format(value):'—';
export function loadingState(call){
  const w=call.loading||{};
  if(w.remainingVan===0 && (w.workTotal>0 || w.completed>0))return '잔량 0';
  if(w.completed>0 && w.remainingVan>0)return '선적 진행';
  if(w.completed===0 && w.remainingVan>0)return '작업 대기';
  if(Number.isSafeInteger(w.completed)||Number.isSafeInteger(w.remainingVan))return '실적 확인';
  if(Number.isSafeInteger(w.workTotal))return '작업량 확인';
  return Number.isSafeInteger(w.plan)?'계획 확인':'미수신';
}
export function boardData(state={}){
  const terminal=state.terminal||'pnc', status=state.terminalStatus||{},source=status.source||{};
  const official=source.kind==='official',live=official&&!source.stale;
  const statusText=source.partial?'확인본 · 일부 모선':source.stale?'최근 확인본':live?'운영사 공식':'연결 대기';
  const priority=c=>c.berthPhase==='berthed'?0:c.berthPhase==='departed'?2:1;
  const rows=(official?(status.calls||[]):[]).filter(c=>c && c.terminal===terminal && !c.isDemo &&
    (c.berthPhase!=='departed'||c.loading?.workCheckedAt))
    .sort((a,b)=>priority(a)-priority(b)||String(a.etb||'~').localeCompare(String(b.etb||'~')));
  return {terminal,source:source.label||'',last:timeLabel(source.checkedAt||source.updatedAt),statusText,live,
    rows,trucks:status.yardTrucks||null};
}
export function mountTerminalMarquee(T,scene,renderer){
  const group=new T.Group();group.name='항만 운영 전광판';scene.add(group);
  group.position.set(TERMINAL_WALL.x,0,TERMINAL_WALL.z);group.userData.atdInteract='board';
  const resources=[],keep=obj=>(resources.push(obj),obj);
  const steel=keep(new T.MeshStandardMaterial({color:0x343f46,metalness:.46,roughness:.52}));
  const liner=keep(new T.MeshStandardMaterial({color:0x506673,metalness:.42,roughness:.6}));
  const accent=keep(new T.MeshStandardMaterial({color:0xf6a747,metalness:.22,roughness:.6}));
  const masonry=keep(new T.MeshStandardMaterial({color:0xa3aaa4,metalness:.02,roughness:.94}));
  const unit=keep(new T.BoxGeometry());
  function box(x,y,z,w,h,d,mat){
    const mesh=new T.Mesh(unit,mat);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);group.add(mesh);return mesh;
  }
  const {width,height,screenY:cy,footDepth}=TERMINAL_WALL;
  const lowerEdge=cy-height/2,upperEdge=cy+height/2,faceDepth=.505;
  // Back the entire screen with a continuous wall from slab to coping. The
  // screen's bottom edge is 90 cm above the paving, in view from the approach.
  box(0,.14,0,width+1.02,.28,footDepth,masonry);
  box(0,(upperEdge+.22)/2,0,width+.78,upperEdge+.22,.88,masonry);
  box(0,cy,0,width+.26,height+.27,.98,steel);
  box(0,upperEdge+.28,0,width+.96,.20,1.19,liner);
  for(const side of [-1,1]){
    box(0,lowerEdge-.115,side*.495,width+.28,.105,.095,liner);
    box(-width/2+1.25,lowerEdge-.18,side*.49,2.2,.05,.09,accent);
    for(let i=1;i<8;i++)box(-width/2+i*width/8,.47,side*.445,.020,.31,.015,liner);
  }
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=536;
  const ctx=canvas.getContext('2d');
  const tex=keep(new T.CanvasTexture(canvas));tex.colorSpace=T.SRGBColorSpace;
  tex.userData.harborDisplay=true;tex.anisotropy=4;
  const screenMat=keep(new T.MeshBasicMaterial({map:tex,toneMapped:false,fog:false}));
  const surface=keep(new T.PlaneGeometry(width,height));
  for(const sign of [1,-1]){
    const face=new T.Mesh(surface,screenMat);face.position.set(0,cy,faceDepth*sign);face.rotation.y=sign<0?Math.PI:0;
    face.userData.atdInteract='board';group.add(face);
  }
  let board, signature='',page=-1,clock=0;
  function words(txt,x,y,size,color,weight=600,cap){
    ctx.font=weight+' '+size+'px system-ui, sans-serif';ctx.fillStyle=color;
    let str=String(txt??'');
    if(cap && ctx.measureText(str).width>cap){
      let lo=0,hi=str.length;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(ctx.measureText(str.slice(0,mid)+'…').width<=cap)lo=mid;else hi=mid-1;}
      str=str.slice(0,lo)+'…';
    }
    ctx.fillText(str,x,y);
  }
  function paint(){
    if(!ctx||!board)return;
    const W=canvas.width,H=canvas.height;
    ctx.fillStyle='#102934';ctx.fillRect(0,0,W,H);ctx.fillStyle='#173541';ctx.fillRect(0,0,W,110);
    ctx.fillStyle='#ffa83e';ctx.fillRect(0,0,10,110);
    words(board.terminal.toUpperCase()+'   선적 현황',46,78,59,'#fff8e8',750,775);
    ctx.textAlign='right';words(board.statusText,W-42,48,31,board.live?'#a2e4bd':'#ffc17e',700);
    words('BUSAN NEW PORT',W-42,87,24,'#accaCE',600);ctx.textAlign='left';
    const X=[46,601,792,987,1200], label='#9fbfc6';
    ['모선 / 수출 항차','적하 계획','적하 완료','잔량(VAN)','선적 상태'].forEach((v,i)=>words(v,X[i],169,30,label,600));
    for(let i=0;i<3;i++){
      const y=187+i*85,row=board.rows[page*3+i];
      ctx.fillStyle=i%2?'#142f3a':'#193641';ctx.fillRect(20,y,W-40,80);
      if(!row)continue;
      const w=row.loading||{};
      words(row.name,X[0],y+37,34,'#fff9e9',715,540);
      words([row.voy,row.berth].filter(Boolean).join('  ·  '),X[0],y+67,23,'#b6c9c8',600,540);
      words(quantity(w.plan),X[1],y+53,35,'#f2d598',650,165);
      words(quantity(w.completed),X[2],y+53,35,'#a2e4bd',700,171);
      words(quantity(w.remainingVan),X[3],y+53,35,'#edf5ef',650,170);
      words(loadingState(row),X[4],y+53,29,'#f2d598',620,210);
    }
    if(!board.rows.length)words(board.statusText==='연결 대기'?'공식 선적 자료 연결 대기':'표시할 선적 자료가 없습니다',X[0],240,36,'#c6d5d5');
    ctx.fillStyle='#274650';ctx.fillRect(20,455,W-40,2);
    const trucks=board.trucks;
    const truckLabel=trucks && Number.isFinite(trucks.inbound)&&Number.isFinite(trucks.outbound)?'  ·  반입 '+trucks.inbound+'대 / 반출 '+trucks.outbound+'대':'';
    words((board.source?board.terminal.toUpperCase()+' 운영사 공개자료':'부산항')+truckLabel,46,507,26,'#bed1cf',520,805);
    ctx.textAlign='right';words((board.last==='—'?'':'확인 '+board.last+' KST   ')+(board.rows.length>3?(page+1)+'/'+Math.ceil(board.rows.length/3):''),W-43,507,25,'#b6c9c8',550,540);ctx.textAlign='left';
    tex.needsUpdate=true;
  }
  function setBoard(state){
    const next=boardData(state);
    const key=JSON.stringify([next.terminal,next.statusText,next.source,next.last,next.trucks,next.rows.map(r=>[r.id,r.name,r.voy,r.berth,r.berthPhase,r.etb,r.etd,r.loading])]);
    if(signature===key)return;
    const reset=next.terminal!==board?.terminal;board=next;signature=key;
    page=reset?0:Math.max(0,Math.min(page,Math.ceil(board.rows.length/3)-1));paint();
  }
  function update(time){
    if(!board || !Number.isFinite(time))return;
    if(time-clock<9)return;clock=time;
    const pages=Math.max(1,Math.ceil(board.rows.length/3));
    if(pages>1){page=(page+1)%pages;paint();}
  }
  // On the software renderer the world buffer can shrink on a slow device.
  // Reproject the same live face at display resolution, behind the game's HUD.
  const holder=renderer?.isCanvasHarborRenderer && renderer.domElement.parentElement;
  if(holder){
    canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:absolute;left:0;top:0;width:1440px;height:536px;max-width:none;transform-origin:0 0;pointer-events:none;';
    canvas.hidden=true;holder.append(canvas);
  }
  const clipMatrix=new T.Matrix4(),corners=Array.from({length:3},()=>new T.Vector4()),sample=new T.Vector4(),localCamera=new T.Vector3();
  function paintView(camera,w,h){
    if(!holder)return;
    const side=group.worldToLocal(localCamera.copy(camera.position)).z>=0?1:-1;
    clipMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(group.matrixWorld);
    const at=(v,x,y)=>v.set(x*side,y+cy,(faceDepth+.004)*side,1).applyMatrix4(clipMatrix);
    const [tl,tr,bl]=corners;
    at(tl,-width/2,height/2);at(tr,width/2,height/2);at(bl,-width/2,-height/2);
    canvas.hidden=true;
    if(corners.some(c=>c.w<.5)||Math.abs(tr.x/tr.w-tl.x/tl.w)*w<150)return;
    let visible=0;
    for(const fx of [-.46,-.23,0,.23,.46])for(const fy of [-.43,0,.43]){
      at(sample,width*fx,height*fy);
      const x=Math.floor((sample.x/sample.w+1)*renderer.w/2),y=Math.floor((1-sample.y/sample.w)*renderer.h/2);
      if(x<0||y<0||x>=renderer.w||y>=renderer.h)continue;
      if(renderer.depth[y*renderer.w+x]>1/Math.max(.1,sample.w-.28))return;
      visible++;
    }
    if(!visible)return;
    for(const c of corners){c.x=(c.x+c.w)*w/2;c.y=(c.w-c.y)*h/2;}
    const dx=canvas.width,dy=canvas.height,scale=1/tl.w;
    const m=[(tr.x-tl.x)/dx,(tr.y-tl.y)/dx,0,(tr.w-tl.w)/dx,
      (bl.x-tl.x)/dy,(bl.y-tl.y)/dy,0,(bl.w-tl.w)/dy,0,0,1,0,tl.x,tl.y,0,tl.w];
    canvas.style.transform='matrix3d('+m.map(v=>+(v*scale).toFixed(9)).join(',')+')';
    canvas.hidden=false;
  }
  setBoard({});
  return {setBoard,update,paintView,destroy(){if(holder)canvas.remove();scene.remove(group);resources.forEach(x=>x.dispose());}};
}