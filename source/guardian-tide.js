// Sculpted water uses ordinary indexed meshes. Both renderers see the same
// changing silhouette, colored glassy folds and droplets, including on mobile.
export function makeCourtTide(T,parent,spots) {
  const group=new T.Group();group.name='Sea passage between the guardians';parent.add(group);
  const openWater=new T.Group();group.add(openWater);
  const centerX=spots.reduce((n,p)=>n+p.x,0)/spots.length;
  const centerZ=spots.reduce((n,p)=>n+p.z,0)/spots.length;
  group.position.set(centerX,0,centerZ);
  const geometries=new Set(),materials=new Set(),palette=[];
  const tau=Math.PI*2, len=13.28;
  const color=c=>new T.Color(c);
  function paint(day,moon,{alpha=1,flat=false,vertices=false,lit=true}={}) {
    const opts={color:day,side:T.DoubleSide,vertexColors:vertices,transparent:alpha<1,opacity:alpha,depthWrite:alpha>=1};
    const m=lit?new T.MeshStandardMaterial({...opts,roughness:.34,metalness:.035,flatShading:flat}):new T.MeshBasicMaterial(opts);
    materials.add(m);palette.push({m,day:color(day),moon:color(moon)});return m;
  }
  function geometry(xyz,index,colors) {
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
    if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    g.setIndex(index);g.userData.preserveTopology=true;geometries.add(g);return g;
  }
  function add(name,g,m) {
    if(!g.attributes.normal)g.computeVertexNormals();
    const o=new T.Mesh(g,m);o.name=name;group.add(o);return o;
  }
  const rows=104,columns=8;
  const tones=['#4ea7af','#287d8e','#479e9d','#92d3bf','#b5e6cf','#63c6c6','#388d9c','#77c7c3'];
  const riverColors=[],riverIx=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<columns;j++){
    const c=color(tones[j]);riverColors.push(c.r,c.g,c.b);
    if(i<rows&&j<columns-1){const a=i*columns+j,b=a+columns;riverIx.push(a,a+1,b,b,a+1,b+1);}
  }
  const riverG=geometry(new Float32Array((rows+1)*columns*3),riverIx,riverColors);
  riverG.attributes.position.setUsage(T.DynamicDrawUsage);
  const river=add('Continuous folded tidal stream',riverG,paint('#ffffff','#9bbee2',{vertices:true,alpha:.82,lit:false}));
  river.renderOrder=2;
  riverG.boundingSphere=new T.Sphere(new T.Vector3(0,.4,0),len+.3);
  const median=spots[1].x-spots[0].x;
  const firstGap=(spots[0].x+spots[1].x)*.5-centerX;
  const cycle=9.4;
  function smooth(low,high,value){
    const f=Math.max(0,Math.min(1,(value-low)/(high-low)));return f*f*(3-2*f);
  }
  function tidePhase(x,t){
    const p=t/cycle-(x-firstGap)/(3*median)+.44;
    return p-Math.floor(p);
  }
  function swellAt(phase){return Math.pow(.5-.5*Math.cos(tau*phase),1.38);}
  // Main channel curls in front of one plinth, behind the next, then
  // resurfaces in each open gap. Higher water stays in the three gaps.
  function surface(x,v,time,out) {
    const u=(x+len)/(2*len);
    const taper=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.38);
    const along=(x+len)/median;
    const swell=Math.sin(x*1.03-time*1.12+v*1.35);
    const angle=(x-(spots[0].x-centerX))/median*Math.PI;
    const gap=Math.pow(Math.abs(Math.sin(angle)),2.6);
    const cross=v*2-1;
    const pulse=swellAt(tidePhase(x,time));
    const bank=.62*Math.min(1,Math.max(0,(Math.abs(x)-3)/6));
    out[0]=x;
    out[2]=taper*(1.05+bank+.81*Math.sin(angle+.26*Math.sin(time*.34))+.17*Math.sin(time*.62-along*2)) + cross*taper*(.99+.38*gap);
    out[1]=.134+taper*(.048+.12*(1-cross*cross)+gap*(.14+.48*pulse+.11*swell)+.033*Math.sin(along*4.3-time*1.3+v*3.7));
  }

  // Front-to-back sections of a real curling breaker. The foam edge folds
  // back over a concave hollow before the face joins the next stretch of water.
  const outline=[
    [-1.62,.07],[-1.20,.21],[-.92,.49],[-.63,.93],[-.42,1.47],[-.20,1.94],
    [.17,2.25],[.55,2.34],[.87,2.22],[1.01,1.98],[.92,1.77],[.78,1.71],
    [.81,1.91],[.68,2.02],[.51,2.02],[.34,1.89],[.21,1.62],[.15,1.22],
    [.22,.85],[.44,.56],[.83,.29],[1.51,.095]
  ];
  const surfColors=['#327f8e','#398e97','#4aa6a5','#66c4b7','#9dddc9','#c6eddb','#e1f4df','#f5f6df','#e5f6e4','#b9e6d9','#8fd5d4','#b4e4dc','#8dd1ca','#5db5ba','#398e9e','#267f90','#2f8e98','#319ba3','#46a6a4','#57b0ae','#6dbdb6','#85c5b7'];
  const capFaces=T.ShapeUtils.triangulateShape(outline.map(([x,y])=>new T.Vector2(x,y)),[]);
  const folds=[];
  const bodyPaint=paint('#ffffff','#bad5ed',{alpha:.82,vertices:true,lit:false});
  const finePaint=paint('#d7f2df','#d4efff',{alpha:.90,lit:false});
  const foamPaint=paint('#eaf7e6','#d1f2ff',{lit:false});
  const dropG=new T.IcosahedronGeometry(1,1);geometries.add(dropG);
  const beads=new T.InstancedMesh(dropG,foamPaint,24);beads.name='Windblown seafoam pearls';beads.frustumCulled=false;group.add(beads);
  const bead=new T.Object3D(), scratch=[0,0,0];
  const sections=6, stride=outline.length;
  for(let k=0;k<spots.length-1;k++){
    const xyz=new Float32Array((sections+1)*stride*3), idx=[],colors=[];
    for(let j=0;j<=sections;j++)for(let i=0;i<stride;i++){
      const col=color(surfColors[i]);const shade=.84+.16*j/sections;colors.push(col.r*shade,col.g*shade,col.b*shade);
      if(j<sections){const a=j*stride+i,b=j*stride+(i+1)%stride;idx.push(a,b,a+stride,b,b+stride,a+stride);}
    }
    for(const [a,b,c] of capFaces){idx.push(c,b,a,sections*stride+a,sections*stride+b,sections*stride+c);}
    const g=geometry(xyz,idx,colors);g.attributes.position.setUsage(T.DynamicDrawUsage);
    g.boundingSphere=new T.Sphere(new T.Vector3(0,1.6,0),4.25);
    const mesh=add('Breaking tide '+(k+1),g,bodyPaint);mesh.renderOrder=3;
    mesh.position.set((spots[k].x+spots[k+1].x)/2-centerX,.14,(spots[k].z+spots[k+1].z)/2-centerZ+.77);
    mesh.rotation.y=[-.32,.24,-.14][k];mesh.scale.set([.91,1.12,.97][k],[1.07,.91,.99][k],[1.15,.84,1.02][k]);
    folds.push(mesh);
  }
  // A handful of silver streaks follow the S-curve of the actual channel.
  // Moving each sample along the channel keeps them continuous across gaps.
  const strokes=16, segs=9, trailIx=[];
  for(let k=0;k<strokes;k++)for(let j=0;j<segs;j++){const a=(k*(segs+1)+j)*2;trailIx.push(a,a+1,a+2,a+2,a+1,a+3);}
  const trailsG=geometry(new Float32Array(strokes*(segs+1)*6),trailIx);
  const trail=add('Traveling eddies',trailsG,finePaint);trail.renderOrder=4;
  trailsG.boundingSphere=new T.Sphere(new T.Vector3(0,.4,0),len+.4);
  // A long ocean swell arrives behind the breaking crests. Its ridgeline is
  // continuous across the stone piers; the plaques stand on the dry front.
  const backRows=74;
  const profile=[[.02,-1.40,'#3e8294'],[.19,-1.10,'#3c95a2'],[.56,-.72,'#69b9ba'],
    [1.04,-.34,'#a0d9cb'],[1.12,-.23,'#dae9da'],[.98,-.08,'#8dcac3'],
    [.62,.23,'#398b9c'],[.28,.54,'#2c788e'],[.02,1.02,'#4fa4ab']];
  const backIx=[],backColors=[];
  for(let i=0;i<=backRows;i++)for(let j=0;j<profile.length;j++){
    const shade=color(profile[j][2]);backColors.push(shade.r,shade.g,shade.b);
    if(i<backRows && j<profile.length-1){
      const a=i*profile.length+j,b=a+profile.length;backIx.push(a,a+1,b,b,a+1,b+1);
    }
  }
  const backGeo=geometry(new Float32Array((backRows+1)*profile.length*3),backIx,backColors);
  backGeo.attributes.position.setUsage(T.DynamicDrawUsage);
  backGeo.boundingSphere=new T.Sphere(new T.Vector3(0,1,-1.8),15.7);
  const incoming=add('Outer swell against the sanctuary',backGeo,paint('#ffffff','#b2d0dc',{vertices:true,lit:false,alpha:.83}));
  incoming.renderOrder=1;openWater.add(incoming);

  // Build a soft alpha texture with thin wisps at the edge. Three staggered
  // sheets of spray rise in each gap, behind the lettering and below faces.
  const vapour=document.createElement('canvas');vapour.width=192;vapour.height=112;
  const vapourCtx=vapour.getContext('2d');
  if(vapourCtx){
    const pixels=vapourCtx.createImageData(192,112);
    for(let y=0;y<112;y++)for(let x=0;x<192;x++){
      const u=x/191,v=y/111;
      const band=.13*Math.sin(u*9.4+.6)+.08*Math.sin(u*16.0);
      const qx=(u-.49)*2.08,qy=(v-.52-band)*2.60;
      const edge=Math.max(0,1-qx*qx-qy*qy);
      const veil=.45+.21*Math.sin(5.6*u+7.3*v)+.14*Math.cos(9.4*u-16*v)+.095*Math.sin(34*u+24*v);
      const opacity=Math.max(0,Math.min(1,edge*edge*.90+edge*veil*.36));
      const off=(y*192+x)*4;pixels.data[off]=207+22*edge;pixels.data[off+1]=227+16*edge;
      pixels.data[off+2]=226+17*edge;pixels.data[off+3]=Math.round(255*opacity);
    }
    vapourCtx.putImageData(pixels,0,0);
  }
  const mistMap=new T.CanvasTexture(vapour);mistMap.colorSpace=T.SRGBColorSpace;
  const mistGeo=new T.PlaneGeometry(1,1);geometries.add(mistGeo);
  const sprays=[];
  for(let k=0;k<folds.length;k++)for(let layer=0;layer<3;layer++){
    const mat=paint('#e5efea','#a5cbdf',{alpha:.34,lit:false});
    mat.map=mistMap;mat.needsUpdate=true;
    const mesh=add('Sea spray '+(k+1)+' · '+(layer+1),mistGeo,mat);
    mesh.renderOrder=5+layer;mesh.raycast=()=>{};
    sprays.push({mesh,k,layer});
  }
  const pos=(attribute,i,x,y,z)=>attribute.setXYZ(i,x,y,z);
  let lastTime=NaN,lastNight=NaN;
  function update(time=0,night=0,reduced=false){
    // Reduced motion freezes the current, including droplets, but preserves
    // the moonlit palette and the three-dimensional curl.
    const t=reduced?1.7:Math.max(0,time);
    const dusk=Math.max(0,Math.min(1,Number(night)||0));
    const paletteChanged=!Number.isFinite(lastNight)||Math.abs(dusk-lastNight)>.007;
    if(paletteChanged){for(const {m,day,moon} of palette)m.color.copy(day).lerp(moon,dusk);lastNight=dusk;}
    if(!paletteChanged&&Number.isFinite(lastTime)&&Math.abs(t-lastTime)<1/32)return;lastTime=t;
    const bp=backGeo.attributes.position;
    for(let i=0;i<=backRows;i++){
      const f=i/backRows,x=(f-.5)*27.2,edge=Math.min(1,Math.sin(Math.PI*f)*3.3);
      const wave=Math.sin(.49*x-t*.77),swell=.65+.37*wave+.24*Math.sin(x*.81+t*.45);
      const bend=-1.60+.58*Math.sin(x*.34-t*.45)+.19*Math.cos(.72*x+t*.59);
      for(let j=0;j<profile.length;j++){
        const [crest,stretch]=profile[j];
        bp.setXYZ(i*profile.length+j,x,.13+edge*(.12+crest*swell),bend+stretch);
      }
    }
    bp.needsUpdate=true;
    const rp=riverG.attributes.position;
    for(let i=0;i<=rows;i++){
      const x=(-len+2*len*i/rows)*.963;
      for(let j=0;j<columns;j++){surface(x,j/(columns-1),t,scratch);pos(rp,i*columns+j,...scratch);}
    }
    rp.needsUpdate=true;
    for(let k=0;k<folds.length;k++){
      const mesh=folds[k],wp=mesh.geometry.attributes.position;
      const phase=tidePhase(mesh.position.x,t),power=swellAt(phase);
      const lift=.36+1.22*power, passing=-Math.sin(phase*tau);
      // The shoulder rises on the west side and tips toward the next guardian;
      // on the falling phase the entire lip stretches down into a broad eddy.
      const roll=smooth(.22,.62,phase)*(1-smooth(.72,1,phase));
      const spray=smooth(.28,.45,phase)*(1-smooth(.57,.78,phase));
      const breath=t*.73+k*.89;
      const lip=.14*passing+.27*roll;
      const reach=.13+.12*k;
      for(let j=0;j<=sections;j++){
        const v=j/sections,arc=Math.sin(Math.PI*v);
        for(let i=0;i<stride;i++){
          const [x,y]=outline[i],tip=y/2.34;
          const height=.04+y*(.69+.31*arc)*lift;
          const lean=tip*tip*(lip+.105*Math.sin(breath+v*3)) + passing*.27*tip;
          pos(wp,j*stride+i,x*(1+reach*(1-power))+.30*(v-.5)+.16*arc+lean,height,
            (v-.5)*(2.10-.98*tip)+.23*Math.sin(x*1.7+breath+v)*tip);
        }
      }
      wp.needsUpdate=true;
      // A short fan of droplets rises from the breaking lip, then falls into the trough.
      mesh.updateMatrix();
      for(let j=0;j<8;j++){
        const p=(t*.58+j*.3819+k*.19)%1,spread=(j%3-1)*.21;
        const r=spray*(.052+.047*Math.sin(Math.PI*p))*(j%3===0?1.1:.78);
        bead.position.set(.76+lip+passing*.19+p*.61,1.82*lift+.78*Math.sin(Math.PI*p)-.67*p,spread+.12+p*.37);
        bead.position.applyMatrix4(mesh.matrix);bead.scale.set(Math.max(.0001,r*.85),Math.max(.0001,r*1.18),Math.max(.0001,r*.88));bead.updateMatrix();beads.setMatrixAt(k*8+j,bead.matrix);
      }
    }
    beads.instanceMatrix.needsUpdate=true;
    for(const {mesh,k,layer} of sprays){
      const fold=folds[k],phase=tidePhase(fold.position.x,t),power=swellAt(phase);
      const life=(t*(.22+.025*layer)+layer/3+k*.23)%1;
      const visibility=Math.sin(Math.PI*life);
      const drift=(life-.34)*1.45;
      mesh.position.set(fold.position.x+drift+Math.sin(t*.55+k+layer)*.22,
        .52+(.46+2.0*power)*(.42+.81*life)+layer*.08,
        fold.position.z+.22-.48*layer-.29*life);
      mesh.scale.set(2.35+life*2.10+layer*.18,1.00+1.09*life+.24*power,1);
      mesh.rotation.set(-.08,.14*(layer-1),-.15+.25*Math.sin(t*.26+k*1.8+layer));
      mesh.material.opacity=(.19+.35*power)*visibility*(1-.24*dusk);
    }
    const tp=trailsG.attributes.position;
    for(let k=0;k<strokes;k++){
      const u=(k*.618034+t*(.036+(k%3)*.003))%1, distance=(.65+.20*(k%4));
      const center=(u*2-1)*(len-1.4);
      for(let j=0;j<=segs;j++){
        const f=j/segs,x=center+(f-.5)*distance*2;
        const v=.15+.68*((k*.373)%1)+.06*Math.sin(f*3.4+k+t*.8);
        const band=(.007+.024*(k%3===0?1:.6))*Math.sin(Math.PI*f);
        for(let side=0;side<2;side++){surface(x,v+(side?band:-band),t,scratch);pos(tp,(k*(segs+1)+j)*2+side,scratch[0],scratch[1]+.039,scratch[2]);}
      }
    }
    tp.needsUpdate=true;
  }
  update(0,0,false);
  return{update,destroy(){parent.remove(group);mistMap.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}