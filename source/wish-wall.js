// The ground-level long side faces local +Z. The upper box sits on a second
// ground box behind it; the writing surface stays accessible from the plaza.
const W = 6, H = 2.595, REAR_Z = -2.43, MAX_NOTES = 12;
const bounds = Object.freeze({minX:-3.01,maxX:3.01,minZ:REAR_Z-1.19,maxZ:1.24});
const dimensions = Object.freeze({width:bounds.maxX-bounds.minX,height:H+2.60,depth:bounds.maxZ-bounds.minZ,bounds});
const FONT = 'AtdPret,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';

function clean(value, limit) {
  return Array.from(String(value ?? '').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, limit).join('');
}

function clipped(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  const chars = Array.from(text);
  while (chars.length && ctx.measureText(chars.join('') + '…').width > width) chars.pop();
  return chars.join('') + '…';
}

function bodyLines(ctx,text,width,maxLines){
  const chars=Array.from(text),lines=[];
  while(chars.length && lines.length<maxLines-1){
    let line='';
    while(chars.length && ctx.measureText(line+chars[0]).width<=width)line+=chars.shift();
    if(!line && chars.length)line=chars.shift();
    lines.push(line.trim());
  }
  if(chars.length)lines.push(clipped(ctx,chars.join('').trim(),width));
  return lines;
}

function drawBL(ctx,entry,vessel){
  const {width,height}=ctx.canvas;
  ctx.fillStyle='#e6eff0';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#325968';ctx.fillRect(0,0,width,37);
  ctx.font='bold 22px '+FONT;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#fff8e7';
  ctx.fillText('게임 B/L',20,19);
  ctx.font='600 16px '+FONT;ctx.textAlign='right';
  ctx.fillText(clipped(ctx,vessel,width*.59),width-16,19);
  ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#26454c';ctx.font='600 24px '+FONT;
  bodyLines(ctx,entry.text,width-52,2).forEach((line,i)=>ctx.fillText(line,22,67+i*30));
  ctx.fillStyle='#86a7ad';ctx.fillRect(18,height-43,width-36,1.5);
  ctx.font='bold 20px '+FONT;ctx.fillStyle='#3c5b61';
  ctx.fillText(clipped(ctx,entry.name,width-130),22,height-14);
  ctx.font='600 16px '+FONT;ctx.textAlign='right';ctx.fillText('출항 기념',width-17,height-15);
}
function drawNote(ctx, entry, accent, paper) {
  const {width, height} = ctx.canvas;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 7, height);
  ctx.fillStyle = '#363b35';
  ctx.font = '600 29px ' + FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  bodyLines(ctx,entry.text,width-58,2).forEach((line,i)=>ctx.fillText(line,25,52+i*39));
  ctx.fillStyle = accent;
  ctx.fillRect(25, height-44, width-49, 1.5);
  ctx.font = 'bold 22px ' + FONT;
  ctx.fillStyle = '#45584c';
  ctx.fillText(clipped(ctx, entry.name, width-63), 25, height-12);
}

export function makeWishWall(T, parent, {x,z,yaw=0,side='left'}) {
  const wallSide=side==='right'?'right':'left';
  function tag(obj){obj.userData.atdInteract='wish';obj.userData.wishSide=wallSide;}
  const group = new T.Group();
  group.name = 'Harbor wish containers · '+wallSide;
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  parent.add(group);
  const materials = new Set(), geometries = new Set(), textures = new Set();
  const metal = new T.MeshStandardMaterial({vertexColors:true, roughness:.8, metalness:.13});
  materials.add(metal);
  const positions=[], colors=[], indices=[], normals=[];
  const palette = new Map();
  function face(points, color, direction) {
    let rgb=palette.get(color);
    if (!rgb) {rgb=new T.Color(color);palette.set(color,rgb);}
    const start=positions.length/3;
    for (const point of points) {
      positions.push(...point);colors.push(rgb.r,rgb.g,rgb.b);normals.push(...direction);
    }
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  function box(cx, cy, cz, w, h, d, paint) {
    const l=cx-w/2,r=cx+w/2,b=cy-h/2,t=cy+h/2,f=cz+d/2,k=cz-d/2;
    face([[l,b,f],[r,b,f],[r,t,f],[l,t,f]],paint,[0,0,1]);
    face([[r,b,k],[l,b,k],[l,t,k],[r,t,k]],paint,[0,0,-1]);
    face([[r,b,f],[r,b,k],[r,t,k],[r,t,f]],paint,[1,0,0]);
    face([[l,b,k],[l,b,f],[l,t,f],[l,t,k]],paint,[-1,0,0]);
    face([[l,t,f],[r,t,f],[r,t,k],[l,t,k]],paint,[0,1,0]);
    face([[l,b,k],[r,b,k],[r,b,f],[l,b,f]],paint,[0,-1,0]);
  }

  const steel='#b8bdab';
  const paints={
    sage:['#77998a','#91ab9b','#536f67','#355951','#92a99b'],
    sand:['#c8bc9f','#d4c8aa','#8f8e79','#677266','#c4baa2'],
    coral:['#b27e69','#c5977f','#8a695a','#605951','#ad8472'],
    slate:['#7b9299','#96a6a8','#566e76','#3f5662','#81989d']
  };
  function freight(level,cz,paint){
    const [sage,rib,frame,casting,door]=paints[paint];
    const part=(cx,cy,z,w,h,d,color)=>box(cx,cy+level*H,z+cz,w,h,d,color);
    part(0,1.31,0,5.82,2.41,2.16,sage);
    // Stamped sidewalls, roof ribs, two steel corner frames and ISO casting openings.
    for (let i=0;i<34;i++) {
      const xx=-2.79+i*.169;
      part(xx,1.31,-1.092,.059,2.24,.032,rib);
      part(xx,1.31,1.092,.059,2.24,.032,rib);
      part(xx,2.526,0,.063,.031,2.14,rib);
    }
    for (const side of [-1,1]) {
      for (const end of [-1,1]) {
        part(end*2.932,1.30,side*1.116,.115,2.5,.105,frame);
        for (const yy of [.118,2.483]) {
          part(end*2.922,yy,side*1.106,.156,.23,.138,casting);
          part(end*2.922,yy,side*1.177,.082,.044,.012,'#28443e');
        }
      }
      for (const yy of [.10,2.496]) part(0,yy,side*1.116,5.90,.103,.095,frame);
      // Paired end doors, locking rods with lever handles, hinge straps and gaskets.
      for (const j of [-1,1]) {
        part(side*2.933,1.305,j*.527,.045,2.27,1.015,door);
        for (let k=0;k<4;k++) part(side*2.963,.55+k*.47,j*.527,.02,.044,.85,sage);
        part(side*2.968,1.286,j*.362,.045,2.2,.043,steel);
        part(side*2.988,.949,j*.485,.024,.052,.265,casting);
        for (let k=0;k<3;k++) part(side*2.960,.44+k*.82,j*.960,.055,.081,.185,'#627f71');
      }
      part(side*2.956,1.30,0,.026,2.24,.030,casting);
    }
  }
  freight(0,0,wallSide==='left'?'sage':'slate');
  freight(0,REAR_Z,wallSide==='left'?'coral':'sage');
  freight(1,REAR_Z,wallSide==='left'?'sand':'coral');
  const fascia=wallSide==='left'?'#345c57':'#385665';
  // Recessed cork-and-linen mounting field, enamel fascia and contrasting wood trim.
  box(0,1.146,1.122,5.47,1.64,.066,'#4b665c');
  box(0,1.146,1.165,5.36,1.54,.034,'#d5c7a6');
  for (const side of [-1,1]) box(side*2.713,1.146,1.172,.045,1.63,.043,'#b68b66');
  for (const yy of [.342,1.949]) box(0,yy,1.166,5.46,.045,.049,'#b68b66');
  box(0,2.23,1.128,5.49,.442,.081,fascia);
  box(-2.757,2.23,1.165,.05,.421,.035,'#c97860');
  // Metal fasteners sit proud of the frame, not the pinned papers.
  for(const xx of [-2.65,2.65]) for(const yy of [.395,1.902,2.202,2.305]) {
    box(xx,yy,1.194,.034,.034,.016,steel);
  }

  const steelGeometry=new T.BufferGeometry();
  steelGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  steelGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  steelGeometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  steelGeometry.setIndex(indices);
  steelGeometry.userData.preserveTopology=true;
  steelGeometry.computeBoundingSphere();
  geometries.add(steelGeometry);
  const shell=new T.Mesh(steelGeometry,metal);
  shell.name='Corrugated container, corner castings and fittings';
  shell.castShadow=true;shell.receiveShadow=true;group.add(shell);

  function canvasFace(name,w,h,width,height,shape) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');
    const map=new T.CanvasTexture(canvas);
    map.colorSpace=T.SRGBColorSpace;map.minFilter=T.LinearFilter;map.generateMipmaps=false;
    const mat=new T.MeshBasicMaterial({map});
    const geo=shape || new T.PlaneGeometry(w,h);
    textures.add(map);materials.add(mat);geometries.add(geo);
    const mesh=new T.Mesh(geo,mat);mesh.name=name;group.add(mesh);
    return {mesh,context,map};
  }
  const sign=canvasFace('기원함',5.18,.345,1024,78);
  sign.mesh.position.set(0,2.23,1.175);
  if(sign.context){
    const ctx=sign.context;
    ctx.fillStyle=fascia;ctx.fillRect(0,0,1024,78);
    ctx.fillStyle='#fff2d3';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='bold 54px '+FONT;ctx.fillText('기원함',512,39);
    sign.map.needsUpdate=true;
  }
  const empty=canvasFace('Wall status',3.48,.304,512,48);
  empty.mesh.position.set(0,1.17,1.184);

  // The front face stops at the diagonal fold. A separate angled facet lifts its corner
  // in silhouette, independent of whether the renderer supports normal maps.
  const paperFace=new T.BufferGeometry();
  paperFace.setAttribute('position',new T.Float32BufferAttribute([
    -.5,-.5,0,.5,-.5,0,.5,.30,0,.415,.5,0,-.5,.5,0
  ],3));
  paperFace.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,.8,.915,1,0,1],2));
  paperFace.setIndex([0,1,2,0,2,3,0,3,4]);paperFace.computeVertexNormals();
  const foldGeo=new T.BufferGeometry();
  foldGeo.setAttribute('position',new T.Float32BufferAttribute([.5,.30,.004,.479,.459,.038,.415,.5,.004],3));
  foldGeo.computeVertexNormals();
  const foldMat=new T.MeshStandardMaterial({color:'#ddd2b2',side:T.DoubleSide,roughness:.94});
  const pinGeo=new T.IcosahedronGeometry(1,0),pinMat=new T.MeshStandardMaterial({color:'#a34f3d',roughness:.53});
  const billPin=new T.MeshStandardMaterial({color:'#587884',metalness:.38,roughness:.43});
  materials.add(billPin);
  materials.add(foldMat);materials.add(pinMat);geometries.add(foldGeo);geometries.add(pinGeo);geometries.add(paperFace);
  const cards=[];
  const noteColors=[['#a85846','#fff2d5'],['#476e66','#f1f4df'],['#596f83','#f4f1df']];
  function createCard() {
    const card=canvasFace('A pinned departure wish',1,1,384,159,paperFace);
    const fold=new T.Mesh(foldGeo,foldMat);card.mesh.add(fold);
    const pin=new T.Mesh(pinGeo,pinMat);
    pin.scale.set(.023,.052,.022);pin.position.set(-.19,.448,.022);card.mesh.add(pin);
    card.pin=pin;card.mesh.traverse(tag);
    cards.push(card);return card;
  }
  group.traverse(tag);
  let signature, disposed=false;
  function setWishes(call,wishes) {
    if(disposed)return;
    const real=call&&Array.isArray(wishes)?wishes.filter(n=>n&&
      (!n.callId||n.callId===call.id)&&(n.side??n.wallSide??n.wall_side??'left')===wallSide&&clean(n.text,160)
    ).slice(0,MAX_NOTES):[];
    const entries=real.map(n=>({id:n.id,name:clean(n.name,32),text:clean(n.text,160),kind:(n.kind??n.noteKind??n.note_kind)==='bl'?'bl':'wish'}));
    const vessel=call?clean([call.name,call.voy].filter(Boolean).join(' '),72):'';
    const key=JSON.stringify([call?.id,vessel,Boolean(call?.atd),entries]);
    if(key===signature)return;signature=key;

    empty.mesh.visible=!entries.length;
    if(!entries.length && empty.context){
      const ec=empty.context;ec.fillStyle='#d5c7a6';ec.fillRect(0,0,512,48);
      ec.fillStyle='#43594e';ec.font='600 23px '+FONT;ec.textAlign='center';ec.textBaseline='middle';
      ec.fillText(!call?'관제소에서 모선을 선택해 주세요':call.atd?'이곳에 남긴 기념 쪽지가 없어요':'기원문이나 게임 B/L을 붙여 주세요',256,25);
      empty.map.needsUpdate=true;
    }
    const dense=entries.length>6, cols=dense?4:3, pitchX=dense?1.255:1.68, pitchY=dense?.48:.68;
    entries.forEach((entry,i)=>{
      const card=cards[i] || createCard(),row=Math.floor(i/cols),col=i%cols;
      const seed=Number.isFinite(Number(entry.id))?Math.abs(Number(entry.id))%24:i;
      const [accent,paper]=noteColors[seed%noteColors.length];
      const xx=(col-(cols-1)/2)*pitchX, yy=(dense?1.615:1.49)-row*pitchY;
      card.mesh.position.set(xx,yy,1.207+(i%2)*.004);
      card.mesh.rotation.z=((seed%7)-3)*.007;
      card.mesh.scale.set(dense?1.15:1.47,dense?.415:.565,1);
      card.mesh.visible=true;
      const bill=entry.kind==='bl';
      card.pin.material=bill?billPin:pinMat;
      card.mesh.name=bill?'Pinned game B/L keepsake':'A pinned departure wish';
      card.mesh.userData.noteKind=entry.kind;
      const noteKey=JSON.stringify([entry.kind,entry.name,entry.text,accent,paper,bill?vessel:'']);
      if(card.noteKey!==noteKey && card.context){
        if(bill)drawBL(card.context,entry,vessel);else drawNote(card.context,entry,accent,paper);
        card.map.needsUpdate=true;card.noteKey=noteKey;
      }
    });
    for(let i=entries.length;i<cards.length;i++)cards[i].mesh.visible=false;
  }
  const cos=Math.cos(yaw),sin=Math.sin(yaw);
  function blocks(px,pz){
    const dx=px-x,dz=pz-z;
    const localX=dx*cos-dz*sin,localZ=dx*sin+dz*cos;
    return Math.abs(localX)<W/2+.12 && localZ>bounds.minZ-.12 && localZ<bounds.maxZ+.12;
  }
  function destroy(){
    if(disposed)return;disposed=true;parent.remove(group);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  }
  setWishes(null,[]);
  return {group,side:wallSide,dimensions,setWishes,blocks,destroy};
}