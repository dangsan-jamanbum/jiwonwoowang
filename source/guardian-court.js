import { makeCourtTide } from './guardian-tide.js';
import { makeHonorHall } from './honor-hall.js';
import { makeWishWall } from './wish-wall.js';

// Facing the plaza, the Korean maritime heroes occupy the two higher central
// seats. The real open sea begins immediately behind this southern quay.
const pi=Math.PI;
const berths=[
  {id:'poseidon',name:'포세이돈',x:4.0,z:48.85,yaw:pi+.12,field:'#356d78',elevation:2.65},
  {id:'yi',name:'이순신 장군',x:-2.1,z:49.55,yaw:pi+.04,field:'#805854',elevation:3.35},
  {id:'jang',name:'해상왕 장보고',x:-8.2,z:49.55,yaw:pi-.04,field:'#546b82',elevation:3.35},
  {id:'njord',name:'뇨르드',x:-14.3,z:48.85,yaw:pi-.12,field:'#527669',elevation:2.65}
];
const stoneTop=1.10, halfWidth=1.62, halfDepth=1.31;
export function buildGuardianCourt(T,scene){
  const root=new T.Group();root.name='Maritime guardians court';scene.add(root);
  const spots=berths.map(({id,x,z,yaw,elevation})=>({
    id,x,y:stoneTop+elevation,z,yaw,front:{x:Math.sin(yaw),z:Math.cos(yaw)},approach:{x,z:z-4.1}
  }));
  const owned=new Set(),mats=new Set(),inscriptions=[];
  const colors=new Map(),get=c=>{if(!colors.has(c))colors.set(c,new T.Color(c));return colors.get(c);};
  // A separately bounded batch for each sculpture avoids submitting the entire
  // court when a player is examining a single emblem in first-person view.
  let batch;
  function begin(){batch={xyz:[],normals:[],colors:[]};}
  function tri(a,b,c,color){
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const len=Math.hypot(...n)||1,co=get(color);
    for(const p of [a,b,c]){batch.xyz.push(...p);batch.normals.push(n[0]/len,n[1]/len,n[2]/len);batch.colors.push(co.r,co.g,co.b);}
  }
  const quad=(a,b,c,d,col)=>{tri(a,b,c,col);tri(a,c,d,col);};
  const materials=new Map();
  function finish(name,parent=root){
    if(!batch.xyz.length)return;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(batch.xyz,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(batch.normals,3));g.setAttribute('color',new T.Float32BufferAttribute(batch.colors,3));
    g.userData.preserveTopology=true;g.computeBoundingSphere();owned.add(g);
    if(!materials.has('matte')){const m=new T.MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:.83,metalness:.03,side:T.DoubleSide});materials.set('matte',m);mats.add(m);}
    const m=new T.Mesh(g,materials.get('matte'));m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const stoneOutline=(width,depth,cut,dy)=>[
    [-width+cut,dy,depth],[width-cut,dy,depth],[width,dy,depth-cut],[width,dy,-depth+cut],
    [width-cut,dy,-depth],[-width+cut,dy,-depth],[-width,dy,-depth+cut],[-width,dy,depth-cut]
  ];
  function plinthLayer(w,d,cut,lo,hi,top,side,bevel=.026){
    const a=stoneOutline(w,d,cut,lo),b=stoneOutline(w,d,cut,hi-bevel),c=stoneOutline(w-bevel,d-bevel,Math.max(.05,cut-bevel*.5),hi);
    for(let i=0;i<8;i++){const j=(i+1)%8;
      quad(a[i],a[j],b[j],b[i],side);quad(b[i],b[j],c[j],c[i],top);tri([0,hi,0],c[i],c[j],top);
    }
  }
  function rod(a,b,r,col,n=6){
    const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va).normalize();
    const orth=new T.Vector3().crossVectors(d,Math.abs(d.y)<.86?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize(),other=new T.Vector3().crossVectors(d,orth),ring=[];
    for(let j=0;j<n;j++){const th=j*2*Math.PI/n;ring.push(orth.clone().multiplyScalar(r*Math.cos(th)).addScaledVector(other,r*Math.sin(th)));}
    for(let i=0;i<n;i++){const j=(i+1)%n;
      quad(va.clone().add(ring[i]).toArray(),va.clone().add(ring[j]).toArray(),vb.clone().add(ring[j]).toArray(),vb.clone().add(ring[i]).toArray(),col);}
  }
  function badge(id,field,accent){
    const front=.738;
    const points=[[-.312,.088],[-.35,.124],[-.35,.243],[-.305,.281],[.305,.281],[.35,.243],[.35,.124],[.312,.088]];
    for(let i=1;i<points.length-1;i++)tri([points[0][0],points[0][1],front],[points[i][0],points[i][1],front],[points[i+1][0],points[i+1][1],front],field);
    const y=.184, scale=.76,z=front+.009;
    function trace(path,width=.013){for(let i=1;i<path.length;i++)rod([path[i-1][0]*scale,y+path[i-1][1]*scale,z],[path[i][0]*scale,y+path[i][1]*scale,z],width,accent,5);}
    if(id==='poseidon'){
      trace([[0,-.094],[0,.113]]);
      for(const s of [-1,1])trace([[0,-.018],[s*.071,.003],[s*.102,.053],[s*.102,.103]]);
    }else if(id==='njord'){
      trace([[-.157,.004],[-.073,.002],[.001,.041],[.093,.065],[.124,.091],[.11,.109]]);
      trace([[-.115,-.064],[-.018,-.056],[.056,-.025],[.125,-.017],[.148,.010]]);
    }else if(id==='yi'){
      trace([[-.17,-.022],[-.111,-.070],[.113,-.070],[.17,-.02]]);trace([[-.152,-.012],[-.113,.054],[-.064,.079],[.059,.079],[.12,.045],[.138,-.008]]);
      trace([[-.035,.072],[-.059,.000]],.009);trace([[.055,.074],[.033,.002]],.009);trace([[.135,.017],[.177,.054],[.198,.034]],.011);
    }else{
      trace([[-.19,-.034],[-.118,-.077],[.10,-.078],[.197,-.010]]);trace([[-.047,-.025],[-.047,.115]]);trace([[-.053,.098],[-.14,.014],[-.055,.010]],.010);
      trace([[.066,-.03],[.066,.079]]);trace([[.068,.064],[.126,.013],[.070,.011]],.010);
    }
  }
  // The relief and the surrounding slab share a mineral surface. A distance
  // field from the Korean glyphs carves V-shaped channels into its height map.
  const graniteFaces=[];
  function canvasMap(canvas,display=false){
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
    map.userData.harborLitStone=true;
    if(display)map.userData.harborDisplay=true;
    inscriptions.push(map);return map;
  }
  function makeCanvas(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;}
  const grainSize=192,grainCanvas=makeCanvas(grainSize,grainSize),grain=grainCanvas.getContext('2d');
  let randomState=73175;
  const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  if(grain){
    const im=grain.createImageData(grainSize,grainSize);
    for(let y=0;y<grainSize;y++)for(let x=0;x<grainSize;x++){
      const crystal=random(),fleck=crystal<.037?-17:crystal>.963?21:0;
      const mottling=4*Math.sin(x*.082+Math.sin(y*.063))+3*Math.cos(y*.137+x*.043);
      const tone=121+mottling+(random()-.5)*15+fleck,i=(y*grainSize+x)*4;
      im.data[i]=tone-2;im.data[i+1]=tone+1;im.data[i+2]=tone;im.data[i+3]=255;
    }
    grain.putImageData(im,0,0);
    for(let i=0;i<130;i++){
      const x=random()*grainSize,y=random()*grainSize,sz=1+random()*1.9;
      grain.fillStyle=i%3?'rgba(41,48,46,.32)':'rgba(193,193,181,.39)';
      grain.beginPath();grain.moveTo(x,y);grain.lineTo(x+sz,y-.63*sz);
      grain.lineTo(x+1.4*sz,y+.36*sz);grain.lineTo(x+.32*sz,y+.82*sz);grain.fill();
    }
  }
  const stoneMap=canvasMap(grainCanvas), stoneMat=new T.MeshStandardMaterial({map:stoneMap,color:0xffffff,roughness:.96,metalness:0,vertexColors:true});
  mats.add(stoneMat);
  function carve(name,index){
    const w=768,h=219,face=makeCanvas(w,h),ctx=face.getContext('2d'),height=makeCanvas(w,h),bump=height.getContext('2d');
    const mask=makeCanvas(w,h),ink=mask.getContext('2d');
    if(!ctx||!bump||!ink)return null;
    const fontFamily='"Noto Serif KR","Noto Serif CJK KR",Batang,serif';
    let size=139;ink.font='bold '+size+'px '+fontFamily;
    const measured=ink.measureText(name).width;
    if(measured>w-32){size=Math.floor(size*(w-32)/measured);ink.font='bold '+size+'px '+fontFamily;}
    ink.textAlign='center';ink.textBaseline='middle';ink.fillStyle='#fff';ink.fillText(name,w/2,h/2-1);
    const glyph=ink.getImageData(0,0,w,h).data,distance=new Float32Array(w*h);
    for(let i=0;i<distance.length;i++)distance[i]=glyph[i*4+3]>127?30:0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-w]+1,distance[i-w-1]+1.414,distance[i-w+1]+1.414);
    }
    for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){
      const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+w]+1,distance[i+w+1]+1.414,distance[i+w-1]+1.414);
    }
    const depth=i=>Math.min(distance[i]/5.5,1);
    const colorMap=canvasMap(face,true);
    const relief=new T.CanvasTexture(height);relief.colorSpace=T.NoColorSpace;relief.anisotropy=4;inscriptions.push(relief);
    function repaint(quarry){
      ctx.fillStyle='#787d7b';ctx.fillRect(0,0,w,h);
      if(quarry){
        const sw=quarry.naturalWidth||quarry.width,sh=quarry.naturalHeight||quarry.height;
        const slice=Math.min(sh,sw*h/w),start=(sh-slice)*(index+.5)/4;
        ctx.drawImage(quarry,0,start,sw,slice,0,0,w,h);
      }else{
        for(let y=-32;y<h;y+=grainSize)for(let x=-23*index;x<w;x+=grainSize)ctx.drawImage(grainCanvas,x,y);
      }
      const source=ctx.getImageData(0,0,w,h),out=source.data,heights=bump.createImageData(w,h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=y*w+x,j=i*4,coverage=glyph[j+3]/255,d=depth(i);
        const gray=out[j]*.32+out[j+1]*.53+out[j+2]*.15;
        // Unpainted natural stone stays in the same mid-gray range across all
        // four tablets; the inscription is the shadow inside the cut.
        const field=quarry?Math.max(82,Math.min(150,112+(gray-119)*.43)):gray;
        const dx=x>0&&x<w-1?depth(i+1)-depth(i-1):0,dy=y>0&&y<h-1?depth(i+w)-depth(i-w):0;
        const grazing=(-dx*.62-dy*.80)*174;
        const tone=field+(grazing-(62+12*d)*coverage);
        out[j]=tone-1;out[j+1]=tone+1;out[j+2]=tone;
        const v=Math.round(193+(field-119)*.14-133*d);
        heights.data[j]=heights.data[j+1]=heights.data[j+2]=v;heights.data[j+3]=255;
      }
      ctx.putImageData(source,0,0);bump.putImageData(heights,0,0);
      colorMap.needsUpdate=true;relief.needsUpdate=true;
    }
    repaint(null);graniteFaces.push(repaint);
    return {colorMap,relief};
  }
  function stoneTablet(station,index){
    const tablet=new T.Group();tablet.name=station.name+' 석패';
    tablet.position.set(station.x,.02,46.62);tablet.rotation.y=pi;
    tablet.userData.atdInteract='guardian';tablet.userData.guardianId=station.id;root.add(tablet);
    // The apron, canted shoulders, raised lip and inner reveal have real
    // depth. There is no front face behind the opening until the text bed.
    const points=[],uvs=[],tones=[];
    function panel(a,b,c,tint){
      const u=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),v=new T.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
      const n=u.cross(v),ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
      for(const [x,y,z] of [a,b,c]){
        points.push(x,y,z);
        uvs.push(ax>az&&ax>ay?(z+.53)/1.06:(x+2.29)/4.58,ay>ax&&ay>az?(z+.53)/1.06:y/1.85);
        tones.push(tint,tint,tint);
      }
    }
    function link(left,right,tint){
      for(let i=0;i<left.length;i++){const k=(i+1)%left.length;
        panel(left[i],left[k],right[k],tint);panel(left[i],right[k],right[i],tint);}
    }
    function ring(w,lo,hi,corner,shoulder,z){
      return [[-w+corner,lo],[w-corner,lo],[w,lo+corner],[w,hi-shoulder],[w-shoulder,hi],
        [-w+shoulder,hi],[-w,hi-shoulder],[-w,lo+corner]].map(([x,y])=>[x,y,z-.06*y]);
    }
    const heel=ring(2.20,.02,.27,.08,.10,-.42),toe=ring(2.20,.02,.27,.08,.10,.42);
    link(heel,toe,.62);
    for(let i=1;i<toe.length-1;i++)panel(toe[0],toe[i],toe[i+1],.66);
    const rings=[
      ring(2.04,.19,1.80,.12,.25,-.37),
      ring(2.09,.20,1.81,.12,.25,.20),
      ring(2.03,.27,1.74,.11,.22,.37),
      ring(1.94,.37,1.64,.084,.15,.368),
      ring(1.88,.43,1.58,.062,.10,.287)
    ];
    for(let i=0;i<rings.length-1;i++)link(rings[i],rings[i+1],[.74,.89,.96,.59][i]);
    for(let i=1;i<rings[0].length-1;i++)panel(rings[0][0],rings[0][i+1],rings[0][i],.70);
    const bodyGeometry=new T.BufferGeometry();
    bodyGeometry.setAttribute('position',new T.Float32BufferAttribute(points,3));bodyGeometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    bodyGeometry.setAttribute('color',new T.Float32BufferAttribute(tones,3));bodyGeometry.computeVertexNormals();bodyGeometry.userData.preserveTopology=true;owned.add(bodyGeometry);
    const body=new T.Mesh(bodyGeometry,stoneMat);body.name=station.name+' 화강석 몸돌';body.castShadow=true;body.receiveShadow=true;tablet.add(body);
    const cut=carve(station.name,index);if(!cut)return;
    const bed=rings[rings.length-1],vertices=[],coords=[],indices=[];
    const centerY=1.005,centerZ=.287-.06*centerY;
    for(const [x,y,z] of bed){vertices.push(x,y-centerY,z-centerZ);coords.push((x+1.88)/3.76,(y-.43)/1.15);}
    for(let i=1;i<bed.length-1;i++)indices.push(0,i,i+1);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(coords,2));g.setIndex(indices);g.computeVertexNormals();owned.add(g);
    const material=new T.MeshStandardMaterial({color:0xffffff,map:cut.colorMap,bumpMap:cut.relief,bumpScale:.043,roughness:.96,metalness:0});
    mats.add(material);
    const face=new T.Mesh(g,material);face.name=station.name+' 음각';face.position.set(0,centerY,centerZ);face.receiveShadow=true;
    face.userData.atdInteract='guardian';face.userData.guardianId=station.id;tablet.add(face);
  }
  for(const [index,station] of berths.entries()){
    stoneTablet(station,index);
    const plinth=new T.Group();
    plinth.name=station.id+' honor plinth';
    plinth.userData.atdInteract='guardian';plinth.userData.guardianId=station.id;
    plinth.position.set(station.x,station.elevation,station.z);plinth.rotation.y=station.yaw;root.add(plinth);
    begin();
    {
      plinthLayer(1.93,1.52,.36,-.05,.018,'#9bafa7','#7b9392');
      plinthLayer(1.80,1.43,.32,.018,.067,'#c8c6b4','#a3aba0');
      plinthLayer(1.68,1.35,.30,.067,.105,'#d8d4c0','#b6bead');
    }
    plinthLayer(halfWidth,halfDepth,.34,.105,.20,'#c4c5b5','#94a49d',.04);
    plinthLayer(1.53,1.22,.32,.20,.32,'#e0d7c1','#b6bbaa',.035);
    plinthLayer(1.41,1.08,.25,.32,.39,'#729a95','#466e70');
    plinthLayer(1.37,1.05,.23,.39,.86,'#e2dfcc','#c5c4af',.035);
    plinthLayer(1.42,1.10,.26,.86,.94,'#aeaa91','#91a29a');
    plinthLayer(1.48,1.13,.28,.94,stoneTop,'#efead9','#ded8c1',.045);
    finish(station.id+' layered limestone',plinth);
    const relief=new T.Group();relief.position.set(0,.207,.748);relief.scale.set(1.44,1.64,.44);plinth.add(relief);
    begin();badge(station.id,station.field,'#fff0bb');finish(station.id+' enamel seal',relief);
    begin();
    for(const d of [-1,1]){
      const x=d*.91;
      rod([d*.62,.553,1.061],[d*1.20,.553,1.061],.014,'#a29670');
      quad([x-.02,.51,1.068],[x+.02,.51,1.068],[x+.02,.595,1.068],[x-.02,.595,1.068],'#af9c71');
    }
    finish(station.id+' bronze inlay',plinth);
  }
  // Higgsfield quarry sample. Only its mineral surface is used; the border,
  // inscription, cavity height and chisel shading are generated per statue.
  let quarryImage=null;
  if(typeof Image==='function'){
    quarryImage=new Image();
    quarryImage.onload=()=>{
      if(grain){
        const size=Math.min(quarryImage.naturalWidth||quarryImage.width,quarryImage.naturalHeight||quarryImage.height);
        grain.drawImage(quarryImage,0,0,size,size,0,0,grainSize,grainSize);
        const data=grain.getImageData(0,0,grainSize,grainSize);
        for(let p=0;p<data.data.length;p+=4){
          const d=data.data,shade=Math.max(82,Math.min(150,112+(d[p]*.32+d[p+1]*.53+d[p+2]*.15-119)*.43));
          d[p]=shade-1;d[p+1]=shade+1;d[p+2]=shade;
        }
        grain.putImageData(data,0,0);stoneMap.needsUpdate=true;
      }
      for(const paint of graniteFaces)paint(quarryImage);
      graniteFaces.length=0;
    };
    quarryImage.onerror=()=>{graniteFaces.length=0;};
    quarryImage.src='/assets/guardian-granite.png';
  }else graniteFaces.length=0;
  // Rotate the original tidal sculpture into the new shore frame; this keeps
  // each crest in the physical gap between its two neighbouring statues.
  const seaFrame=new T.Group();seaFrame.position.set(-5.15,2.58,49.20);seaFrame.rotation.y=pi;root.add(seaFrame);
  const surfSpots=spots.map(s=>({x:-(s.x+5.15),z:49.20-s.z}));
  const tide=makeCourtTide(T,seaFrame,surfSpots);
  const hall=makeHonorHall(T,root);
  const walls=[
    makeWishWall(T,root,{x:13,z:47.4,yaw:-pi*.5,side:'left'}),
    makeWishWall(T,root,{x:-23.3,z:47.4,yaw:pi*.5,side:'right'})
  ];
  const wishEntries={left:{x:10.2,z:45.9,radius:3.3},right:{x:-20.5,z:45.9,radius:3.3}};
  function blocks(x,z){return hall.blocks(x,z)||walls.some(w=>w.blocks(x,z));}
  function setWishes(call,wishes){for(const wall of walls)wall.setWishes(call,wishes);}
  function destroy(){
    if(quarryImage){quarryImage.onload=null;quarryImage.onerror=null;}graniteFaces.length=0;
    tide.destroy();hall.destroy();for(const wall of walls)wall.destroy();
    scene.remove(root);owned.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());inscriptions.forEach(map=>map.dispose());
  }
  return {group:root,spots,blocks,wishEntries,setWishes,update:tide.update,destroy};
}