import {mountOfficeSpeech} from './office-speech.js?v=22';

// The plaza desk faces the visitor as they arrive alongside the export quay.
export const DEPARTURE_OFFICE=Object.freeze({x:2.7,z:7.4});
const officeScale=1.18;
const chorusLines=[
  ['What if we just','surrender, surrender?'],
  ['Baby, we could make it','last forever'],
  ['But only if we','surrender, surrender'],
  ['Baby, give me something','to remember'],
  ['So what if we just surrender?'],
];
const chorusStart=2.50,chorusBeat=2.6,chorusCount=chorusLines.length*2;
const chorusEnd=chorusStart+chorusBeat*chorusCount;

const kst=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function actualTime(iso){
  const parts=Object.fromEntries(kst.formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
  return parts.month+'.'+parts.day+'   '+parts.hour+':'+parts.minute+' KST';
}
const limit=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=limit(v);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

export function buildDepartureOffice(T,scene,{onAnnouncement}={}){
  let speechOverlay=null;
  const group=new T.Group();group.name='출항 공표소';group.position.set(DEPARTURE_OFFICE.x,0,DEPARTURE_OFFICE.z);
  group.scale.setScalar(officeScale);group.userData.atdInteract='departureOffice';scene.add(group);
  const resources=new Set(),materials=new Map();
  function keep(value){resources.add(value);return value;}
  const cube=keep(new T.BoxGeometry()),sphere=keep(new T.SphereGeometry(1,18,14)),rod=keep(new T.CylinderGeometry(1,1,1,12));
  function mat(color){
    if(!materials.has(color))materials.set(color,keep(new T.MeshStandardMaterial({color,roughness:.76})));
    return materials.get(color);
  }
  function child(parent,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
  function mesh(parent,geo,color,x=0,y=0,z=0){
    const o=new T.Mesh(geo,typeof color==='string'?mat(color):color);o.position.set(x,y,z);
    o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  function box(parent,color,x,y,z,w,h,d){const o=mesh(parent,cube,color,x,y,z);o.scale.set(w,h,d);return o;}
  function oval(parent,color,x,y,z,w,h,d){const o=mesh(parent,sphere,color,x,y,z);o.scale.set(w,h,d);return o;}
  const vec=new T.Vector3(),axis=new T.Vector3(0,1,0);
  function stretch(o,a,b,r,depth=r){
    vec.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const length=vec.length();
    o.position.set((a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5);
    o.quaternion.setFromUnitVectors(axis,vec.normalize());o.scale.set(r,length,depth);
  }
  function bar(parent,color,a,b,r,depth=r){const o=mesh(parent,rod,color);stretch(o,a,b,r,depth);return o;}
  function curve(parent,color,coords,radius){
    const path=new T.CatmullRomCurve3(coords.map(p=>new T.Vector3(...p)));
    return mesh(parent,keep(new T.TubeGeometry(path,Math.max(5,coords.length*2),radius,6,false)),color);
  }
  function facelet(parent,color,points,z){
    const s=new T.Shape(points.map(([x,y])=>new T.Vector2(x,y)));
    return mesh(parent,keep(new T.ShapeGeometry(s)),color,0,0,z);
  }
  function surface(parent,w,h,px,py,x,y,z,alpha=false){
    const cv=document.createElement('canvas');cv.width=px;cv.height=py;
    const map=keep(new T.CanvasTexture(cv));map.colorSpace=T.SRGBColorSpace;map.userData.harborDisplay=true;map.anisotropy=4;
    const paint=keep(new T.MeshBasicMaterial({map,toneMapped:false,transparent:alpha,depthWrite:!alpha,side:T.DoubleSide}));
    const item=mesh(parent,keep(new T.PlaneGeometry(w,h)),paint,x,y,z);item.castShadow=false;
    return {item,map,ctx:cv.getContext('2d'),width:px,height:py};
  }
  function text(ctx,word,x,y,size,color,bold,maxWidth){
    ctx.fillStyle=color;ctx.font=(bold?'700 ':'500 ')+size+'px system-ui, sans-serif';
    ctx.fillText(word,x,y,maxWidth);
  }
  const ink='#263a45',teal='#26494b',brass='#ba9a5e',wood='#aa7250',darkWood='#78503c';
  const ivory='#f5ebd6',slacks='#40475a',skin='#efbda1',silver='#a6a9a7',hairlight='#d9d9cf',navy='#37455d',shirt='#f1eadf';
  // Sloped writing surface makes the seal and the lower half of the clerk visible from the promenade.
  const desk=child(group,-.44,0,0);
  for(const x of [-.86,.86])for(const z of [.0,.88])box(desk,darkWood,x,.37,z,.105,.73,.105);
  box(desk,teal,0,.55,.79,1.81,.42,.13);
  box(desk,brass,0,.69,.859,1.76,.021,.014);
  box(desk,wood,0,.785,.44,2.02,.12,1.12);
  const paper=surface(group,1.09,.77,768,510,-.64,1.003,.60);paper.item.name='출항 기념 선하증권';paper.item.rotation.x=-1.14;
  const clip=box(group,brass,-.64,1.16,.27,.36,.045,.065);clip.rotation.x=.37;
  // The copper-edged sign stays visible above other visitors even when no ship has left.
  for(const x of [-1.51,2.00]){
    box(group,teal,x,1.52,-.50,.084,3.03,.092);
    box(group,brass,x,.106,-.50,.155,.14,.16);
  }
  box(group,darkWood,.245,3.09,-.50,3.75,.58,.137);
  box(group,brass,.245,3.393,-.50,3.80,.043,.159);
  const fascia=surface(group,3.66,.523,966,140,.245,3.092,-.426);
  fascia.item.name='출항 공표소 현판';
  if(fascia.ctx){
    const c=fascia.ctx;c.fillStyle='#234348';c.fillRect(0,0,966,140);
    c.fillStyle='#ebad83';c.fillRect(23,20,99,98);
    c.fillStyle='#674f46';c.beginPath();c.arc(72,51,15,0,Math.PI*2);c.fill();c.fillRect(64,60,16,15);
    c.fillRect(47,73,50,14);c.fillRect(44,91,56,4);
    c.textAlign='center';text(c,'출항 공표소',542,111,105,'#fff7e3',true,790);
    fascia.map.needsUpdate=true;
  }
  const rear=mesh(group,fascia.item.geometry,fascia.item.material,.245,3.092,-.574);rear.rotation.y=Math.PI;
  const clerk=child(group,-.49,0,-.16);clerk.name='삼각 안경 출항 안내원';
  for(const side of [-1,1]){
    oval(clerk,slacks,side*.133,.46,0,.112,.37,.116);
    oval(clerk,'#393b41',side*.14,.12,.06,.131,.081,.183);
  }
  oval(clerk,navy,0,1.02,0,.326,.42,.230);
  oval(clerk,shirt,0,1.385,.02,.203,.125,.14);
  for(const side of [-1,1]){
    facelet(clerk,shirt,[[side*.035,1.25],[side*.143,1.386],[side*.041,1.405],[0,1.355]],.145);
    oval(clerk,'#28364b',0,.99+side*.082,.222,.021,.021,.009);
  }
  oval(clerk,skin,0,1.433,-.007,.116,.158,.11);
  const head=child(clerk,0,1.756,0);head.name='공표원 얼굴';
  const face=oval(head,skin,0,-.018,.0,.391,.393,.319);
  face.geometry=keep(new T.BufferGeometry().copy(sphere));
  oval(head,skin,0,-.104,.304,.047,.047,.037);
  for(const side of [-1,1]){
    oval(head,skin,side*.366,-.062,-.001,.060,.081,.04);
    oval(head,'#b58e69',side*.380,-.127,.013,.021,.024,.014);
    oval(head,'#d7927f',side*.240,-.134,.223,.051,.018,.012);
  }
  // A continuous sculpted cap runs below the ears at the back and opens at the forehead.
  const vertices=[],indices=[],rings=12,segments=34;
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,fore=(1+Math.cos(a))*.5;
    const edge=2.16-.98*fore**3+.14*Math.sin(2*a)*fore**3;
    const phi=.003+(edge-.003)*j/rings;
    vertices.push(.402*Math.sin(phi)*Math.sin(a),.020+.408*Math.cos(phi),-.014+.329*Math.sin(phi)*Math.cos(a));
  }
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
    const n=j*(segments+1)+i;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);
  }
  const cap=keep(new T.BufferGeometry());cap.setAttribute('position',new T.Float32BufferAttribute(vertices,3));cap.setIndex(indices);cap.computeVertexNormals();
  mesh(head,cap,silver);oval(head,silver,0,.105,-.305,.236,.186,.156);
  for(const side of [-1,1]){
    const temple=oval(head,silver,side*.333,.07,-.009,.076,.197,.104);temple.rotation.z=-side*.10;
    curve(head,hairlight,[[side*.055,.391,.108],[side*.17,.337,.193],[side*.275,.226,.215],[side*.348,.110,.155]],.011);
    curve(head,'#929992',[[side*.074,.394,.07],[side*.215,.311,.145],[side*.326,.180,.157]],.007);
  }
  const bridgeColor='#3c3543';
  const eyes=[];
  for(const side of [-1,1]){
    const eye=oval(head,'#392e2b',side*.141,-.005,.301,.033,.049,.016);eyes.push(eye);
    oval(head,'#fff5e3',side*.141-.008,.011,.316,.008,.009,.004);
    curve(head,'#747873',[[side*.064,.087,.304],[side*.145,.121,.289],[side*.213,.131,.261]],.012);
    // Cat-eye triangles, with broad raised outer corners and narrow, rounded lower tips.
    const p=[[side*.033,.021,.333],[side*.255,.057,.287],[side*.232,-.001,.305],[side*.149,-.104,.33],[side*.111,-.105,.33],[side*.033,.021,.333]];
    for(let i=1;i<p.length;i++)bar(head,bridgeColor,p[i-1],p[i],.014);
    for(const v of p.slice(0,-1))oval(head,bridgeColor,...v,.014,.014,.014);
    bar(head,bridgeColor,[side*.249,.054,.285],[side*.370,.031,-.003],.012);
    curve(head,'#be8e7e',[[side*.176,-.185,.238],[side*.197,-.153,.241],[side*.208,-.143,.236]],.005);
  }
  curve(head,bridgeColor,[[-.037,.020,.332],[0,.032,.34],[.037,.020,.332]],.011);
  curve(head,'#995e54',[[-.054,-.179,.28],[0,-.193,.286],[.055,-.179,.28]],.008);
  const mouth=oval(head,'#975f53',0,-.180,.279,.038,.006,.005);
  // One hand keeps the form in place. The other follows the stamp's handle.
  bar(group,shirt,[-.22,1.275,-.08],[-.101,1.07,.17],.106,.091);
  oval(group,shirt,-.102,1.07,.17,.106,.105,.096);
  bar(group,shirt,[-.102,1.07,.17],[-.156,1.058,.354],.085);
  oval(group,skin,-.164,1.061,.388,.087,.068,.078);
  const armTop=mesh(group,rod,shirt),armLower=mesh(group,rod,shirt),elbow=oval(group,shirt,0,0,0,.1,.1,.1);
  const stamp=child(group);stamp.name='목제 SURRENDERED 도장';
  box(stamp,'#993e37',0,.029,0,.50,.055,.254);
  box(stamp,'#795038',0,.084,0,.53,.070,.278);
  box(stamp,'#b67b51',0,.126,0,.50,.045,.259);
  mesh(stamp,keep(new T.LatheGeometry([[.078,.140],[.12,.162],[.083,.209],[.052,.295],[.071,.361],[.114,.410],[.120,.460],[.093,.506],[.025,.525],[0,.525]].map(([x,y])=>new T.Vector2(x,y)),16)),darkWood);
  const grasp=oval(stamp,skin,-.074,.285,-.015,.084,.10,.081);
  grasp.rotation.z=-.2;
  oval(stamp,skin,-.013,.299,.054,.047,.061,.042);
  // Framed announcement board. Both faces display the same genuine record.
  const notice=child(group,1.08,0,-.33);
  for(const x of [-.875,.875]){box(notice,teal,x,.85,0,.087,1.7,.087);box(notice,brass,x,.082,0,.174,.09,.18);}
  box(notice,teal,0,1.67,0,2.10,1.26,.126);
  box(notice,brass,0,2.306,0,2.16,.04,.16);
  const board=surface(notice,1.99,1.15,870,504,0,1.673,.068);
  board.item.name='공식 출항 게시판';
  const backBoard=mesh(notice,board.item.geometry,board.item.material,0,1.673,-.068);backBoard.rotation.y=Math.PI;
  const chat=surface(group,2.50,.74,900,274,-.55,2.59,.05,true);chat.item.name='공표원 말풍선';chat.item.visible=false;
  // Reusable camera-facing bubbles keep each sung line readable while walking.
  const chorus=Array.from({length:2},(_,i)=>{
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=270;
    const map=keep(new T.CanvasTexture(canvas));map.colorSpace=T.SRGBColorSpace;
    const material=keep(new T.SpriteMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));
    const item=new T.Sprite(material);item.name='공표원 노래 말풍선 '+(i+1);item.visible=false;group.add(item);
    return {item,material,map,ctx:canvas.getContext('2d'),beat:-1,shown:false,words:''};
  });
  function hideChorus(){for(const bubble of chorus){bubble.shown=false;bubble.item.visible=false;bubble.beat=-1;}}
  function chorusPaint(bubble,lines){
    const c=bubble.ctx;if(!c)return;
    c.clearRect(0,0,900,270);c.beginPath();c.moveTo(48,12);c.lineTo(852,12);c.quadraticCurveTo(884,12,884,44);
    c.lineTo(884,194);c.quadraticCurveTo(884,226,852,226);c.lineTo(480,226);c.lineTo(428,257);c.lineTo(433,226);
    c.lineTo(48,226);c.quadraticCurveTo(16,226,16,194);c.lineTo(16,44);c.quadraticCurveTo(16,12,48,12);c.closePath();
    c.fillStyle='#fff8e7';c.fill();c.strokeStyle='#8d7257';c.lineWidth=5;c.stroke();
    c.textAlign='center';
    text(c,'♪',63,69,42,'#a86754',true,50);text(c,'♫',837,196,40,'#a86754',true,50);
    lines.forEach((line,i)=>text(c,line,450,lines.length===1?142:103+i*67,54,ink,true,749));
    bubble.map.needsUpdate=true;
  }
  function chorusUpdate(age,enabled,loop=false){
    const beat=Math.floor((age-chorusStart)/chorusBeat);
    for(let slot=0;slot<chorus.length;slot++){
      const bubble=chorus[slot],index=beat-((beat-slot+2)%2);
      const elapsed=age-chorusStart-index*chorusBeat;
      bubble.shown=enabled&&index>=0&&(loop||index<chorusCount)&&elapsed>=0&&elapsed<chorusBeat+.22;
      bubble.item.visible=bubble.shown&&!speechOverlay;
      if(!bubble.shown)continue;
      if(bubble.beat!==index){
        bubble.beat=index;const lines=chorusLines[index%chorusLines.length];
        bubble.words='♪ '+lines.join(' ')+' ♫';chorusPaint(bubble,lines);
      }
      const enter=ease(elapsed/.16),exit=1-ease((elapsed-chorusBeat)/.22);
      bubble.material.opacity=enter*exit;
      bubble.item.position.set(-.55+(slot?-.075:.075),2.48+.025*Math.sin(elapsed*3)+.045*(1-exit),.23);
      bubble.item.scale.set(2.28*(.95+.05*enter),.684*(.95+.05*enter),1);
    }
  }
  function boardPaint(call){
    const c=board.ctx;if(!c)return;
    c.fillStyle='#f1eddf';c.fillRect(0,0,870,504);c.fillStyle='#314d4e';c.fillRect(0,0,870,116);
    text(c,'출항 확인 기록',41,82,58,'#fff7e1',true,544);c.textAlign='right';text(c,'ATD',823,79,49,'#e6c488',true,172);c.textAlign='left';
    c.fillStyle='#c4b590';c.fillRect(40,143,790,3);
    text(c,call?'공식 출항 확인':'관제소 공식 기록',43,207,40,'#5e6c65',false,776);
    text(c,call?call.name:'출항 확인 대기',39,310,82,ink,true,785);
    text(c,call?'항차 '+call.voy:'출항한 모선의 이름과 항차를 공표합니다.',42,388,call?47:38,teal,true,777);
    text(c,call?'ATD  '+actualTime(call.atd):'부산신항  ·  관제소',43,460,35,'#7a6758',false,775);
    board.map.needsUpdate=true;
  }
  function paperPaint(call,sealed){
    const c=paper.ctx;if(!c)return;
    c.fillStyle='#fff4d9';c.fillRect(0,0,768,510);c.strokeStyle='#b7a47c';c.lineWidth=5;c.strokeRect(15,15,738,480);
    text(c,'BILL OF LADING',42,95,64,ink,true,675);
    text(c,'출항 기념증',45,140,31,'#836e56',false,660);
    c.fillStyle='#bbac89';c.fillRect(45,163,674,2);
    if(call){text(c,call.name+'   '+call.voy,43,214,35,ink,true,677);text(c,'ATD  '+actualTime(call.atd),44,254,29,ink,false,672);}
    for(const y of [278,320,360,405,449]){c.fillStyle='#c2b496';c.fillRect(46,y,673,2);}
    if(sealed){
      c.save();c.translate(389,350);c.rotate(-.075);c.strokeStyle='#a83f35';c.lineWidth=7;c.strokeRect(-254,-57,508,113);
      c.textAlign='center';text(c,'SURRENDERED',0,28,68,'#a83f35',true,471);c.restore();
    }
    paper.map.needsUpdate=true;
  }
  function bubblePaint(call){
    const c=chat.ctx;if(!c)return;
    c.clearRect(0,0,900,274);c.beginPath();c.moveTo(51,9);c.lineTo(849,9);c.quadraticCurveTo(886,9,886,46);c.lineTo(886,186);
    c.quadraticCurveTo(886,223,849,223);c.lineTo(397,223);c.lineTo(296,261);c.lineTo(332,223);
    c.lineTo(51,223);c.quadraticCurveTo(14,223,14,186);c.lineTo(14,46);c.quadraticCurveTo(14,9,51,9);c.closePath();
    c.fillStyle='#fff4d6';c.fill();c.strokeStyle='#725c45';c.lineWidth=6;c.stroke();
    c.textAlign='center';text(c,call.name,450,92,61,ink,true,805);
    text(c,call.voy+' 항차, 출항을 공표합니다!',450,167,45,teal,true,807);
    chat.map.needsUpdate=true;
  }
  let currentTerminal='',known=null,latest=null,active=null,armed=false,startTime=null,sealed=false;
  let displayAge=0,idleStart=null,manualUntil=null,manualRequested=false;
  const queue=[],terminalHistory=new Map();
  function present(call){
    active=call;startTime=null;displayAge=0;idleStart=null;manualUntil=null;manualRequested=false;sealed=false;hideChorus();boardPaint(call);paperPaint(call,false);
    bubblePaint(call);chat.item.visible=!speechOverlay;onAnnouncement?.(call);
  }
  function showLatest(){
    boardPaint(latest);
    paperPaint(latest,Boolean(latest));
  }
  function reset(){
    active=null;startTime=null;idleStart=null;manualUntil=null;manualRequested=false;sealed=false;chat.item.visible=false;hideChorus();queue.length=0;known=null;
  }
  function setDepartures(calls,terminal){
    if(!['pnc','pnit'].includes(terminal)||!Array.isArray(calls))return;
    if(terminal!==currentTerminal){reset();currentTerminal=terminal;latest=null;armed=false;known=terminalHistory.get(terminal)||new Map();terminalHistory.set(terminal,known);}
    const now=Date.now();
    const authorized=calls.filter(c=>c?.atdVerified===true&&c.isDemo===false&&c.terminal===terminal&&
      typeof c.id==='string'&&c.id&&typeof c.name==='string'&&c.name.trim()&&typeof c.voy==='string'&&c.voy.trim()&&
      Number.isFinite(Date.parse(c.atd))&&Date.parse(c.atd)<=now&&Date.parse(c.atd)>=now-7*86400000);
    const sorted=[...new Map(authorized.map(c=>[c.id,c])).values()].sort((a,b)=>Date.parse(b.atd)-Date.parse(a.atd));
    const ids=new Set(sorted.map(c=>c.id)),previous=latest;latest=sorted[0]||null;
    if(known&&armed){
      for(const c of [...sorted].reverse())if(!known.has(c.id))queue.push(c);
    }
    for(const c of sorted)known.set(c.id,Date.parse(c.atd));
    for(const [id,when] of known)if(when<now-7*86400000)known.delete(id);
    for(let i=queue.length-1;i>=0;i--)if(!ids.has(queue[i].id))queue.splice(i,1);
    if(active&&!ids.has(active.id)){active=null;startTime=null;chat.item.visible=false;hideChorus();}
    if(!active){
      if(queue.length)present(queue.shift());
      else if(!armed||previous?.id!==latest?.id||previous?.atd!==latest?.atd)showLatest();
    }
    armed=true;
  }
  function replay(){
    if(active)return true;
    // A visitor can hear her hum without inventing a departure or stamping an
    // unverified document. Official records alone may start the stamp ceremony.
    if(!latest){manualRequested=true;idleStart=null;hideChorus();return true;}
    present(latest);return true;
  }
  function update(time,nearby=false){
    if(!Number.isFinite(time))return;
    if(active&&startTime===null)startTime=time;
    const age=active?Math.max(0,time-startTime):0;
    displayAge=age;
    if(manualRequested){manualUntil=time+chorusCount*chorusBeat;manualRequested=false;}
    const humming=!active&&(nearby||(manualUntil!==null&&time<manualUntil));
    if(humming&&idleStart===null)idleStart=time;
    if(!humming)idleStart=null;
    const songAge=humming?chorusStart+Math.max(0,time-idleStart):age;
    const singing=humming||(!!active&&age>=chorusStart&&age<chorusEnd);
    const rhythm=singing?Math.sin((songAge-chorusStart)*Math.PI*4/chorusBeat):0;
    const read=ease(age/.6)*(1-ease((age-1.3)/.7));
    const rise=ease((age-1.60)/.73),impact=ease((age-2.33)/.17),bounce=ease((age-2.50)/.26),back=ease((age-3.04)/.78);
    const emphasis=active?(1-back):0;
    // At impact the bottom of the rubber stamp is parallel to the writing plane.
    const tilt=Math.PI/2+paper.item.rotation.x,hitZ=.72;
    const hitY=paper.item.position.y-Math.tan(tilt)*(hitZ-paper.item.position.z);
    stamp.position.set(mix(-1.195,-.64,rise*emphasis),mix(1.14,hitY,impact*emphasis)+(.72*(rise-impact)+.16*bounce)*emphasis,mix(.54,hitZ,rise*emphasis));
    stamp.rotation.set(tilt-.31*(rise-impact)*emphasis,0,-.08*(1-impact*emphasis)-.12*(rise-impact)*emphasis);
    const wr=[stamp.position.x-.11,stamp.position.y+.258,stamp.position.z+.072];
    const lifting=(rise-impact)*emphasis;
    const bend=[-1.005-.065*lifting,1.141+.41*lifting,.11+.075*lifting];
    stretch(armTop,[-.721,1.267,-.10],bend,.104,.097);elbow.position.set(...bend);
    stretch(armLower,bend,wr,.084,.078);
    const breath=Math.sin(time*1.52)*.009;
    const idleGlance=active?0:ease((Math.sin(time*.56)-.15)/.85);
    head.position.y=1.756+breath+.009*rhythm;head.rotation.x=.03+.052*idleGlance+.11*read+.13*(impact-bounce)*emphasis+.025*rhythm;
    head.rotation.y=active?0:.17*idleGlance;
    head.rotation.z=.027+.05*(rise-impact)*emphasis+.035*rhythm;
    mouth.scale.y=singing?.010+.020*Math.abs(Math.sin((songAge-chorusStart)*9)):active&&age<2.25?.008+.012*Math.abs(Math.sin(age*12)):.006;
    const blink=Math.abs((time+.2)%4.7-2.0);for(const eye of eyes)eye.scale.y=.049*(blink<.12?.22+.78*blink/.12:1);
    if(active&&age>=2.50&&!sealed){sealed=true;paperPaint(active,true);}
    if(active&&age>=chorusStart)chat.item.visible=false;
    chorusUpdate(songAge,!!active||humming,humming);
    if(active&&age>=chorusEnd+.30){active=null;startTime=null;hideChorus();if(queue.length)present(queue.shift());else showLatest();}
  }
  function speechMessages(){
    if(active&&displayAge<chorusStart)return [{id:'announcement:'+active.id,text:active.name+' '+active.voy+' 항차, 출항을 공표합니다!',opacity:1}];
    return chorus.filter(b=>b.shown).sort((a,b)=>a.beat-b.beat).map(b=>({id:'song:'+b.beat,text:b.words,opacity:b.material.opacity}));
  }
  function mountSpeech(layer){
    speechOverlay?.dispose();speechOverlay=mountOfficeSpeech(T,layer,()=>head);
    chat.item.visible=false;for(const bubble of chorus)bubble.item.visible=false;
  }
  function paintSpeech(camera,player,width,height){speechOverlay?.paint(camera,player,width,height,speechMessages());}
  boardPaint(null);paperPaint(null,false);update(0);
  const approach={x:DEPARTURE_OFFICE.x,z:DEPARTURE_OFFICE.z+2.5*officeScale,yaw:Math.PI,radius:2.45};
  function blocks(x,z){
    const dx=(x-DEPARTURE_OFFICE.x)/officeScale,dz=(z-DEPARTURE_OFFICE.z)/officeScale;
    // Include the visitor's shoulder clearance around the writing desk and narrow board.
    return (dx>-1.72&&dx<.78&&dz>-.75&&dz<1.21)||(dx>-.17&&dx<2.33&&dz>-.62&&dz<-.04);
  }
  return {group,approach,blocks,setDepartures,update,replay,mountSpeech,paintSpeech,dispose(){speechOverlay?.dispose();scene.remove(group);resources.forEach(o=>o.dispose());resources.clear();}};
}