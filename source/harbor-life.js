// The approach is also used by the presence service to validate eating at the counter.
export const EOMUK_ZONE = Object.freeze({x:-13.75, z:24.7, yaw:-Math.PI / 2, radius:2.45});
export const SHARK_WATCH = Object.freeze({x:-17.75, z:30.35, yaw:-Math.PI / 2, radius:2.8});

const SEA_LEVEL = -.85;
const STALL = Object.freeze({x:-16.15, z:24.7, yaw:Math.PI / 2});
const WATCH_SIGN = Object.freeze({x:-18.42, z:28.15, yaw:Math.PI*.61});

export function buildHarborLife(T, scene) {
  const group=new T.Group();group.name='부산항의 일상';scene.add(group);
  const booth=new T.Group();booth.name='부산 어묵 포장마차';booth.position.set(STALL.x,0,STALL.z);
  booth.rotation.y=STALL.yaw;booth.userData.atdInteract='eomuk';group.add(booth);
  const resources=new Set(),colors=new Map();
  const keep=resource=>{resources.add(resource);return resource;};
  function material(color) {
    if(!colors.has(color))colors.set(color,keep(new T.MeshStandardMaterial({color,roughness:.80,side:T.DoubleSide})));
    return colors.get(color);
  }
  const cube=keep(new T.BoxGeometry()),ball=keep(new T.SphereGeometry(1,12,9)),tube=keep(new T.CylinderGeometry(1,1,1,10));
  const up=new T.Vector3(0,1,0),vector=new T.Vector3();
  function mesh(parent,g,m,x=0,y=0,z=0){
    const o=new T.Mesh(g,typeof m==='string'?material(m):m);o.position.set(x,y,z);parent.add(o);return o;
  }
  function box(parent,m,x,y,z,w,h,d){const o=mesh(parent,cube,m,x,y,z);o.scale.set(w,h,d);return o;}
  function ellipsoid(parent,m,x,y,z,rx,ry,rz){const o=mesh(parent,ball,m,x,y,z);o.scale.set(rx,ry,rz);return o;}
  function cyl(parent,m,x,y,z,r,h){const o=mesh(parent,tube,m,x,y,z);o.scale.set(r,h,r);return o;}
  function bar(parent,m,a,b,r) {
    const dir=vector.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const length=dir.length();
    const o=mesh(parent,tube,m,(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5);
    o.quaternion.setFromUnitVectors(up,dir.normalize());o.scale.set(r,length,r);return o;
  }
  function curve(parent,m,points,r,segments=12){
    const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    return mesh(parent,keep(new T.TubeGeometry(path,segments,r,5,false)),m);
  }
  function geometry(vertices,index,vertexColors){
    const g=keep(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(index);
    if(vertexColors)g.setAttribute('color',new T.Float32BufferAttribute(vertexColors,3));
    g.computeVertexNormals();g.computeBoundingSphere();g.userData.preserveTopology=true;return g;
  }
  function paintedSign(text,w,h,x,y,z) {
    const cv=document.createElement('canvas');cv.width=768;cv.height=150;
    const c=cv.getContext('2d');c.fillStyle='#f3dfb8';c.fillRect(0,0,768,150);
    c.strokeStyle='#a9623d';c.lineWidth=3;c.strokeRect(10,10,748,130);
    c.textAlign='center';c.textBaseline='middle';c.fillStyle='#643e33';c.font='bold 106px "Noto Serif KR",serif';c.fillText(text,384,78,620);
    for(const s of [24,744]){c.fillStyle='#927a5f';c.beginPath();c.arc(s,76,3.5,0,Math.PI*2);c.fill();}
    const map=keep(new T.CanvasTexture(cv));map.colorSpace=T.SRGBColorSpace;map.userData.harborDisplay=true;map.userData.harborLitStone=true;
    const face=mesh(booth,keep(new T.PlaneGeometry(w,h)),keep(new T.MeshStandardMaterial({map,roughness:.89})),x,y,z);face.name=text;
  }
  const steel='#8d9b96',chrome='#cbd0ba',charcoal='#394b49',timber='#996b49',cream='#f6dcaa',apron='#536f60';
  // A pushcart base, worn timber service counter and a lidded back shelf.
  for(const x of [-1.35,1.32])for(const z of [-.49,.49]){
    const wheel=cyl(booth,'#4c524d',x,.245,z,.245,.11);wheel.rotation.x=Math.PI*.5;
    const hub=cyl(booth,'#a5a391',x,.245,z+Math.sign(z)*.058,.10,.014);hub.rotation.x=Math.PI*.5;
  }
  box(booth,'#426258',0,.72,0,3.30,.76,1.34);
  const slats=['#b78154','#b07a50','#c28d5d','#aa744c','#bf8957'];
  for(let n=0;n<14;n++)box(booth,slats[n%slats.length],-1.54+n*.237,.72,.683,.218,.64,.027);
  box(booth,timber,0,1.11,.02,3.55,.15,1.58);
  const sashimiPlate=new T.Group();sashimiPlate.name='상어회 접시';sashimiPlate.position.set(-1.02,1.245,-.20);booth.add(sashimiPlate);
  cyl(sashimiPlate,'#d9e2dc',0,.015,0,.64,.075);
  cyl(sashimiPlate,'#668c80',0,.057,0,.57,.025);
  cyl(sashimiPlate,'#f3e8d3',0,.072,0,.49,.012);
  const sashimiSlices=[];
  function fillSashimiPlate(){
    if(sashimiSlices.length)return;
    for(let i=0;i<27;i++){
      const ring=i<9?0:i<18?1:2,slot=i%9,angle=slot*Math.PI*2/9+ring*.18,radius=.13+ring*.145;
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      const slice=ellipsoid(sashimiPlate,'#ee9588',x,.112+ring*.004,z,.142,.027,.069);
      slice.rotation.y=angle+.18;sashimiSlices.push(slice);
      ellipsoid(sashimiPlate,'#f8d9c9',x-.012,.137+ring*.004,z-.006,.093,.008,.014).rotation.y=angle+.18;
    }
    for(let i=0;i<5;i++){
      const leaf=ellipsoid(sashimiPlate,'#6d9a68',-.40+i*.075,.105,.30,.13,.018,.045);
      leaf.rotation.y=-.48+i*.22;
    }
  }
  box(booth,'#cda678',0,1.15,.807,3.55,.065,.045);
  box(booth,'#8e5c43',0,.395,.71,3.38,.12,.095);
  for(const x of [-1.56,1.56])for(const z of [-.57,.59]){
    bar(booth,chrome,[x,1.16,z],[x,2.65,z],.033);cyl(booth,charcoal,x,1.17,z,.063,.066);
  }
  // A stretched canvas awning: ridge, sagging front valance, stitched panels.
  const stripes=['#c95e3d','#d5714c','#c55b3a','#db8054','#cf6843'];
  const eaves=[[-.98,2.59],[-.56,2.84],[.02,2.99],[.47,2.92],[.95,2.71],[.96,2.48]];
  for(let i=0;i<9;i++){
    const x0=-1.90+i*(3.8/9),x1=x0+3.8/9,mid=(x0+x1)*.5,xyz=[],ix=[];
    for(let j=0;j<eaves.length;j++){
      const [z,y]=eaves[j];xyz.push(x0,y,z,mid,y-(j===5?.045:.012),z+.008,x1,y,z);
      if(j<eaves.length-1)for(let k=0;k<2;k++){const a=j*3+k;ix.push(a,a+3,a+1,a+1,a+3,a+4);}
    }
    mesh(booth,geometry(xyz,ix),stripes[i%stripes.length]);
  }
  for(const x of [-1.90,1.90]){
    mesh(booth,geometry([x,2.57,-.98,x,2.84,-.56,x,2.99,.02,x,2.92,.47,x,2.71,.95,x,2.57,.95],[0,1,2,0,2,3,0,3,4,0,4,5]),'#ce714d');
    for(let j=0;j<4;j++)bar(booth,cream,[x,eaves[j][1]-.01,eaves[j][0]],[x,eaves[j+1][1]-.01,eaves[j+1][0]],.017);
  }
  bar(booth,cream,[-1.90,2.70,.956],[1.90,2.70,.956],.019);
  box(booth,timber,0,2.49,.979,2.31,.42,.071);paintedSign('부산 어묵',2.26,.385,0,2.495,1.018);
  // Divided stainless pan, amber broth, folded flat fish cakes and round skewers.
  box(booth,charcoal,.15,1.21,.32,1.73,.14,.80);
  box(booth,steel,.15,1.285,.32,1.68,.065,.77);box(booth,'#ad753c',.15,1.319,.32,1.53,.02,.62);
  for(const x of [-.66,.15,.96])box(booth,chrome,x,1.35,.32,.032,.082,.715);
  for(const z of [-.043,.683])box(booth,chrome,.15,1.35,z,1.66,.082,.032);
  const folded=geometry([-.070,-.165,-.033,.073,-.095,-.033,-.064,-.01,-.033,.094,.066,-.033,-.046,.139,-.033,
    -.070,-.165,.033,.073,-.095,.033,-.064,-.01,.033,.094,.066,.033,-.046,.139,.033],[0,1,5,1,6,5,1,2,6,2,7,6,2,3,7,3,8,7,3,4,8,4,9,8]);
  for(let i=0;i<12;i++){
    const x=-.49+(i%6)*.249,z=.12+Math.floor(i/6)*.36,lean=(i%3-1)*.045;
    bar(booth,'#b08a53',[x,1.33,z],[x+lean,1.80+(i%4)*.043,z-.105],.011);
    if(i%3===1){for(let p=0;p<2;p++)ellipsoid(booth,p?'#e2b969':'#ce9855',x+lean*.3,1.40+p*.103,z-.031,.070,.075,.059);}
    else {const fish=mesh(booth,folded,i%2?'#ebca8a':'#d6a064',x+lean*.3,1.49,z-.036);fish.rotation.y=(i%4)*.24;}
  }
  const urn=cyl(booth,'#9faaa0',1.32,1.38,-.01,.218,.41);urn.name='육수통';
  cyl(booth,chrome,1.32,1.604,-.01,.24,.047);ellipsoid(booth,charcoal,1.32,1.65,-.01,.07,.037,.05);
  for(let n=0;n<4;n++){const cup=mesh(booth,keep(new T.CylinderGeometry(.102,.070,.155,12)),cream,-1.29+n*.08,1.27,-.02+n*.065);cup.rotation.z=(n-2)*.03;}
  for(const x of [-1.3,1.3]){
    bar(booth,'#665344',[x,2.81,.32],[x,2.58,.32],.011);
    ellipsoid(booth,'#e98153',x,2.43,.32,.131,.163,.133);cyl(booth,cream,x,2.41,.32,.135,.043);cyl(booth,charcoal,x,2.58,.32,.064,.035);
  }
  // A distinct, short-haired vendor in a kerchief and apron offers a skewer.
  const vendor=new T.Group();vendor.name='어묵집 아주머니';vendor.position.set(-.55,0,-.50);booth.add(vendor);
  const skin='#e5ac8f',hair='#493b39';
  ellipsoid(vendor,'#e6cc9f',0,1.29,0,.304,.48,.212);box(vendor,apron,0,1.28,.162,.403,.53,.095);
  for(const s of [-1,1])bar(vendor,apron,[s*.105,1.63,.119],[s*.165,1.44,.214],.030);
  const vendorHead=new T.Group();vendorHead.position.set(0,1.87,0);vendor.add(vendorHead);
  ellipsoid(vendorHead,skin,0,0,.017,.27,.293,.238);ellipsoid(vendorHead,hair,0,.065,-.058,.283,.26,.211);
  ellipsoid(vendorHead,'#ba654d',0,.169,-.029,.293,.158,.240);
  curve(vendorHead,cream,[[-.27,.121,.03],[-.178,.157,.153],[.015,.147,.202],[.17,.135,.153],[.26,.113,.064]],.017);
  for(const s of [-1,1]){
    ellipsoid(vendorHead,skin,s*.252,-.018,.035,.054,.069,.045);ellipsoid(vendorHead,hair,s*.099,.015,.230,.022,.029,.011);
    ellipsoid(vendorHead,'#ce8a77',s*.152,-.042,.202,.045,.020,.009);
  }
  curve(vendorHead,'#895746',[[-.043,-.085,.224],[.0,-.099,.232],[.047,-.081,.217]],.009,7);
  ellipsoid(vendorHead,skin,.006,-.029,.249,.040,.031,.032);
  for(const s of [-1,1]){
    const end=[s*(s<0?.38:.31),s<0?1.35:1.45,s<0?.25:.36];
    bar(vendor,'#dcb68a',[s*.232,1.51,.01],[s*.365,1.38,.123],.083);bar(vendor,skin,[s*.365,1.38,.123],end,.059);ellipsoid(vendor,skin,...end,.069,.073,.061);
  }
  bar(vendor,'#bd914f',[.30,1.43,.33],[.49,1.79,.49],.011);
  for(let n=0;n<3;n++)ellipsoid(vendor,'#e3b777',.385+n*.024,1.62+n*.05,.42+n*.022,.048,.041,.044);
  // The cart and the vendor's head each move as a unit. Batch their small
  // pieces by painting the original material colour into the merged vertices.
  const boothPaint=keep(new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.80,side:T.DoubleSide}));
  function batchWoodAndFittings(parent,excluded) {
    parent.updateWorldMatrix(true,true);
    const inv=parent.matrixWorld.clone().invert(),transform=new T.Matrix4(),normalMatrix=new T.Matrix3();
    const xyz=[],normal=[],color=[],index=[],pieces=[];
    function collect(item){
      if(item===excluded)return;
      if(item.isMesh&&item.material.isMeshStandardMaterial&&!item.material.map){
        const g=item.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal'),offset=xyz.length/3,rgb=item.material.color;
        transform.multiplyMatrices(inv,item.matrixWorld);normalMatrix.getNormalMatrix(transform);
        for(let v=0;v<p.count;v++){
          vector.fromBufferAttribute(p,v).applyMatrix4(transform);xyz.push(vector.x,vector.y,vector.z);
          vector.fromBufferAttribute(n,v).applyNormalMatrix(normalMatrix);normal.push(vector.x,vector.y,vector.z);color.push(rgb.r,rgb.g,rgb.b);
        }
        const ix=g.getIndex();for(let k=0;k<(ix?.count??p.count);k++)index.push(offset+(ix?ix.getX(k):k));
        pieces.push(item);
      }
      item.children.forEach(collect);
    }
    parent.children.forEach(collect);
    const combined=geometry(xyz,index,color);combined.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
    pieces.forEach(o=>o.removeFromParent());const model=mesh(parent,combined,boothPaint);model.name=parent.name+' 조형';
  }
  batchWoodAndFittings(booth,vendorHead);batchWoodAndFittings(vendorHead);
  // A waist-high harbour marker sits between the cart and the observation
  // spot, well below the sightline from the walkway to the dorsal fin.
  const marker=new T.Group();marker.name='상어 표지판';marker.userData.atdInteract='sharkWatch';
  marker.position.set(WATCH_SIGN.x,0,WATCH_SIGN.z);marker.rotation.y=WATCH_SIGN.yaw;group.add(marker);
  box(marker,'#a7aaa0',0,.043,0,.36,.084,.29);
  box(marker,'#5d6a62',0,.28,0,.16,.44,.13);
  box(marker,'#9e7752',0,.75,0,.146,.96,.113);
  box(marker,'#876b4d',0,1.16,0,.90,.70,.13);
  box(marker,'#b49b78',0,1.532,0,.94,.058,.169);
  batchWoodAndFittings(marker);
  const markerCv=document.createElement('canvas');markerCv.width=352;markerCv.height=272;
  const ink=markerCv.getContext('2d');
  ink.fillStyle='#2e6069';ink.fillRect(0,0,352,272);
  ink.strokeStyle='#8caaa3';ink.lineWidth=3;ink.strokeRect(9,9,334,254);
  // A simple round snout, swept tail and dorsal fin echo the animal below.
  ink.save();ink.translate(176,136);ink.scale(1.42,1.42);ink.translate(-122,-99);ink.fillStyle='#e2ebdc';
  ink.beginPath();ink.moveTo(26,110);ink.quadraticCurveTo(77,71,120,79);ink.lineTo(155,39);
  ink.quadraticCurveTo(158,60,148,82);ink.quadraticCurveTo(176,86,194,98);ink.lineTo(220,74);
  ink.quadraticCurveTo(220,98,209,111);ink.lineTo(221,132);ink.lineTo(196,123);
  ink.quadraticCurveTo(165,141,114,143);ink.lineTo(133,158);ink.quadraticCurveTo(103,159,83,142);
  ink.quadraticCurveTo(43,141,28,125);ink.quadraticCurveTo(18,119,26,110);ink.fill();
  ink.fillStyle='#335e65';ink.beginPath();ink.arc(61,108,4.5,0,Math.PI*2);ink.fill();
  ink.restore();
  const signMap=keep(new T.CanvasTexture(markerCv));signMap.colorSpace=T.SRGBColorSpace;signMap.userData.harborDisplay=true;
  const face=keep(new T.PlaneGeometry(.84,.645));
  const signInk=keep(new T.MeshStandardMaterial({map:signMap,roughness:.78}));
  const front=mesh(marker,face,signInk,0,1.165,.066);front.name=marker.name;
  // A fishing rod is fixed beside the lookout; its fine line reaches the shark pool.
  bar(marker,'#574535',[.34,1.02,.11],[1.02,3.02,-.20],.034);
  curve(marker,'#d9e1dc',[[1.02,3.02,-.20],[1.24,2.12,-.40],[1.48,.34,-.72]],.008,16);
  const back=mesh(marker,face,signInk,0,1.165,-.066);back.rotation.y=Math.PI;
  // Swirls of steam above the pot. A soft alpha gradient leaves the broth and skewers in view.
  const vapourCanvas=document.createElement('canvas');vapourCanvas.width=64;vapourCanvas.height=80;
  const vc=vapourCanvas.getContext('2d');const mist=vc.createRadialGradient(32,40,1,32,40,30);
  mist.addColorStop(0,'rgba(255,247,222,.85)');mist.addColorStop(.42,'rgba(255,247,222,.46)');mist.addColorStop(1,'rgba(255,247,222,0)');vc.fillStyle=mist;vc.fillRect(0,0,64,80);
  const vapourTexture=keep(new T.CanvasTexture(vapourCanvas));vapourTexture.colorSpace=T.SRGBColorSpace;
  const steamGeo=keep(new T.PlaneGeometry(.40,.65));
  const steam=Array.from({length:6},(_,i)=>{
    const m=keep(new T.MeshBasicMaterial({map:vapourTexture,transparent:true,opacity:.35,depthWrite:false,side:T.DoubleSide}));
    const wisp=mesh(booth,steamGeo,m);wisp.name='어묵 솥의 김';wisp.rotation.y=(i%3-1)*.40;return wisp;
  });

  // A round-nosed requiem shark. The body, asymmetric caudal fin and paired
  // pectorals have real thickness and can be viewed from either shore angle.
  const shark=new T.Group();shark.name='북항이';shark.userData.atdInteract='shark';group.add(shark);
  const animal=new T.Group();shark.add(animal);
  const rings=[[-1.77,.085,.10,.035],[-1.58,.114,.12,.015],[-1.24,.185,.174,.012],[-.84,.342,.278,.025],
    [-.30,.49,.377,.045],[.27,.55,.403,.056],[.76,.52,.368,.064],[1.19,.428,.288,.090],
    [1.52,.326,.192,.11],[1.72,.22,.121,.124],[1.83,.10,.066,.132],[1.858,.014,.018,.137]];
  const bodyPos=[],bodyIx=[],bodyColor=[],segments=24,dorsalPaint=new T.Color('#75939e'),flankPaint=new T.Color('#9db7b8'),bellyPaint=new T.Color('#d8dfd0');
  rings.forEach(([z,width,height,offset],j)=>{
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,yn=Math.sin(a),xn=Math.cos(a);
      bodyPos.push(xn*width,yn*height+offset,z);
      const color=yn>-.23?flankPaint.clone().lerp(dorsalPaint,Math.min(1,(yn+.23)*1.10)):flankPaint.clone().lerp(bellyPaint,Math.min(1,(-.23-yn)*4.2));
      bodyColor.push(color.r,color.g,color.b);
      if(j<rings.length-1){const p=j*segments+i,q=j*segments+(i+1)%segments;bodyIx.push(p,q,p+segments,q,q+segments,p+segments);}
    }
  });
  const sharkSkin=keep(new T.MeshStandardMaterial({vertexColors:true,color:0xffffff,side:T.DoubleSide,roughness:.54,metalness:.015}));
  const body=mesh(animal,geometry(bodyPos,bodyIx,bodyColor),sharkSkin);body.name='둥근 주둥이와 유선형 몸통';
  // Closed tapered blades are thicker along their leading edge. Each fin uses
  // an internal ridge; silhouettes remain readable even when seen edge-on.
  function fin(parent,name,outline,ridge,width,color,axis='x'){
    const points=outline.flat(),v=axis==='x'?[width,0,0]:[0,width,0];
    points.push(...ridge.map((d,i)=>d+v[i]),...ridge.map((d,i)=>d-v[i]));
    const a=outline.length,b=a+1,index=[];for(let j=0;j<a;j++){const k=(j+1)%a;index.push(j,k,a,k,j,b);}
    const o=mesh(parent,geometry(points,index),color);o.name=name;return o;
  }
  fin(animal,'등지느러미',[[0,.34,.35],[0,.59,.18],[0,.88,-.015],[0,1.03,-.24],[0,1.055,-.36],
    [0,.91,-.337],[0,.76,-.32],[0,.58,-.38],[0,.47,-.50],[0,.35,-.65]],[0,.57,-.095],.077,'#445d71');
  curve(animal,'#a4b8bc',[[0,.49,.263],[0,.65,.145],[0,.854,.010],[0,1.013,-.216]],.017,12);
  fin(animal,'두 번째 등지느러미',[[0,.18,-1.13],[0,.37,-1.35],[0,.41,-1.42],[0,.24,-1.43],[0,.17,-1.51]],[0,.25,-1.33],.04,'#546b79');
  const pectorals=[];
  for(const s of [-1,1]){
    const verts=[[s*.42,.047,.62],[s*.74,.021,.40],[s*1.02,-.021,.09],[s*1.25,-.077,-.17],
      [s*1.31,-.102,-.31],[s*1.22,-.099,-.36],[s*.83,-.050,-.25],[s*.52,-.018,-.15],[s*.39,-.063,.12]];
    pectorals.push(fin(animal,'가슴지느러미',verts,[s*.70,.008,.13],.045,'#71949c','y'));
    fin(animal,'배지느러미',[[s*.19,-.08,-.71],[s*.42,-.15,-.87],[s*.49,-.17,-1.10],[s*.28,-.12,-1.04],[s*.15,-.10,-.95]],
      [s*.28,-.12,-.91],.022,'#7e9fa2','y');
  }
  const tailPivot=new T.Group();tailPivot.position.set(0,.038,-1.58);animal.add(tailPivot);
  const tail=fin(tailPivot,'초승달 꼬리지느러미',[[0,.0,.073],[0,.23,-.10],[0,.47,-.30],[0,.73,-.59],[0,.84,-.78],
    [0,.78,-.88],[0,.50,-.65],[0,.28,-.47],[0,.07,-.34],[0,-.01,-.35],[0,-.26,-.50],[0,-.42,-.63],
    [0,-.46,-.59],[0,-.30,-.32],[0,-.13,-.13]],[0,.095,-.18],.073,'#527481');
  for(const s of [-1,1]){
    ellipsoid(animal,'#364c58',s*.436,.175,1.13,.038,.049,.056);
    ellipsoid(animal,'#f7efda',s*.461,.196,1.146,.014,.014,.017);
    ellipsoid(animal,'#3e5961',s*.186,.166,1.74,.016,.012,.021);
    curve(animal,'#556e71',[[s*.248,.047,1.66],[s*.332,.050,1.49],[s*.392,.067,1.32]],.009,6);
    for(let i=0;i<3;i++){
      const z=.82-i*.111,x=.51+i*.011;
      curve(animal,'#476773',[[s*(x-.026),.212,z],[s*x,.136,z-.035],[s*(x+.01),.060,z-.028]],.011,5);
    }
  }
  // The harbor's opaque ocean clips submerged geometry. Reproject only the
  // underwater silhouettes just below the apparent wet back, tinted through
  // the water. This preserves the full fins in the software and WebGL views.
  const below=new T.Group();below.name='수면에 비치는 북항이';shark.add(below);
  const refract=keep(new T.MeshBasicMaterial({color:'#7ea5b1',transparent:true,opacity:.69,side:T.DoubleSide,depthWrite:false}));
  const detail=keep(new T.MeshBasicMaterial({color:'#82a6ad',transparent:true,opacity:.76,side:T.DoubleSide,depthWrite:false}));
  const echo=mesh(below,body.geometry,refract);echo.renderOrder=1;
  for(const source of pectorals){const f=mesh(below,source.geometry,detail);f.renderOrder=1;}
  const echoTail=new T.Group();echoTail.position.copy(tailPivot.position);below.add(echoTail);const tailShadow=mesh(echoTail,tail.geometry,detail);tailShadow.renderOrder=1;
  below.scale.y=.009; below.position.y=.017;
  // The wake is broken up into short arcs so both the nose and the turning
  // tail leave a gentle line, without a permanent oval surrounding the fish.
  const wake=new T.Group();shark.add(wake);const wakePieces=[];
  for(const s of [-1,1])for(let j=0;j<3;j++){
    const start=[1.52,.19,-1.36][j],end=[.49,-.98,-2.96][j],spread=[.31,.66,.84][j];
    const w=curve(wake,keep(new T.MeshBasicMaterial({color:j===0?'#e1eee3':'#b0cfcd',transparent:true,opacity:.52,depthWrite:false})),
      [[s*spread,.035,start],[s*(spread+.19),.035,start*.54+end*.46],[s*(spread+.21+.10*j),.035,end]],j===0?.029:.023,10);
    w.renderOrder=2;wakePieces.push(w);
  }
  const dayTransmission=new T.Color('#84acb4'),nightTransmission=new T.Color('#507e91');
  let sceneTime=0,fishingStartedAt=null,plateFilled=false;
  function setSashimiPlate(){
    fishingStartedAt=null;plateFilled=true;fillSashimiPlate();
  }
  function fishShark(){
    if(plateFilled)return 'full';
    if(fishingStartedAt!==null)return 'busy';
    fishingStartedAt=sceneTime;return 'started';
  }
  function update(time=0,night=0,reduced=false){
    sceneTime=Number.isFinite(time)?time:sceneTime;
    let caughtNow=false,jump=0;
    if(fishingStartedAt!==null){
      const progress=(sceneTime-fishingStartedAt)/2.65;
      if(progress<1)jump=Math.sin(Math.max(0,progress)*Math.PI)*2.45;
      else{fishingStartedAt=null;plateFilled=true;fillSashimiPlate();caughtNow=true;}
    }
    const t=reduced?7:Number.isFinite(time)?time:0,n=Math.max(0,Math.min(1,Number(night)||0));
    for(let i=0;i<steam.length;i++){
      const s=steam[i],life=(t*.32+i*.173)%1;
      s.position.set(-.38+(i%3)*.39+.12*Math.sin(t*1.4+i)+life*.065,1.46+life*.76,.13+(i%2)*.25);
      s.scale.set(.53+.82*life,.63+.59*life,1);s.rotation.z=.28*Math.sin(life*3+i);s.material.opacity=.53*Math.sin(life*Math.PI);
    }
    vendorHead.rotation.y=.10*Math.sin(t*.51)-.055;vendorHead.rotation.z=.019*Math.sin(t*.66);
    // The west side of the quay is clear from the stall to the new shoreline
    // return. A short patrol keeps both the bow and tail in this open water.
    const a=t*.18+.66,rx=1.48,rz=3.20;
    shark.position.set(-24.8+rx*Math.sin(a),SEA_LEVEL+jump,30.55+rz*Math.cos(a));
    shark.rotation.y=Math.atan2(rx*Math.cos(a),-rz*Math.sin(a));
    animal.position.y=-.083+.048*Math.sin(a*1.8);animal.rotation.z=.038*Math.sin(a);animal.rotation.x=.025*Math.sin(t*1.12);
    tailPivot.rotation.y=.27*Math.sin(t*1.95);echoTail.rotation.y=tailPivot.rotation.y;
    for(let i=0;i<wakePieces.length;i++){const w=wakePieces[i];w.material.opacity=(.60+.13*Math.sin(t*.90-i*.86))*(1-.16*n);w.position.z=.065*Math.sin(t*1.28-i*.46);}
    refract.color.copy(dayTransmission).lerp(nightTransmission,n);detail.color.copy(refract.color).multiplyScalar(1.08);
    return caughtNow;
  }
  function blocks(x,z){
    if(Math.abs(x-STALL.x)<1.09 && Math.abs(z-STALL.z)<1.93)return true;
    const dx=x-WATCH_SIGN.x,dz=z-WATCH_SIGN.z,c=Math.cos(WATCH_SIGN.yaw),s=Math.sin(WATCH_SIGN.yaw);
    return Math.abs(dx*c-dz*s)<.58&&Math.abs(dx*s+dz*c)<.29;
  }
  function dispose(){scene.remove(group);resources.forEach(resource=>resource.dispose());resources.clear();}
  update();return {group,booth,shark,sharkWatch:SHARK_WATCH,approach:EOMUK_ZONE,blocks,update,fishShark,setSashimiPlate,dispose};
}