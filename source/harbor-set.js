import {TERMINAL_WALL,TERMINAL_WALL_BOUNDS} from './terminal-marquee.js?v=16';
import {smokingSeats} from './bench-seats.js';
import {buildContainerYard,HARBOR_BOUNDS,onHarborLand,SHRINE_QUAY,withinShrineQuay} from './cy-yard.js';

// A miniature Busan terminal. Repeated solid parts are instanced by geometry,
// material and moving parent, so the waterfront stays inexpensive to render.
export function buildHarbor(T,scene){
  const PI=Math.PI, tau=2*PI, root=new T.Group();root.name='Busan waterfront';scene.add(root);
  const temp=new T.Object3D(), batches=new Map(), allGeos=[],allMats=[],textures=[];
  const geo=g=>(allGeos.push(g),g);
  const meshMat=(o)=>{const m=new T.MeshStandardMaterial(o);allMats.push(m);return m;};
  const cabin=meshMat({color:'#718989',roughness:.45,emissive:'#ffcf86',emissiveIntensity:0});
  const cabinDay=new T.Color('#718989'),cabinNight=new T.Color('#e1c597');
  const solid=meshMat({color:0xffffff,roughness:.84}), metal=meshMat({color:0xffffff,roughness:.54,metalness:.13});
  const glass=meshMat({color:0xffffff,roughness:.29,metalness:.16}), lamp=meshMat({color:0xffffff,roughness:.64,emissive:'#ffd696',emissiveIntensity:.16});
  const boxG=geo(new T.BoxGeometry(1,1,1)),ballG=geo(new T.SphereGeometry(.5,12,9)),stoneG=geo(new T.DodecahedronGeometry(.5,0));
  const cylG=geo(new T.CylinderGeometry(.5,.5,1,16)),roundG=geo(new T.CylinderGeometry(.5,.5,1,30)),coneG=geo(new T.ConeGeometry(.5,1,10));
  const tubeG=geo(new T.CylinderGeometry(.5,.5,1,8)),ringG=geo(new T.TorusGeometry(.5,.105,7,20));
  function buffer(parent,g,m){
    const key=parent.uuid+'|'+g.uuid+'|'+m.uuid;
    if(!batches.has(key))batches.set(key,{parent,g,m,entries:[]});return batches.get(key).entries;
  }
  function put(g,x,y,z,w,h,d,color,m=solid,parent=root,rx=0,ry=0,rz=0){
    temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(w,h,d);temp.updateMatrix();
    buffer(parent,g,m).push([temp.matrix.clone(),color]);
  }
  const box=(...a)=>put(boxG,...a),orb=(...a)=>put(ballG,...a),cyl=(...a)=>put(cylG,...a);
  function beam(a,b,r,color,parent=root,m=metal){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),dir=q.clone().sub(p),len=dir.length();
    temp.position.copy(p).lerp(q,.5);temp.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
    temp.scale.set(r*2,len,r*2);temp.updateMatrix();buffer(parent,tubeG,m).push([temp.matrix.clone(),color]);
  }
  let seed=63;
  function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
  const choose=a=>a[Math.floor(random()*a.length)];
  function flush(){
    for(const {parent,g,m,entries} of batches.values()){
      const batch=new T.InstancedMesh(g,m,entries.length);
      entries.forEach(([matrix,c],i)=>{batch.setMatrixAt(i,matrix);batch.setColorAt(i,new T.Color(c));});
      batch.computeBoundingSphere();batch.castShadow=m!==glass&&m!==lamp;batch.receiveShadow=true;parent.add(batch);
    }
    batches.clear();
  }
  function mesh(g,m,x,y,z,parent=root){
    const item=new T.Mesh(g,m);item.position.set(x,y,z);item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;
  }
  const signMap=new Map();
  function sign(text,x,y,z,w,h,color='#fff6df',ink='#2d4853',parent=root,yaw=0){
    const k=[text,color,ink].join('|');
    if(!signMap.has(k)){
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=160;
      const c=canvas.getContext('2d');c.fillStyle=color;c.fillRect(0,0,640,160);c.fillStyle=ink;
      c.font='750 92px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';
      c.fillText(text,320,82,602);
      const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=2;textures.push(tex);
      const m=meshMat({map:tex,roughness:.84});signMap.set(k,m);
    }
    const s=mesh(geo(new T.PlaneGeometry(w,h)),signMap.get(k),x,y,z,parent);s.rotation.y=yaw;s.castShadow=false;
  }
  const street='#e7d7bd',sand='#dbc4a0',pale='#eee4d3',iron='#465d62',wood='#a77452',cream='#faebcf';
  const coral='#cf7568',teal='#548d95',steel='#487580',ink='#324d5a';
  const seaMat=meshMat({color:'#3c8296',roughness:.36,metalness:.16});
  // Retain the subdivided open sea, but cut the actual outline of the
  // sanctuary apron out of it. Water cannot show through these working berths.
  const lattice=Array.from({length:45},(_,i)=>-385+i*17.5);
  const axis=edges=>[...new Set([...lattice,...edges])].sort((a,b)=>a-b);
  const seaX=axis(SHRINE_QUAY.flatMap(([l,r])=>[l,r]));
  const seaZ=axis(SHRINE_QUAY.flatMap(([,,b,f])=>[b,f]));
  const seaPoints=[],seaIndices=[];
  for(const z of seaZ)for(const x of seaX)seaPoints.push(x,0,z);
  for(let iz=0;iz<seaZ.length-1;iz++)for(let ix=0;ix<seaX.length-1;ix++){
    if(withinShrineQuay((seaX[ix]+seaX[ix+1])/2,(seaZ[iz]+seaZ[iz+1])/2))continue;
    const a=iz*seaX.length+ix,b=a+seaX.length;
    seaIndices.push(a,b,a+1,b,b+1,a+1);
  }
  const waterGeometry=geo(new T.BufferGeometry());
  waterGeometry.setAttribute('position',new T.Float32BufferAttribute(seaPoints,3));waterGeometry.setIndex(seaIndices);
  waterGeometry.computeVertexNormals();waterGeometry.computeBoundingSphere();
  const sea=mesh(waterGeometry,seaMat,0,-.85,0);sea.name='Open harbour water';sea.castShadow=false;
  // Seawall, promenade stone joints and non-slip painted quay edge.
  box(-3.9,-.99,-5.55,31.35,1.96,51.6,'#baa990');box(-3.9,-.14,-5.55,31.35,.28,51.6,street);
  const lanternSpots=[[-16.5,16.5],[8.5,-23],[-15,-8]];
  // Asphalt and longitudinal rails run the full length of the working apron.
  // White traffic stripes and yellow safe-edge markings stay readable at night.
  function pavingAtlas(dark) {
    const cv=document.createElement('canvas');cv.width=1024;cv.height=1536;
    const c=cv.getContext('2d'),px=x=>(x+19.575)*cv.width/31.35,py=z=>(z+31.35)*cv.height/51.6;
    c.fillStyle=dark?'#42505d':'#858c91';c.fillRect(0,0,cv.width,cv.height);
    let state=172;const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    for(let i=0;i<18000;i++){
      c.fillStyle=rnd()<.5?'rgba(239,244,242,.08)':'rgba(29,43,47,.08)';
      c.fillRect(rnd()*cv.width,rnd()*cv.height,.35+rnd()*1.6,.5+rnd()*1.7);
    }
    const rect=(x,z,w,d,color)=>{c.fillStyle=color;c.fillRect(px(x),py(z),w*cv.width/31.35,d*cv.height/51.6);};
    const white=dark?'#d1ddd9':'#edf1eb',yellow=dark?'#d6ac60':'#edbf54',rubber=dark?'#2e3e49':'#647175';
    // Crane rail grooves, service road and berth safety strips.
    for(const x of [-18.65,10.55])rect(x,-31.4,.21,51.7,yellow);
    rect(-8.65,-31.4,.115,51.7,white);
    // The west service-lane edge follows the outline of the smoking bay.
    rect(-13.7,-31.4,.115,39.3,white);rect(-13.7,16.5,.115,3.8,white);
    rect(-13.7,7.9,2.12,.10,white);rect(-11.68,7.9,.10,8.7,white);rect(-13.7,16.5,2.12,.10,white);
    for(let z=-31;z<20;z+=4.75)rect(-11.22,z,.13,2.08,white);
    for(const x of [-1.4,7.25]){rect(x-.095,-31.4,.19,51.7,rubber);rect(x-.026,-31.4,.052,51.7,dark?'#8697a0':'#c2ced0');}
    for(let z=-30;z<20;z+=4.7){rect(9.55,z,.70,.10,white);rect(-17.84,z,.70,.10,white);}
    for(const [x,z] of [[-16.35,2.1],[8.0,-10.7],[8.0,11.3]]){
      c.save();c.translate(px(x),py(z));c.rotate(-Math.PI/2);c.fillStyle=dark?'#abb9bb':'#e2e9e6';c.font='bold 24px sans-serif';c.textAlign='center';c.fillText(x<0?'B02':'B01',0,0);c.restore();
    }
    if(dark)for(const [x,z] of lanternSpots){
      const tx=px(x),ty=py(z),r=cv.width*.175,g=c.createRadialGradient(tx,ty,0,tx,ty,r);g.addColorStop(0,'#e9d3a663');g.addColorStop(.55,'#e9d3a626');g.addColorStop(1,'#e9d3a600');c.fillStyle=g;c.fillRect(tx-r,ty-r,r*2,r*2);
    }
    const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.userData.harborPaving=true;textures.push(texture);return texture;
  }
  const dayPaving=pavingAtlas(false),nightPaving=pavingAtlas(true);
  const pavementMat=meshMat({map:dayPaving,roughness:.96,metalness:0});
  const pavement=mesh(geo(new T.PlaneGeometry(31.35,51.60)),pavementMat,-3.9,.013,-5.55);
  pavement.rotation.x=-PI/2;pavement.castShadow=false;
  for(const x of [-19.45,11.61]){
    box(x,.035,-5.5,.20,.07,51.45,pale);box(x+(x>0?-.42:.42),.015,-5.5,.075,.02,51.1,'#ebbe73');
    for(let z=-30;z<20;z+=1.30){box(x,.08,z,.33,.065,.64,'#e5b750');box(x,.081,z+.65,.33,.065,.64,'#4e5659');}
    for(let z=-30;z<20;z+=3.1){
      const outside=x>0?x+.18:x-.18;box(outside,-.48,z,.30,1.06,1.05,'#34454c',solid);put(ringG,outside+(x>0?.12:-.12),-.49,z,.83,.89,.66,'#293940',solid,root,0,PI/2);
      beam([x,.1,z-.4],[outside,-.22,z-.15],.027,'#626869');beam([x,.1,z+.4],[outside,-.22,z+.15],.027,'#626869');
    }
  }
  function bollard(x,z){
    cyl(x,.12,z,.56,.24,.56,'#7d8077');cyl(x,.34,z,.32,.43,.32,'#c88860');orb(x,.56,z,.62,.24,.45,'#a4634b');
  }
  for(let z=-28;z<=19;z+=5.6){bollard(10.75,z);bollard(-18.6,z);}
  for(let i=0;i<12;i++)box(-1.8+i*.42,.022,16.2,.17,.02,1.65,'#f5ebd5');
  for(let i=0;i<13;i++){box(.6,.02,13-i*2.9,.065,.015,1.2,'#f8e8c6');}
  const litPromenade=new T.Group();root.add(litPromenade);
  const washCanvas=document.createElement('canvas');washCanvas.width=washCanvas.height=64;
  const washCtx=washCanvas.getContext('2d');
  const wash=washCtx.createRadialGradient(32,32,0,32,32,31.5);
  wash.addColorStop(0,'rgba(255,209,131,.51)');wash.addColorStop(.34,'rgba(255,211,142,.27)');wash.addColorStop(1,'rgba(255,218,163,0)');
  washCtx.fillStyle=wash;washCtx.fillRect(0,0,64,64);
  const washTexture=new T.CanvasTexture(washCanvas);washTexture.colorSpace=T.SRGBColorSpace;textures.push(washTexture);
  const washMat=new T.MeshBasicMaterial({map:washTexture,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  allMats.push(washMat);
  const washGeo=geo(new T.PlaneGeometry(1,1));
  function lampPost(x,z,h=6.2){
    cyl(x,.14,z,.48,.28,.48,'#78857e');cyl(x,h*.5,z,.11,h,.11,'#647b79');
    beam([x,h-.06,z],[x+.28,h+.33,z],.052,'#667a76');beam([x+.28,h+.33,z],[x+.61,h+.33,z],.051,'#667a76');
    cyl(x+.61,h+.24,z,.52,.12,.52,iron);
    box(x+.61,h+.06,z,.62,.12,.38,'#ffe8b9',lamp);
    for(const sign of [-1,1])beam([x+.61+sign*.19,h+.19,z],[x+.61+sign*.14,h-.09,z],.018,iron);
    cyl(x+.61,h-.13,z,.29,.04,.29,'#8d8e77',metal);
    const lightWash=mesh(washGeo,washMat,x+.66,.052,z+.14,litPromenade);
    lightWash.scale.set(4.9,3.75,1);lightWash.rotation.x=-PI/2;lightWash.castShadow=false;lightWash.receiveShadow=false;
  }
  for(const [x,z] of lanternSpots)lampPost(x,z);
  // Four timber benches in facing pairs leave a central aisle around one bin.
  const smoke=new T.Group();smoke.name='Smoking area';smoke.userData.atdInteract='smoking';smoke.position.set(-14.85,0,12.2);root.add(smoke);
  const furnitureBounds=[];
  const tube='#252c30';
  const timber=['#ae652d','#c47d3a','#b87433','#c2803e'].map((shade,index)=>{
    const cv=document.createElement('canvas');cv.width=256;cv.height=32;
    const cc=cv.getContext('2d');cc.fillStyle=shade;cc.fillRect(0,0,256,32);
    for(let i=0;i<22;i++){
      const y=(i*8.37+index*7.2)%32, bend=Math.sin(i*1.23)*1.7;
      cc.beginPath();cc.moveTo(-4,y);cc.bezierCurveTo(45,y+bend,113,y-bend,172,y+.4*bend);cc.lineTo(258,y+bend);
      cc.lineWidth=i%3===0?.45:.70;cc.strokeStyle=i%2?'rgba(83,45,25,.18)':'rgba(244,191,118,.24)';cc.stroke();
    }
    const texture=new T.CanvasTexture(cv);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
    return meshMat({map:texture,roughness:.64});
  });
  for(const seat of smokingSeats){
    const side=Math.sign(seat.x-smoke.position.x);
    const bench=new T.Group();bench.name='Timber bench';bench.userData.atdInteract='seat';bench.userData.seatId=seat.id;
    bench.position.set(seat.x-smoke.position.x,0,seat.z-smoke.position.z);bench.rotation.y=seat.yaw+PI;smoke.add(bench);
    for(let i=0;i<4;i++){
      const z=-.42+i*.223;box(0,.76,z,3.02,.135,.195,'#ffffff',timber[i],bench);
      for(const x of [-1.36,1.36])cyl(x,.831,z,.043,.010,.043,'#4d4a41',metal,bench);
    }
    for(let i=0;i<3;i++){
      const y=.99+i*.266,z=.37+i*.075;
      box(0,y,z,3.00,.216,.114,'#ffffff',timber[(i+1)%4],bench,.244);
      for(const x of [-1.36,1.36])orb(x,y,z-.066,.054,.054,.03,'#53493b',metal,bench);
    }
    for(const x of [-1.5,1.5]){
      beam([x,.028,-.45],[x,.706,-.45],.073,tube,bench);
      beam([x,.706,-.45],[x,.706,.40],.073,tube,bench);
      beam([x,.71,.40],[x,1.69,.66],.073,tube,bench);
      beam([x,.04,.58],[x,.71,.40],.073,tube,bench);
      for(const [y,z] of [[.705,-.45],[.705,.40],[1.69,.66]])orb(x,y,z,.153,.153,.153,tube,metal,bench);
    }
    beam([-1.48,.39,.46],[1.48,.39,.46],.053,tube,bench);
    // Local +Z is the back rail. Extend the solid footprint slightly past
    // the backrest and end frames so the walking rig clears both.
    const {x,z}=seat;
    furnitureBounds.push([x-(side<0?.91:.70),x+(side>0?.91:.70),z-1.77,z+1.77]);
  }
  const bin=new T.Group();bin.name='One combined ashtray and litter bin';bin.userData.atdInteract='smoking';smoke.add(bin);
  furnitureBounds.push([smoke.position.x-.55,smoke.position.x+.55,smoke.position.z-.55,smoke.position.z+.55]);
  cyl(0,.61,0,.62,1.19,.62,'#607278',metal,bin);
  cyl(0,.065,0,.70,.13,.70,'#3e4d53',metal,bin);
  cyl(0,1.24,0,.70,.10,.70,'#b8c2ba',metal,bin);
  cyl(0,1.294,0,.51,.035,.51,'#414a4e',metal,bin);
  cyl(0,1.316,0,.32,.021,.32,'#8a8e7f',metal,bin);
  box(0,.89,-.291,.36,.175,.065,'#2e3539',metal,bin);
  sign('흡연구역',0,.56,-.315,.47,.14,'#51666d','#f6f1de',bin,PI);
  // Each container includes corner castings, pressed steel side ribs and
  // reinforced doors. Side ribs are drawn as geometry and share instances.
  function container(x,y,z,w,h,d,color,parent=root,sparse=false){
    box(x,y,z,w,h,d,color,solid,parent);
    const c=new T.Color(color).multiplyScalar(.83).getStyle();
    const hi=new T.Color(color).lerp(new T.Color('#fff2d8'),.14).getStyle();
    for(const s of [-1,1]){
      const xx=x+s*(w*.5+.014);
      for(let j=1;j<(sparse?6:12);j++){
        const zz=z-d*.5+j*d/(sparse?6:12);
        box(xx,y,zz,.035,h*.78,.043,hi,solid,parent);
      }
      for(const v of [-1,1])box(xx,y+v*h*.46,z,.055,.055,d,c,solid,parent);
    }
    for(const s of [-1,1]){
      const zz=z+s*(d*.5+.018);
      box(x,y,zz,.038,h*.94,.04,c,solid,parent);
      for(const f of [-.34,-.20,.20,.34])box(x+f*w,y,zz,.022,h*.8,.05,hi,solid,parent);
    }
  }
  const containerColors=['#ad5346','#bf644e','#34758b','#759ea0','#bd9b65','#477d9c','#408779','#a13f3c','#b47b54','#697c91'];
  const sections=[[-15.2,2.65],[-14.4,3.35],[-11.6,3.75],[7.6,3.75],[11.7,3.45],[14.3,2.62],[16.65,1.22],[17.65,.14]];
  const levels=[[-1.88,.62],[-.88,.88],[-.25,.965],[.13,.987],[2.61,1],[2.83,1.004]];
  function makeShip(name,ox,oz,scale,hullColor,layout=0,heading=0){
    const ship=new T.Group();ship.name=name;ship.position.set(ox,0,oz);
    ship.scale.setScalar(scale);ship.rotation.y=heading;root.add(ship);
    const verts=[],cols=[];
    function face(p,q,r,s,color){
      const c=new T.Color(color);
      for(const v of [p,q,r,p,r,s]){verts.push(...v);cols.push(c.r,c.g,c.b);}
    }
    function hp(i,j,sgn){const [z,w]=sections[i],[y,frac]=levels[j];return [w*frac*sgn,y,z];}
    for(let i=0;i<sections.length-1;i++){
      for(let j=0;j<levels.length-1;j++){
        const color=j<2?'#a56258':j===2?'#cb8474':j===4?'#5d777c':hullColor;
        face(hp(i,j,-1),hp(i+1,j,-1),hp(i+1,j+1,-1),hp(i,j+1,-1),color);
        face(hp(i+1,j,1),hp(i,j,1),hp(i,j+1,1),hp(i+1,j+1,1),color);
      }
      const top=levels.length-1;
      face(hp(i,top,-1),hp(i+1,top,-1),hp(i+1,top,1),hp(i,top,1),'#a6aaa0');
      face(hp(i,0,1),hp(i+1,0,1),hp(i+1,0,-1),hp(i,0,-1),'#87574f');
    }
    const bow=sections.length-1;
    for(let j=0;j<levels.length-1;j++){
      const color=j<2?'#a56258':hullColor;
      face(hp(0,j,1),hp(0,j,-1),hp(0,j+1,-1),hp(0,j+1,1),color);
      face(hp(bow,j,-1),hp(bow,j,1),hp(bow,j+1,1),hp(bow,j+1,-1),color);
    }
    const hull=geo(new T.BufferGeometry());
    hull.setAttribute('position',new T.Float32BufferAttribute(verts,3));
    hull.setAttribute('color',new T.Float32BufferAttribute(cols,3));
    hull.computeVertexNormals();
    // The narrow paint bands share edges with the deck and keel. Simplifying
    // per paint color would move coincident vertices apart in the CPU renderer.
    hull.userData.preserveTopology=true;
    const hullMesh=mesh(hull,meshMat({vertexColors:true,roughness:.67,metalness:.11}),0,0,0,ship);
    hullMesh.name='Watertight hull';
    const sy=2.83;
    // Rows of real hatch covers, stepped stacks, and a working aisle left
    // between loads and the bridge. A tall white bridge marks the stern.
    for(let row=0;row<4;row++){
      const z=-6.9+row*4.49;
      box(0,sy+.07,z,6.5,.14,4.15,'#707f7b',metal,ship);
      for(let lane=0;lane<3;lane++){
        const count=1+((row*7+lane+layout)%3===0?2:((row+lane+layout)%3===1?0:1));
        for(let level=0;level<count;level++){
          const clr=containerColors[(row*3+lane*7+level*5+layout)%containerColors.length];
          container(-2.12+lane*2.13,sy+.18+.73+level*1.53,z,2.04,1.48,4.1,clr,ship,scale<.6);
        }
      }
    }
    box(0,sy+1.18,-11.96,5.28,2.35,3.32,'#e7dfc9',solid,ship);
    box(-.10,sy+3.01,-11.93,5.45,1.35,2.98,'#eee8d6',solid,ship);
    box(0,sy+3.78,-11.92,6.18,.22,3.28,'#a6b3a9',solid,ship);
    box(0,sy+4.41,-11.97,5.53,1.16,2.78,'#eee8d3',solid,ship);
    box(0,sy+5.05,-11.97,5.95,.22,3.19,'#bfbaa7',solid,ship);
    for(const s of [-1,1]){
      for(let k=0;k<5;k++){
        const z=-13.04+k*.53;box(s*2.78,sy+4.49,z,.07,.64,.43,k%3===1?'#ffffff':'#526e76',k%3===1?cabin:glass,ship);
        box(s*2.74,sy+2.93,z,.07,.42,.34,'#6a8990',glass,ship);
      }
      for(let k=0;k<10;k++){
        cyl(s*3.59,sy+.29,-8+k*1.84,.05,.58,.05,'#eee6ce',metal,ship);
      }
      beam([s*3.59,sy+.59,-8],[s*3.59,sy+.59,8.55],.026,'#dedac3',ship);
      for(let k=0;k<8;k++)box(s*3.76,1.85,-8.4+k*2.2,.031,.12,.41,'#7e9b9b',solid,ship);
    }
    for(let k=0;k<7;k++){
      box(-2.27+k*.75,sy+4.48,-10.56,.57,.64,.06,k===1||k===3?'#ffffff':'#597984',k===1||k===3?cabin:glass,ship);
      box(-2.1+k*.69,sy+4.48,-13.37,.49,.62,.06,'#66848b',glass,ship);
    }
    cyl(1.38,sy+4.19,-14.12,1.16,3.25,1.16,hullColor,solid,ship);
    cyl(1.38,sy+5.70,-14.12,1.17,.43,1.17,coral,solid,ship);
    cyl(1.38,sy+5.98,-14.12,1.08,.17,1.08,ink,solid,ship);
    cyl(-.68,sy+6.16,-12.3,.085,2.28,.085,'#e7e1ce',metal,ship);
    beam([-1.28,sy+6.49,-12.3],[-.06,sy+6.49,-12.3],.05,'#dfd8bb',ship);
    orb(-.68,sy+7.32,-12.3,.17,.16,.17,'#dd8b72',lamp,ship);
    cyl(0,3.57,14.48,.085,1.43,.085,'#e4d8bc',metal,ship);
    cyl(0,2.97,14.54,.67,.28,.67,'#666e65',metal,ship);
    for(const side of [-1,1]){
      const points=[[3.61,9.2],[3.33,11.7],[2.55,14.3],[1.18,16.65],[.14,17.5]].map(([x,z])=>[x*side,z]);
      for(let i=0;i<points.length-1;i++){
        const [x,z]=points[i],[xx,zz]=points[i+1];beam([x,3.30,z],[xx,3.30,zz],.030,'#e5dfbd',ship);
        cyl(x,3.05,z,.054,.47,.054,'#d7d8bd',metal,ship);
      }
      // Anchor hawse at both sides of the bow.
      orb(side*3.21,1.90,12.2,.13,.65,.82,'#243e49',solid,ship);
      const ax=side*3.25;
      beam([ax,1.96,12.15],[ax,1.33,12.26],.07,'#4d5857',ship);
      beam([ax,1.35,11.96],[ax,1.29,12.27],.06,'#4d5857',ship);
      beam([ax,1.29,12.27],[ax,1.39,12.58],.06,'#4d5857',ship);
    }
    return ship;
  }
  const primary=makeShip('Selected port call',15.20,1,1,'#344f60');
  const arriving=makeShip('Arrival berth',-33.10,-16.0,.79,'#568076',3,-.04);
  // The symbolic line meets a visible fairlead on the shore-facing bow.
  put(ringG,3.66,2.40,9.90,.47,.62,.53,'#9aa9a6',metal,arriving,0,PI/2);
  const neighbor=makeShip('Adjacent berth',79,-15,.71,'#5a7c86',9,PI);
  const neighborShips=[neighbor,
    makeShip('Adjacent south berth',79,11,.69,'#728880',4,PI),
    makeShip('West terminal south berth',-61,14,.65,'#5e737e',6),
    makeShip('West terminal north berth',-61,-13,.65,'#806e68',2)];
  // The opposite terminals have their own ships and decks at player ground
  // height. Peer positions on those quays can only belong to their own call.
  function outerPier(x,width,centerZ,length,nearSide){
    box(x,-.68,centerZ,width,1.34,length,'#b9ab96');
    box(x,-.035,centerZ,width,.07,length,'#d8cab2');
    const edge=x+nearSide*(width/2-.22);
    box(edge,.006,centerZ,.12,.012,length,'#ecc48b');
    for(let zz=centerZ-length/2+2;zz<centerZ+length/2;zz+=4.7)bollard(edge-nearSide*.55,zz);
    for(let zz=centerZ-length/2+3;zz<centerZ+length/2;zz+=11){
      const px=x-nearSide*.5;container(px,.62,zz,2.18,1.24,3.65,choose(containerColors),root,true);
      if(random()>.4)container(px,1.85,zz,2.17,1.22,3.64,choose(containerColors),root,true);
    }
  }
  outerPier(85.8,7.75,-1.1,94,-1);
  outerPier(-67.05,7.65,-.8,94,1);
  const neighborSlots=[
    {x:82.34,z:-14,y:0,yaw:-PI/2},{x:82.34,z:12,y:0,yaw:-PI/2},
    {x:-63.93,z:15,y:0,yaw:PI/2},{x:-63.93,z:-12,y:0,yaw:PI/2},
  ];
  const remote=makeShip('Outer roadstead',-40,78,.45,'#526b77',8,.82);
  // Two outward-facing paint decals use the vessel and voyage bound to this
  // physical model. A source refresh changes only the chalked call identity.
  function hullLettering(ship,communal=false){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=180;
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;textures.push(texture);
    const paint=meshMat({map:texture,transparent:true,depthWrite:false,roughness:.84,polygonOffset:true,polygonOffsetFactor:-2});
    const decal=geo(new T.PlaneGeometry(11.85,1.8));
    const faces=[-1,1].map(side=>{
      const label=mesh(decal,paint,side*3.791,1.51,.89,ship);label.rotation.y=side*PI/2;
      label.name='Hull name and voyage';label.castShadow=false;label.visible=false;return label;
    });
    let signature='';ship.visible=false;
    return call=>{
      const raw=typeof call==='string'?{name:call}:call||{};
      const name=String(raw.name||raw.vesselName||raw.vessel||'').trim().toUpperCase();
      const voy=String(raw.voy||raw.voyage||raw.carrierVoyage||raw.terminalVoyage||'').trim().toUpperCase();
      const next=JSON.stringify([raw.id||null,name,voy]);if(signature===next)return;signature=next;
      ship.visible=communal||Boolean(name);ship.userData.callId=raw.id||null;ship.userData.vesselName=name;ship.userData.voyage=voy;
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1024,180);
      if(name){
        ctx.fillStyle='#fff5df';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.font='bold 88px sans-serif';ctx.fillText(name,512,voy?59:89,996);
        if(voy){ctx.font='bold 53px sans-serif';ctx.fillStyle='#edd6aa';ctx.fillText('VOY. '+voy,512,139,945);}
      }
      faces.forEach(label=>{label.visible=Boolean(name);});texture.needsUpdate=true;
    };
  }
  const paintMain=hullLettering(primary,true),paintArrival=hullLettering(arriving,true),paintNeighbors=neighborShips.map(ship=>hullLettering(ship));
  function setNeighbors(calls=[]){paintNeighbors.forEach((draw,i)=>draw(calls[i]));}
  function setVessel(call){paintMain(call);}
  function bindVessels({departure=null,arrival=null,neighbors=[]}={}){
    paintMain(departure);paintArrival(arrival);setNeighbors(neighbors);
  }
  const shipTargets={departure:primary.getObjectByName('Watertight hull'),arrival:arriving.getObjectByName('Watertight hull'),
     neighbors:neighborShips.map(s=>s.getObjectByName('Watertight hull'))};
  function getRopeAnchor(out=new T.Vector3()){
    return arriving.localToWorld(out.set(3.68,2.40,9.9));
  }
  const updateYard=buildContainerYard(T,{root,geo,meshMat,mesh,box,cyl,orb,put,beam,solid,metal,lamp,boxG,textures,sign});
  // Harbor horizon. Mountain ridges rise in broken silhouettes behind low
  // Korean apartment blocks, working cranes, cable bridge and its piers.
  // Two coastal ridgelines shelter the terminal from the mainland side;
  // the southern sweep opens into uninterrupted navigable water.
  function ridge(distance,phase,shade,scale){
    const pts=[],tri=[];
    for(let i=0;i<=96;i++){
      const angle=-2.17+i*4.36/96;
      const profile=.62+.26*Math.sin(angle*4.1+phase)+.14*Math.cos(angle*10.5-phase)+.06*Math.sin(angle*17.4);
      const fade=Math.min(1,i/11,(96-i)/12),r=distance+3.8*Math.sin(angle*6.7+phase);
      const x=Math.sin(angle)*r,z=-Math.cos(angle)*r,h=1.0+Math.max(0,profile)*scale*fade;
      pts.push(x,-1.25,z,x,h,z,x*1.025,h*.78,z*1.025);
      if(i){const j=i*3;tri.push(j-3,j,j-2,j-2,j,j+1,j-2,j+1,j-1,j-1,j+1,j+2);}
    }
    const g=geo(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setIndex(tri);g.computeVertexNormals();
    const m=mesh(g,meshMat({color:shade,roughness:.96,side:T.DoubleSide}),0,0,0);m.castShadow=false;
  }
  ridge(190,1.25,'#8ea9ae',32);ridge(157,-.87,'#729699',22);
  for(let i=0;i<117;i++){
    const a=i/117*tau,dist=126+random()*35,x=Math.sin(a)*dist,z=Math.cos(a)*dist;
    if(z>18&&Math.abs(x)<80)continue;
    const h=1.8+random()*5.8,w=.88+random()*2.6,d=1.4+random()*2.1;
    box(x,h/2-1.15,z,w,h,d,choose(['#c0c5b7','#c2c7be','#d6cdbb','#b8c1b8','#b0bcc0']));
    if(i%3===0){
      for(let j=1;j<4;j++)box(x,-.55+h*j*.21,z+d*.5+.025,w*.75,.12,.04,'#97a7a5');
      if(i%2===0)box(x+w*.18,h*.55-.55,z+d*.5+.049,w*.17,.16,.05,'#e1cc9b',lamp);
    }
  }
  const bridgeZ=-140;
  box(7,6.92,bridgeZ,137,.64,3.5,'#b3bcb1');
  for(const x of [-26,40]){
    for(const z of [bridgeZ-1.72,bridgeZ+1.72]){
      box(x,11.3,z,.86,23.0,.79,'#d5d1be');
      for(const dx of [5,12,19,26]){
        beam([x,22.48,z],[x+dx,7.20,z],.085,'#cccbb9');beam([x,22.48,z],[x-dx,7.20,z],.085,'#cccbb9');
      }
    }
    box(x,21.50,bridgeZ,.81,.64,4.0,'#c7cbbd');
  }
  const glints=new T.Group();glints.visible=false;root.add(glints);
  const lightWater=meshMat({color:'#fff9df',emissive:'#ddc28c',emissiveIntensity:.24,roughness:.42});
  for(const [x,z] of [[-21.2,-7.3],[21.5,11],[25.8,-4.7],[37,8],[-33,14],[9.6,-35.3],[-10.6,-34.8],[3.4,26.8]]){
    const golden=random()>.28;
    for(let i=0;i<10;i++){
      const zz=z+.3*i+(random()-.5)*.30,xx=x+(random()-.5)*.64;
      const width=(.23+Math.sin(PI*i/10)*.61)*(.6+.66*random());
      orb(xx,-.795,zz,width,.018,.057+.08*random(),golden?choose(['#c0ab83','#d8c999','#cabf95']):choose(['#b2c8bd','#9db9bd']),lightWater,glints);
    }
  }
  const foam=new T.Group();root.add(foam);
  for(let i=0;i<370;i++){
    const x=(random()-.5)*157,z=(random()-.5)*152;
    if((x>-20&&x<12&&z>-32&&z<21)||withinShrineQuay(x,z))continue;
    const length=.24+random()*1.7;
    orb(x,-.812,z,length,.023,.055+random()*.08,choose(['#8ccac6','#a6d5cc','#c1ded0']),solid,foam,0,random()*.48);
  }
  for(let i=0;i<35;i++){
    const z=-14+i*.9,x=18+Math.sin(i*.7)*2.4;
    orb(x,-.795,z,.6+random()*.9,.03,.17,'#c8e2d7',solid,foam);
  }
  // A gull's long, swept primaries form the outer black tip. The pale inner
  // feathers meet a much shorter white body; both wings hinge at the shoulder.
  const gullFeathers=meshMat({vertexColors:true,roughness:.82,side:T.DoubleSide});
  function flightWing(side){
    const xyz=[],colors=[];
    function triangle(a,b,c,tint){
      const color=new T.Color(tint);
      for(const [x,y,z] of [a,b,c]){xyz.push(side*x,y,z);colors.push(color.r,color.g,color.b);}
    }
    const profile=[
      [.00,.00,.16,-.21],[.29,.12,.25,-.28],[.62,.17,.24,-.17],
      [.79,.115,.15,-.16],[.94,.06,.055,-.16],[1.10,.00,-.09,-.22],[1.27,-.075,-.32,-.33]
    ];
    const tops=['#dce1df','#a7b3ba','#b3c0c6','#8495a0','#333d46','#36414a'];
    for(let i=0;i<profile.length-1;i++){
      const [x,y,f,b]=profile[i],[xx,yy,ff,bb]=profile[i+1];
      const a=[x,y+.025,f],c=[x,y-.015,b],d=[xx,yy+.025,ff],e=[xx,yy-.015,bb];
      const ridge=[x,y+.065,f*.73+b*.27],ridge2=[xx,yy+.052,ff*.73+bb*.27];
      triangle(a,ridge,d,tops[i]);triangle(d,ridge,ridge2,tops[i]);
      triangle(ridge,c,ridge2,tops[i]);triangle(ridge2,c,e,tops[i]);
      const under=i<4?'#f3f3e8':'#39424a';
      triangle([x,y-.023,b],[x,y+.01,f],[xx,yy+.01,ff],under);
      triangle([x,y-.023,b],[xx,yy+.01,ff],[xx,yy-.023,bb],under);
    }
    for(const [x,z] of [[.89,-.15],[1.008,-.185]]){
      triangle([x,.002,z+.075],[x+.045,-.007,z+.12],[x+.205,-.055,z-.153],'#3a444b');
    }
    triangle([1.06,.014,-.125],[1.10,.003,-.116],[1.145,-.019,-.169],'#f6f6ee');
    const g=geo(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
  const wings=[flightWing(-1),flightWing(1)];
  const flights=[
    [16.8,-9.7,7.7,5.6,13.2,.087,2.45],[18.3,-6.5,8.5,5.0,12.3,.087,2.21],
    [-26.7,-4.1,7.9,7.7,15.1,.061,4.24],[-24.8,-2.2,8.7,6.6,13.7,.061,4.04]
  ].map(([cx,cz,alt,rx,rz,rate,phase],index)=>{
    const bird=new T.Group();bird.name='Harbor gull';root.add(bird);
    orb(0,0,-.035,.30,.30,.84,'#f4f4e9',solid,bird);
    orb(0,.091,-.135,.277,.175,.56,'#aab7c0',solid,bird);
    orb(0,.066,.247,.24,.27,.34,'#f4f5ed',solid,bird,-.17);
    orb(0,.166,.345,.256,.244,.279,'#faf9ef',solid,bird);
    for(const side of [-1,1]){
      orb(side*.101,.188,.408,.039,.047,.041,'#c4a457',solid,bird);
      orb(side*.111,.191,.411,.023,.03,.029,'#202b30',solid,bird);
    }
    put(coneG,0,.146,.519,.098,.236,.087,'#ddad53',solid,bird,PI/2);
    for(const side of [-1,0,1])orb(side*.043,-.019,-.463,.091,.037,.39,'#e7ece9',solid,bird,.09,-side*.20);
    const pair=wings.map((geometry,i)=>{
      const wing=mesh(geometry,gullFeathers,(i?1:-1)*.087,.074,-.022,bird);wing.name=i?'Right wing':'Left wing';return wing;
    });
    bird.scale.setScalar(index%2?.83:.97);
    return {bird,pair,cx,cz,alt,rx,rz,rate,phase};
  });
  flush();
  const zones={
    departure:{x:10.8,z:5,yaw:PI/2,radius:3.0,anchor:{x:11.45,y:1.35,z:5}},
    arrival:{x:-17.6,z:-7,yaw:-PI/2,radius:3.0,anchor:{x:-30.51,y:1.90,z:-8.07}},
    shrine:{x:-5.15,z:39.25,yaw:0,radius:4.8},
    yard:{x:-7.3,z:-55.6,yaw:PI,radius:4.5},control:{x:TERMINAL_WALL.x,z:TERMINAL_WALL.z+10,yaw:PI,radius:3.4},
    smoking:{x:-15.65,z:12.2,yaw:0,radius:3.4},
  };
  for(const val of Object.values(zones))val.facing=val.yaw;
  const wall=TERMINAL_WALL_BOUNDS,clearance=.17;
  const noWalk=[...furnitureBounds,[wall.minX-clearance,wall.maxX+clearance,wall.minZ-clearance,wall.maxZ+clearance]];
  for(const [baseX,z] of [[24,-45],[24,-57.6]]){
    for(const dz of [-3.85,3.85])for(const dx of [-5.3,3.35]){
      const x=baseX+dx;noWalk.push([x-.68,x+.68,z+dz-1.19,z+dz+1.19]);
    }
  }
  function canWalk(x,z){
    if(!onHarborLand(x,z))return false;
    return !noWalk.some(([l,r,b,f])=>x>l&&x<r&&z>b&&z<f);
  }
  function update({time=0,night=0,push=0,pull=0,departure=0}={}){
    const t=Number.isFinite(time)?time:0,n=Number(night)||0;
    updateYard(n);
    const shove=Number(push)||0,tug=Number(pull)||0,leave=Number(departure)||0;
    primary.position.y=.026*Math.sin(t*.72)+shove*.028;primary.rotation.z=.002*Math.sin(t*.46)-shove*.009;
    // Ease off the quay into the channel before passing the wider eastern
    // apron, then follow the shoreline. This runs only on an actual departure.
    const castOff=Math.min(1,Math.max(0,leave/.47)),channel=Math.max(0,(leave-.13)/.87);
    primary.position.x=15.20+shove*.065+18*(castOff*castOff*(3-2*castOff));
    primary.position.z=1+channel*97;primary.rotation.y=.10*Math.sin(PI*castOff);
    arriving.position.y=.034*Math.sin(t*.69+.7);arriving.position.x=-33.10+tug*.11;
    arriving.rotation.z=.003*Math.sin(t*.43+.4)+tug*.009;neighborShips.forEach((v,i)=>{v.position.y=.033*Math.sin(t*.81+i*.7+.3);});
    remote.position.y=.036*Math.sin(t*.55);foam.position.set(.15*Math.sin(t*.43),.011*Math.sin(t*.72),.19*Math.cos(t*.34));
    flights.forEach(({bird,pair,cx,cz,alt,rx,rz,rate,phase},i)=>{
      const a=t*rate+phase;
      bird.position.set(cx+rx*Math.sin(a),alt+.33*Math.sin(a*2+phase),cz+rz*Math.cos(a));
      bird.rotation.y=Math.atan2(rx*Math.cos(a),-rz*Math.sin(a));
      bird.rotation.z=-.11+.065*Math.sin(a);bird.rotation.x=.035*Math.cos(a*2);
      const active=Math.max(0,Math.sin(t*.69+i*1.7));
      const lift=.04+active*(.31*Math.sin(t*5.1+i*.86)+.06);
      pair[0].rotation.z=-lift;pair[1].rotation.z=lift;
    });
    cabin.color.copy(cabinDay).lerp(cabinNight,n);cabin.emissiveIntensity=.78*n;
    lamp.emissiveIntensity=.20+1.82*n;washMat.opacity=.63*n;litPromenade.visible=n>.05;
    const paving=n>.4?nightPaving:dayPaving;
    if(pavementMat.map!==paving){pavementMat.map=paving;pavementMat.needsUpdate=true;}
    glints.visible=n>.35;glints.position.set(.11*Math.sin(t*.65),.009*Math.sin(t*.68),.14*Math.cos(t*.54));
    seaMat.color.set(n>.5?'#255570':'#42879b');
  }
  function destroy(){
    scene.remove(root);
    root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
    allGeos.forEach(g=>g.dispose());allMats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  }
  const groundHeight=()=>0;
  return {spawn:{x:6,z:8,yaw:PI*.68},worldBounds:HARBOR_BOUNDS,zones,canWalk,groundHeight,update,destroy,setVessel,setNeighbors,bindVessels,getRopeAnchor,shipTargets,smokingTarget:smoke,seats:smokingSeats,
    mainShip:primary,arrivalShip:arriving,neighborShip:neighbor,neighborSlots,
    collisionHullSpec:{sections,levels,ships:[primary,arriving,...neighborShips,remote]}};
}