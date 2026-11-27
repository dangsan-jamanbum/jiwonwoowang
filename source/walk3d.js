import * as THREE from './vendor/three.module.js';
import { makeWorker, makeGuardian } from './harbor-figures.js?v=21';
import { buildHarbor } from './harbor-set.js?v=22';
import { CY_STACK_BOUNDS } from './cy-yard.js';
import { buildGuardianCourt } from './guardian-court.js';
import { CanvasHarborRenderer } from './canvas-harbor.js';
import { makeVesselCameraGuard } from './vessel-camera.js';
import { PALM_CONTACTS, PALM_DURATION, palmPose } from './palm-beats.js';
import { CHEER_PEAKS, CHEER_DURATION, cheerPose, mountCheers } from './shrine-gesture.js?v=16';
import { mountTerminalMarquee, TERMINAL_WALL, TERMINAL_WALL_BOUNDS } from './terminal-marquee.js?v=17';
import { buildDepartureOffice } from './departure-office.js?v=24';
import { buildHarborLife } from './harbor-life.js?v=20';
import { buildPortVehicles } from './port-vehicles.js?v=3';

const { Vector3: V3 } = THREE;
const clamp = (v, lo, hi) => Math.min(hi,Math.max(lo,v));
const mix = THREE.MathUtils.lerp;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const ease = (a,b,t) => mix(a,b,1-Math.exp(-t));
const yawTo = (from,to) => Math.atan2(to.x-from.x,to.z-from.z);
const turn = (a,b,dt) => a + Math.atan2(Math.sin(b-a),Math.cos(b-a)) * (1-Math.exp(-dt*22));
const BASE_YAW = -.34;
const STEP = .65;
const WALK_SPEED=5.15, RUN_SPEED=8.15, CARRY_WALK_SPEED=3.15, CARRY_RUN_SPEED=4.55, TRAVEL_SPEED=10.2, GAIT_PER_UNIT=2.58;
const SMOKE_DURATION=7.2, EAT_DURATION=2.85;
function bitePose(age) {
  if(age<0||age>=EAT_DURATION)return 0;
  const u=clamp(age/.78,0,1),v=clamp((age-1.57)/1.05,0,1);
  return u*u*(3-2*u)*(1-v*v*(3-2*v));
}
function smoothBetween(start,end,age) {
  const n=clamp((age-start)/(end-start),0,1);return n*n*(3-2*n);
}
const noSmoke={smoke:0,smokeRest:0,smokeInhale:0,smokeExhale:0};
export function smokingPose(age) {
  if(!(age>=0&&age<SMOKE_DURATION))return noSmoke;
  const hand=smoothBetween(.30,1.40,age)*(1-smoothBetween(2.97,4.14,age));
  return {
    smoke:.065+.935*hand,
    smokeRest:smoothBetween(0,.64,age)*(1-smoothBetween(6.37,7.2,age)),
    smokeInhale:smoothBetween(1.22,1.77,age)*(1-smoothBetween(2.81,3.20,age)),
    smokeExhale:smoothBetween(3.51,3.98,age)*(1-smoothBetween(5.13,5.93,age))
  };
}
// A UUIDv7 carries the start of the break through the existing presence
// stream, including when a nearby observer first appears halfway through it.
export function smokingId(startedAt) {
  const stamp=Math.floor(startedAt).toString(16).padStart(12,'0');
  return stamp.slice(0,8)+'-'+stamp.slice(8)+'-7'+crypto.randomUUID().slice(15);
}
export function smokingStart(id,fallback,serverTime) {
  if(typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-7/i.test(id)){
    const stamp=parseInt(id.slice(0,8)+id.slice(9,13),16);
    if(stamp>=serverTime-30000&&stamp<=serverTime+1500)return Math.min(stamp,serverTime);
  }
  return fallback;
}
const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]];

// Keep the third-person boom and near plane on the visitor's side of every
// steel wall. A tall stack also blocks the camera in a shorter adjacent bay.
const cameraWalls=[...CY_STACK_BOUNDS,TERMINAL_WALL_BOUNDS];
function stopCameraAtWalls(anchor,eye,padding) {
  const dx=eye.x-anchor.x,dy=eye.y-anchor.y,dz=eye.z-anchor.z;
  const x0=Math.min(anchor.x,eye.x)-padding,x1=Math.max(anchor.x,eye.x)+padding;
  const z0=Math.min(anchor.z,eye.z)-padding,z1=Math.max(anchor.z,eye.z)+padding;
  const y0=Math.min(anchor.y,eye.y)-padding;
  const invX=dx?1/dx:0,invY=dy?1/dy:0,invZ=dz?1/dz:0;
  let fraction=1;
  for(const b of cameraWalls){
    if(x1<b.minX||x0>b.maxX||z1<b.minZ||z0>b.maxZ||y0>b.top)continue;
    const ax=(b.minX-padding-anchor.x)*invX,bx=(b.maxX+padding-anchor.x)*invX;
    const az=(b.minZ-padding-anchor.z)*invZ,bz=(b.maxZ+padding-anchor.z)*invZ;
    const ay=(-padding-anchor.y)*invY,by=(b.top+padding-anchor.y)*invY;
    const enter=Math.max(0,dx?Math.min(ax,bx):-Infinity,dy?Math.min(ay,by):-Infinity,dz?Math.min(az,bz):-Infinity);
    const exit=Math.min(fraction,dx?Math.max(ax,bx):Infinity,dy?Math.max(ay,by):Infinity,dz?Math.max(az,bz):Infinity);
    if(enter<=exit)fraction=Math.min(fraction,enter);
  }
  if(fraction<1)eye.set(anchor.x+dx*fraction,anchor.y+dy*fraction,anchor.z+dz*fraction);
}

function navigatorFor(canWalk,bounds) {
  const {minX,minZ,maxX,maxZ}=bounds;
  const XN=Math.floor((maxX-minX)/STEP)+1, ZN=Math.floor((maxZ-minZ)/STEP)+1;
  const points=new Map();
  const index=(x,z)=>z*XN+x;
  for(let z=0;z<ZN;z++)for(let x=0;x<XN;x++) {
    const px=minX+x*STEP,pz=minZ+z*STEP;
    if(canWalk(px,pz))points.set(index(x,z),{x:px,z:pz,ix:x,iz:z,i:index(x,z)});
  }
  function clear(a,b) {
    const steps=Math.max(1,Math.ceil(distance(a,b)/.25));
    for (let n=1;n<=steps;n++) if(!canWalk(mix(a.x,b.x,n/steps),mix(a.z,b.z,n/steps)))return false;
    return true;
  }
  function nearest(point) {
    let best=null,d=Infinity;
    for (const p of points.values()) {
      const squared=(point.x-p.x)**2+(point.z-p.z)**2;
      if(squared<d){d=squared;best=p;}
    }
    return best;
  }
  // A long walk across the terminal can visit thousands of intersections.
  // Pop the most promising point without scanning the whole frontier.
  function queue(heap,id,rank) {
    const node={id,rank};let i=heap.length;
    while(i){const p=(i-1)>>1;if(heap[p].rank<=rank)break;heap[i]=heap[p];i=p;}
    heap[i]=node;
  }
  function pop(heap) {
    const best=heap[0],last=heap.pop();
    if(heap.length){let i=0,left;
      while((left=i*2+1)<heap.length) {
        const right=left+1,child=right<heap.length&&heap[right].rank<heap[left].rank?right:left;
        if(heap[child].rank>=last.rank)break;
        heap[i]=heap[child];i=child;
      }
      heap[i]=last;
    }
    return best.id;
  }
  function path(a,b) {
    if(canWalk(b.x,b.z) && clear(a,b)) return [{x:b.x,z:b.z}];
    const start=nearest(a),end=nearest(b);if(!start||!end)return [];
    const open=[],closed=new Set(),previous=new Map(),scores=new Map([[start.i,0]]);
    queue(open,start.i,distance(start,end));
    while(open.length){
      const id=pop(open);if(closed.has(id))continue;
      const p=points.get(id);
      if(id===end.i) {
        const raw=[];
        for(let n=id;n!==undefined;n=previous.get(n))raw.push(points.get(n));
        raw.reverse();
        if(canWalk(b.x,b.z) && clear(end,b))raw.push(b);
        const output=[];let pos=a, i=0;
        while(i<raw.length) {
          let last=i;
          while(last+1<raw.length && clear(pos,raw[last+1]))last++;
          if(!clear(pos,raw[last]))return [];
          output.push({x:raw[last].x,z:raw[last].z});pos=raw[last]; i=last+1;
        }
        return output;
      }
      closed.add(id);
      for(const [dx,dz] of dirs) {
        const nx=p.ix+dx,nz=p.iz+dz;
        if(nx<0||nx>=XN||nz<0||nz>=ZN)continue;
        const ni=index(nx,nz),next=points.get(ni);
        if(!next||closed.has(ni)||!clear(p,next))continue;
        if(dx&&dz && (!points.has(index(nx,p.iz))||!points.has(index(p.ix,nz))))continue;
        const g=scores.get(id)+distance(p,next);
        if(g>=(scores.get(ni)??Infinity))continue;
        scores.set(ni,g);previous.set(ni,id);queue(open,ni,g+distance(next,end));
      }
    }
    return [];
  }
  return {path,clear};
}

function element(tag, style, label) {
  const item=document.createElement(tag);
  if(style)item.style.cssText=style;
  if(label)item.setAttribute('aria-label',label);
  return item;
}
function labelTexture(words, fill='#fffbed', ink='#24464d') {
  const cv=document.createElement('canvas');cv.width=384;cv.height=144;
  const ctx=cv.getContext('2d');ctx.font='bold 64px system-ui,sans-serif';
  const measured=ctx.measureText(words).width,w=Math.ceil(Math.min(360,measured+52));cv.width=w;
  ctx.font='bold 64px system-ui,sans-serif';ctx.textBaseline='middle';ctx.textAlign='center';
  ctx.lineJoin='round';ctx.lineWidth=12;ctx.strokeStyle=ink;ctx.strokeText(words,w/2,70,w-14);ctx.fillStyle=fill;ctx.fillText(words,w/2,70,w-14);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  return {texture:tex,aspect:w/144};
}
function shadowTexture() {
  const C=document.createElement('canvas');C.width=C.height=96;const g=C.getContext('2d');
  const r=g.createRadialGradient(48,48,4,48,48,45);r.addColorStop(0,'rgba(17,35,52,.56)');r.addColorStop(.7,'rgba(17,35,52,.20)');r.addColorStop(1,'rgba(17,35,52,0)');
  g.fillStyle=r;g.fillRect(0,0,96,96);return new THREE.CanvasTexture(C);
}

export function mountWalk3D(container, options={}) {
  let disposed=false;
  const renderOptions={antialias:true,powerPreference:'high-performance',alpha:false};
  let renderer, software=false;
  try {renderer=new THREE.WebGLRenderer(renderOptions);}
  catch {renderer=new CanvasHarborRenderer(renderOptions);software=true;}
  if(!renderer?.domElement)throw new Error('3D 화면을 만들 수 없습니다.');
  const canvas=renderer.domElement;canvas.tabIndex=0;
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none;';
  canvas.setAttribute('aria-label','부산항 3D 탐험. WASD로 이동, Shift로 달리기, E로 가까운 화물을 들거나 내려놓기. 화면을 드래그해 둘러보세요.');
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=!software;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(software?1:Math.min(1.6,window.devicePixelRatio||1));
  const host=element('div','position:absolute;inset:0;overflow:hidden;isolation:isolate;');
  host.append(canvas);container.replaceChildren(host);
  const controlsHint=element('div','position:absolute;left:14px;bottom:14px;z-index:4;pointer-events:none;padding:7px 11px;border-radius:10px;background:rgba(19,39,48,.76);border:1px solid rgba(225,239,229,.25);color:#fff4df;font:600 12px/1.4 system-ui,sans-serif;letter-spacing:.01em;');
  controlsHint.textContent='WASD 이동  ·  Shift 달리기  ·  E 화물 들기 / 내려놓기';
  host.append(controlsHint);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(48,1,.12,265);
  const set=buildHarbor(THREE,scene);
  const zoneIds=['departure','arrival','shrine','control','smoking','yard'];
  const zones=Object.fromEntries(zoneIds.filter(id=>set.zones[id]).map(id=>[id,set.zones[id]]));
  const court=buildGuardianCourt(THREE,scene);
  const office=buildDepartureOffice(THREE,scene,{onAnnouncement:meta=>options.onDepartureAnnouncement?.(meta)});
  const marquee=mountTerminalMarquee(THREE,scene,renderer);
  const harborLife=buildHarborLife(THREE,scene);
  const portVehicles=buildPortVehicles(THREE,scene);
  zones.departureOffice=office.approach;zones.eomuk=harborLife.approach;zones.shark=harborLife.sharkWatch;
  const canWalk=(x,z)=>set.canWalk(x,z) && !court.blocks(x,z) && !office.blocks(x,z) && !harborLife.blocks(x,z);
  let navigation;
  const route=(a,b)=>(navigation ||= navigatorFor(canWalk,set.worldBounds)).path(a,b);
  const measuredGround=(x,z)=>set.groundHeight?.(x,z) || 0;
  const sun=new THREE.DirectionalLight(0xffedd1,2.45);sun.position.set(-13,28,15);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.045;sun.shadow.bias=-.00036;
  Object.assign(sun.shadow.camera,{left:-36,right:36,top:40,bottom:-40,near:1,far:105});
  sun.shadow.camera.updateProjectionMatrix();sun.target.position.set(-3,0,-6);scene.add(sun,sun.target);
  const skyLight=new THREE.HemisphereLight(0xe4f4ff,0xa69c82,1.82);scene.add(skyLight);
  const bounce=new THREE.DirectionalLight(0xffe0bd,.42);bounce.position.set(18,8,-18);scene.add(bounce);
  const sky=new THREE.Color(),daySky=new THREE.Color(0xbce4e8),nightSky=new THREE.Color(0x293857),fogDay=new THREE.Color(0xbddfdc),fogNight=new THREE.Color(0x344669);
  const air=new THREE.Fog(0xc1dfe0,65,198);scene.background=sky;scene.fog=air;
  const skyState={night:0,cloud:0};scene.userData.atdSky=skyState;
  const skyDome=new THREE.SphereGeometry(166,32,18), skyPos=skyDome.getAttribute('position');
  const colors=new THREE.Float32BufferAttribute(new Float32Array(skyPos.count*3),3);
  skyDome.setAttribute('color',colors);
  const dome=new THREE.Mesh(skyDome,new THREE.MeshBasicMaterial({side:THREE.BackSide,vertexColors:true,depthWrite:false,fog:false,toneMapped:false}));
  dome.userData.backgroundOnly=true;dome.renderOrder=-100;scene.add(dome);
  const topDay=new THREE.Color(0x6aaecd),bottomDay=new THREE.Color(0xe5eddc);
  const topNight=new THREE.Color(0x0c1532),bottomNight=new THREE.Color(0x3e4c6c),zenith=new THREE.Color(),horizon=new THREE.Color(),tint=new THREE.Color();
  let randomSeed=1749;
  const stableRandom=()=>{randomSeed=(Math.imul(1664525,randomSeed)+1013904223)>>>0;return randomSeed/4294967296;};
  const starsGeom=new THREE.BufferGeometry(),starsData=[];
  for(let i=0;i<370;i++){const a=stableRandom()*Math.PI*2,h=.035+stableRandom()*.91,r=Math.sqrt(1-h*h);starsData.push(141*r*Math.sin(a),141*h,141*r*Math.cos(a));}
  starsGeom.setAttribute('position',new THREE.Float32BufferAttribute(starsData,3));
  const stars=new THREE.Points(starsGeom,new THREE.PointsMaterial({color:0xf6f0d7,size:.16,sizeAttenuation:true,transparent:true,depthWrite:false,fog:false,toneMapped:false}));
  stars.renderOrder=-95;stars.userData.backgroundOnly=true;scene.add(stars);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(2.1,22,14),new THREE.MeshBasicMaterial({color:0xffedce,fog:false,toneMapped:false}));
  moon.renderOrder=-92;moon.userData.backgroundOnly=true;scene.add(moon);
  const lightAt = [[10,6,7],[-10,6,-20],[0,6,-5]].map(([x,y,z])=>{const l=new THREE.PointLight(0xffb974,0,14,2);l.position.set(x,y,z);scene.add(l);return l;});
  function paintSky(n,cover) {
    skyState.night=n;skyState.cloud=cover;
    zenith.copy(topDay).lerp(topNight,n);horizon.copy(bottomDay).lerp(bottomNight,n);
    if(cover)zenith.lerp(horizon,cover*.7);
    for(let i=0;i<skyPos.count;i++) {
      const t=clamp((skyPos.getY(i)/166+.045)/.74,0,1);
      tint.copy(horizon).lerp(zenith,Math.pow(t,.65));colors.setXYZ(i,tint.r,tint.g,tint.b);
    }
    colors.needsUpdate=true;stars.visible=n>.25;stars.material.opacity=clamp(n*(1-cover*2),0,1);
    moon.visible=n>.35;lightAt.forEach(l=>{l.intensity=n*23;});
  }
  const shadeTex=shadowTexture(), shadeGeo=new THREE.PlaneGeometry(1,1);
  const shadeMat=new THREE.MeshBasicMaterial({map:shadeTex,transparent:true,depthWrite:false,opacity:.8});
  function shadow(size) {const m=new THREE.Mesh(shadeGeo,shadeMat);m.rotation.x=-Math.PI/2;m.scale.set(size,size*.76,1);m.position.y=.026;scene.add(m);return m;}
  function addFigure(style, factory=makeWorker) {
    const fig=factory(THREE,style);
    scene.add(fig.group);const sh=shadow(factory===makeWorker?1.48:1.65);
    fig.group.traverse(o=>{if(o.isMesh)o.castShadow=true;});
    return {...fig,shade:sh};
  }
  function updateShadow(f) {f.shade.position.set(f.group.position.x,measuredGround(f.group.position.x,f.group.position.z)+.026,f.group.position.z);}
  function removeFigure(fig) {
    if(!fig)return;scene.remove(fig.group,fig.shade);
    if(fig.vapor){scene.remove(fig.vapor);for(const puff of fig.vapor.children)puff.material.dispose();}
    // Figures own geometry/materials through their factory; shared materials may be cached.
    fig.dispose?.();
  }
  let profile=options.profile || {},style=profile.style==='vest'?'vest':profile.style==='honghong'?'honghong':'cardigan', local=addFigure(style);
  const sharkDishProp=new THREE.Group();sharkDishProp.name='손에 든 상어 요리';local.handR.add(sharkDishProp);sharkDishProp.position.set(0,.018,.055);sharkDishProp.visible=false;
  const dishBowl=new THREE.Mesh(new THREE.CylinderGeometry(.105,.085,.035,16),new THREE.MeshStandardMaterial({color:'#f1e5ce',roughness:.72}));dishBowl.position.y=.018;sharkDishProp.add(dishBowl);
  const dishFoods={
    steak:new THREE.Mesh(new THREE.BoxGeometry(.13,.038,.085),new THREE.MeshStandardMaterial({color:'#a85b43',roughness:.83})),
    soup:new THREE.Mesh(new THREE.CylinderGeometry(.071,.071,.012,14),new THREE.MeshStandardMaterial({color:'#dcae63',roughness:.55})),
    sashimi:new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshStandardMaterial({color:'#e9958b',roughness:.7}))
  };
  for(const [kind,food] of Object.entries(dishFoods)){food.position.set(0,.045,.018);food.visible=false;sharkDishProp.add(food);}
  const spawn=set.spawn || {x:6,z:8,yaw:2.2};
  const spawnAngle=Math.random()*Math.PI*2,spawnRadius=.32+.58*Math.random();
  const startX=spawn.x+Math.cos(spawnAngle)*spawnRadius,startZ=spawn.z+Math.sin(spawnAngle)*spawnRadius;
  const player=new V3(canWalk(startX,startZ)?startX:spawn.x,0,canWalk(startX,startZ)?startZ:spawn.z);
  player.y=measuredGround(player.x,player.z);
  let heading=spawn.yaw??2.2,lastMove=-100,near=null,time=0,walkMix=0,modeLight='auto',night=0,lastKst=-100,weather='clear';
  const guardianFigures=[];
  const courtBounds=new THREE.Box3(),labelTop=new V3();
  for(const spot of court.spots) {
    const fig=addFigure(spot.id,makeGuardian);
    fig.group.position.set(spot.x,spot.y,spot.z);
    fig.group.rotation.y=spot.yaw;fig.group.userData.atdInteract="guardian";fig.group.userData.guardianId=spot.id;
    updateShadow(fig);fig.shade.position.y=spot.y+.012;
    guardianFigures.push(fig);
    fig.labelAnchor.getWorldPosition(labelTop);
    courtBounds.expandByPoint(new V3(spot.x-2.65,0,spot.z-1.65));
    courtBounds.expandByPoint(new V3(spot.x+2.65,labelTop.y+.28,spot.z+1.65));
  }
  const courtCenter=courtBounds.getCenter(new V3()),courtSize=courtBounds.getSize(new V3());
  const courtFront=new V3(zones.shrine.x-courtCenter.x,0,zones.shrine.z-courtCenter.z).normalize();
  const peers=new Map(), palmMarks=[];
  const cargoVisuals=new Map();
  let cargoItems=Array.isArray(options.cargoItems)?options.cargoItems.map(v=>({...v})):[],cargoSelfId=options.cargoSelfId||options.getSelfId?.()||null;
  let carriedCargoId=cargoItems.find(v=>v.carrierId===cargoSelfId)?.id||null;
  const cargoMaterials={
    cloud:new THREE.MeshStandardMaterial({color:0x394654,roughness:.92}),
    cloudLight:new THREE.MeshStandardMaterial({color:0x8798a2,roughness:.86}),
    lightning:new THREE.MeshStandardMaterial({color:0xffd34e,emissive:0xffa900,emissiveIntensity:1.25,roughness:.4}),
    workerClothes:new THREE.MeshStandardMaterial({color:0xf2a52e,roughness:.82}),
    workerVest:new THREE.MeshStandardMaterial({color:0xffdf72,roughness:.78}),
    workerSkin:new THREE.MeshStandardMaterial({color:0xd69a70,roughness:.9}),
    workerPants:new THREE.MeshStandardMaterial({color:0x344d60,roughness:.9}),
    helmet:new THREE.MeshStandardMaterial({color:0xf5d34f,roughness:.68}),
    equipment:new THREE.MeshStandardMaterial({color:0x477c83,metalness:.35,roughness:.62}),
    equipmentMetal:new THREE.MeshStandardMaterial({color:0xb8c3c1,metalness:.72,roughness:.38}),
    beacon:new THREE.MeshStandardMaterial({color:0xe45b42,emissive:0x7d170c,emissiveIntensity:.45}),
    bomb:new THREE.MeshStandardMaterial({color:0x292d32,metalness:.22,roughness:.55}),
    bombFuse:new THREE.MeshStandardMaterial({color:0xd9a34b,roughness:.62}),
    wrench:new THREE.MeshStandardMaterial({color:0xb9c8ca,metalness:.82,roughness:.28}),
    delayAura:new THREE.MeshBasicMaterial({color:0xff2938,transparent:true,opacity:.78,depthWrite:false,side:THREE.DoubleSide}),
    cancelAura:new THREE.MeshBasicMaterial({color:0x35ed83,transparent:true,opacity:.78,depthWrite:false,side:THREE.DoubleSide}),
    delayGlow:new THREE.MeshBasicMaterial({color:0xff2938,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}),
    cancelGlow:new THREE.MeshBasicMaterial({color:0x35ed83,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide})
  };
  function cargoPart(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function makeCargoVisual(item){
    const g=new THREE.Group();g.name='지연 상쇄 현장 지원 모형';
    const kind=item.kind||(/weather|storm|재해|기상/i.test(item.id+' '+item.name)?'weather':/crew|worker|인원|작업/i.test(item.id+' '+item.name)?'crew':'equipment');
    if(kind==='bomb'){
      cargoPart(g,new THREE.SphereGeometry(.39,18,14),cargoMaterials.bomb,0,.43,0,1,1,.94);
      cargoPart(g,new THREE.TorusGeometry(.395,.045,8,24),cargoMaterials.beacon,0,.43,0,1,1,1);
      const fuse=cargoPart(g,new THREE.CylinderGeometry(.045,.055,.20,8),cargoMaterials.bombFuse,.12,.83,-.02);
      fuse.rotation.z=-.48;
      cargoPart(g,new THREE.SphereGeometry(.075,8,6),cargoMaterials.bombFuse,.17,.94,-.02);
    }else if(kind==='wrench'){
      const handle=cargoPart(g,new THREE.CylinderGeometry(.105,.13,.72,10),cargoMaterials.wrench,0,.43,0);
      handle.rotation.z=Math.PI/4;
      cargoPart(g,new THREE.TorusGeometry(.19,.065,9,20),cargoMaterials.wrench,-.27,.70,0,1,1,1);
      cargoPart(g,new THREE.BoxGeometry(.17,.14,.12),cargoMaterials.wrench,-.40,.83,0);
      cargoPart(g,new THREE.BoxGeometry(.17,.14,.12),cargoMaterials.wrench,-.13,.57,0);
    }else if(kind==='weather'){
      const cloud=new THREE.Group();g.add(cloud);
      cargoPart(cloud,new THREE.SphereGeometry(.34,14,10),cargoMaterials.cloud,-.25,.65,0,1.12,.82,.92);
      cargoPart(cloud,new THREE.SphereGeometry(.40,14,10),cargoMaterials.cloud,0,.72,0,1.05,.88,1);
      cargoPart(cloud,new THREE.SphereGeometry(.30,14,10),cargoMaterials.cloud,.29,.63,0,1.1,.82,.92);
      cargoPart(cloud,new THREE.SphereGeometry(.22,12,8),cargoMaterials.cloudLight,-.04,.88,-.015,1.15,.62,.9);
      const bolt=new THREE.Shape();bolt.moveTo(.10,.48);bolt.lineTo(-.12,.08);bolt.lineTo(.03,.08);bolt.lineTo(-.08,-.30);bolt.lineTo(.25,.14);bolt.lineTo(.09,.14);bolt.closePath();
      const lightning=new THREE.Mesh(new THREE.ShapeGeometry(bolt),cargoMaterials.lightning);
      lightning.position.set(.08,.26,.25);lightning.scale.set(.9,.9,.5);lightning.castShadow=true;g.add(lightning);
      cargoPart(g,new THREE.SphereGeometry(.045,8,6),cargoMaterials.lightning,-.43,.28,.16);
      cargoPart(g,new THREE.SphereGeometry(.045,8,6),cargoMaterials.lightning,.43,.30,.14);
    }else if(kind==='crew'){
      const people=[[-.34,-.20],[0,-.26],[.34,-.18],[-.17,.22],[.19,.24]];
      for(const [x,z] of people){
        const person=new THREE.Group();person.position.set(x,0,z);g.add(person);
        cargoPart(person,new THREE.CylinderGeometry(.105,.12,.30,8),cargoMaterials.workerClothes,0,.39,0);
        cargoPart(person,new THREE.BoxGeometry(.19,.10,.13),cargoMaterials.workerVest,0,.43,.012);
        cargoPart(person,new THREE.SphereGeometry(.085,10,8),cargoMaterials.workerSkin,0,.62,0);
        cargoPart(person,new THREE.SphereGeometry(.105,10,6,0,Math.PI*2,0,Math.PI/2),cargoMaterials.helmet,0,.69,0,1,1,.9);
        for(const side of [-1,1]){
          cargoPart(person,new THREE.CylinderGeometry(.035,.04,.24,7),cargoMaterials.workerPants,side*.055,.15,0);
          cargoPart(person,new THREE.CylinderGeometry(.027,.03,.20,7),cargoMaterials.workerClothes,side*.14,.40,0);
        }
      }
      cargoPart(g,new THREE.CylinderGeometry(.52,.52,.045,18),cargoMaterials.equipment,-.02,.025,0,1,.7,.72);
    }else{
      cargoPart(g,new THREE.BoxGeometry(.76,.42,.52),cargoMaterials.equipment,0,.29,0);
      cargoPart(g,new THREE.BoxGeometry(.80,.08,.56),cargoMaterials.equipmentMetal,0,.53,0);
      cargoPart(g,new THREE.CylinderGeometry(.19,.19,.10,16),cargoMaterials.equipmentMetal,-.28,.61,0,1,1,.34);
      cargoPart(g,new THREE.CylinderGeometry(.19,.19,.10,16),cargoMaterials.equipmentMetal,.28,.61,0,1,1,.34);
      cargoPart(g,new THREE.CylinderGeometry(.07,.07,.10,10),cargoMaterials.beacon,0,.66,-.12);
      for(const x of [-.25,.25])for(const z of [-.18,.18])
        cargoPart(g,new THREE.CylinderGeometry(.07,.07,.07,10),cargoMaterials.cloud,x,.07,z);
    }
    // Green is always cancellation/support; red is always delay/penalty.
    const isCancel=item.effect==='cancel';
    const auraMat=isCancel?cargoMaterials.cancelAura:cargoMaterials.delayAura;
    const glowMat=isCancel?cargoMaterials.cancelGlow:cargoMaterials.delayGlow;
    const glow=new THREE.Mesh(new THREE.CircleGeometry(.86,28),glowMat);
    glow.name='cargo-aura-glow';glow.rotation.x=-Math.PI/2;glow.position.y=.018;g.add(glow);
    const aura=new THREE.Mesh(new THREE.TorusGeometry(.70,.045,7,32),auraMat);
    aura.name='cargo-aura';aura.rotation.x=Math.PI/2;aura.position.y=.055;g.add(aura);
    const outer=new THREE.Mesh(new THREE.TorusGeometry(.91,.018,6,32),auraMat);
    outer.name='cargo-aura-outer';outer.rotation.x=Math.PI/2;outer.position.y=.035;outer.scale.setScalar(.98);g.add(outer);
    return g;
  }
  function syncCargoVisuals(){
    cargoSelfId=options.getSelfId?.()||cargoSelfId;
    for(const item of cargoItems){
      if(!item?.id||item.delivered)continue;
      let visual=cargoVisuals.get(item.id);
      if(!visual){visual=makeCargoVisual(item);cargoVisuals.set(item.id,visual);}
      let parent=null;
      if(item.carrierId)parent=item.carrierId===cargoSelfId?local.group:peers.get(item.carrierId)?.fig.group||null;
      if(parent){
        if(visual.parent!==parent){visual.parent?.remove(visual);parent.add(visual);}
        visual.visible=true;visual.position.set(0,.98,.47);visual.scale.setScalar(.90);visual.rotation.set(0,0,0);
      }else if(item.carrierId){
        if(visual.parent!==scene){visual.parent?.remove(visual);scene.add(visual);}
        visual.visible=false;
      }else{
        if(visual.parent!==scene){visual.parent?.remove(visual);scene.add(visual);}
        const x=Number(item.x)||0,z=Number(item.z)||0;
        visual.visible=true;visual.scale.setScalar(1.12);visual.position.set(x,measuredGround(x,z)+.02,z);visual.rotation.y=Number(item.yaw)||0;
      }
    }
    for(const [id,visual] of cargoVisuals)if(!cargoItems.some(v=>v.id===id&&!v.delivered)){visual.parent?.remove(visual);cargoVisuals.delete(id);}
    carriedCargoId=cargoItems.find(v=>v.carrierId===cargoSelfId&&!v.delivered)?.id||null;
  }
  function setCargo(items,selfId){
    if(Array.isArray(items))cargoItems=items.map(v=>({...v}));
    if(selfId)cargoSelfId=selfId;
    syncCargoVisuals();
  }
  function nearestCargo(){
    let best=null,bestDistance=2.25;
    for(const item of cargoItems){
      if(item.delivered||item.carrierId)continue;
      const d=distance(player,item);
      if(d<bestDistance){best=item;bestDistance=d;}
    }
    return best;
  }
  async function interactCargo(){
    const item=carriedCargoId?cargoItems.find(v=>v.id===carriedCargoId):nearestCargo();
    if(!item)return false;
    const mode=carriedCargoId?'drop':'pickup';
    try{
      const result=await options.onCargoAction?.(mode,item.id,{x:player.x,z:player.z});
      if(result?.items)setCargo(result.items,result.selfId);
      else if(mode==='pickup'){item.carrierId=cargoSelfId;syncCargoVisuals();}
      else {item.carrierId=null;item.x=player.x;item.z=player.z;syncCargoVisuals();}
      options.onHint?.(result?.message||(mode==='pickup'?'화물을 들었습니다. E를 눌러 내려놓으세요.':'화물을 내려놓았습니다.'));
      return true;
    }catch(error){options.onHint?.(error?.message||'화물을 옮기지 못했습니다.');return false;}
  }
  syncCargoVisuals();
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const labels=element('div','position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;');
  labels.className='harbor-live-labels';host.append(labels);
  office.mountSpeech(labels);
  const cheers=mountCheers(THREE,labels);
  const selfSpeaker=Symbol('self'),localAnchor=()=>local.group;
  function sayChat(avatarId,message,isSelf=false) {
    if(disposed||(!isSelf&&!avatarId))return false;
    // Resolve a stable speaker ID each frame: chat can arrive before its
    // first presence snapshot or just before a figure changes clothes.
    return cheers.say(isSelf?selfSpeaker:avatarId,isSelf?localAnchor:()=>peers.get(avatarId)?.fig.group,message);
  }
  let localSignal=null,serverClockOffset=0;
  const mouthAt=new V3(),emberAt=new V3(),breathForward=new V3();
  const smokeCanvas=document.createElement('canvas');smokeCanvas.width=smokeCanvas.height=96;
  const smokeCtx=smokeCanvas.getContext('2d');
  const cloud=smokeCtx.createRadialGradient(44,47,3,48,48,46);
  cloud.addColorStop(0,'rgba(247,246,240,.94)');cloud.addColorStop(.32,'rgba(231,233,232,.80)');
  cloud.addColorStop(.59,'rgba(198,207,208,.52)');cloud.addColorStop(.84,'rgba(145,158,162,.17)');cloud.addColorStop(1,'rgba(159,174,177,0)');
  smokeCtx.fillStyle=cloud;smokeCtx.fillRect(0,0,96,96);
  const smokeTex=new THREE.CanvasTexture(smokeCanvas);smokeTex.colorSpace=THREE.SRGBColorSpace;
  function paintBreath(fig,age) {
    if(!(age>=0&&age<SMOKE_DURATION)||!fig.group.visible){if(fig.vapor)fig.vapor.visible=false;return;}
    if(!fig.vapor){
      fig.vapor=new THREE.Group();fig.vapor.name='Cigarette wisp and exhaled smoke';scene.add(fig.vapor);
      for(let i=0;i<(reduceMotion?5:10);i++){
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,depthWrite:false}));
        sprite.userData.source=new V3();sprite.userData.forward=new V3();
        fig.vapor.add(sprite);
      }
    }
    if(fig.mouth)fig.mouth.getWorldPosition(mouthAt);
    else mouthAt.copy(fig.group.position).add(new V3(0,1.79,0));
    (fig.cigaretteTip||fig.handR).getWorldPosition(emberAt);
    breathForward.set(0,0,1);
    if(fig.mouth)breathForward.transformDirection(fig.mouth.matrixWorld);
    else breathForward.applyQuaternion(fig.group.quaternion);
    const wisps=reduceMotion?2:4,vapor=fig.vapor;
    if(!vapor.visible||age<vapor.userData.age){
      for(const puff of vapor.children)puff.userData.emission=-1;
    }
    vapor.visible=true;vapor.userData.age=age;
    for(let i=0;i<vapor.children.length;i++){
      const puff=vapor.children[i],wisp=i<wisps;
      const phase=wisp?age/2.08-i/wisps:(age-3.70-(i-wisps)*1.25/(vapor.children.length-wisps-1))/2.0;
      const emission=wisp?Math.floor(phase):0,t=wisp?phase-emission:phase;
      puff.visible=phase>=0&&t<1;
      if(!puff.visible)continue;
      const data=puff.userData;
      if(data.emission!==emission){
        // Once released, the wisp drifts on the breeze rather than following
        // a hand back to the pocket or a worker turning their head.
        data.emission=emission;data.source.copy(wisp?emberAt:mouthAt);
        data.forward.copy(breathForward);
      }
      const travel=wisp?.045*t:.08+1.02*t;
      puff.position.copy(data.source).addScaledVector(data.forward,travel);
      puff.position.x+=(wisp?.18:.32)*t+Math.sin(t*4.4+i)*t*.042;
      puff.position.z+=.08*t;
      puff.position.y+=(wisp?.79:.29)*t+.30*t*t;
      const fade=Math.min(1,age*4,(SMOKE_DURATION-age)*3);
      puff.material.opacity=(wisp?.64:.79)*Math.sin(t*Math.PI)**.68*fade;
      const size=wisp?.08+t*.20:.14+t*.52;
      puff.scale.set(size*(wisp?.82:1.25),size,1);
    }
  }
  const pullLabel=labelTexture('영차!','#ffe3bf','#51403c');
  const effects=[], lookAt=new V3(), desired=new V3(), aim=new V3(), targetOffset=new V3();
  const splashGeo=new THREE.IcosahedronGeometry(.065,0);
  const splashMat=new THREE.MeshBasicMaterial({color:0xcaecee});
  const ringGeo=new THREE.TorusGeometry(.31,.022,6,30);
  const littleRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0xfff5ae,transparent:true,depthWrite:false}));
  littleRing.rotation.y=Math.PI/2;littleRing.visible=false;scene.add(littleRing);
  const wave=new THREE.Group(),waveMat=new THREE.MeshStandardMaterial({color:0x73dae0,roughness:.3});
  const faceMat=new THREE.MeshBasicMaterial({color:0x28475b});
  function waveBall(px,py,pz,sx,sy,sz,mat) {
    const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);m.position.set(px,py,pz);m.scale.set(sx,sy,sz);wave.add(m);
  }
  waveBall(0,0,0,.25,.22,.52,waveMat);waveBall(.02,.10,-.24,.13,.15,.2,waveMat);
  for(const z of [-.12,.12])waveBall(-.22,.07,z,.027,.04,.027,faceMat);
  waveBall(-.245,-.01,0,.023,.028,.045,faceMat);
  wave.visible=false;scene.add(wave);
  const ropeGeometry=new THREE.BufferGeometry(), ropeSegments=26;
  const ropePositions=new Float32Array((ropeSegments+1)*3);
  ropeGeometry.setAttribute('position',new THREE.BufferAttribute(ropePositions,3));
  const rope=new THREE.Line(ropeGeometry,new THREE.LineBasicMaterial({color:0xf9a35b}));rope.visible=false;
  rope.frustumCulled=false;scene.add(rope);
  // A tube gives the symbolic line a readable width on mobile WebGL drivers.
  const ropeMat=new THREE.MeshStandardMaterial({color:0xe59a5e,roughness:.88});
  const ropeUnitGeo=new THREE.CylinderGeometry(.044,.044,1,6);
  const ropeTubes=new THREE.InstancedMesh(ropeUnitGeo,ropeMat,ropeSegments);
  ropeTubes.frustumCulled=false;ropeTubes.visible=false;scene.add(ropeTubes);
  const dummy=new THREE.Object3D(),up=new V3(0,1,0),ropeP=new V3(),ropeQ=new V3(),ropeD=new V3(),anchor=new V3();
  const arrival=zones.arrival, departure=zones.departure;
  const movingRopeEnd=new V3();
  function updateRope(strain) {
    const close=distance(player,arrival)<6;
    rope.visible=ropeTubes.visible=close;
    if(!close)return;
    const a=set.getRopeAnchor?.(movingRopeEnd) || arrival.anchor;
    if(currentAction?.mode==='pull') {
      local.handR.getWorldPosition(anchor);
    } else {
      const pulling=[...peers.values()].find(p=>p.actionMode==='pull' && time-p.started<1.2 && distance(p.fig.group.position,arrival)<3.4);
      if(pulling)pulling.fig.handR.getWorldPosition(anchor);
      else anchor.set(arrival.x-.1,.72,arrival.z);
    }
    let lastX=a.x,lastY=a.y,lastZ=a.z;
    for(let n=0;n<=ropeSegments;n++) {
      const t=n/ropeSegments;
      const x=mix(a.x,anchor.x,t),y=mix(a.y,anchor.y,t)-Math.sin(Math.PI*t)*(.32-.27*strain),z=mix(a.z,anchor.z,t);
      ropePositions.set([x,y,z],n*3);
      if(n) {
        ropeP.set(lastX,lastY,lastZ);ropeQ.set(x,y,z);ropeD.subVectors(ropeQ,ropeP);
        dummy.position.copy(ropeP).addScaledVector(ropeD,.5);dummy.scale.set(1,ropeD.length(),1);dummy.quaternion.setFromUnitVectors(up,ropeD.normalize());dummy.updateMatrix();ropeTubes.setMatrixAt(n-1,dummy.matrix);
      }
      lastX=x;lastY=y;lastZ=z;
    }
    ropeGeometry.attributes.position.needsUpdate=true;ropeTubes.instanceMatrix.needsUpdate=true;
  }

  const groundMarker=new THREE.Mesh(new THREE.RingGeometry(.22,.31,28),new THREE.MeshBasicMaterial({color:0xffe1a7,side:THREE.DoubleSide,transparent:true,opacity:.86,depthWrite:false}));
  groundMarker.rotation.x=-Math.PI/2;groundMarker.visible=false;scene.add(groundMarker);
  let markerTimer=0;
  function marker(p) {groundMarker.position.set(p.x,measuredGround(p.x,p.z)+.055,p.z);groundMarker.visible=true;markerTimer=time;}

  // Permanent unloading target: exact same center/radius used by the server delivery check.
  const cargoDropPoint=new THREE.Vector3(10.8,0,5);
  const cargoDropGround=measuredGround(cargoDropPoint.x,cargoDropPoint.z);
  const cargoDropRing=new THREE.Mesh(
    new THREE.TorusGeometry(4.28,.075,8,72),
    new THREE.MeshBasicMaterial({color:0x43f39a,emissive:0x168b54,emissiveIntensity:.7,transparent:true,opacity:.72,depthWrite:false})
  );
  cargoDropRing.rotation.x=Math.PI/2;cargoDropRing.position.set(cargoDropPoint.x,cargoDropGround+.09,cargoDropPoint.z);scene.add(cargoDropRing);
  const cargoDropSquare=new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(8.55,.025,8.55)),
    new THREE.LineBasicMaterial({color:0x9fffd0,transparent:true,opacity:.52,depthWrite:false})
  );
  cargoDropSquare.position.set(cargoDropPoint.x,cargoDropGround+.12,cargoDropPoint.z);scene.add(cargoDropSquare);
  const cargoDropLabel=element('div','position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:none;white-space:nowrap;padding:7px 13px;border:1px solid #8fffc2;border-radius:18px;background:rgba(7,42,31,.92);color:#d9ffe9;font:800 14px/1.25 system-ui;letter-spacing:-.2px;box-shadow:0 0 18px #42f39a88,0 3px 10px #001b16aa;text-shadow:0 1px 2px #001b16;z-index:5;');
  cargoDropLabel.textContent='화물 하역 구역';
  host.append(cargoDropLabel);
  const feedback=element('div','position:absolute;top:15%;left:50%;transform:translateX(-50%);pointer-events:none;padding:7px 17px;white-space:nowrap;border:1px solid #fae7a0;border-radius:20px;background:#f9dd88;color:#6e491d;font:800 15px/1.4 system-ui;box-shadow:0 4px 18px #2b331f2b;');
  feedback.hidden=true;host.append(feedback);
  let ceremony=-1e4;
  const confetti=[];
  let celebrationKey='', vesselConfirmedAt=null;
  function celebrate(meta) {
    if(meta && (meta.confirmed===false || meta.isDemo || meta.atdVerified===false))return false;
    const stamp=(meta?.atdVerified===true||meta?.confirmed===true?meta.atd:null)||vesselConfirmedAt;
    const actual=Date.parse(stamp);if(!Number.isFinite(actual) || actual>Date.now())return false;
    const key=String(meta?.id||vesselId)+'/'+String(stamp);
    if(celebrationKey===key)return false;
    // The confirmation belongs to this visitor's vessel. The communal hull
    // remains alongside so everyone's shared pushing space stays in place.
    celebrationKey=key;ceremony=time;feedback.textContent='PORT CALL  ·  출항을 축하합니다';feedback.hidden=false;
    const papers=['#fff4e0','#f6be68','#eda98c','#d2ddd4'];
    for(let i=0;i<42;i++){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(.12+i%3*.043,.20+i%4*.023),new THREE.MeshBasicMaterial({color:papers[i%4],side:THREE.DoubleSide}));
      const p={m,x:departure.x-4+Math.random()*8,y:3+Math.random()*6,z:departure.z-5+Math.random()*10,phase:Math.random()*7,fall:.4+Math.random()};
      m.position.set(p.x,p.y,p.z);scene.add(m);confetti.push(p);
    }
    return true;
  }

  let plan=null,cameraYaw=.15,cameraPitch=.36,zoom=1,initialCamera=true,openingVista=true;
  let currentAction=null,actionWave=-100,shipPush=0,shipPull=0,aligning=false;
  let touchLatched=false,contactIntent=0,walkPhase=0;
  let seated=null,lastSeat=null,seatBlend=0,lastSeatKey='';
  const isDockGesture=()=>['push','pull'].includes(currentAction?.mode);
  const gestureLocked=()=>isDockGesture()||currentAction?.mode==='cheer';
  const keys=new Set(),joy={x:0,y:0};
  let nearbyShrine=null,shrineX=NaN,shrineZ=NaN;
  function refreshNearby(force=false) {
    let next=null,best=Infinity;
    for(const [id,z] of Object.entries(zones)){
      const d=distance(player,z),radius=z.radius || (id==='shrine'?3.8:3);
      if(d<radius && d<best){next=id;best=d;}
    }
    if(seated)next='smoking';
    const zoneChanged=force||next!==near;
    near=next;
    let shrineChanged=false;
    if(shrineX!==player.x||shrineZ!==player.z){
      const target=nextToShrine();
      shrineChanged=Number.isNaN(shrineX)||target?.kind!==nearbyShrine?.kind||target?.id!==nearbyShrine?.id;
      nearbyShrine=target;shrineX=player.x;shrineZ=player.z;
    }
    if(zoneChanged)options.onNearby?.(next);
    if(shrineChanged)options.onShrineNearby?.(nearbyShrine);
    notifySeat(force);
  }
  function cancelPlan() {if(plan) {const old=plan;plan=null;old.resolve?.({id:old.id,arrived:false,canceled:true});}}
  function autopilot(target,id,autoOpen,quick,keepView=false) {
    if(gestureLocked())return Promise.resolve({id,arrived:false,canceled:true});
    if(seated)standUp();
    cancelPlan();currentAction=null;railView=null;
    if(!keepView&&id)openingVista=false;
    const nodes=route(player,target);
    if(!nodes.length) {options.onHint?.('산책로 쪽을 눌러 이동해 주세요.');return Promise.resolve({id,arrived:false,canceled:false});}
    marker(nodes.at(-1));
    return new Promise(resolve=>{plan={id,nodes,at:0,autoOpen,quick,keepView,resolve,target};});
  }
  function dockLane(id) {
    const dock=zones[id];
    const track=id==='departure'?dock.anchor.x-.778:dock.x;
    const prefer=distance(player,dock)<3?player.z-dock.z:Math.sin(spawnAngle)*1.6;
    const lanes=[0,.84,-.84,1.68,-1.68,2.45,-2.45].sort((a,b)=>Math.abs(a-prefer)-Math.abs(b-prefer));
    let best={x:track,z:dock.z},bestSpace=-1;
    for(const lane of lanes){
      const candidate={x:track,z:dock.z+lane};if(!canWalk(candidate.x,candidate.z))continue;
      let room=Infinity;for(const p of peers.values())room=Math.min(room,Math.hypot(candidate.x-p.tx,candidate.z-p.tz));
      if(room>=.79)return candidate;
      if(room>bestSpace){best=candidate;bestSpace=room;}
    }
    return best;
  }
  function goTo(id,autoOpen=true) {
    if(disposed || !zones[id])return Promise.resolve({id,arrived:false,canceled:true});
    const target=id==='departure'||id==='arrival'?dockLane(id):zones[id];
    return autopilot(target,id,!['yard','arrival','departure','shrine'].includes(id) && autoOpen,true);
  }
  function finishPlan() {
    const done=plan;if(!done)return;
    plan=null;
    if(done.id) {
      const z=zones[done.id];heading=z.yaw ?? z.facing ?? heading;refreshNearby();
      if (time-gestureTime>.9 && !['arrival','departure'].includes(done.id)){
        if(['shrine','yard','smoking'].includes(done.id))cameraYaw=heading+Math.PI;
        if(done.id==='control')cameraYaw=heading+Math.PI;
        if(done.id==='shark')frameSharkFromHere();
        railView=done.id;
      }
      if (done.autoOpen && !disposed) options.onZone?.(done.id);
    }
    done.resolve?.({id:done.id,arrived:true,canceled:false});
  }
  function moveWithCollision(dx,dz){
    const startX=player.x,startZ=player.z;
    const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
    for(let i=0;i<n;i++){
      const x=player.x+dx/n,z=player.z+dz/n;
      if(canWalk(x,z)&&!portVehicles.blocks(x,z)) {player.x=x;player.z=z;}
      else if(canWalk(x,player.z)&&!portVehicles.blocks(x,player.z))player.x=x;
      else if(canWalk(player.x,z)&&!portVehicles.blocks(player.x,z))player.z=z;
      else break;
    }
    player.y=measuredGround(player.x,player.z);
    return Math.hypot(player.x-startX,player.z-startZ);
  }
  function walk(step,dt){
    if (!plan)return 0;
    let moved=0;
    while(plan && step>.0001) {
      const next=plan.nodes[plan.at], d=distance(player,next);
      if(d<.055) {
        moved+=moveWithCollision(next.x-player.x,next.z-player.z);
        if(++plan.at>=plan.nodes.length){finishPlan();break;}continue;
      }
      const v=Math.min(step,d);
      heading=turn(heading,yawTo(player,next),dt);
      const achieved=moveWithCollision((next.x-player.x)/d*v,(next.z-player.z)/d*v);
      moved+=achieved;step-=v;
      if(achieved<.012 && v>.04){cancelPlan();break;}
      if(v>=d-.005 && ++plan.at>=plan.nodes.length){finishPlan();break;}
    }
    return moved;
  }
  function palmMark(at,beat,localHand) {
    const wrapper=element('div','position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;');
    wrapper.className='harbor-palm-beat';wrapper.dataset.beat=String(beat);
    const burst=element('span','position:absolute;inset:0;');
    const palm=element('i','position:absolute;left:-5px;top:-3px;width:10px;height:10px;border-radius:48% 48% 54% 54%;background:#ffdfad;box-shadow:0 0 0 1px #775c454d;');
    palm.style.transform='rotate('+(beat===1?-12:12)+'deg) scaleX('+(beat===1?1:-1)+')';
    for(const [x,y,h,tilt] of [[-3,1,6,-40],[0,-5,7,-8],[3,-7,8,0],[6,-6,7,6],[9,-3,5,18]]){
      const finger=element('i','position:absolute;width:3px;border-radius:3px;background:#ffdfad;');
      Object.assign(finger.style,{left:x+'px',top:y+'px',height:h+'px',transform:'rotate('+tilt+'deg)'});palm.append(finger);
    }
    burst.append(palm);
    if(!reduceMotion){
      for(let i=0;i<5;i++){
        const line=element('i','display:block;position:absolute;left:-1px;top:-1px;width:3px;height:8px;border-radius:3px;background:#fff2aa;box-shadow:0 0 0 1px #925b394d;transform-origin:1.5px 1px;');
        line.style.transform='rotate('+(i*72+17)+'deg) translateY(-11px)';burst.append(line);
      }
    }
    wrapper.append(burst);labels.append(wrapper);
    palmMarks.push({wrapper,at:at.clone(),since:time,beat,local:localHand});
  }
  function paintMarks() {
    for(let i=palmMarks.length-1;i>=0;i--){
      const mark=palmMarks[i],u=(time-mark.since)/(reduceMotion?.30:.37);
      if(u>=1){mark.wrapper.remove();palmMarks.splice(i,1);continue;}
      labelPoint.copy(mark.at).project(camera);
      if(labelPoint.z<0||labelPoint.z>=1||Math.abs(labelPoint.x)>1.12||Math.abs(labelPoint.y)>1.12){mark.wrapper.style.visibility='hidden';continue;}
      mark.wrapper.style.visibility='visible';
      const x=(labelPoint.x+1)*width/2,y=(1-labelPoint.y)*height/2;
      const size=reduceMotion?1:(.94+.16*Math.sin(Math.PI*u));
      mark.wrapper.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) scale('+size+')';
      mark.wrapper.style.opacity=String(Math.min(1,Math.max(0,(1-u)*3)));
    }
  }
  function showImpact(at,mode,affectsShip=true,beat=1,isLocal=false) {
    if(mode==='push')palmMark(at,beat,isLocal);
    else {
      const {texture,aspect}=pullLabel;
      const mat=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false});
      const sprite=new THREE.Sprite(mat);sprite.position.set(at.x,at.y+.48,at.z);sprite.scale.set(aspect*.75,.75,1);sprite.renderOrder=8;scene.add(sprite);
      effects.push({mesh:sprite,base:sprite.position.clone(),start:time,duration:.68,aspect});
    }
    options.onPalmContact?.({local:isLocal,beat,mode,point:{x:at.x,y:at.y,z:at.z}});
    if(!affectsShip)return;
    if(mode==='push') {
      shipPush=reduceMotion?.38:beat===1?.84:1;actionWave=time;littleRing.position.copy(at);littleRing.position.x-=.055;littleRing.visible=!reduceMotion;
      wave.position.set(departure.x+.49,-.48,at.z+(beat===1?.6:-.55));wave.visible=true;
      if(!reduceMotion)for(let i=0;i<6;i++){
        const m=new THREE.Mesh(splashGeo,splashMat),angle=Math.PI*2*i/6;m.position.copy(at);scene.add(m);
        effects.push({mesh:m,base:at.clone(),start:time,duration:.30,velocity:new V3(-.35-Math.random()*.17,Math.sin(angle)*.85,Math.cos(angle)*.85)});
      }
    } else shipPull=1;
  }
  function slapPoseAtFrame(record,elapsed) {
    const due=PALM_CONTACTS[record.beats];
    // A slow frame must still show flat palms on the steel at the instant
    // its contact mark appears, even if it skipped over the short hold.
    return palmPose(due!==undefined && elapsed>=due ? due : elapsed);
  }
  function dispatchContacts(actor, record, mode, elapsed, own, affectsShip) {
    if(!mode || elapsed<0)return;
    const times=mode==='push'?PALM_CONTACTS:[.43];
    while(record.beats<times.length && elapsed>=times[record.beats]){
      const beat=++record.beats;
      const hand=mode==='push' && beat===2?actor.handL:actor.handR;
      hand.getWorldPosition(handPoint);
      if(mode==='push')handPoint.x=Math.min(departure.anchor.x-.022,handPoint.x);
      showImpact(handPoint,mode,affectsShip,beat,own);
    }
  }
  function startGesture(mode) {
    currentAction={mode,start:time,beats:0};
    if(mode==='push'||mode==='pull')localSignal={mode,id:crypto.randomUUID(),at:Date.now()};
  }
  const callFor=mode=>mode==='push'?departureCall:mode==='pull'?arrivalCall:null;
  function contactPoint(mode,z=player.z) {
    const dock=mode==='push'?departure:arrival;
    return {x:mode==='push'?dock.anchor.x-.778:dock.x,z:dock.z+clamp(z-dock.z,-2.42,2.42)};
  }
  async function approachContact(mode,z) {
    const call=callFor(mode);if(!call||gestureLocked()||blocked())return;
    const ownPoint=contactPoint(mode);
    const intent=++contactIntent,target=distance(player,ownPoint)<.32?ownPoint:contactPoint(mode,z);
    if(distance(player,target)>.12) {
      const result=await autopilot(target,null,false,true,true);
      if(!result.arrived)return;
    }
    if(intent!==contactIntent||callFor(mode)?.id!==call.id||blocked()||distance(player,target)>.25)return;
    options.onDockContact?.(mode,call.id);
  }
  function attemptDockAction(mode) {
    const id=mode==='push'?'departure':mode==='pull'?'arrival':null;
    const call=callFor(mode);
    if(!id || !call || disposed || !active || aligning || gestureLocked())return null;
    const spot=zones[id];if(distance(player,spot)>(spot.radius || 3)+.45)return null;
    const target=contactPoint(mode);cancelPlan();aligning=true;
    return (async()=>{
      try {
        if(distance(player,target)>.038){
          const result=await autopilot(target,null,false,true,true);
          if(!result.arrived||disposed||!active||callFor(mode)?.id!==call.id||distance(player,target)>.19)return false;
        }
        heading=spot.yaw ?? heading;
        startGesture(mode);return true;
      }finally{aligning=false;}
    })();
  }
  function actAtDock(mode){return attemptDockAction(mode) || Promise.resolve(false);}
  const seatList=set.seats||[];
  const seatedMotion=motion=>motion==='sit'||motion==='sit-smoke';
  const smokeMotion=motion=>motion==='smoke'||motion==='sit-smoke';
  const seatX=s=>s.x+Math.sin(s.yaw)*.15,seatZ=s=>s.z+Math.cos(s.yaw)*.15;
  function seatAt(x,z){return seatList.find(s=>Math.hypot(x-seatX(s),z-seatZ(s))<.28);}
  function occupied(seat){
    for(const peer of peers.values())if(peer.seat?.id===seat.id)return true;
    return false;
  }
  function nearestFreeSeat(){
    let best=null,d=Infinity;
    for(const seat of seatList){
      const len=distance(player,seat.approach);
      if(len<d&&!occupied(seat)){best=seat;d=len;}
    }
    return best;
  }
  const nearSmoking=p=>Boolean(zones.smoking &&
    ((distance(p,zones.smoking)<zones.smoking.radius&&canWalk(p.x,p.z))||seatAt(p.x,p.z)));
  function getSeatState(){
    return {seated:Boolean(seated),seatId:seated?.id||null,available:!seated&&nearSmoking(player)&&Boolean(nearestFreeSeat())};
  }
  function notifySeat(force=false){
    const state=getSeatState(),key=(state.seatId||'')+':'+state.available;
    if(force||key!==lastSeatKey){lastSeatKey=key;options.onSeatChange?.(state);}
  }
  function standUp(){
    if(!seated)return false;
    lastSeat=seated;seated=null;
    const a=lastSeat.approach;player.set(a.x,measuredGround(a.x,a.z),a.z);
    currentAction=null;lastMove=time;localSignal=null;refreshNearby(true);return true;
  }
  async function sitAt(id){
    if(disposed||blocked()||aligning||gestureLocked())return false;
    if(seated?.id===id)return true;
    const seat=seatList.find(s=>s.id===id);
    if(!seat||occupied(seat)){options.onHint?.('이미 다른 산책자가 앉아 있어요.');return false;}
    if(seated)standUp();
    const a=seat.approach;
    if(distance(player,a)>.10){
      const walk=await autopilot(a,null,false,true,true);
      if(!walk.arrived||distance(player,a)>.20||disposed||blocked())return false;
    }
    if(occupied(seat)){options.onHint?.('다른 산책자가 먼저 앉았어요.');return false;}
    cancelPlan();currentAction=null;localSignal=null;lastSeat=seated=seat;lastMove=-100;
    player.set(seatX(seat),measuredGround(seat.x,seat.z),seatZ(seat));
    heading=seat.yaw;refreshNearby(true);return true;
  }
  async function toggleSeat(){
    if(seated)return standUp();
    if(!nearSmoking(player))return false;
    const seat=nearestFreeSeat();if(!seat){options.onHint?.('지금은 빈 벤치가 없어요.');return false;}
    return sitAt(seat.id);
  }
  function smoke() {
    if(disposed||blocked()||!nearSmoking(player)||gestureLocked()||aligning||currentAction?.mode==='smoke')return false;
    cancelPlan();const id=smokingId(Date.now()+serverClockOffset);
    currentAction={mode:'smoke',start:time,smokeAt:performance.now(),id};localSignal=null;
    return true;
  }
  const nearEomuk=p=>distance(p,zones.eomuk)<=zones.eomuk.radius&&canWalk(p.x,p.z);
  async function visitFoodStall(){
    if(!nearEomuk(player)){
      const walk=await autopilot(zones.eomuk,null,false,true,true);
      if(!walk.arrived||disposed||blocked()||!nearEomuk(player))return;
    }
    options.onZone?.('eomuk');
  }
  function eatFishcake(){
    if(disposed||blocked()||!nearEomuk(player)||seated||gestureLocked()||aligning||currentAction?.mode==='eat')return false;
    cancelPlan();currentAction={mode:'eat',food:'eomuk',start:time,id:crypto.randomUUID()};localSignal=null;return true;
  }
  function act(mode) {
    if(mode==='eat')return eatFishcake();
    if(mode==='smoke')return smoke();
    if(mode==='sit')return toggleSeat();
    if(mode==='coffee'||mode==='phone'){if(gestureLocked()||aligning)return false;startGesture(mode);return true;}
    return Boolean(attemptDockAction(mode));
  }

  let active=options.active!==false;
  const dirVector=new V3(),handPoint=new V3();
  let departureCall=null,arrivalCall=null,neighborCalls=[],vesselId='';
  function guardianFront(p,spot){
    const front=spot.front||courtFront;
    return (p.x-spot.x)*front.x+(p.z-spot.z)*front.z>1.25&&distance(p,spot)<5.45;
  }
  const atCourt=(p)=>canWalk(p.x,p.z)&&(distance(p,zones.shrine)<zones.shrine.radius || court.spots.some(s=>guardianFront(p,s)));
  const canCheerHere=()=>!!(active&&!disposed&&!gestureLocked()&&!aligning&&atCourt(player));
  async function approachGuardian(id) {
    const spot=court.spots.find(s=>s.id===id);
    if(!spot||!active||disposed||aligning||gestureLocked())return false;
    if(guardianFront(player,spot)){
      heading=yawTo(player,spot);return true;
    }
    const target=spot.approach||{x:spot.x+courtFront.x*4.1,z:spot.z+courtFront.z*4.1};
    const result=await autopilot(target,null,false,true,true);
    if(!result.arrived||!canCheerHere())return false;
    heading=yawTo(player,spot);return true;
  }
  const cheerAge=action=>Math.max(0,(performance.now()-action.cheerAt)/1000);
  function cheer(call,{requestId=crypto.randomUUID(),guardianId,direction=call?.direction}={}) {
    if(!call?.id||!call.name||!canCheerHere())return false;
    const guardian=court.spots.find(s=>s.id===guardianId);
    cancelPlan();heading=yawTo(player,guardian||courtCenter);lastMove=time;
    const trade=direction==='import'?'import':'export';
    const voyage=(trade==='import'?call.inboundVoy:call.outboundVoy)||call.voy;
    currentAction={mode:'cheer',start:time,cheerAt:performance.now(),beats:0,call:{id:call.id,name:call.name,voy:voyage,direction:trade},requestId};
    localSignal={mode:'cheer',id:requestId,at:Date.now()};
    cheers.exclaim(selfSpeaker,localAnchor,currentAction.call,0,performance.now()/1000);
    options.onOwnCheerBeat?.(currentAction.call,0,trade);
    return true;
  }
  function setVessel(vessel){
    bindVessels({departure:vessel,arrival:arrivalCall,neighbors:neighborCalls});
  }
  function bindVessels({departure:out=null,arrival:incoming=null,personal=out}={}) {
    if(out?.id!==vesselId||incoming?.id!==arrivalCall?.id)contactIntent++;
    departureCall=out;arrivalCall=incoming;neighborCalls=[];vesselId=personal?.id||'';
    vesselConfirmedAt=personal&&!personal.isDemo&&personal.atdVerified===true&&personal.atd||null;
    set.bindVessels?.({departure:personal?{...personal,voy:personal.outboundVoy||personal.voy}:null,
      arrival:personal?{...personal,voy:personal.inboundVoy||personal.voy}:null,neighbors:[]});
  }

  function getPresence(){
    const gesture=currentAction?.mode;
    const motion=seated?(gesture==='smoke'?'sit-smoke':'sit'):gesture&&['push','pull','cheer','coffee','phone','smoke','eat'].includes(gesture)?gesture:time-lastMove<.19?'walk':'idle';
    return {x:+player.x.toFixed(3),z:+player.z.toFixed(3),yaw:+heading.toFixed(3),motion,cargoId:carriedCargoId,
      actionId:gesture==='smoke'||gesture==='eat'?currentAction.id:localSignal && Date.now()-localSignal.at<(gesture==='cheer'?4100:2800)?localSignal.id:null};
  }
  function removePeer(id,p) {
    removeFigure(p.fig);p.label.remove();peers.delete(id);
  }
  function setLivePeers(list=[],serverTime=Date.now()) {
    const now=Date.now(), expected=new Set();
    if(Number.isFinite(serverTime))serverClockOffset=serverTime-now;
    for(const row of Array.isArray(list)?list:[]) {
      if(!row || !row.id || row.isSelf || expected.has(row.id))continue;
      const stamp=Number(row.updatedAt),age=Math.max(0,(Number(serverTime)||now)-stamp);
      const x=Number(row.x),z=Number(row.z),yaw=Number(row.yaw);
      const seat=seatedMotion(row.motion)?seatAt(x,z):null;
      if(!Number.isFinite(stamp)||!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(yaw)||age>22000||(!seat&&!canWalk(x,z)))continue;
      expected.add(row.id);
      let p=peers.get(row.id);
      if(!p){
        const label=element('div','position:absolute;left:0;top:0;display:none;padding:3px 8px;border-radius:10px;color:#fffaf0;background:rgba(27,50,62,.91);border:1px solid #ffffffaa;box-shadow:0 1px 4px #0b263048;font:700 12px/1.35 system-ui;white-space:nowrap;max-width:18em;overflow:hidden;text-overflow:ellipsis;');
        label.className='harbor-live-nickname';labels.append(label);
        p={fig:addFigure(row.style==='vest'?'vest':row.style==='honghong'?'honghong':'cardigan'),style:row.style,label,tx:x,tz:z,yaw,ts:0,seen:now,started:-10000,actionMode:null,queue:[],played:new Map(),beats:0,vx:0,vz:0,walk:0,phase:stableRandom()*5};
        p.fig.group.position.set(x,measuredGround(x,z),z);p.fig.group.rotation.y=yaw;peers.set(row.id,p);
      }
      if(stamp<p.ts)continue;
      if(p.style!==row.style) {
        const previous=p.fig.group;removeFigure(p.fig);p.fig=addFigure(row.style==='vest'?'vest':row.style==='honghong'?'honghong':'cardigan');
        p.fig.group.position.copy(previous.position);p.fig.group.rotation.y=previous.rotation.y;p.style=row.style;
      }
      if(p.label.textContent!==row.name)p.label.textContent=String(row.name || '항구 방문자').slice(0,24);
      if(stamp!==p.ts){
        const interval=(stamp-p.ts)/1000;p.received=now;
        p.vx=p.ts&&interval>0?clamp((x-p.tx)/interval,-TRAVEL_SPEED,TRAVEL_SPEED):0;p.vz=p.ts&&interval>0?clamp((z-p.tz)/interval,-TRAVEL_SPEED,TRAVEL_SPEED):0;
      }
      const smoking=smokeMotion(row.motion)&&nearSmoking({x,z});
      if(smoking && (!smokeMotion(p.motion)||(row.actionId&&p.smokeId!==row.actionId))){
        const serverNow=Number(serverTime)||now;
        const started=smokingStart(row.actionId,stamp,serverNow);
        p.smokeAt=performance.now()-Math.max(0,serverNow-started);p.smokeId=row.actionId;
      }
      const eating=row.motion==='eat'&&row.actionId&&nearEomuk({x,z});
      if(eating&&p.eatId!==row.actionId){p.eatId=row.actionId;p.eatAt=time-Math.min(EAT_DURATION,age/1000);}
      p.seat=seat;p.tx=x;p.tz=z;p.yaw=seat?seat.yaw:yaw;p.ts=stamp;p.seen=now-age;p.motion=(smokeMotion(row.motion)&&!smoking)||(row.motion==='eat'&&!eating)?'idle':row.motion;
      const signals=Array.isArray(row.recentActions)?[...row.recentActions]:[];
      if(row.actionId && ['push','pull'].includes(row.motion))signals.push({id:row.actionId,mode:row.motion,at:stamp});
      for(const event of signals) {
        const at=Number(event.at),latency=(Number(serverTime)||now)-at;
        if(!event.id||p.played.has(event.id)||!Number.isFinite(at)||latency>4100||latency< -1000)continue;
        if(event.mode==='cheer'){
          if(!atCourt({x,z}))continue;
        }else{
          const dock=event.mode==='push'?departure:event.mode==='pull'?arrival:null;
          if(!dock||Math.abs(x-dock.x)>1.7||Math.abs(z-dock.z)>3.3)continue;
        }
        p.played.set(event.id,now);p.queue.push({id:event.id,mode:event.mode,direction:event.direction,
          name:'같은 마음으로',accepted:now-Math.max(0,latency)});
      }
      for(const [id,seen] of p.played)if(now-seen>9000)p.played.delete(id);
      if(Math.hypot(p.fig.group.position.x-x,p.fig.group.position.z-z)>10)p.fig.group.position.set(x,measuredGround(x,z),z);
    }
    for(const [id,p] of peers)if(!expected.has(id))removePeer(id,p);
    // Two visitors may arrive between snapshots. Both see the same tie-break.
    const selfId=options.getSelfId?.();
    if(seated&&selfId)for(const [id,p] of peers)if(p.seat?.id===seated.id&&id<selfId){
      standUp();options.onHint?.('다른 산책자가 먼저 앉았어요.');break;
    }
    syncCargoVisuals();
    notifySeat();
  }
  // Timetable memberships are historical. Only live position snapshots create avatars.
  function setPeers(){}
  function setNeighbors(calls){bindVessels({departure:departureCall,arrival:arrivalCall,neighbors:calls});}
  async function goToPeer(id) {
    const peer=peers.get(id);
    if(disposed || !peer || Date.now()-peer.seen>22000)return {arrived:false,id,offline:true};
    const destination={x:peer.tx,z:peer.tz}, a=yawTo(destination,player);
    let target=null;
    for(const offset of [0,.7,-.7,1.5,-1.5,Math.PI]) {
      const x=destination.x+Math.sin(a+offset)*1.2,z=destination.z+Math.cos(a+offset)*1.2;
      if(canWalk(x,z)){target={x,z};break;}
    }
    if(!target)return {arrived:false,id};
    const result=await autopilot(target,null,false,true);
    if(!result.arrived)return {...result,id};
    const live=peers.get(id);
    if(!live)return {arrived:false,id,offline:true};
    heading=yawTo(player,{x:live.tx,z:live.tz});
    if(time-gestureTime>.9)cameraYaw=heading+Math.PI+.64;
    const moved=distance(player,{x:live.tx,z:live.tz})>3;
    if(moved)options.onHint?.('상대가 이동했어요. 최신 위치에서 다시 만날 수 있어요.');
    return {arrived:true,id,moved};
  }
  const labelPoint=new V3();
  // Fixed center of the animal's short patrol, relative to the quay marker.
  const sharkPool=new V3(zones.shark.x-7.05,-.55,zones.shark.z+.20);
  function frameSharkFromHere(){
    heading=yawTo(player,sharkPool);cameraYaw=heading+Math.PI;
    openingVista=false;railView='shark';
  }
  let selectedSharkDish='steak';
  const sharkMenu=element('section','position:absolute;z-index:40;left:50%;bottom:13%;transform:translateX(-50%);width:min(340px,calc(100% - 30px));padding:16px;border:1px solid #e7c58e;border-radius:18px;background:rgba(31,48,47,.96);box-shadow:0 12px 34px #081c20a8;color:#fff5df;font:600 14px/1.45 system-ui;pointer-events:auto;');
  sharkMenu.hidden=true;sharkMenu.setAttribute('aria-label','상어 요리 메뉴');host.append(sharkMenu);
  function hideSharkMenu(){sharkMenu.hidden=true;sharkMenu.replaceChildren();}
  function showSharkMenu(stage){
    sharkMenu.replaceChildren();
    const title=element('div','font-size:17px;font-weight:850;margin:0 0 10px;text-align:center;');
    title.textContent=stage==='choose'?'상어 요리 고르기':'요리가 완성됐어요!';
    sharkMenu.append(title);
    const addChoice=(label,action)=>{
      const button=element('button','display:block;width:100%;margin:7px 0;padding:11px 13px;border:1px solid #d6b77e;border-radius:12px;background:#f3d9a7;color:#4b392b;font:800 14px system-ui;cursor:pointer;');
      button.type='button';button.textContent=label;button.addEventListener('click',action);sharkMenu.append(button);
    };
    if(stage==='choose'){
      addChoice('🥩 상어 스테이크',()=>chooseSharkDish('steak'));
      addChoice('🍲 상어 수프',()=>chooseSharkDish('soup'));
      addChoice('🍣 상어회',()=>chooseSharkDish('sashimi'));
    }else addChoice('🍽️ 요리 먹기',startEatingShark);
    addChoice('닫기',hideSharkMenu);
    sharkMenu.hidden=false;
  }
  function chooseSharkDish(dish){
    if(!harborLife.chooseSharkDish?.(dish))return;
    selectedSharkDish=dish;hideSharkMenu();
    for(const [kind,food] of Object.entries(dishFoods))food.visible=kind===dish;
    options.onHint?.((dish==='steak'?'상어 스테이크':dish==='soup'?'상어 수프':'상어회')+'를 요리하고 있어요. 잠시 기다려 주세요.');
  }
  function startEatingShark(){
    if(!harborLife.beginEatingShark?.())return;
    hideSharkMenu();cancelPlan();currentAction={mode:'eat',food:'shark',dish:selectedSharkDish,start:time,id:crypto.randomUUID()};localSignal=null;
    options.onHint?.('손에 든 상어 요리를 먹는 중이에요!');
  }
  function watchShark() {
    if(!active||disposed||distance(player,zones.shark)>zones.shark.radius)return false;
    if(railView!=='shark')frameSharkFromHere();
    const result=harborLife.fishShark?.()||'busy';
    if(result==='ready'){
      if(harborLife.pickUpShark?.(local.group))options.onHint?.('상어를 품에 안았어요! 포장마차로 가져가 E키를 눌러 건네주세요.');
      else options.onHint?.('상어를 낚았어요!');
    }else if(result==='cast')options.onHint?.('미끼를 던졌어요. 상어가 물 때까지 잠깐 기다려요.');
    else if(result==='waiting')options.onHint?.('미끼를 물 때까지 기다려요. 물면 E키를 빠르게 연타!');
    else if(result==='reeling')options.onHint?.('좋아! 낚싯줄을 당기는 중이에요. 계속 E키 연타!');
    else if(result==='caught'){options.onFishCaught?.();options.onHint?.('상어를 낚았어요! 눈이 X가 됐어요. E키를 한 번 더 눌러 들어 올리세요.');}
    else if(result==='carrying')options.onHint?.('상어를 들고 있어요. 포장마차로 가서 E키를 눌러 건네주세요.');
    return true;
  }
  function interactSharkAtStall(){
    if(!active||disposed||distance(player,zones.eomuk)>zones.eomuk.radius)return false;
    const result=harborLife.interactSharkAtStall?.();
    if(result==='menu'){showSharkMenu('choose');options.onHint?.('상어를 포장마차에 건넸어요. 요리를 골라 주세요.');}
    else if(result==='eatMenu'){showSharkMenu('eat');}
    else return false;
    return true;
  }
  function placeLabels() {
    camera.updateMatrixWorld();
    office.paintSpeech(camera,player,width,height);
    cheers.paint(camera,player,width,height,performance.now()/1000,local.group);
    for(const p of peers.values()){
      if(!active || !p.fig.group.visible || distance(player,p.fig.group.position)>36){p.label.style.display='none';continue;}
      labelPoint.copy(p.fig.group.position);labelPoint.y+=2.53;labelPoint.project(camera);
      if(labelPoint.z<=-1||labelPoint.z>=1||Math.abs(labelPoint.x)>1.02||Math.abs(labelPoint.y)>1.02){p.label.style.display='none';continue;}
      const sx=Math.round((labelPoint.x+1)*width/2),sy=Math.round((1-labelPoint.y)*height/2);
      p.label.style.transform='translate('+sx+'px,'+sy+'px) translate(-50%,-100%)';p.label.style.display='block';
    }
  }
  function setProfile(value) {
    profile=value || {};const next=profile.style==='vest'?'vest':profile.style==='honghong'?'honghong':'cardigan';if(next===style)return;
    removeFigure(local);style=next;local=addFigure(style);local.group.position.copy(player);local.group.rotation.y=heading;updateShadow(local);
  }
  let drops=null;
  function setWeather(input) {
    const type=typeof input==='object'?input?.code:input;
    const next=['rain','snow','cloud','clear'].includes(type)?type:'clear';
    if(next===weather)return;weather=next;lastKst=-100;
    if(drops){scene.remove(drops);drops.geometry.dispose();drops.material.dispose();drops=null;}
    if(weather!=='rain'&&weather!=='snow')return;
    const data=new Float32Array(380*3);for(let i=0;i<data.length;i+=3){data[i]=(Math.random()-.5)*49;data[i+1]=Math.random()*17;data[i+2]=(Math.random()-.5)*49;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));
    drops=new THREE.Points(g,new THREE.PointsMaterial({color:weather==='snow'?0xffffff:0xbcddeb,size:weather==='snow'?.12:.08,transparent:true,opacity:.75,depthWrite:false}));drops.frustumCulled=false;scene.add(drops);
  }
  function setLight(value) {modeLight=['day','night','dusk'].includes(value)?value:'auto';lastKst=-100;}
  function ambient(dt) {
    for(const visual of cargoVisuals.values()){
      const pulse=1+.08*Math.sin(time*3.2+(visual.id?.length||0));
      const aura=visual.getObjectByName('cargo-aura');if(aura)aura.scale.setScalar(pulse);
      const outer=visual.getObjectByName('cargo-aura-outer');if(outer)outer.scale.setScalar(1.18-pulse*.12);
    }
    if(time-lastKst>10) {
      const k=(new Date().getUTCHours()+9)%24;
      const amount=modeLight==='auto'?(k<6||k>=20?.92:k>=18||k<8?.47:0):modeLight==='night'?.92:modeLight==='dusk'?.47:0;
      night=amount;lastKst=time;
      const cover=weather==='cloud'?.19:weather==='rain'||weather==='snow'?.30:0;paintSky(night,cover);
      sky.copy(daySky).lerp(nightSky,night);air.color.copy(fogDay).lerp(fogNight,night);
      if(cover){sky.lerp(new THREE.Color(0x93a8b7),cover);air.color.lerp(sky,cover);}
      skyLight.color.setHex(0xe4f4ff).lerp(new THREE.Color(0xa7bdeb),night);
      skyLight.groundColor.setHex(0xa69c82).lerp(new THREE.Color(0x777e9e),night);
      sun.color.setHex(0xffe1bb).lerp(new THREE.Color(0xc3d8f3),night);
      sun.intensity=mix(2.5,1.12,night)*(1-cover);skyLight.intensity=mix(1.7,1.24,night);
      bounce.intensity=mix(.4,.91,night);renderer.toneMappingExposure=mix(1.04,1.05,night);
    }
    if(drops){
      const data=drops.geometry.attributes.position;
      for(let i=0;i<data.count;i++){let y=data.getY(i)-dt*(weather==='snow'?1.6:10);if(y<0)y+=17;data.setY(i,y);}
      data.needsUpdate=true;drops.position.set(player.x,0,player.z);
    }
  }

  let width=0,height=0,railView=null,gestureTime=-100;
  function resize() {
    const r=container.getBoundingClientRect();if(r.width<1||r.height<1)return;
    if(width===Math.round(r.width) && height===Math.round(r.height))return;
    if(initialCamera&&openingVista){
      // Frame the broad terminal board behind the clerk, leaving the working
      // ship on the east edge. A narrow phone needs a larger initial yaw.
      const aspect=r.width/r.height;
      cameraYaw=clamp(.27-.07*aspect,.15,.24);
      cameraPitch=aspect<.85?.34:.36;
    }
    width=Math.round(r.width);height=Math.round(r.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function home() {
    openingVista=false;railView=near==='shrine'||near==='yard'?near:null;
    cameraYaw=near==='arrival'?.87:['smoking','shrine','yard','control'].includes(near)?zones[near].yaw+Math.PI:BASE_YAW;
    cameraPitch=.25;zoom=1;
  }
  function zoomBy(delta) {if(railView==='shark')railView=null;zoom=clamp(zoom+delta,.66,1.85);}
  const cameraGuard=makeVesselCameraGuard(THREE,set.collisionHullSpec);
  const cameraOrigin=new V3();
  function adjustView(dt) {
    cameraGuard.update();
    const horizontal=width/Math.max(height,1);
    const showCourt=railView==='shrine' && near==='shrine' && !plan;
    const showYard=railView==='yard' && near==='yard' && !plan;
    const showBoard=railView==='control' && near==='control' && !plan;
    // A short wide opening shot includes the length of the quay without
    // shrinking the avatar. Return to a tighter lens when players take over.
    const showShark=near==='shark'&&railView==='shark'&&!plan;
    const sharkFov=horizontal<.9?65:Math.max(43,2*THREE.MathUtils.radToDeg(Math.atan(.65/horizontal)));
    const fov=showShark?sharkFov:(showCourt||showBoard)&&horizontal<.85?63:openingVista?(horizontal<.85?64:50):showYard?48:43;
    if(Math.abs(camera.fov-fov)>.025){camera.fov=initialCamera?fov:ease(camera.fov,fov,dt*8);camera.updateProjectionMatrix();}
    const radius=cameraGuard.padding(camera);
    const vista=openingVista||showYard;
    const range=(openingVista?21:showYard?10.0:horizontal<.9?10.6:9.85)/zoom;
    const y=range*Math.sin(cameraPitch),xz=range*Math.cos(cameraPitch);
    const forwardX=-Math.sin(cameraYaw),forwardZ=-Math.cos(cameraYaw);
    const lookAhead=vista?2.2:1.85;
    aim.set(player.x+forwardX*lookAhead,player.y+(vista?1.97:1.42),player.z+forwardZ*lookAhead);
    targetOffset.set(Math.sin(cameraYaw)*xz,y,Math.cos(cameraYaw)*xz);
    desired.copy(aim).add(targetOffset);
    if(showCourt){
      const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
      const widthRange=courtSize.x*.5/(tan*horizontal*.94);
      const heightRange=courtSize.y*.5/(tan*.70);
      const lift=horizontal<.85?.135:.065;
      // The central stonework is high. Frame the visitor's feet in front of
      // it as well as the guardian's crown on top, especially on wide screens.
      aim.copy(courtCenter);aim.y-=courtSize.y*.055;
      const visitorDepth=(player.x-aim.x)*courtFront.x+(player.z-aim.z)*courtFront.z;
      const visitorRange=visitorDepth+(aim.y-player.y+lift*visitorDepth)/(tan*.82);
      const zRange=Math.max(Math.max(widthRange,heightRange)+courtSize.z*.5,visitorRange)/zoom;
      desired.set(aim.x+courtFront.x*zRange,aim.y+zRange*lift,aim.z+courtFront.z*zRange);
    }
    if(showBoard){
      const wall=TERMINAL_WALL,frontZ=wall.z+wall.footDepth/2;
      const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
      const boardFit=Math.max(wall.width*.55/(tan*horizontal),wall.height*.58/tan);
      aim.set(wall.x,wall.screenY-.88,frontZ);
      const visitorFit=(player.z-frontZ)+(aim.y-player.y)/(tan*.87);
      const range=Math.max(boardFit,visitorFit)/zoom;
      desired.set(aim.x,aim.y+range*.065,aim.z+range);
    }
    // The map's explicit lookout destination frames the animal. A drag or
    // a step immediately releases this view, as it does at the guardian court.
    if(showShark){
      aim.copy(sharkPool);
      if(horizontal<.9){
        // On portrait screens, look along the route's long axis so the
        // body and wake remain in view through both turns.
        desired.set(.8,7.85,-7.75).multiplyScalar(Math.max(1.06,.62/horizontal)).add(aim);
      }else desired.set(aim.x+9.4,4.1,aim.z);
    }
    cameraOrigin.set(player.x,player.y+1.43,player.z);
    cameraGuard.constrain(cameraOrigin,desired,radius,desired,camera.position,true);
    stopCameraAtWalls(cameraOrigin,desired,radius);
    if(initialCamera){camera.position.copy(desired);lookAt.copy(aim);initialCamera=false;}
    else {const s=1-Math.exp(-dt*7.3);camera.position.lerp(desired,s);lookAt.lerp(aim,s);}
    // Interpolation between two safe positions can cross a moving bow or a
    // convex corner. Validate the actual eye position immediately before draw.
    cameraGuard.constrain(cameraOrigin,camera.position,radius,camera.position);
    stopCameraAtWalls(cameraOrigin,camera.position,radius);
    camera.lookAt(lookAt);
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),walkPlane=new THREE.Plane(new V3(0,1,0),0);
  const pointers=new Map();
  let gesture=null,pinch=null;
  const blocked=()=>!active || !!document.querySelector('dialog[open],.atd-conversation:not([hidden]):not([data-passive="true"])');
  function nextToShrine() {
    let best=null,range=Infinity;
    for(const [side,entry] of Object.entries(court.wishEntries||{})){
      const d=distance(player,entry);if(d<entry.radius && d<range){best={kind:'wish',id:side};range=d;}
    }
    for(const spot of court.spots){const d=distance(player,spot);if(d<range&&guardianFront(player,spot)){range=d;best={kind:'guardian',id:spot.id};}}
    if(best)return best;
    const {left,right}=court.wishEntries;
    if(player.x>=right.x&&player.x<=left.x&&player.z>=zones.shrine.z-zones.shrine.radius*.5&&player.z<=left.z+1&&canWalk(player.x,player.z)){
      const closest=court.spots.reduce((a,b)=>distance(player,a)<=distance(player,b)?a:b);
      return {kind:'court',id:closest.id};
    }
    return null;
  }
  async function goToWish(side) {
    const entry=court.wishEntries?.[side];
    if(!entry||!active||disposed||aligning||gestureLocked())return false;
    if(distance(player,entry)>entry.radius){
      const result=await autopilot(entry,null,false,true);
      if(!result.arrived)return false;
    }
    return true;
  }
  function interactNearShrine() {
    const entry=nextToShrine();if(!entry||gestureLocked()||blocked())return false;
    shrineInteraction(entry.kind==='court'?'guardian':entry.kind,entry.id);return true;
  }
  async function shrineInteraction(kind,id) {
    const spot=kind==='guardian'?court.spots.find(s=>s.id===id):court.wishEntries?.[id];
    if(!spot||gestureLocked())return;
    if(kind==='guardian'){
      options.onShrineInteraction?.(kind,id);
      return;
    }
    if(await goToWish(id))options.onShrineInteraction?.(kind,id);
  }
  // Use the first visible painted object; a stack, crane or another vessel in
  // front of a ship must consume the ray instead of activating a hidden hull.
  function tap(x,y) {
    if(gestureLocked()||aligning)return;
    const bounds=canvas.getBoundingClientRect();
    pointer.set((x-bounds.left)/bounds.width*2-1,-(y-bounds.top)/bounds.height*2+1);
    camera.updateMatrixWorld();scene.updateMatrixWorld(true);ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObjects(scene.children,true).find(h=>{
      if(!h.object.isMesh||h.distance<=camera.near||h.object.material?.opacity<.22)return false;
      for(let o=h.object;o;o=o.parent)if(!o.visible||o===local.group||o===local.shade||o.userData.backgroundOnly)return false;
      return true;
    });
    if(hit){
      for(let o=hit.object;o;o=o.parent){
        if(o===set.mainShip){if(departureCall)approachContact('push',hit.point.z);else options.onDockContact?.('push',null);return;}
        if(o===set.arrivalShip||o===ropeTubes){if(arrivalCall)approachContact('pull',arrival.z);else options.onDockContact?.('pull',null);return;}
        const kind=o.userData.atdInteract;
        if(kind==='departureOffice'){
          if(!office.replay())options.onHint?.('최근 공식 출항 확인 기록을 기다리고 있어요.');
          return;
        }
        if(kind==='board'){options.onTerminalBoard?.();return;}
        if(kind==='wish'||kind==='guardian'){shrineInteraction(kind,kind==='wish'?o.userData.wishSide:o.userData.guardianId);return;}
        if(kind==='eomuk'){visitFoodStall();return;}
        if(kind==='sharkWatch'){goTo('shark',true);return;}
        if(kind==='shark'){options.onHint?.('북항이가 부두 옆을 헤엄치고 있어요.');return;}
        if(kind==='seat'){sitAt(o.userData.seatId);return;}
        if(kind==='smoking'){
          if(nearSmoking(player))options.onZone?.('smoking');else goTo('smoking',true);
          return;
        }
      }
    }
    const point=ray.ray.intersectPlane(walkPlane,new V3());if(!point)return;
    const box=set.worldBounds;
    if(point.x<box.minX-2||point.x>box.maxX+2||point.z<box.minZ-2||point.z>box.maxZ+2)return;
    const target=Object.entries(zones).find(([,z])=>distance(z,point)<1.25);
    if(target)goTo(target[0],false);else autopilot(point,null,false,false);
  }
  const events=new AbortController(),on=(target,name,listener,opts={})=>target.addEventListener(name,listener,{...opts,signal:events.signal});
  on(canvas,'pointerdown',e=>{
    if(blocked() || (e.pointerType==='mouse' && e.button!==0 && e.button!==2))return;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1){gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,drag:false};pinch=null;}
    if(pointers.size===2){const [a,b]=pointers.values();pinch={distance:Math.hypot(b.x-a.x,b.y-a.y),zoom};if(gesture)gesture.drag=true;}
  });
  on(canvas,'pointermove',e=>{
    if(!pointers.has(e.pointerId)||blocked())return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch && pointers.size>=2){if(railView==='shark')railView=null;const [a,b]=pointers.values();zoom=clamp(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(pinch.distance,1),.66,1.85);return;}
    if(!gesture || gesture.id!==e.pointerId)return;
    const d=Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y);if(d>5)gesture.drag=true;
    if(gesture.drag){cameraYaw-=(e.clientX-gesture.lastX)*.008;
      const dy=e.clientY-gesture.lastY;
      cameraPitch=clamp(cameraPitch+dy*.005,.10,.94);
      if(['shrine','yard','shark','control'].includes(railView))railView=null;
      gestureTime=time;canvas.style.cursor='grabbing';}
    gesture.lastX=e.clientX;gesture.lastY=e.clientY;
  });
  function release(e) {
    const g=gesture;pointers.delete(e.pointerId);
    if(g && g.id===e.pointerId && !g.drag && !blocked() && e.type==='pointerup')tap(e.clientX,e.clientY);
    if(pointers.size<2)pinch=null;
    gesture=null;canvas.style.cursor='grab';
  }
  on(canvas,'pointerup',release);on(canvas,'pointercancel',release);on(canvas,'contextmenu',e=>e.preventDefault());
  on(canvas,'wheel',e=>{if(blocked())return;e.preventDefault();zoomBy(clamp(-e.deltaY*.002,-.22,.22));},{passive:false});
  const joystick=element('div','position:absolute;left:14px;bottom:calc(var(--chat-footprint,0px) + max(12px,env(safe-area-inset-bottom)));width:77px;height:77px;display:none;align-items:center;justify-content:center;border-radius:50%;border:1px solid #fff8;background:#173c4a45;touch-action:none;user-select:none;box-shadow:inset 0 0 0 6px #ffffff18;z-index:2;','캐릭터 이동 조이스틱');
  const knob=element('div','width:33px;height:33px;border-radius:50%;border:2px solid #ffffffb0;background:#f9f5e9b3;pointer-events:none;');
  joystick.append(knob);host.append(joystick);
  const touchDevice=window.matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints>0;
  let stickId=null;
  const resetStick=()=>{joy.x=joy.y=0;stickId=null;knob.style.transform='translate(0,0)';};
  function positionStick(e) {const r=joystick.getBoundingClientRect();let x=e.clientX-r.x-r.width/2,y=e.clientY-r.y-r.height/2;const d=Math.hypot(x,y),max=24;const s=d>max?max/d:1;x*=s;y*=s;joy.x=x/max;joy.y=-y/max;knob.style.transform='translate('+x+'px,'+y+'px)';}
  on(joystick,'pointerdown',e=>{if(blocked())return;stickId=e.pointerId;joystick.setPointerCapture(stickId);e.preventDefault();positionStick(e);});
  on(joystick,'pointermove',e=>{if(e.pointerId===stickId)positionStick(e);});
  on(joystick,'pointerup',resetStick);on(joystick,'pointercancel',resetStick);
  on(window,'keydown',e=>{
    const key=e.key.toLowerCase();
    if(e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || blocked() || (e.target.closest?.('input,textarea,select,button,[contenteditable="true"]') && e.target!==canvas))return;
    if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','shift'].includes(key)){keys.add(key);e.preventDefault();}
    if((key==='e'||key==='enter')&&(!e.repeat||near==='shark')&&!gestureLocked()){
      if(carriedCargoId||nearestCargo()){e.preventDefault();e.stopImmediatePropagation();interactCargo();return;}
      if(near==='shark'){e.preventDefault();e.stopImmediatePropagation();watchShark();return;}
      if(interactNearShrine()){e.preventDefault();}
      else if(near&&!['yard','departure','arrival'].includes(near)){e.preventDefault();options.onZone?.(near);}
    }
  });
  on(window,'keyup',e=>keys.delete(e.key.toLowerCase()));
  on(window,'blur',()=>{keys.clear();resetStick();});
  on(document,'visibilitychange',()=>{if(document.hidden){keys.clear();resetStick();}});
  function setActive(next) {
    active=Boolean(next);joystick.style.display=active&&touchDevice?'flex':'none';
    labels.hidden=!active;
    if(!active){
      if(currentAction?.mode==='smoke'||currentAction?.mode==='eat'){currentAction=null;paintBreath(local,-1);}
      contactIntent++;keys.clear();resetStick();cancelPlan();pointers.clear();gesture=null;pinch=null;
    }
    if(active){refreshNearby(true);resize();}
  }
  function motion(dt) {
    const x=joy.x+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const z=joy.y+Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
    let moved=0;
    if(Math.hypot(x,z)<.12||Math.abs(player.z-departure.z)>2.75||player.x<departure.anchor.x-1.3)touchLatched=false;
    if(gestureLocked()){walkMix=ease(walkMix,0,dt*14);refreshNearby();return;}
    if(Math.hypot(x,z)>.12 && !blocked()) {
      if(seated)standUp();
      cancelPlan();currentAction=null;railView=null;
      dirVector.set(x*Math.cos(cameraYaw)-z*Math.sin(cameraYaw),0,-x*Math.sin(cameraYaw)-z*Math.cos(cameraYaw));
      if(dirVector.length()>1)dirVector.normalize();
      heading=turn(heading,Math.atan2(dirVector.x,dirVector.z),dt);
      const running=keys.has('shift');
      const speed=carriedCargoId?(running?CARRY_RUN_SPEED:CARRY_WALK_SPEED):(running?RUN_SPEED:WALK_SPEED);
      moved=moveWithCollision(dirVector.x*dt*speed,dirVector.z*dt*speed);
      if(callFor('push')&&dirVector.x>.42&&player.x>=departure.anchor.x-.79&&Math.abs(player.z-departure.z)<=2.45){
        player.x=departure.anchor.x-.778;
        if(!touchLatched){touchLatched=true;options.onDockContact?.('push',departureCall.id);}
      }
    }else if(plan && !blocked()){
      const speed=carriedCargoId?CARRY_WALK_SPEED:plan.quick?clamp(distance(player,plan.target)*.25+WALK_SPEED,WALK_SPEED,TRAVEL_SPEED):WALK_SPEED;
      moved=walk(dt*speed,dt);
    }
    if(moved>.001){lastMove=time;walkPhase+=Math.min(moved*GAIT_PER_UNIT,14*dt);}
    walkMix=ease(walkMix,moved>.001?1:0,dt*11);
    refreshNearby();
  }
  function pullPulse(age) {
    if(age<0 || age>1.05)return 0;
    return Math.pow(Math.max(0,Math.sin(Math.PI*age/1.05)),.75);
  }
  function playerPose(dt) {
    const action=currentAction,age=action?.mode==='cheer'?cheerAge(action):action?time-action.start:10;
    const slap=action?.mode==='push'?slapPoseAtFrame(action,age):{push:0,backswing:0,recoil:0};
    const smokeAge=action?.mode==='smoke'?(performance.now()-action.smokeAt)/1000:-1;
    const smoking=smokeAge>=0&&smokeAge<SMOKE_DURATION&&nearSmoking(player);
    if(action?.mode==='smoke'&&!smoking)currentAction=null;
    const eating=action?.mode==='eat'&&(action.food==='shark'||nearEomuk(player))&&age<EAT_DURATION;
    if(action?.mode==='eat'&&!eating){
      if(action.food==='shark'&&age>=EAT_DURATION&&harborLife.finishEatingShark?.()){
        options.onFishEaten?.();options.onHint?.('요리를 다 먹었어요. 큰 북항이 상어가 바다로 돌아왔어요.');
      }
      currentAction=null;
    }
    let pull=action?.mode==='pull'?pullPulse(age):0,coffee=0,phone=0;
    if(action?.mode==='coffee'||action?.mode==='phone') {
      const t=Math.min(1,age/2.25);const strength=Math.sin(Math.PI*t);
      if(action.mode==='coffee')coffee=strength;else phone=strength;
      if(t>=1)currentAction=null;
    } else if(!action && time-lastMove>3.2 && walkMix<.1) {
      const phase=(time+1.7)%22;
      coffee=phase>4&&phase<6.6?Math.sin((phase-4)/2.6*Math.PI):0;
      phone=phase>14&&phase<17?Math.sin((phase-14)/3*Math.PI):0;
    }
    seatBlend=ease(seatBlend,seated?1:0,dt*(seated?8:12));
    local.group.position.copy(player);
    if(lastSeat&&seatBlend>.005){
      const a=lastSeat.approach;
      if(seated){
        local.group.position.x=mix(a.x,player.x,seatBlend);local.group.position.z=mix(a.z,player.z,seatBlend);
      }else{
        local.group.position.x=mix(player.x,seatX(lastSeat),seatBlend);local.group.position.z=mix(player.z,seatZ(lastSeat),seatBlend);
      }
    }
    local.group.rotation.y=heading;
    const praying=action?.mode==='cheer';
    local.animate({time,walk:praying||seated?0:walkMix,walkPhase,sit:seatBlend,seatHeight:lastSeat?lastSeat.y-player.y:undefined,...slap,...(praying?cheerPose(age):{}),pull,coffee,phone,...smokingPose(smoking?smokeAge:-1),eat:eating?bitePose(age):0});
    const sharkEating=eating&&action?.food==='shark';if(local.eomuk)local.eomuk.visible=eating&&!sharkEating;sharkDishProp.visible=Boolean(sharkEating);updateShadow(local);
    paintBreath(local,smoking?smokeAge:-1);
    if(praying){
      while(action.beats<CHEER_PEAKS.length && age>=CHEER_PEAKS[action.beats]){
        cheers.exclaim(selfSpeaker,localAnchor,action.call,++action.beats,performance.now()/1000);
        options.onOwnCheerBeat?.(action.call,action.beats,action.call.direction);
      }
      if(age>=CHEER_DURATION){currentAction=null;options.onCheerEnd?.({requestId:action.requestId,callId:action.call.id});}
    }
    if(action && ['push','pull'].includes(action.mode)) {
      dispatchContacts(local,action,action.mode,age,true,true);
      if(age>=(action.mode==='push'?PALM_DURATION:1.05)){
        currentAction=null;options.onDockGestureEnd?.(action.mode);
      }
    }
    const now=Date.now();
    for(const [id,p] of peers){
      if(now-p.seen>22000){removePeer(id,p);continue;}
      if(p.actionMode){
        const complete=p.actionMode==='cheer'?cheerAge(p)>=CHEER_DURATION&&p.beats===CHEER_PEAKS.length:
          time-p.started>=(p.actionMode==='push'?PALM_DURATION:1.05);
        if(complete)p.actionMode=null;
      }
      while(!p.actionMode && p.queue.length){
        const event=p.queue.shift(),dock=event.mode==='push'?departure:arrival;
        if(now-event.accepted>8000)continue;
        if(event.mode==='cheer'){if(!atCourt({x:p.tx,z:p.tz}))continue;}
        else if(Math.abs(p.tx-dock.x)>1.7||Math.abs(p.tz-dock.z)>3.4)continue;
        if(event.mode==='cheer'){
          p.cheerAt=performance.now();
          cheers.exclaim(id,()=>peers.get(id)?.fig.group,event,0,p.cheerAt/1000);
        }
        p.actionMode=event.mode;p.event=event;p.started=time;p.beats=0;
      }
      const pos=p.fig.group.position,age=p.actionMode==='cheer'?cheerAge(p):time-p.started;
      const pose=p.actionMode==='push'?slapPoseAtFrame(p,age):{push:0,backswing:0,recoil:0};
      const move=p.motion==='walk' && now-p.seen<2200;
      const lead=move?Math.min(Math.max(0,(now-p.received)/1000),.16):0;
      let x=p.tx+p.vx*lead,z=p.tz+p.vz*lead;
      if(!p.seat&&!canWalk(x,z)){x=p.tx;z=p.tz;}
      const drift=Math.hypot(x-pos.x,z-pos.z);
      const previousX=pos.x,previousZ=pos.z;
      pos.x=ease(pos.x,x,dt*6.5);pos.z=ease(pos.z,z,dt*6.5);pos.y=measuredGround(pos.x,pos.z);
      p.walkPhase=(p.walkPhase||0)+Math.min(Math.hypot(pos.x-previousX,pos.z-previousZ)*GAIT_PER_UNIT,14*dt);
      const remoteYaw=p.actionMode==='cheer'||!p.actionMode?p.yaw:(p.actionMode==='push'?departure:arrival).yaw;
      p.fig.group.rotation.y=turn(p.fig.group.rotation.y,remoteYaw,dt);
      p.walk=ease(p.walk,(move||drift>.13)?1:0,dt*9);
      labelPoint.set(pos.x,pos.y+1.15,pos.z).project(camera);
      p.fig.group.visible=distance(player,pos)<60 && labelPoint.z>-.98 && labelPoint.z<1.005 && Math.abs(labelPoint.x)<1.32 && Math.abs(labelPoint.y)<1.4;
      p.fig.shade.visible=p.fig.group.visible;
      p.sitBlend=ease(p.sitBlend||0,p.seat?1:0,dt*8);
      const smokeAge=smokeMotion(p.motion)&&!p.actionMode&&nearSmoking({x:p.tx,z:p.tz})?(performance.now()-p.smokeAt)/1000:-1;
      if(p.fig.group.visible){
        const prop=(p.motion==='coffee'||p.motion==='phone')?.72:0;
        const praising=p.actionMode==='cheer';
        p.fig.animate({time:time+p.phase,walk:p.actionMode||p.seat?0:p.walk,walkPhase:p.walkPhase,sit:p.sitBlend,seatHeight:p.seat?p.seat.y-pos.y:undefined,...pose,...(praising?cheerPose(age):{}),pull:p.actionMode==='pull'?pullPulse(age):0,coffee:p.motion==='coffee'?prop:0,phone:p.motion==='phone'?prop:0,...smokingPose(smokeAge),eat:p.motion==='eat'&&!p.actionMode?bitePose(time-p.eatAt):0});updateShadow(p.fig);
        if(praising){
          while(p.beats<CHEER_PEAKS.length&&age>=CHEER_PEAKS[p.beats])cheers.exclaim(id,()=>peers.get(id)?.fig.group,p.event,++p.beats,performance.now()/1000);
        }else if(p.actionMode)dispatchContacts(p.fig,p,p.actionMode,age,false,true);
      } else if(p.actionMode){
        const contacts=p.actionMode==='cheer'?CHEER_PEAKS:p.actionMode==='push'?PALM_CONTACTS:[.43];
        while(p.beats<contacts.length && age>=contacts[p.beats])p.beats++;
      }
      paintBreath(p.fig,smokeAge);
    }
    for(const [i,f] of guardianFigures.entries())f.animate({time:time+i*.63,walk:0,push:0,pull:0,coffee:0,phone:0});
    updateRope(Math.max(pull,shipPull));
    shipPull=Math.max(0,shipPull-dt*1.6);shipPush=Math.max(0,shipPush-dt*2.2);
  }
  function animation(dt) {
    const age=time-actionWave;
    if(littleRing.visible){littleRing.material.opacity=clamp(1-age/.55,0,1);littleRing.scale.setScalar(.3+Math.max(0,age)*2);if(age>.55)littleRing.visible=false;}
    if(wave.visible){wave.position.y=-.6+.3*Math.sin(Math.min(age/1.3,1)*Math.PI);wave.scale.setScalar(Math.max(.01,Math.sin(Math.min(age/1.3,1)*Math.PI)));if(age>=1.3)wave.visible=false;}
    for(let i=effects.length-1;i>=0;i--){const p=effects[i],t=time-p.start,f=t/p.duration;
      if(f>=1){scene.remove(p.mesh);if(!p.velocity)p.mesh.material.dispose();effects.splice(i,1);continue;}
      if(p.velocity){p.mesh.position.copy(p.base).addScaledVector(p.velocity,t);p.mesh.position.y-=t*t*1.8;p.mesh.scale.setScalar(1-f);}
      else {p.mesh.position.copy(p.base);p.mesh.position.y+=f*.55;p.mesh.material.opacity=Math.min(1,(1-f)*3);const s=.68+.23*Math.sin(Math.PI*f);p.mesh.scale.set(s*p.aspect,s,1);}
    }
    if(groundMarker.visible){const f=clamp((time-markerTimer)/1.15,0,1);groundMarker.scale.setScalar(1+f);groundMarker.material.opacity=.82*(1-f);if(f>=1)groundMarker.visible=false;}
    const carrying=Boolean(carriedCargoId);
    const targetPulse=.72+.22*Math.sin(time*(carrying?5.8:2.1));
    cargoDropRing.material.opacity=carrying?Math.min(1,targetPulse+.16):targetPulse*.72;
    cargoDropRing.material.emissiveIntensity=carrying?1.65:0.62;
    cargoDropSquare.material.opacity=carrying?.92:.48;
    cargoDropSquare.material.color.setHex(carrying?0x65ffad:0x9fffd0);
    cargoDropRing.scale.setScalar(carrying?1+.035*Math.sin(time*5.8):1);
    cargoDropLabel.style.display=carrying?'block':'none';
    if(carrying){
      const labelWorld=new THREE.Vector3(cargoDropPoint.x,cargoDropGround+2.55,cargoDropPoint.z).project(camera);
      const labelVisible=labelWorld.z>-1&&labelWorld.z<1&&Math.abs(labelWorld.x)<1.15&&Math.abs(labelWorld.y)<1.15;
      cargoDropLabel.style.display=labelVisible?'block':'none';
      if(labelVisible){
        cargoDropLabel.style.left=((labelWorld.x*.5+.5)*host.clientWidth)+'px';
        cargoDropLabel.style.top=((-labelWorld.y*.5+.5)*host.clientHeight)+'px';
        cargoDropLabel.textContent='↓ 여기에 놓기 (E)';
      }
    }else cargoDropLabel.textContent='화물 하역 구역';
    const celebration=time-ceremony;
    for(let i=confetti.length-1;i>=0;i--){const c=confetti[i];c.m.position.set(c.x+Math.sin(celebration+c.phase)*.8,c.y-celebration*c.fall,c.z+Math.cos(celebration+c.phase)*.4);c.m.rotation.set(celebration*.6,c.phase+celebration,celebration*.95);
      if(c.m.position.y<0||celebration>9){scene.remove(c.m);c.m.geometry.dispose();c.m.material.dispose();confetti.splice(i,1);}
    }
    if(celebration>7)feedback.hidden=true;
    set.update?.({time,night,push:shipPush,pull:shipPull,departure:0});
    court.update(time,night,reduceMotion);
    marquee.update(time);office.update(time,distance(player,office.approach)<8);const fishEvent=harborLife.update(time,night,reduceMotion);if(fishEvent==='cooked'){options.onFishCooked?.();showSharkMenu('eat');options.onHint?.('요리가 완성됐어요! 메뉴에서 먹기를 눌러 주세요.');}portVehicles.update(Date.now()/1000);
  }
  let frame=0,last=performance.now();
  function tick(stamp) {
    if(disposed)return;
    frame=requestAnimationFrame(tick);
    if(document.hidden || !active){last=stamp;return;}
    const dt=Math.min(software?.14:.075,Math.max(.001,(stamp-last)/1000));last=stamp;time+=dt;
    ambient(dt);motion(dt);playerPose(dt);animation(dt);adjustView(dt);
    placeLabels();paintMarks();dome.position.copy(camera.position);stars.position.copy(camera.position);moon.position.set(camera.position.x+30,camera.position.y+31,camera.position.z-119);
    renderer.render(scene,camera);
    if(software)marquee.paintView?.(camera,width,height);
  }
  function dispose() {
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);cancelPlan();observer.disconnect();events.abort();cargoDropLabel.remove();scene.remove(cargoDropRing,cargoDropSquare);cargoDropRing.geometry.dispose();cargoDropRing.material.dispose();cargoDropSquare.geometry.dispose();cargoDropSquare.material.dispose();
    court.destroy();marquee.destroy();office.dispose();harborLife.dispose();portVehicles.destroy();
    cheers.clear();
    const geometries=new Set(),materials=new Set(),textures=new Set([smokeTex]);
    scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
    scene.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
    pullLabel.texture.dispose();set.destroy?.();renderer.dispose();host.remove();
  }
  on(canvas,'webglcontextlost',e=>{e.preventDefault();if(!disposed)options.onHint?.('3D 화면 연결을 복구하고 있어요.');});
  joystick.style.display=active&&touchDevice?'flex':'none';local.group.position.copy(player);local.group.rotation.y=heading;
  bindVessels();updateShadow(local);adjustView(1);frame=requestAnimationFrame(tick);
  return {available:true,renderer:software?'canvas3d':'webgl',getZonePosition:id=>zones[id],getNearbyShrine:()=>nearbyShrine,watchShark,interactSharkAtStall,getPresence,setLivePeers,goToPeer,goTo,goToWish,actAtDock,act,smoke,eatFishcake,toggleSeat,sitAt,standUp,getSeatState,cheer,sayChat,canCheerHere,approachGuardian,interactNearShrine,hasCargoInteraction:()=>Boolean(carriedCargoId||nearestCargo()),interactCargo,home,zoomBy,setActive,setProfile,setPeers,setNeighbors,setVessel,bindVessels,setBoard:state=>marquee.setBoard(state),setDepartures:(calls,terminal)=>office.setDepartures(calls,terminal),replayDeparture:()=>office.replay(),setWishes:(call,wishes)=>court.setWishes(call,wishes),setWeather,setLight,celebrate,setCargo,setSashimiPlate:harborLife.setSashimiPlate,dispose,destroy:dispose};
}