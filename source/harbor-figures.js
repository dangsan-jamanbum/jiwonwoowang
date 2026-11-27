/* Soft-sculpted, articulated harbor residents. Z points forward and the sole
   of the shoe is the origin. Geometry and materials are shared by each cast. */
const tau=Math.PI*2;
const saturate=v=>Math.max(0,Math.min(1,Number(v)||0));
const getTime=v=>Number.isFinite(v)?v:0;
const pools=new WeakMap();

function kit(T){
  if(pools.has(T))return pools.get(T);
  const matCache=new Map(), batches=new Map(), sphere=new T.SphereGeometry(1,20,16);
  const material=(color,rough=.76)=>{
    const k=color+':'+rough;if(!matCache.has(k))matCache.set(k,new T.MeshStandardMaterial({color,roughness:rough,metalness:rough<.35?.18:0,side:T.DoubleSide}));
    return matCache.get(k);
  };
  function group(parent,x=0,y=0,z=0){
    const g=new T.Group();g.position.set(x,y,z);if(parent)parent.add(g);return g;
  }
  function mesh(parent,geo,color,x=0,y=0,z=0,rough=.76){
    const obj=new T.Mesh(geo,typeof color==='string'?material(color,rough):color);
    obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;
  }
  function orb(parent,x,y,z,rx,ry,rz,col,rough=.76){
    const o=mesh(parent,sphere,col,x,y,z,rough);o.scale.set(rx,ry,rz);return o;
  }
  const groupGeo=(vertices,indices)=>{
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  };
  /* Each elliptical section specifies height, two radii and optional forward
     offset. The same loft builds clothing hems, smooth cheeks and fingertips. */
  function rings(parent,sections,col,x=0,y=0,z=0,segs=28){
    const v=[],ix=[];
    for(const [h,rx,rz,oz=0] of sections){
      for(let j=0;j<segs;j++){const a=tau*j/segs;v.push(Math.sin(a)*rx,h,Math.cos(a)*rz+oz);}
    }
    for(let i=0;i<sections.length-1;i++)for(let j=0;j<segs;j++){
      const a=i*segs+j,b=i*segs+(j+1)%segs;ix.push(a,b,b+segs,a,b+segs,a+segs);
    }
    for(const [layer,reverse] of [[0,true],[sections.length-1,false]]){
      const row=sections[layer],center=v.length/3;v.push(0,row[0],row[3]||0);
      for(let j=0;j<segs;j++){const a=layer*segs+j,b=layer*segs+(j+1)%segs;ix.push(center,reverse?b:a,reverse?a:b);}
    }
    return mesh(parent,groupGeo(v,ix),col,x,y,z);
  }
  function tube(parent,pts,r,col,segments=Math.max(5,pts.length*3)){
    const vectors=pts.map(p=>new T.Vector3(...p));
    const path=new T.CatmullRomCurve3(vectors);
    return mesh(parent,new T.TubeGeometry(path,segments,r,7,false),col);
  }
  function plaque(parent,pts,z,col,depth=.008,rad=.003){
    const sh=new T.Shape();sh.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)sh.lineTo(pts[i][0],pts[i][1]);sh.closePath();
    const geo=new T.ExtrudeGeometry(sh,{depth,bevelEnabled:!!rad,bevelSegments:2,bevelSize:rad,bevelThickness:rad,curveSegments:5});
    return mesh(parent,geo,col,0,0,z);
  }
  function rect(parent,x,y,z,w,h,d,rad,col){
    const sh=new T.Shape(),a=-w/2,b=w/2,l=-h/2,u=h/2,r=Math.min(rad,h/2,w/2);
    sh.moveTo(a+r,l);sh.lineTo(b-r,l);sh.quadraticCurveTo(b,l,b,l+r);sh.lineTo(b,u-r);sh.quadraticCurveTo(b,u,b-r,u);sh.lineTo(a+r,u);sh.quadraticCurveTo(a,u,a,u-r);sh.lineTo(a,l+r);sh.quadraticCurveTo(a,l,a+r,l);
    const geo=new T.ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelSegments:2,bevelSize:Math.min(.0035,rad*.22),bevelThickness:.003,curveSegments:4});
    return mesh(parent,geo,col,x,y,z);
  }
  /* A tapered bent lentil with a curved spine is more believable as a lock
     than disconnected balls. All sections blend into the hair cap or beard. */
  function lock(parent,pts,width,thickness,col){
    const curve=new T.CatmullRomCurve3(pts.map(a=>new T.Vector3(...a)));
    const v=[],ix=[],steps=12,n=9;
    for(let i=0;i<=steps;i++){
      const u=i/steps,pos=curve.getPoint(u),edge=curve.getTangent(u),taper=(.025+.975*Math.sin(Math.PI*Math.pow(u,.77))**.63);
      let side=new T.Vector3(-edge.y,edge.x,0);if(side.lengthSq()<.0001)side.set(1,0,0);side.normalize();
      const out=new T.Vector3().crossVectors(edge,side).normalize();
      for(let j=0;j<n;j++){const a=tau*j/n;const p=pos.clone().addScaledVector(side,width*taper*Math.cos(a)).addScaledVector(out,thickness*taper*Math.sin(a));v.push(p.x,p.y,p.z);}
    }
    for(let i=0;i<steps;i++)for(let j=0;j<n;j++){
      const a=i*n+j,b=i*n+(j+1)%n;ix.push(a,b,b+n,a,b+n,a+n);
    }
    return mesh(parent,groupGeo(v,ix),col);
  }
  function cap(parent,w,h,d,limit,col,y=.055){
    const v=[],ix=[], around=36,down=16;
    for(let i=0;i<=down;i++)for(let j=0;j<around;j++){
      const a=tau*j/around,phi=.003+(limit(a)-.003)*i/down;
      v.push(Math.sin(phi)*Math.sin(a)*w,y+Math.cos(phi)*h,-.018+Math.sin(phi)*Math.cos(a)*d);
    }
    for(let i=0;i<down;i++)for(let j=0;j<around;j++){
      const a=i*around+j,b=i*around+(j+1)%around;ix.push(a,b+around,b,a,a+around,b+around);
    }
    return mesh(parent,groupGeo(v,ix),col);
  }
  const paintBatch=rough=>{const key=rough<.48?'glazed':'matte';if(!batches.has(key))batches.set(key,new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:key==='matte'?.78:.35,metalness:key==='matte'?0:.05,side:T.DoubleSide}));return batches.get(key);};
  const result={T,group,mesh,material,orb,rings,tube,rect,plaque,lock,cap,paintBatch};pools.set(T,result);return result;
}

function face(k,head,theme){
  const {group,orb,rings,lock}=k,skin=theme.skin;
  // Keep a soft continuous cheek plane beneath the simple oval eyes.
  const cheekSurface=group(head);cheekSurface.name='worker-face-surface';
  const contours=[[-.314,.065,.084,.034],[-.290,.156,.173,.037],[-.253,.232,.230,.034],[-.196,.299,.279,.029],[-.121,.348,.318,.019],[-.043,.364,.337,.008],[.042,.360,.341,.001],[.128,.347,.330,0],[.221,.315,.295,0],[.312,.238,.218,0],[.372,.110,.094,0],[.387,.024,.024,0]];
  const rows=[];
  for(let i=0;i<contours.length-1;i++){
    const low=contours[i],high=contours[i+1];
    rows.push(low,low.map((value,axis)=>(value+high[axis])*.5));
  }
  rows.push(contours[contours.length-1]);
  rings(cheekSurface,rows,skin,0,0,0,40);
  const eyes=[];
  for(const side of [-1,1]){
    const ear=orb(head,side*.343,-.040,-.013,.053,.080,.047,skin);ear.rotation.z=-side*.10;
    const eye=group(head,side*.133,.005,.309);eye.rotation.y=side*.28;eyes.push(eye);
    orb(eye,0,.002,.009,.042,.056,.019,'#3f332d',.53);
    orb(eye,-.009,.022,.026,.009,.010,.002,'#f9efda',.44);
    lock(head,[[side*.071,.097,.319],[side*.113,.106,.314],[side*.160,.104,.295],[side*.191,.094,.277]],.012,.007,theme.brow);
  }
  orb(head,0,-.057,.339,.036,.035,.028,skin);
  const lips=group(head,0,-.162,.334);lips.name='worker-lips';
  lock(lips,[[-.047,.008,-.010],[-.017,0,0],[.016,0,0],[.051,.013,-.010]],.0068,.004,'#995f54');
  const breathOpening=group(lips);breathOpening.name='breath-opening';
  orb(breathOpening,0,-.001,.002,.017,.011,.004,'#89594d');
  return eyes;
}
function hair(k,head,style,theme){
  const {cap,lock,tube}=k, f=style==='cardigan';
  const main=theme.hair,lit=theme.hairLight;
  const hairline=a=>{
    const front=(Math.cos(a)+1)/2;
    return (f?2.63:2.30)-(f?1.56:1.25)*Math.pow(front,2.35) + .055*Math.sin(a*2+.8);
  };
  cap(head,.387,.403,f?.385:.368,hairline,main,.054);
  // Hair ribbons follow the actual crown and sit just above its surface.
  // Light grazes them both from the front and in the rear-follow camera.
  const depth=f?.385:.368;
  function crown(azimuth,incline,lift){
    return [Math.sin(incline)*Math.sin(azimuth)*(.387+lift),.054+Math.cos(incline)*(.403+lift),-.018+Math.sin(incline)*Math.cos(azimuth)*(depth+lift)];
  }
  const locks=f?[
    [[.48,.37],[.36,.67],[.02,.92],[-.30,1.19],[-.56,1.41]],
    [[.58,.39],[.67,.74],[.84,1.02],[1.09,1.43],[1.26,1.89]],
    [[2.52,.44],[2.61,.83],[2.66,1.25],[2.54,1.78],[2.59,2.32]],
    [[-3.0,.38],[-2.94,.86],[-2.86,1.31],[-2.89,1.81],[-3.00,2.35]]
  ]:[
    [[-.43,.33],[-.06,.62],[.27,.90],[.57,1.08],[.88,1.30]],
    [[-.61,.39],[-.39,.72],[-.15,.91],[.22,1.07],[.46,1.22]],
    [[2.38,.36],[2.63,.72],[2.72,1.15],[2.7,1.65],[2.85,1.99]],
    [[-2.89,.50],[-2.76,.82],[-2.69,1.22],[-2.59,1.62],[-2.57,2.04]]
  ];
  for(let i=0;i<locks.length;i+=2){
    lock(head,locks[i].map(([a,b])=>crown(a,b,.008)),i<2?.043:.032,.014,i===0||i===2?lit:main);
  }
  // A filled nape and overlapping tapered locks give both heads a rounded
  // silhouette even in the normal rear-follow camera.
  if(f){
    for(const side of [-1,1]){
      lock(head,[[side*.014,.402,-.097],[side*.114,.207,-.330],[side*.154,-.043,-.351],[side*.128,-.253,-.230]],.086,.028,side<0?lit:main);
      lock(head,[[side*.235,.309,.005],[side*.360,.132,.015],[side*.382,-.068,.015],[side*.309,-.253,.074]],.082,.039,main);
    }
    k.rings(head,[[-.253,.139,.098],[-.228,.243,.154],[-.148,.302,.206],[-.030,.332,.216],[.122,.311,.201],[.241,.233,.164]],main,0,0,-.129,32);
    for(const s of [-1,1]){
      lock(head,[[s*.132,.375,-.061],[s*.272,.252,-.192],[s*.362,.056,-.164],[s*.303,-.202,-.120]],.092,.037,main);
      lock(head,[[s*.043,.411,-.075],[s*.142,.296,-.272],[s*.227,.044,-.31],[s*.200,-.221,-.218]],.073,.027,lit);
    }
  }else{
    k.orb(head,0,.115,-.117,.298,.275,.249,main);
    for(const s of [-1,1]){
      lock(head,[[s*.013,.405,-.121],[s*.075,.306,-.262],[s*.138,.114,-.333],[s*.173,-.099,-.244]],.081,.025,s<0?main:lit);
      lock(head,[[s*.059,.424,.004],[s*.164,.353,-.187],[s*.243,.164,-.262],[s*.206,-.096,-.249]],.081,.026,lit);
    }
  }
  const bangset=f?[
    [[.155,.310,.19],[.078,.224,.294],[-.040,.164,.307],[-.135,.065,.303],.077],
    [[.151,.319,.175],[-.008,.260,.274],[-.153,.157,.284],[-.253,.005,.213],.082],
    [[.082,.325,.20],[-.12,.26,.252],[-.244,.137,.215],[-.313,-.075,.13],.076],
    [[.145,.306,.182],[.197,.225,.258],[.269,.143,.232],[.342,-.026,.106],.061],
    [[-.281,.159,.177],[-.343,.018,.163],[-.328,-.13,.131],[-.276,-.24,.085],.049],
    [[.277,.138,.18],[.34,.025,.157],[.326,-.119,.125],[.281,-.243,.10],.045]
  ]:[
    [[.142,.326,.18],[.069,.254,.279],[-.046,.206,.301],[-.138,.126,.301],.082],
    [[.134,.31,.19],[-.021,.272,.282],[-.17,.193,.265],[-.267,.081,.196],.087],
    [[.039,.326,.19],[-.129,.276,.229],[-.252,.17,.209],[-.324,.025,.124],.07],
    [[.138,.30,.196],[.211,.242,.23],[.291,.146,.191],[.326,.02,.104],.071],
    [[-.261,.129,.184],[-.313,.044,.16],[-.313,-.035,.137],[-.291,-.09,.129],.041]
  ];
  for(let i=0;i<bangset.length;i++){
    const run=bangset[i],pts=run.slice(0,4);
    if(i!==1&&i!==2)lock(head,pts,run[4],f?.019:.020,main);
  }
  if(f){
    for(const s of [-1,1])lock(head,[[s*.275,.251,-.126],[s*.365,.076,-.10],[s*.355,-.102,-.14],[s*.251,-.234,-.18]],.052,.015,lit);
    for(const s of [-1,0,1])tube(head,[[s*.105,.275,-.285],[s*.16,.10,-.338],[s*.19,-.07,-.306],[s*.173,-.20,-.228]],.006,lit,11);
  }else{
    for(const s of [-1,1])lock(head,[[s*.019,.416,.03],[s*.13,.389,-.093],[s*.215,.301,-.184],[s*.266,.195,-.229]],.058,.020,lit);
  }
}

// The collar, opening and ID follow the jacket's surface.
function tailorWorker(k,chest,badge,cardigan,coat,shirt){
  const {T,rings,tube,orb,mesh}=k;
  // Chest and shoulders provide the volume; the waist and hem fall straight.
  const sections=[
    [-.064,.274,.160,-.005],[-.053,.294,.169,-.005],[.018,.296,.171,-.005],
    [.146,.283,.167,-.004],[.255,.287,.179,-.003],[.377,.306,.195,-.002],
    [.475,.326,.196,0],[.533,.324,.177,0],[.574,.286,.155,.001],
    [.613,.199,.127,.002],[.646,.105,.093,0]
  ];
  function profile(y){
    let b=1;while(b<sections.length-1&&y>sections[b][0])b++;
    const a=sections[b-1],hi=sections[b],t=saturate((y-a[0])/(hi[0]-a[0]));
    return [y,...[1,2,3].map(axis=>a[axis]+(hi[axis]-a[axis])*t)];
  }
  rings(chest,sections,coat,0,0,0,36);
  const surface=(x,y,back=false,lift=.010)=>{
    const [,w,d,offset]=profile(y);
    return offset+(back?-1:1)*(d*Math.sqrt(Math.max(.025,1-(x/w)**2))+lift);
  };
  function seam(xy,color,r,back=false,lift=.010){
    const curve=new T.CatmullRomCurve3(xy.map(([x,y])=>new T.Vector3(x,y,0)));
    const points=curve.getPoints(Math.max(xy.length*2,8)).map(({x,y})=>[x,y,surface(x,y,back,typeof lift==='function'?lift(y):lift)]);
    return tube(chest,points,r,color,points.length);
  }
  // Project the shirt opening and collar onto the jacket.
  function panel(lines,col,lift){
    const vertices=[],indices=[];
    lines.forEach(([y,lo,hi],i)=>{
      for(let j=0;j<7;j++){
        const x=lo+(hi-lo)*j/6;
        vertices.push(x,y,surface(x,y,false,lift));
        if(i&&j){const a=i*7+j;indices.push(a-8,a-7,a,a-8,a,a-1);}
      }
    });
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(chest,geo,col);
  }
  if(cardigan){
    panel([[-.045,-.061,.063],[.094,-.054,.056],[.242,-.044,.047],[.363,-.041,.044],[.482,-.083,.083],[.585,-.116,.116],[.625,-.093,.093]],shirt,.008);
    for(const side of [-1,1])seam([[side*.120,.585],[side*.082,.482],[side*.044,.363],[side*.047,.242],[side*.056,.094],[side*.064,-.045]],side>0?'#8aa490':'#779682',.007,false,.012);
    for(const y of [.017,.166,.303])orb(chest,.061,y,surface(.061,y,false,.014),.010,.010,.005,'#c3b89a');
  }else{
    panel([[.385,-.006,.006],[.470,-.067,.069],[.559,-.103,.102],[.618,-.093,.094]],shirt,.009);
    seam([[0,-.049],[0,.097],[0,.240],[0,.385]],'#667882',.0055);
  }
  panel([[.511,-.058,-.056],[.566,-.112,-.032],[.619,-.082,-.009]],'#fff3df',.016);
  panel([[.511,.055,.057],[.566,.032,.112],[.619,.009,.082]],'#fff3df',.016);
  // A matching welt follows the jacket surface where the resting hand enters.
  seam([[-.263,.073],[-.243,.117],[-.219,.159]],cardigan?'#76947e':'#405765',.0085,false,.010);
  const strap=cardigan?'#b36c61':'#739faf';
  const strapLift=y=>.012+.020*saturate((y-.42)/.15);
  for(const sign of [-1,1])seam([[sign*.090,.632],[sign*.138,.555],[sign*.122,.460],[sign*.089,.364],[sign*.040,.277],[sign*.006,.234]],strap,.0115,false,strapLift);
  const claspY=.233, lowerY=.074;
  const claspZ=surface(0,claspY,false,.015),lowerZ=surface(0,lowerY,false,.015);
  badge.position.set(0,claspY,claspZ);badge.scale.setScalar(1.13);
  badge.userData.restPitch=-Math.atan2(lowerZ-claspZ,claspY-lowerY);
}

// One broad fishcake sheet is threaded through a bamboo skewer in three folds.
function addEomuk(k,holder){
  const {T,mesh,tube}=k;
  tube(holder,[[0,0,-.101],[0,0,.294]],.0075,'#bf955e',5);
  const pos=[],indices=[],color=[],steps=42,across=6,total=(steps+1)*(across+1);
  const crust=new T.Color('#c59662'),middle=new T.Color('#e5bd87'),tone=new T.Color();
  for(let skin=-1;skin<=1;skin+=2){
    for(let i=0;i<=steps;i++){
      const t=i/steps,phi=t*Math.PI*6,angle=Math.atan2(.058*Math.PI*6*Math.cos(phi),.205);
      const corner=.68+.32*Math.min(1,Math.min(t,1-t)*14);
      for(let j=0;j<=across;j++){
        const v=2*j/across-1,edge=Math.abs(v)**4;
        const x=.058*Math.sin(phi)+skin*.007*Math.cos(angle);
        const y=v*(.066+.0055*Math.cos(phi*.5))*corner;
        const z=.090+.205*t+.004*edge*Math.sin(phi)-skin*.007*Math.sin(angle);
        pos.push(x,y,z);
        tone.copy(middle).lerp(crust,.20*edge+.27*Math.max(0,Math.cos(phi))+.10*(skin<0));
        color.push(tone.r,tone.g,tone.b);
        if(i&&j){const a=pos.length/3-1,b=a-1,c=a-across-1,d=c-1;
          if(skin>0)indices.push(d,b,a,d,a,c);else indices.push(d,c,a,d,a,b);}
      }
    }
  }
  function rim(a,b){indices.push(a,b,b+total,a,b+total,a+total);}
  for(let i=0;i<steps;i++){const a=i*(across+1);rim(a,a+across+1);rim(a+across+across+1,a+across);}
  for(let j=0;j<across;j++){rim(j+1,j);const b=steps*(across+1)+j;rim(b,b+1);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(color,3));geo.setIndex(indices);geo.computeVertexNormals();
  mesh(holder,geo,'#ffffff');
}

function dressHonghong(k,chest,coat){
  const {rings,tube,orb}=k;
  // A soft, ankle-length thobe with a rounded, gently protruding belly.
  rings(chest,[[-.735,.255,.174,-.012],[-.700,.285,.190,-.010],[-.560,.310,.207,-.008],[-.360,.342,.232,-.006],[-.150,.382,.258,-.004],[.035,.405,.274,-.002],[.205,.389,.258,0],[.365,.344,.218,0],[.500,.292,.170,0],[.590,.205,.122,0],[.650,.105,.088,0]],coat,0,0,0,40);
  // A restrained front placket and collar keep the robe readable at game scale.
  tube(chest,[[0,.605,.128],[0,.485,.179],[0,.300,.254],[0,.080,.274],[0,-.180,.258],[0,-.440,.230],[0,-.680,.190]],.006,'#e7e3dc',24);
  orb(chest,0,.525,.176,.018,.018,.008,'#d7d1c8');
  orb(chest,0,.445,.192,.012,.012,.006,'#d7d1c8');
}

function buildRig(T,style,guardian){
  const k=kit(T),{group,orb,rings,tube,plaque,rect,lock,mesh}=k;
  const h=style==='honghong', f=style==='cardigan', g=guardian||'';
  const themes={
    poseidon:{hair:'#365e75',hairLight:'#608697',brow:'#38556a',skin:'#deb18e',coat:'#749ca2'},
    njord:{hair:'#7f7566',hairLight:'#b1a28b',brow:'#766558',skin:'#ddba9e',coat:'#6e8174'},
    yi:{hair:'#333338',hairLight:'#484249',brow:'#383334',skin:'#deb08c',coat:'#56544e'},
    jang:{hair:'#393437',hairLight:'#504347',brow:'#423534',skin:'#e5b592',coat:'#504549'}
  };
  const theme=themes[g]||(h?{skin:'#e8b995',hair:'#292522',hairLight:'#49403a',brow:'#40332e',coat:'#fffdf8'}:{skin:'#efc29f',hair:f?'#3c3335':'#352e2e',hairLight:f?'#514248':'#51433f',brow:'#4b403d',coat:f?'#91ad97':'#344957'});
  const G=group(null),body=group(G,0,.85,0), chest=group(body),head=group(chest,0,1.003,.017);
  const skin=theme.skin,shirt='#fffdf7',coat=theme.coat,pants=g?'#515d68':h?'#fffdf8':'#495563';
  const hem=g?'#b3a185':f?'#84a48c':'#344b5a';
  const eyes=g?guardianFace(k,head,theme,g):face(k,head,theme);
  if(!g){
    if(h){
      // Dark, tidy side hair beneath a soft red-and-white checked ghutra.
      orb(head,0,.115,-.117,.298,.275,.249,'#292522');
      for(const side of [-1,1]){
        lock(head,[[side*.30,.24,.015],[side*.36,.06,.005],[side*.37,-.16,-.025],[side*.32,-.38,-.035]],.105,.045,'#fffdf8');
        lock(head,[[side*.24,.20,-.12],[side*.29,-.01,-.23],[side*.27,-.23,-.25],[side*.23,-.43,-.17]],.090,.035,'#fffdf8');
        // Small red woven accents on the hanging scarf edges.
        tube(head,[[side*.31,.10,.015],[side*.35,-.08,-.005],[side*.35,-.24,-.025]],.009,'#c94a4c',12);
      }
      const crown=mesh(head,new T.SphereGeometry(1,24,16),'#fffdf8',0,.205,-.015);
      crown.scale.set(.365,.245,.345);
      // A dark agal sits over the scarf; the red forehead band remains visible.
      const agal=mesh(head,new T.TorusGeometry(.337,.031,8,40),'#292725',0,.302,-.012);
      agal.rotation.x=Math.PI/2;agal.scale.set(1,.92,1);
      const band=group(head,0,.226,.286);
      rect(band,0,0,0,.625,.084,.026,.018,'#c92535');
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,128);
      ctx.fillStyle='#fff8ef';ctx.font='bold 92px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('홍홍',256,66);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      const textMaterial=new T.MeshBasicMaterial({map:texture,transparent:true,side:T.DoubleSide,depthWrite:false});
      const lettering=mesh(band,new T.PlaneGeometry(.43,.078),textMaterial,0,0,.016);
      for(const side of [-1,1]){
        const lens=mesh(head,new T.TorusGeometry(.073,.008,7,20),'#39332f',side*.137,-.005,.340);
        lens.scale.set(1,.82,1);
        tube(head,[[side*.064,-.004,.342],[side*.018,.002,.348],[-side*.018,.002,.348],[-side*.064,-.004,.342]],.006,'#39332f',10);
        tube(head,[[side*.208,.018,.315],[side*.30,.032,.245]],.006,'#39332f',8);
      }
    }else hair(k,head,style,theme);
    // A vertically oriented egg in the front and profile cameras. The heavier
    // lower face follows an actual sculpted surface around both cheeks.
    head.scale.set(h?.96:f?.889:.918,h?1.04:1.085,h?1.015:f?.991:1.005);
    head.position.y=1.030;
  }
  rings(chest,[[.55,.076,.078],[.63,.085,.085],[.704,.09,.091]],skin);
  const badge=group(chest,0,.557,.178);
  if(g){
    rings(chest,[[-.072,.216,.124],[-.05,.249,.145],[.015,.257,.155],[.21,.236,.153],[.362,.268,.165],[.46,.285,.160],[.50,.251,.142],[.536,.151,.102],[.55,.088,.083]],coat,0,.10,0);
    rings(chest,[[.026,.242,.145],[.030,.257,.152],[.079,.258,.158],[.091,.253,.155]],hem);
  }else{
    if(h)dressHonghong(k,chest,coat);else tailorWorker(k,chest,badge,f,coat,shirt);
    rect(badge,0,-.081,0,.120,.142,.012,.014,'#e3dcc8');
    rect(badge,0,-.064,.013,.108,.092,.002,.006,'#fff6df');
    rect(badge,-.020,-.061,.016,.048,.055,.002,.003,'#9cb9b5');
    orb(badge,-.019,-.055,.020,.009,.012,.005,'#e9cfad');
    rect(badge,.027,-.061,.018,.030,.006,.002,.002,'#859b94');
    rect(badge,.017,-.095,.017,.064,.005,.002,.002,'#9baa9b');
    orb(badge,0,-.008,.010,.014,.021,.009,'#8c9385',.3);
  }
  const legs=[],arms=[],joints=[G,body,chest,head,badge,...eyes];
  const lips=head.getObjectByName('worker-lips'),breathOpening=lips?.getObjectByName('breath-opening');
  if(!g)joints.push(head.getObjectByName('worker-face-surface'),lips,breathOpening);
  if(!g){
    // A curved trouser seat joins the two thighs below the short jacket.
    rings(body,[[-.134,.181,.115,-.024],[-.105,.231,.146,-.022],[-.046,.267,.157,-.018],[.072,.260,.153,-.009]],f?pants:'#56606a');
  }
  for(const side of [-1,1]){
    const thigh=group(body,side*(g?.135:.141),0,0),shin=group(thigh,0,-.366,0),boot=group(shin,0,-.331,0);
    const shoulder=group(chest,side*(g?.248:.295),.536,.003),elbow=group(shoulder,0,g?-.222:-.267,.001),wrist=group(elbow,0,g?-.190:-.241,0),palm=group(wrist,0,g?-.043:-.056,g?.016:-.024);
    if(g){
      rings(thigh,[[-.365,.105,.104],[-.323,.117,.12],[-.135,.138,.135],[.015,.132,.140],[.057,.106,.103]],pants);
      rings(shin,[[-.327,.106,.114],[-.299,.114,.116],[-.122,.111,.113],[-.007,.107,.112],[.037,.094,.096]],pants);
      orb(boot,0,-.057,.061,.13,.092,.190,'#65564c');
      rings(boot,[[-.145,.106,.166,.058],[-.135,.128,.191,.057],[-.111,.133,.191,.056],[-.098,.123,.184,.055]],'#514b46');
      rings(shoulder,[[-.238,.077,.081],[-.220,.086,.091],[-.10,.093,.093],[-.013,.099,.097],[.049,.077,.077],[.08,.027,.031]],coat);
      rings(elbow,[[-.181,.064,.067],[-.161,.077,.076],[-.066,.081,.082],[.018,.077,.077]],coat);
      rings(elbow,[[-.20,.066,.067],[-.198,.071,.071],[-.164,.074,.076],[-.158,.071,.071]],'#bcaa85');
    }else{
      rings(boot,[[-.145,.095,.153,.054],[-.134,.118,.171,.055],[-.105,.125,.180,.052],[-.071,.126,.174,.044],[-.035,.116,.155,.039],[.007,.092,.106,.005],[.030,.070,.075,-.013]],f?'#685547':'#edece2');
    }
    if(g){
      orb(wrist,0,-.042,.009,.067,.085,.047,skin);
      orb(wrist,-side*.049,-.037,.033,.029,.052,.031,skin);
      for(let i=0;i<3;i++){const px=side*(-.020+i*.017);tube(wrist,[[px,-.092,.035],[px,-.074,.050]],.0022,'#dca689',3);}
    }else{
      // A broad palm and four joined fingertips stay legible against the hull.
      orb(wrist,0,-.052,.008,.077,.074,.034,skin);
      const thumb=orb(wrist,-side*.066,-.054,.008,.032,.052,.028,skin);
      thumb.rotation.z=-side*.44;
      for(const [x,y,ry] of [[-.048,-.103,.034],[-.016,-.114,.040],[.016,-.115,.042],[.048,-.106,.035]])
        orb(wrist,side*x,y,.006,.022,ry,.024,skin);
    }
    legs.push({side,thigh,shin,boot});joints.push(thigh,shin,boot);
    arms.push({side,shoulder,elbow,wrist,palm});joints.push(shoulder,elbow,wrist,palm);
  }
  const cup=group(arms[1].wrist,0,-.087,.05),phone=group(arms[0].wrist,0,-.079,.047);
  rings(cup,[[0,.044,.044],[.012,.045,.045],[.127,.061,.061],[.133,.061,.061]],'#f3dfb7');
  rings(cup,[[.128,.062,.062],[.132,.065,.065],[.139,.062,.062]],'#ffecd2');
  orb(cup,0,.139,0,.055,.003,.055,'#9c7856');
  rect(phone,0,.058,0,.091,.153,.016,.014,'#465759');rect(phone,0,.060,.018,.078,.127,.004,.010,'#a9c6c0');
  const phoneIcon=orb(phone,0,.052,.024,.019,.017,.004,'#e5e5cb');phoneIcon.rotation.z=.35;
  cup.visible=false;phone.visible=false;joints.push(cup,phone);
  let smokeProp,cigaretteTip,eomuk,eomukTip,mouth;
  if(!g){
    mouth=group(head,.023,-.164,.342);mouth.name='mouth';
    smokeProp=group(arms[1].wrist,-.035,-.092,.035);smokeProp.name='cigarette';
    // The pivot is where the fingers grip it, with the filter towards the lips.
    const stem=group(smokeProp);stem.rotation.x=Math.PI/2;
    rings(stem,[[-.120,.014,.014],[-.077,.014,.014]],'#c8a681',0,0,0,10);
    rings(stem,[[-.077,.0155,.0155],[.195,.0155,.0155]],'#fffaf0',0,0,0,12);
    rings(stem,[[.195,.016,.016],[.210,.014,.014]],'#c58c67',0,0,0,10);
    cigaretteTip=group(smokeProp,0,0,.210);cigaretteTip.name='cigarette-tip';
    eomuk=group(arms[1].wrist,-.033,-.084,.045);eomuk.name='folded-eomuk';
    addEomuk(k,eomuk);eomukTip=group(eomuk,0,0,.295);eomukTip.name='edible-tip';
    eomuk.visible=false;smokeProp.visible=false;joints.push(mouth,smokeProp,cigaretteTip,eomuk,eomukTip);
  }
  return {k,G,body,chest,head,eyes,lips,breathOpening,badge,legs,arms,cup,phone,smokeProp,cigaretteTip,eomuk,eomukTip,mouth,joints,theme};
}

// Shrine figures share a monumental body scale. The trident rises above the court.
const guardianScale={poseidon:2.22,njord:2.33,yi:2.22,jang:2.28};

// The four older faces share the toy's smooth sculpt, with different jaw
// lines, eyelids and brows.
function guardianFace(k,head,theme,id){
  const {orb,rings,tube,cap,lock,group}=k;
  const width=id==='njord'?1.035:id==='jang'?.95:1;
  const sculpt=group(head);sculpt.scale.x=width;
  const skin=theme.skin,eyes=[];
  rings(sculpt,[[-.31,.10,.14,.015],[-.27,.22,.207,.013],[-.19,.30,.274,.012],[-.08,.35,.323],[.06,.356,.33],[.19,.32,.29],[.31,.246,.218],[.38,.12,.10],[.40,.025,.025]],skin,0,0,0,30);
  const eyeWidth=id==='jang'?.050:id==='yi'?.046:.051;
  for(const side of [-1,1]){
    const ear=orb(sculpt,side*.344,-.033,.001,.060,.094,.05,skin);ear.rotation.z=-side*.12;
    orb(sculpt,side*.359,-.037,.040,.03,.058,.012,'#c38972');
    const eye=group(head,side*.141*width,-.004,.306);eye.rotation.y=side*.32;eyes.push(eye);
    if(id==='yi'||id==='jang'){
      const iris=id==='yi'?'#493b30':'#593f30';
      eye.rotation.z=side*(id==='yi'?.035:.065);
      orb(eye,0,-.002,.010,.062,.031,.020,'#dfc5a7');
      orb(eye,-side*.004,.000,.024,.031,.030,.013,iris);
      orb(eye,-side*.004,.002,.034,.020,.023,.008,'#292727');
      orb(eye,-.009,.010,.042,.007,.007,.003,'#ffecd1');
      lock(eye,[[-side*.063,-.001,.012],[-side*.032,.023,.028],[side*.017,.028,.030],[side*.064,.013,.012]],.009,.005,theme.brow);
    }else{
      orb(eye,0,0,.01,eyeWidth,.043,.018,'#523c33');
      orb(eye,-side*.003,.003,.022,eyeWidth*.60,.037,.010,'#302c2a');
      orb(eye,-.009,.016,.033,.009,.009,.004,'#fff0d4');
    }
    const dip=id==='yi'?.016:id==='poseidon'?.010:id==='njord'?0:-.004;
    tube(sculpt,[[side*.075,.067-dip,.316],[side*.142,.092,.303],[side*.219,.086,.260]],id==='poseidon'?.021:.018,theme.brow,7);
    tube(sculpt,[[side*.073,.024,.319],[side*.144,.042,.309],[side*.208,.022,.279]],.0065,theme.brow,7);
  }
  orb(sculpt,0,-.059,.337,id==='jang'?.044:.052,.055,.047,skin);
  tube(sculpt,[[-.068,-.145,.291],[-.021,-.151,.304],[.032,-.15,.305],[.062,-.142,.297]],.0075,'#996c5d',8);
  if(id==='poseidon'||id==='njord'){
    const main=theme.hair,light=theme.hairLight;
    cap(head,.383,.407,.366,a=>2.56-1.52*((Math.cos(a)+1)/2)**1.32,main,.058);
    for(const side of [-1,1]){
      for(let i=0;i<2;i++)lock(head,[[side*(.03+.085*i),.42,.06],[side*(.12+.05*i),.35,.24],[side*(.24+.03*i),.24,.22],[side*(.31+.012*i),.123,.149]],.074,.033,i===0?light:main);
      lock(head,[[side*.27,.23,.16],[side*.366,.04,.095],[side*.354,-.124,.082],[side*.29,-.24,.11]],.07,.032,main);
      // Side whiskers and two sweeping moustache locks frame the mouth.
      lock(head,[[side*.30,-.085,.155],[side*.24,-.20,.21],[side*.15,-.279,.225],[side*.07,-.33,.21]],.074,.045,main);
      lock(head,[[side*.013,-.113,.32],[side*.086,-.121,.308],[side*.16,-.152,.28],[side*.205,-.144,.246]],.030,.024,light);
    }
    const beardLength=id==='poseidon'?.424:.395;
    for(const side of [-1,0,1]){
      const x=side*.085;
      lock(head,[[x,-.16,.293],[x*.98,-.227,.279],[x*.86,-.30,.258],[x*.49,-beardLength+Math.abs(x)*.5,.185]],.079,.043,side>0?light:main);
    }
  }else{
    cap(head,.366,.388,.34,a=>2.1-1.09*((Math.cos(a)+1)/2)**1.8,theme.hair,.046);
    if(id==='jang'){
      // The loose hair is a narrative silhouette; no contemporary portrait
      // survives to prescribe the commander's appearance or clothing colors.
      cap(head,.389,.419,.392,a=>2.76-1.78*((Math.cos(a)+1)/2)**1.3,theme.hair,.048);
      rings(head,[[-.47,.187,.090],[-.42,.277,.125],[-.282,.331,.175],[-.044,.342,.194],[.132,.308,.165]],theme.hair,0,0,-.142,30);
      const strands=[
        [[.013,.441,.105],[.119,.366,.238],[.240,.205,.275],[.264,.052,.251],[.295,-.129,.250],[.317,-.327,.138]],
        [[.102,.407,-.042],[.249,.294,.155],[.313,.113,.162],[.343,-.078,.178],[.364,-.255,.142],[.309,-.457,.170]],
        [[.183,.353,-.109],[.314,.148,-.034],[.351,-.093,.021],[.334,-.292,.006],[.374,-.476,.072]],
        [[.064,.400,-.102],[.218,.259,-.217],[.285,-.061,-.229],[.284,-.329,-.180],[.210,-.492,-.166]]
      ];
      for(const side of [-1,1]){
        strands.forEach((strand,i)=>{
          const pts=strand.map(([x,y,z],j)=>[side*x+(side>0&&j<3?.016:0),y+(side>0?.010:0),z]);
          lock(head,pts,i===0?.080:.071,i===0?.043:.035,i%2?'#302c2b':'#40342f');
          if(i<3)lock(head,pts.map(([x,y,z])=>[x-side*.016,y-.007,z+.035]),.016,.009,i?'#4b3930':'#523c31');
        });
        lock(head,[[side*.005,.419,.134],[side*.080,.363,.249],[side*.162,.278,.291],[side*.200,.176,.284]],.052,.024,'#342b28');
        const fringe=side<0?[[.015,.422,.145],[-.022,.367,.228],[-.106,.285,.289],[-.154,.210,.301],[-.192,.126,.286]]:
          [[-.003,.415,.143],[.048,.346,.252],[.133,.297,.281],[.191,.252,.283],[.238,.169,.254]];
        lock(head,fringe,.039,.020,side<0?'#382e28':'#47382f');
        lock(head,[[side*.281,.176,.248],[side*.304,.016,.226],[side*.284,-.132,.242],[side*.310,-.239,.229],[side*.291,-.353,.192]],.041,.019,'#3d2f28');
      }
    }
    const admiral=id==='yi',beard=admiral?'#554334':'#4d372c';
    // The beard follows the jaw in profile, with a lip gap above the chin.
    for(const side of [-1,1]){
      const pts=[[side*.004,-.115,.333],[side*.048,-.118,.330],[side*.099,-.132,.310],[side*.153,-.158,.284],[side*(admiral?.168:.138),-.183,.262]];
      lock(head,pts,admiral?.019:.014,.012,beard);
    }
    // A thin continuous curved patch tracks the chin instead of floating
    // above it. The two commanders have distinct jawlines in profile.
    const jaw=admiral?[
      [-.183,.067,.278],[-.212,.113,.260],[-.244,.126,.239],[-.279,.099,.218],
      [-.310,.074,.193],[-.339,.047,.176],[-.367,.006,.151]
    ]:[
      [-.197,.041,.277],[-.219,.070,.262],[-.238,.079,.249],[-.259,.066,.235],
      [-.281,.041,.218],[-.292,.018,.204],[-.302,.005,.197]
    ];
    const profile=[[-.31,.10,.155],[-.27,.22,.220],[-.19,.30,.286],[-.08,.35,.323]];
    const atFace=(x,y)=>{
      if(y<profile[0][0])return null;
      const i=profile.findIndex(v=>v[0]>=y),lo=profile[Math.max(0,i-1)],hi=profile[Math.max(0,i)];
      const f=lo===hi?0:(y-lo[0])/(hi[0]-lo[0]);
      const rx=lo[1]+(hi[1]-lo[1])*f,rz=lo[2]+(hi[2]-lo[2])*f;
      return rz*Math.sqrt(Math.max(0,1-(x/rx)**2));
    };
    const vertices=[],triangles=[],n=20;
    jaw.forEach(([y,width,tip],i)=>{
      for(let j=0;j<=n;j++){
        const u=j*2/n-1,edge=Math.abs(u),x=u*width;
        const h=y+(admiral?.014:.009)*edge**2*(1-i/(jaw.length-1));
        const skinDepth=atFace(x,h);
        const z=(skinDepth??tip*(1-.14*edge*edge))+.006+.009*(1-edge);
        vertices.push(x,h,z);
        if(i&&j){const m=i*(n+1)+j;triangles.push(m-n-2,m-1,m,m-n-2,m,m-n-1);}
      }
    });
    const geo=new k.T.BufferGeometry();geo.setAttribute('position',new k.T.Float32BufferAttribute(vertices,3));geo.setIndex(triangles);geo.computeVertexNormals();k.mesh(sculpt,geo,beard);
    for(const sign of [-1,1]){
      if(admiral)lock(sculpt,[[sign*.029,-.207,.278],[sign*.032,-.247,.250],[sign*.025,-.303,.199],[sign*.004,-.351,.160]],.005,.003,'#665342');
      lock(sculpt,[[sign*.080,-.147,.309],[sign*.098,-.166,.288],[sign*.110,-.181,.271],[sign*.095,-.204,.265]],.007,.004,beard);
    }
  }
  return eyes;
}

function guardianStance(r,id,t=0,look=0){
  const breath=Math.sin(t*1.30),sailor=id==='jang',sea=id==='poseidon';
  const tilt={poseidon:[-.052,.135],njord:[-.029,-.105],yi:[-.030,.031],jang:[-.010,-.070]}[id];
  r.head.rotation.set(tilt[0]+.006*breath,tilt[1]+.017*Math.sin(t*.46)+Math.max(-.35,Math.min(.35,Number(look)||0)),0);
  const blink=(t+.42)%5.9;for(const eye of r.eyes)eye.scale.y=blink>5.64?Math.max(.12,Math.min(1,Math.abs(blink-5.77)/.13)):1;
  // Straight spine, broad planted feet and a fixed grip. The tiny breath
  // moves the chest and held model together, maintaining both hand contacts.
  r.body.position.set(0,.85,0);r.body.rotation.set(0,0,0);
  r.chest.rotation.set(.004*breath,0,0);
  r.chest.scale.set(id==='yi'?1.18:id==='njord'?1.16:sea?1.12:1.09,1.015,1.045);
  for(const leg of r.legs){
    const s=leg.side;
    leg.thigh.position.x=s*(sailor?.146:.158);leg.thigh.rotation.set(s*.033,0,s*.082);
    leg.shin.rotation.set(.018,0,0);leg.boot.rotation.set(-s*.034,s*.057,-s*.082);
  }
  for(const a of r.arms){
    const s=a.side;a.shoulder.rotation.order='ZXY';
    a.shoulder.position.y=sailor?.485:.536;
    if(sea){
      if(s<0){
        a.shoulder.rotation.set(-.36,0,-.53);a.elbow.rotation.set(-1.21,0,0);a.wrist.rotation.set(-.12,0,-.14);
      }else{
        // The free palm opens out over the water between Poseidon and Njord.
        const swell=.5+.5*Math.sin(t*.69);
        a.shoulder.rotation.set(-.37+.04*swell,.07,.94+.045*swell);
        a.elbow.rotation.set(-.70-.06*swell,-.27,-.08);a.wrist.rotation.set(-.55,.91,.22);
      }
    }else if(id==='yi'){
      if(s<0){
        a.shoulder.rotation.set(-.31,.05,-.62);a.elbow.rotation.set(-1.18,.08,-.045);a.wrist.rotation.set(-.41,-.25,-.19);
      }else{
        // The left fist rests at the belt, while the projecting elbow stays
        // visible from the front in the silhouette of a standing commander.
        a.shoulder.rotation.set(-.11,-.18,1.01);a.elbow.rotation.set(-.81,-.16,-1.54);a.wrist.rotation.set(.18,-.27,-.08);
      }
    }else if(sailor){
      if(s>0){
        // Carry the trade ship on the left palm, leaving his cuirass visible.
        a.shoulder.rotation.set(-.38,-.15,.43);a.elbow.rotation.set(-1.24,-.22,0);
        a.wrist.rotation.set(-.45,.82,.16);
      }else{
        a.shoulder.rotation.set(-.09,.08,-.24);a.elbow.rotation.set(-.26,.10,-.09);
        a.wrist.rotation.set(-.06,-.10,-.14);
      }
    }else{
      a.shoulder.rotation.set(-.38,0,s*.094);
      a.elbow.rotation.set(-1.29,-s*.15,0);
      a.wrist.rotation.set(-.42,s*.36,s*.08);
    }
  }
}

function dressGuardian(r,id){
  const {k,head,chest,body,arms,theme,G}=r;
  const {group,orb,tube,rings,cap,lock,rect,plaque,mesh,T}=k;
  const cream='#e8dfc8',bronze='#ae9670',brass='#bdab86';
  const sea=id==='poseidon',nordic=id==='njord',admiral=id==='yi';
  // Rimmed fabric loft: deep, spacious folds read at promenade distance.
  function mantle(rows,color,opening=.98){
    const v=[],ix=[],n=21;
    rows.forEach(([height,rx,rz],i)=>{
      for(let j=0;j<=n;j++){
        const u=j/n,a=opening+u*(tau-2*opening),hem=i/(rows.length-1),wave=.019*Math.cos(u*Math.PI*10)*hem;
        const edgeLift=(nordic?.13:sea?.064:0)*hem*hem*(1-u)**3;
        v.push(Math.sin(a)*(rx+wave)+edgeLift*.50,height-.010*i*Math.sin(u*Math.PI*3)+edgeLift,Math.cos(a)*(rz+wave)-.034);
        if(i+1<rows.length&&j<n){const at=i*(n+1)+j;ix.push(at,at+n+1,at+1,at+1,at+n+1,at+n+2);}
      }
    });
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(ix);geo.computeVertexNormals();mesh(chest,geo,color);
  }
  function scarf(points,color,width){
    for(let i=0;i+1<points.length;i++){
      const [x1,y1,z1]=points[i],[x2,y2,z2]=points[i+1],dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy)||1;
      const nx=-dy/l*width,ny=dx/l*width;
      const vs=[x1+nx,y1+ny,z1, x1-nx,y1-ny,z1, x2-nx,y2-ny,z2,x2+nx,y2+ny,z2];
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vs,3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();mesh(chest,geo,color);
    }
  }
  function lowerRobe(low,top,base,edge){
    rings(body,[[low,.331,.221],[low+.053,.334,.225],[-.16,.328,.216],[.105,.277,.179]],base);
    rings(body,[[low+.025,.337,.224],[low+.058,.338,.227]],edge);
    rings(chest,[[.035,.254,.162],[.042,.261,.169],[.113,.259,.167],[.121,.252,.16]],top);
  }
  function armorPanel(parent,rows,color){
    const v=[],indices=[],steps=14;
    rows.forEach(([y,width,edge,middle],i)=>{
      for(let j=0;j<=steps;j++){
        const u=2*j/steps-1;
        v.push(u*width,y,edge+(middle-edge)*Math.sqrt(Math.max(0,1-u*u)));
        if(i&&j){const n=i*(steps+1)+j;indices.push(n-steps-2,n-1,n,n-steps-2,n,n-steps-1);}
      }
    });
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(indices);geo.computeVertexNormals();
    return mesh(parent,geo,color);
  }
  if(sea){
    lowerRobe(-.61,'#537a81','#d7d8c4','#9caeaa');
    mantle([[.58,.23,.13],[.47,.322,.184],[.12,.329,.213],[-.34,.389,.246],[-.53,.417,.255]],'#54868e',1.16);
    scarf([[-.245,.538,.099],[-.184,.505,.165],[-.064,.418,.194],[.052,.294,.196],[.19,.142,.157]],cream,.069);
    orb(chest,-.201,.513,.153,.044,.046,.017,'#91b5b1',.38);
    // Low wave crests make a circlet rather than a tall gold RPG crown.
    rings(head,[[.252,.333,.301],[.262,.341,.311],[.308,.325,.291],[.319,.311,.281]],'#ac9d7d');
    for(const side of [-1,1]){
      plaque(head,[[side*.033,.301],[side*.118,.372],[side*.114,.326],[side*.187,.352],[side*.163,.29]],.278,'#b6a482',.010,.0015);
    }
    orb(head,0,.294,.305,.029,.032,.010,'#8ac2bf',.42);
  }else if(nordic){
    lowerRobe(-.395,'#806b53','#687c71','#485e5c');
    mantle([[.58,.245,.15],[.475,.351,.193],[.23,.362,.227],[-.04,.394,.26],[-.46,.455,.29]],'#647b70',.90);
    // A broad storm collar is one solid silhouette instead of loose beads.
    rings(chest,[[.45,.295,.187],[.482,.327,.196],[.548,.309,.183],[.59,.244,.151],[.604,.164,.108]],'#cbbfa4');
    scarf([[.27,.476,.115],[.15,.415,.172],[-.01,.336,.189],[-.237,.203,.136]],'#a19476',.028);
    orb(chest,.207,.471,.138,.061,.06,.021,'#907956',.48);
    orb(chest,.207,.471,.156,.039,.038,.012,'#c3ae7e');
    for(const side of [-1,1]){
      const x=side*.295;
      tube(head,[[x,.015,.144],[x*1.04,-.098,.154],[x*1.03,-.201,.139],[x*.95,-.287,.140]],.041,'#baa382',12);
      for(let j=0;j<3;j++)lock(head,[[x+side*.022,-.045-j*.068,.183],[x-side*.018,-.074-j*.067,.19],[x,-.117-j*.066,.178]],.026,.022,'#d6bfa1');
      rings(head,[[-.275,.040,.034],[-.253,.043,.037]],'#92846d',x*.96,0,.14,12);
    }
    tube(head,[[-.338,.11,-.05],[-.253,.154,.215],[0,.174,.318],[.253,.154,.215],[.338,.11,-.05]],.018,'#8c7c62',16);
  }else if(admiral){
    lowerRobe(-.677,'#6e4e3d','#554d43','#754c3d');
    mantle([[.56,.263,.165],[.42,.309,.185],[.07,.317,.215],[-.45,.36,.239],[-.66,.395,.261]],'#554740',1.35);
    // Overlapping faulds follow the open, bell-shaped riding coat.
    for(const side of [-1,1]){
      const x=(v)=>side*v;
      const flap=plaque(body,[[x(.018),-.055],[x(.215),-.075],[x(.326),-.504],[x(.265),-.548],[x(.104),-.585],[x(.052),-.394]],.222,'#484b48',.015,.006);
      flap.rotation.y=side*.20;
      for(let row=0;row<5;row++)for(let col=0;col<3;col++){
        const cx=x(.050+col*.061+.013*row),cy=-.128-row*.074;
        const scale=plaque(body,[[cx-.031,cy],[cx+.031,cy],[cx+.026,cy-.048],[cx,cy-.070],[cx-.027,cy-.049]],
          .242-Math.abs(cx)*.097,row%2?'#62615a':'#736a5a',.006,.001);
        scale.rotation.y=side*.08;
      }
      tube(body,[[x(.024),-.083,.255],[x(.048),-.28,.247],[x(.080),-.46,.243],[x(.104),-.573,.232]],.011,'#a08a68',8);
      tube(body,[[x(.128),-.178,.193],[x(.198),-.332,.198],[x(.267),-.522,.206],[x(.291),-.647,.193]],.012,'#695c4b',9);
    }
    armorPanel(chest,[[.117,.228,.11,.18],[.21,.256,.089,.192],[.39,.281,.079,.202],[.482,.271,.087,.193],[.547,.182,.126,.167]],'#454d4f');
    for(let i=-3;i<=3;i++){
      const x=i*.061,z=.202-.048*(i/3)**2;
      tube(chest,[[x,.182,z-.016],[x,.316,z+.004],[x*.98,.442,z-.003]],.0045,'#797664',6);
    }
    // The two curved collar lines frame the upper chest above the belt.
    for(const side of [-1,1]){
      tube(chest,[[side*.192,.537,.111],[side*.141,.493,.167],[side*.065,.464,.195],[0,.456,.201]],.010,'#a69a7e',8);
      const shoulder=arms[side>0?1:0].shoulder;
      for(let row=0;row<3;row++){
        const plate=orb(shoulder,0,.035-row*.055,.019,.140-row*.006,.039,.143-row*.003,row%2?'#525757':'#676962');
        plate.rotation.z=-side*.21;
      }
      rings(arms[side>0?1:0].elbow,[[-.177,.078,.078],[-.156,.083,.082],[-.047,.085,.088],[-.037,.080,.083]],'#57574e');
    }
    rings(chest,[[.032,.261,.171],[.038,.272,.181],[.107,.269,.181],[.118,.255,.168]],'#715841');
    rect(chest,0,.080,.184,.091,.050,.014,.006,'#aa9673');
    // Iron cap, shaped neck guards and an open, three-leaf top finial.
    cap(head,.382,.396,.359,()=>Math.PI*.48,'#55595a',.087);
    rings(head,[[.086,.382,.354],[.094,.406,.374],[.108,.402,.370],[.122,.382,.350]],'#454848');
    const hood=new T.BufferGeometry(),v=[],indices=[],segments=30;
    const layers=[[.104,.376,.337],[-.04,.379,.331],[-.17,.393,.327],[-.29,.419,.299],[-.405,.463,.279]];
    layers.forEach(([y,rx,rz],i)=>{
      for(let j=0;j<=segments;j++){
        const f=j/segments,a=.82+f*(tau-1.64),edge=Math.pow(Math.abs(2*f-1),3);
        v.push(Math.sin(a)*rx,y+i*.016*edge,(Math.cos(a)*rz)-.016);
        if(i&&j){const n=i*(segments+1)+j;indices.push(n-segments-2,n-1,n,n-segments-2,n,n-segments-1);}
      }
    });
    hood.setAttribute('position',new T.Float32BufferAttribute(v,3));hood.setIndex(indices);hood.computeVertexNormals();mesh(head,hood,'#634f44');
    for(const side of [-1,1]){
      tube(head,[[side*.276,.084,.217],[side*.285,-.031,.220],[side*.298,-.168,.203],[side*.342,-.339,.173]],.011,'#84765e',10);
      tube(head,[[side*.338,.11,.147],[side*.309,.277,.101],[side*.192,.414,.070],[0,.481,0]],.008,'#968d76',10);
    }
    tube(head,[[0,.126,.360],[0,.259,.331],[0,.402,.228],[0,.481,0]],.009,'#a4987b',12);
    rings(head,[[.463,.078,.066],[.483,.077,.064],[.505,.045,.042],[.544,.026,.025],[.558,.034,.032]],'#8d8165',0,0,0,16);
    for(const side of [-1,0,1]){
      lock(head,[[0,.542,.001],[side*.017,.567,.002],[side*.036,.591,.002],[side*.050,.629-Math.abs(side)*.003,.003]],.010,.008,'#77765e');
    }
    // A small turtle ship accompanies the commander on his plinth.
    const turtle=group(G,.407,.055,.220);turtle.rotation.y=-.24;turtle.scale.setScalar(.64);
    const hull=rings(turtle,[[-.290,.007,.012,.020],[-.236,.066,.058,.004],[-.13,.105,.073],[.13,.106,.074],[.235,.073,.062],[.277,.010,.018,.027]],'#786149',0,.048,0,12);
    hull.rotation.z=-Math.PI/2;
    orb(turtle,-.004,.108,0,.235,.071,.103,'#7d8874');
    for(let i=-2;i<=2;i++)tube(turtle,[[i*.071,.113,-.094],[i*.071,.162,-.042],[i*.071,.180,0],[i*.071,.162,.042],[i*.071,.113,.094]],.009,'#536459',8);
    lock(turtle,[[.228,.091,0],[.270,.126,0],[.278,.192,0],[.308,.205,0]],.035,.027,'#a48a63');
    orb(turtle,.308,.195,0,.050,.024,.033,'#9a815c');
  }else{
    lowerRobe(-.55,'#745241','#343947','#4b3c37');
    mantle([[.57,.261,.161],[.465,.346,.206],[.18,.324,.218],[-.31,.355,.235],[-.50,.380,.253]],'#403d43',1.22);
    armorPanel(chest,[[.12,.249,.087,.192],[.177,.262,.089,.213],[.316,.264,.095,.222],[.432,.293,.091,.203],[.491,.253,.104,.183],[.541,.177,.125,.174]],'#253b4d');
    for(const side of [-1,1]){
      const shoulder=arms[side>0?1:0].shoulder;
      // The indigo shoulder guard flares over the russet stacked sleeve.
      for(let row=0;row<4;row++){
        rings(shoulder,[[-.198+row*.049,.095,.096],[-.194+row*.049,.106,.105],[-.167+row*.049,.114,.109],[-.149+row*.049,.108,.104]],row%2?'#5d4442':'#67504b',0,0,0,22);
      }
      const guard=group(shoulder,side*.042,.039,0);guard.rotation.z=side*.26;
      rings(guard,[[-.068,.151,.155],[-.042,.164,.160],[-.014,.163,.154],[.027,.152,.153],[.067,.106,.117],[.078,.061,.067]],'#2e4354',0,0,0,24);
      rings(guard,[[-.063,.155,.157],[-.051,.164,.162],[-.047,.163,.161]],'#5c6d76',0,0,0,24);
      orb(guard,-side*.044,-.024,.151,.024,.026,.008,'#87989a');
      for(let j=0;j<3;j++)rings(arms[side>0?1:0].elbow,[[-.177+j*.035,.079,.078],[-.155+j*.035,.085,.084]],j%2?'#4d4242':'#645149');
      tube(chest,[[side*.193,.53,.138],[side*.121,.471,.179],[side*.057,.451,.199],[0,.447,.205]],.012,'#75828a',9);
      // An original wave-and-keel relief picks out the curved breastplate.
      tube(chest,[[side*.186,.351,.175],[side*.138,.366,.209],[side*.102,.334,.218],[side*.063,.325,.222],[side*.044,.283,.227]],.007,'#71828b',10);
      tube(chest,[[side*.027,.222,.224],[side*.068,.202,.224],[side*.132,.226,.210],[side*.171,.211,.199],[side*.181,.194,.191]],.006,'#73828a',8);
      orb(chest,side*.126,.419,.192,.019,.019,.008,'#829398');
    }
    rings(chest,[[.029,.269,.175],[.045,.279,.190],[.123,.277,.19],[.133,.263,.173]],'#60483b');
    rect(chest,0,.084,.192,.092,.058,.013,.008,'#aa8a65');
    plaque(body,[[.122,.044],[.175,.046],[.244,-.387],[.187,-.356]],.203,'#795a43',.013,.003);
  }

  guardianStance(r,id);
  G.updateMatrixWorld(true);
  // Derive the contact points from the posed wrists before batching. Props
  // and the relaxed breathing animation then share the chest's transform.
  const palms=arms.map(a=>chest.worldToLocal(a.wrist.localToWorld(new T.Vector3(0,-.055,.037))));
  if(sea){
    const hand=palms[0],p=group(chest,hand.x,hand.y,hand.z),base=-hand.y-.81;
    r.joints.push(p);
    p.rotation.z=.058;
    const shaftTop=1.13;
    // Keep these tiny contours independently tessellated when the software
    // renderer simplifies distant geometry.
    const shaft=tube(p,[[0,base,0],[0,.1,0],[0,shaftTop,0]],.026,'#778e89');
    r.joints.push(shaft);
    rings(p,[[shaftTop-.10,.045,.043],[shaftTop-.07,.05,.046],[shaftTop-.04,.035,.033]],brass,0,0,0,14);
    for(const side of [-1,0,1]){
      const h=side?1.46:1.58,x=side*.195;
      const prong=side?tube(p,[[0,shaftTop-.083,0],[side*.117,shaftTop,0],[x,shaftTop+.104,0],[x,h-.096,0]],.025,'#b6a987',10):
        tube(p,[[0,shaftTop-.06,0],[0,h-.093,0]],.024,'#b6a987',4);
      const blade=mesh(p,new T.ConeGeometry(side?.042:.049,.173,8),'#c5b896',x,h-.029,0);
      blade.rotation.y=Math.PI/4;r.joints.push(prong,blade);
    }
  }else if(admiral){
    // The model rests his right hand on an upright sheathed ceremonial sword.
    const grip=palms[0],sword=group(chest,grip.x,grip.y,grip.z);
    sword.rotation.z=.093;r.joints.push(sword);
    const foot=-.806-grip.y;
    rings(sword,[[foot,.019,.015],[foot+.055,.041,.026],[-.11,.047,.027],[-.092,.050,.029]],'#494e50',0,0,0,12);
    rings(sword,[[foot+.009,.024,.018],[foot+.034,.040,.026],[foot+.082,.041,.029]],'#9d8a66',0,0,0,12);
    orb(sword,0,-.097,0,.088,.017,.048,'#a18d67');
    rings(sword,[[-.085,.025,.021],[.169,.028,.023],[.238,.031,.024],[.256,.031,.025]],'#735348',0,0,0,12);
    for(const y of [-.057,-.017,.024,.065,.106,.147,.188,.229])rings(sword,[[y,.028,.023],[y+.010,.028,.023]],'#a38b70',0,0,0,12);
    orb(sword,0,.257,0,.035,.021,.029,'#ab9571');
  }else{
    const midpoint=nordic?palms[0].clone().lerp(palms[1],.5):palms[1];
    const b=group(chest,midpoint.x,midpoint.y+.051,midpoint.z-.010);
    b.rotation.y=nordic?.14:-.19;if(!nordic)b.scale.setScalar(.62);r.joints.push(b);
    const timber=nordic?'#805b43':admiral?'#755945':'#936c4c';
    const deck=nordic?'#c29969':'#c8a47d';
    // Lofts run along X. Fine pointed ends rise out of the keel.
    const hull=rings(b,[[-.345,.007,.010,.062],[-.29,.042,.062,.020],[-.195,.078,.078],[.12,.089,.084],[.255,.065,.065,.019],[.325,.023,.037,.050],[.35,.007,.012,.068]],timber,0,0,0,12);
    hull.rotation.z=-Math.PI/2;
    orb(b,0,.063,0,.285,.031,.084,deck);
    for(const s of [-1,1])tube(b,[[-.309,.080,s*.035],[-.18,.060,s*.082],[.08,.063,s*.091],[.273,.091,s*.050],[.321,.114,s*.018]],.012,'#c1a17e',9);
    if(nordic){
      for(const s of [-1,1])tube(b,[[s*.245,.041,0],[s*.32,.111,0],[s*.35,.199,0],[s*.316,.229,0],[s*.291,.197,0]],.026,timber,10);
      for(let j=-1;j<=1;j++){
        orb(b,j*.110,.059,.087,.042,.042,.012,j===0?'#9a6952':'#888c77');
        orb(b,j*.110,.060,.100,.010,.010,.006,'#beaa82');
      }
    }else{
      tube(b,[[-.038,.052,0],[-.038,.391,0]],.012,'#967959',5);
      const sail=plaque(b,[[-.190,.138],[.119,.111],[.074,.321],[-.136,.350]],.012,'#e5cd9f',.011,.003);
      sail.rotation.y=.07;
      for(let j=0;j<3;j++)tube(b,[[-.174+j*.015,.18+j*.057,.031],[.101-j*.011,.157+j*.056,.034]],.006,'#b49c72',4);
      tube(b,[[-.245,.068,0],[-.037,.383,0],[.265,.085,0]],.0045,'#b59a77',8);
    }
  }
}

/* Merge stationary parts per joint and material. A worker's facial features,
   garment stitches, hair and shoes become a handful of rigid draw batches. */
function batchRig(T,r){
  const keep=new Set(r.joints);
  r.G.updateMatrixWorld(true);
  const inv=new T.Matrix4(),m=new T.Matrix4(),nm=new T.Matrix3(),p=new T.Vector3(),n=new T.Vector3();
  for(const joint of r.joints){
    inv.copy(joint.matrixWorld).invert();const buckets=new Map(),rem=[];
    function walk(obj){
      if(keep.has(obj))return;
      if(obj.isMesh){
        const batch=r.k.paintBatch(obj.material.roughness),color=obj.material.color;let b=buckets.get(batch);if(!b){b={pos:[],nor:[],colors:[],ix:[]};buckets.set(batch,b);}
        m.multiplyMatrices(inv,obj.matrixWorld);nm.getNormalMatrix(m);
        const pos=obj.geometry.getAttribute('position'),norm=obj.geometry.getAttribute('normal'),vc=obj.geometry.getAttribute('color'),base=b.pos.length/3;
        for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(m);b.pos.push(p.x,p.y,p.z);n.fromBufferAttribute(norm,i).applyMatrix3(nm).normalize();b.nor.push(n.x,n.y,n.z);if(vc)b.colors.push(color.r*vc.getX(i),color.g*vc.getY(i),color.b*vc.getZ(i));else b.colors.push(color.r,color.g,color.b);}
        const arr=obj.geometry.getIndex()?.array;if(arr){for(const i of arr)b.ix.push(base+i);}else for(let i=0;i<pos.count;i++)b.ix.push(base+i);
      }
      for(const child of obj.children)walk(child);
    }
    for(const child of [...joint.children])if(!keep.has(child)){walk(child);rem.push(child);}
    for(const child of rem)joint.remove(child);
    for(const [material,b] of buckets){
      const geo=new T.BufferGeometry();if(joint.name==='worker-face-surface'||joint.name==='cigarette'||joint.name==='folded-eomuk')geo.userData.preserveTopology=true;geo.setAttribute('position',new T.Float32BufferAttribute(b.pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(b.nor,3));geo.setAttribute('color',new T.Float32BufferAttribute(b.colors,3));geo.setIndex(b.ix);geo.computeBoundingSphere();
      const o=new T.Mesh(geo,material);o.castShadow=true;o.receiveShadow=true;joint.add(o);
    }
  }
}
const rigs=new WeakMap();
function getRig(T,style,g=''){
  if(!rigs.has(T))rigs.set(T,new Map());const bank=rigs.get(T),id=g||style;
  if(!bank.has(id)){const r=buildRig(T,style,g);if(g)dressGuardian(r,g);batchRig(T,r);bank.set(id,r);}
  const r=bank.get(id),root=r.G.clone(true),map=new Map();
  function mapClone(a,b){map.set(a,b);a.children.forEach((ch,i)=>mapClone(ch,b.children[i]));}
  mapClone(r.G,root);const ref=v=>map.get(v);
  return {G:root,body:ref(r.body),chest:ref(r.chest),head:ref(r.head),lips:ref(r.lips),breathOpening:ref(r.breathOpening),badge:ref(r.badge),cup:ref(r.cup),phone:ref(r.phone),smokeProp:ref(r.smokeProp),cigaretteTip:ref(r.cigaretteTip),eomuk:ref(r.eomuk),eomukTip:ref(r.eomukTip),mouth:ref(r.mouth),
    eyes:r.eyes.map(ref),legs:r.legs.map(v=>({side:v.side,thigh:ref(v.thigh),shin:ref(v.shin),boot:ref(v.boot)})),arms:r.arms.map(v=>({side:v.side,shoulder:ref(v.shoulder),elbow:ref(v.elbow),wrist:ref(v.wrist),palm:ref(v.palm)}))};
}

// The software and hardware renderers both use these continuous garment
// surfaces. Rings turn gradually through the elbow/knee without a seam.
function fitWorkerCloth(T,r,style){
  const k=kit(T);
  const trouser=[[-.700,.086,.093],[-.682,.092,.100],[-.558,.099,.108],[-.458,.103,.111],[-.408,.105,.113],[-.365,.108,.114],[-.323,.111,.117],[-.267,.115,.121],[-.147,.124,.132],[-.035,.128,.134],[.048,.123,.122],[.067,.103,.101]];
  const sleeve=[[-.510,.063,.067],[-.500,.070,.077],[-.398,.076,.083],[-.314,.080,.086],[-.272,.083,.088],[-.246,.085,.090],[-.197,.088,.093],[-.110,.094,.098],[-.021,.098,.103],[.027,.093,.101],[.054,.079,.086],[.078,.051,.051],[.088,.015,.016]];
  const garments=[];
  function attach(upper,lower,rows,color,blend){
    const ringCount=16,mesh=k.rings(upper,rows,color,0,0,0,ringCount),geo=mesh.geometry;
    mesh.material=k.paintBatch(.76);
    const positions=geo.attributes.position,normals=geo.attributes.normal;
    positions.setUsage(T.DynamicDrawUsage);normals.setUsage(T.DynamicDrawUsage);
    const raw=positions.array.slice(),restNormals=normals.array.slice(),rgb=new T.Color(color);
    const colors=new Float32Array(raw.length);
    for(let i=0;i<colors.length;i+=3){colors[i]=rgb.r;colors[i+1]=rgb.g;colors[i+2]=rgb.b;}
    geo.setAttribute('color',new T.BufferAttribute(colors,3));
    geo.userData.preserveTopology=true;
    geo.boundingSphere=new T.Sphere(new T.Vector3(),Math.abs(rows[0][0])+.16);
    const rests=[...rows.map(row=>row[0]),rows[0][0],rows.at(-1)[0]];
    const crossSections=rests.map((y,j)=>{
      const u=saturate((lower.position.y-y+blend)/(2*blend));
      const from=j<rows.length?j*ringCount:rows.length*ringCount+j-rows.length;
      return {y,weight:u*u*(3-2*u),from,to:from+(j<rows.length?ringCount:1)};
    });
    const q=new T.Quaternion(),last=new T.Quaternion(0,0,0,0),center=new T.Vector3(),point=new T.Vector3();
    garments.push({
      geometry:geo,
      update(){
        if(last.equals(lower.quaternion))return;
        last.copy(lower.quaternion);
        for(const {y,weight,from,to} of crossSections){
          q.identity().slerp(lower.quaternion,weight);
          center.set(0,y,0).sub(lower.position).applyQuaternion(q).add(lower.position);
          for(let j=from;j<to;j++){
            const i=j*3;
            point.set(raw[i],raw[i+1]-y,raw[i+2]).applyQuaternion(q).add(center);
            positions.setXYZ(j,point.x,point.y,point.z);
            point.fromArray(restNormals,i).applyQuaternion(q);
            normals.setXYZ(j,point.x,point.y,point.z);
          }
        }
        positions.needsUpdate=true;normals.needsUpdate=true;
      }
    });
  }
  for(const arm of r.arms)attach(arm.shoulder,arm.elbow,sleeve,style==='vest'?'#f4edda':'#91ad97',.064);
  for(const leg of r.legs)attach(leg.thigh,leg.shin,trouser,style==='vest'?'#56606a':'#495563',.084);
  return {update(){for(const item of garments)item.update();},dispose(){for(const item of garments)item.geometry.dispose();}};
}

function performer(T,style,g){
  const r=getRig(T,style,g),{G,body,chest,head,arms,legs}=r;
  G.name=g?'guardian-'+g:'office-worker-'+style;
  const cloth=g?null:fitWorkerCloth(T,r,style);
  const localRotation=new T.Quaternion(),targetRotation=new T.Quaternion(),propEuler=new T.Euler();
  const propDirection=new T.Vector3(),mouthPoint=new T.Vector3(),restDirection=new T.Vector3(),shaftAxis=new T.Vector3(0,0,1);
  const outward=new T.Quaternion(),upAxis=new T.Vector3(0,1,0),flatPalm=new T.Quaternion();
  function steadyProp(prop,arm,x,y,z){
    localRotation.copy(body.quaternion).multiply(chest.quaternion).multiply(arm.shoulder.quaternion).multiply(arm.elbow.quaternion).multiply(arm.wrist.quaternion).invert();
    targetRotation.setFromEuler(propEuler.set(x,y,z));prop.quaternion.copy(localRotation).multiply(targetRotation);
  }
  function animate(input={}){
    if(g){guardianStance(r,g,getTime(input.time),input.face);return;}
    const sit=saturate(input.sit),seatHeight=Number.isFinite(input.seatHeight)?input.seatHeight:.8275;
    const t=getTime(input.time), w=saturate(input.walk)*(1-sit),ps=saturate(input.push),pl=saturate(input.pull);
    const wind=saturate(input.backswing),reb=saturate(input.recoil),act=Math.max(ps,pl,wind,reb);
    const eat=saturate(input.eat)*(1-Math.max(act,w,saturate(input.prayKneel)));
    const free=1-Math.max(act,w,saturate(input.prayKneel),eat);
    const smoke=saturate(input.smoke)*free;
    const rest=saturate(input.smokeRest??input.smoke)*free;
    const inhale=saturate(input.smokeInhale??input.smoke)*rest,exhale=saturate(input.smokeExhale)*rest;
    const standing=rest*(1-sit),seated=rest*sit;
    const coff=saturate(input.coffee)*(1-Math.max(act,smoke,rest,eat)),ph=saturate(input.phone)*(1-Math.max(act,smoke,rest,eat));
    const kneel=saturate(input.prayKneel),cheer=saturate(input.prayRaise)*kneel;
    const wave=Number.isFinite(input.walkPhase)?input.walkPhase:t*4.7,breath=Math.sin(t*2.18), idle=1-Math.max(w,act),step=Math.sin(wave);
    body.position.set(.027*step*w,.85-(.030+.016*Math.cos(wave*2))*w+breath*.004*idle-.042*pl-.045*wind-.058*reb-.484*kneel,ps*.124-pl*.071-.098*wind-.075*reb-.108*kneel);
    body.rotation.set(.025+.10*w+.055*kneel+.26*ps-.23*pl-.14*wind-.13*reb,.035*step*w,Math.sin(wave)*.037*w);
    chest.rotation.set(.075*w+.125*kneel-.19*cheer+.075*ps-.105*pl-.16*wind-.12*reb,.077*step*w,.01*breath*idle);
    head.rotation.set(.06*w+.14*kneel-.48*cheer-.20*ps+.155*pl+.27*wind+.19*reb+.058*coff+.116*ph,-.08*step*w+.084*Math.sin(t*.66)*idle+.065*coff-.098*ph,-.055*Math.sin(t*.81)*idle+.041*step*w);
    if(eat){head.rotation.x+=.16*eat;head.rotation.y+=(.11-.073*Math.sin(t*.66)*idle)*eat;head.rotation.z*=1-.82*eat;}
    // The hips carry the standing figure over the left foot. A seated visitor
    // leans from the rib cage, leaving their seat planted on the bench.
    body.position.x-=.065*standing;body.position.y-=.005*standing;
    body.rotation.z+=.035*standing;
    chest.rotation.set(chest.rotation.x+.085*standing-.169*seated+.021*inhale-.055*exhale,
      chest.rotation.y-.053*standing+.027*seated,chest.rotation.z+.052*standing+.036*seated);
    head.rotation.x+=.21*smoke+(.136*standing-.061*seated-(.155+.132*sit)*exhale)*(1-smoke);
    head.rotation.y+=(.173-.074*Math.sin(t*.66)*idle)*smoke+(1-smoke)*(.105*standing+.145*seated+.079*exhale);
    head.rotation.z=head.rotation.z*(1-.88*Math.max(smoke,rest))+.054*standing*(1-smoke);
    if(sit){
      body.position.y+=(seatHeight+.134-.85)*sit;body.position.z-=.021*sit;
      body.rotation.x-=.025*sit;chest.rotation.x+=.037*sit;
    }
    if(Number.isFinite(input.face))head.rotation.y+=Math.max(-.7,Math.min(.7,input.face));
    const blinkPoint=(t+.64)%4.73,blink=blinkPoint>4.48?Math.abs(blinkPoint-4.60)/.12:1;
    for(const eye of r.eyes){
      eye.scale.y=Math.max(.10,Math.min(1,blink))*(1-.34*act)*(1-.17*rest-.23*exhale+.045*sit*exhale);
      eye.position.y=.005-.006*standing+.012*sit*exhale;
    }
    r.lips.scale.x=1-.50*exhale;r.breathOpening.visible=exhale>.035;
    r.breathOpening.scale.set(1,exhale,1);
    r.badge.rotation.set(r.badge.userData.restPitch+.075*Math.cos(wave)*w-.275*ps+.24*pl+.23*wind+.58*reb,0,.122*step*w+.045*breath*idle+.068*reb);
    for(const leg of legs){
      const s=leg.side, stride=Math.sin(wave+(s>0?0:Math.PI)),bend=Math.max(0,-stride);
      leg.thigh.rotation.set(-stride*.29*w-.12*w-.88*kneel-.07*ps+s*.16*ps-.30*pl+s*.17*pl-.16*wind-.21*reb,0,-s*(.024+.059*pl));
      leg.shin.rotation.set((.21+bend*.24)*w+2.43*kneel+.06*ps+.41*pl+.22*wind+.285*reb,0,0);
      leg.boot.rotation.set((.17*stride-.11-bend*.14)*w+1.44*kneel-.20*ps+.04*pl,0,s*.03*pl);
      if(standing){
        const loose=s>0;
        leg.thigh.rotation.x+=(loose?-.155:.035)*standing;
        leg.shin.rotation.x+=(loose?.235:.025)*standing;
        leg.thigh.rotation.z+=(loose?.090:.061)*standing;
        leg.boot.rotation.x-=(loose?.080:.060)*standing;
        leg.boot.rotation.z-=(loose?.125:.096)*standing;
      }
      if(sit){
        leg.thigh.rotation.x+=(-1.53-leg.thigh.rotation.x)*sit;
        leg.shin.rotation.x+=(1.62-leg.shin.rotation.x)*sit;
        leg.boot.rotation.x+=(.07-leg.boot.rotation.x)*sit;
      }
    }
    for(const arm of arms){
      const s=arm.side,hold=s>0?coff:ph,sip=s>0?(.28+.72*(.5+.5*Math.sin(t*1.95))**3):0, stride=Math.sin(wave+(s>0?0:Math.PI));
      const effort=Math.max(ps,pl,hold,wind,reb), freeSwing=1-effort;
      arm.shoulder.rotation.order='ZXY';
      arm.shoulder.position.set(s*.295,.536-.031*w+.163*cheer,.003);
      arm.shoulder.scale.y=1+.81*cheer;
      arm.shoulder.rotation.set((-.067+(.14+stride*.21)*w)*freeSwing-1.52*ps-.93*pl-(.68+.63*sip)*hold+.68*wind+.15*reb,-s*(.29*hold+.20*wind),s*(.139*freeSwing-.09*ps+.075*pl+.055*hold+.34*wind+.10*reb));
      arm.elbow.rotation.set((-.105-.085*w)*freeSwing-.09*ps-.73*pl-(1.26+.38*sip)*hold-1.00*wind-.96*reb,-s*(.09*freeSwing+.11*ps+.24*pl+.50*hold+.16*wind),0);
      arm.wrist.rotation.set(.02*freeSwing-1.83*ps+.43*pl+.42*hold-.92*wind-.40*reb,s*(.16*ps+.21*wind),s*.11*hold);
      if(sit){
        arm.shoulder.rotation.x+=(-.32-arm.shoulder.rotation.x)*sit;
        arm.shoulder.rotation.z+=(-s*.14-arm.shoulder.rotation.z)*sit;
        arm.elbow.rotation.x+=(-.36-arm.elbow.rotation.x)*sit;
      }
      if(rest&&s<0){
        // Lower coat pocket when standing; open hand over the thigh when seated.
        const settle=(angle,pocket,lap)=>angle+(pocket+(lap-pocket)*sit-angle)*rest;
        arm.shoulder.rotation.set(settle(arm.shoulder.rotation.x,.068,-.494),settle(arm.shoulder.rotation.y,.979,1.01),settle(arm.shoulder.rotation.z,-.35,.124));
        arm.elbow.rotation.set(settle(arm.elbow.rotation.x,-1.162,-.311),settle(arm.elbow.rotation.y,-.137,-.2),0);
        arm.wrist.rotation.set(settle(arm.wrist.rotation.x,-.035,-.212),settle(arm.wrist.rotation.y,-.138,-.002),settle(arm.wrist.rotation.z,.408,.162));
      }
      if(rest&&s>0){
        const slack=rest*(1-smoke),sway=Math.sin(.94*t);
        arm.shoulder.rotation.x-=(.151+.23*sit+.048*sway)*slack;
        arm.shoulder.rotation.z+=(.145+.081*sit+.052*sway)*slack;
        arm.elbow.rotation.x-=(.205+.25*sit+.085*exhale)*slack;
        arm.wrist.rotation.y-=(.22+.08*sway)*slack;
        arm.shoulder.position.y-=(.022+.032*exhale)*slack;
        if(sit){
          const settle=(angle,target)=>angle+(target-angle)*sit*slack;
          arm.shoulder.rotation.set(settle(arm.shoulder.rotation.x,-.496+.044*sway),settle(arm.shoulder.rotation.y,-.963),settle(arm.shoulder.rotation.z,.529+.028*sway));
          arm.elbow.rotation.set(settle(arm.elbow.rotation.x,-.996-.042*sway),settle(arm.elbow.rotation.y,.252),0);
          arm.wrist.rotation.set(settle(arm.wrist.rotation.x,.25),settle(arm.wrist.rotation.y,.019),settle(arm.wrist.rotation.z,-.596));
        }
      }
      if(smoke&&s>0){
        const towards=(at,target)=>at+(target-at)*smoke;
        arm.shoulder.rotation.set(towards(arm.shoulder.rotation.x,-1.141),towards(arm.shoulder.rotation.y,-.571),towards(arm.shoulder.rotation.z,-.137));
        arm.elbow.rotation.set(towards(arm.elbow.rotation.x,-1.718),towards(arm.elbow.rotation.y,-.044),0);
        arm.wrist.rotation.set(towards(arm.wrist.rotation.x,.468),towards(arm.wrist.rotation.y,.034),towards(arm.wrist.rotation.z,.15));
        arm.shoulder.position.x+=.033*smoke;arm.shoulder.position.y+=.055*smoke;arm.shoulder.position.z+=.072*smoke;
      }
      if(eat&&s>0){
        const lift=(at,target)=>at+(target-at)*eat;
        arm.shoulder.rotation.set(lift(arm.shoulder.rotation.x,-.94),lift(arm.shoulder.rotation.y,-.42),lift(arm.shoulder.rotation.z,.22));
        arm.elbow.rotation.set(lift(arm.elbow.rotation.x,-1.18),lift(arm.elbow.rotation.y,-.16),0);
        arm.wrist.rotation.set(lift(arm.wrist.rotation.x,-.25),lift(arm.wrist.rotation.y,.20),lift(arm.wrist.rotation.z,.18));
      }
      if(ps){
        // Let the wrists clear the shoulder silhouette from the usual rear view.
        arm.shoulder.quaternion.premultiply(outward.setFromAxisAngle(upAxis,s*.385*ps));
        localRotation.copy(body.quaternion).multiply(chest.quaternion).multiply(arm.shoulder.quaternion).multiply(arm.elbow.quaternion).invert();
        flatPalm.setFromEuler(propEuler.set(Math.PI,0,s*.15));
        arm.wrist.quaternion.slerp(localRotation.multiply(flatPalm),ps);
      }
      if(kneel){
        const mix=(current,destination)=>current+(destination-current)*kneel;
        // Lowered hands join just ahead of the lap. On each cheer beat they
        // open over the head in a V outside the cheek/hair silhouette.
        arm.shoulder.rotation.set(mix(arm.shoulder.rotation.x,-.37-.02*cheer),mix(arm.shoulder.rotation.y,-s*.1),mix(arm.shoulder.rotation.z,s*(.18+2.57*cheer)));
        arm.elbow.rotation.set(mix(arm.elbow.rotation.x,-.99+.78*cheer),mix(arm.elbow.rotation.y,-s*.13),mix(arm.elbow.rotation.z,s*(-.22+.48*cheer)));
        arm.wrist.rotation.set(mix(arm.wrist.rotation.x,-.1-.44*cheer),mix(arm.wrist.rotation.y,s*(.24+.62*cheer)),mix(arm.wrist.rotation.z,-s*.15));
      }
    }
    r.cup.visible=coff>.03;r.phone.visible=ph>.03;
    r.eomuk.visible=eat>.03;
    if(r.eomuk.visible){
      r.mouth.getWorldPosition(mouthPoint);arms[1].wrist.worldToLocal(mouthPoint);
      propDirection.copy(mouthPoint).sub(r.eomuk.position).normalize();
      r.eomuk.quaternion.setFromUnitVectors(shaftAxis,propDirection);
    }
    r.smokeProp.visible=Math.max(smoke,rest)>.03;
    if(r.smokeProp.visible){
      const wrist=arms[1].wrist;
      // The prop stays between the fingers, aimed at the corner of the mouth
      // even when the visitor turns their head during an inhale.
      r.mouth.getWorldPosition(mouthPoint);wrist.worldToLocal(mouthPoint);
      propDirection.copy(r.smokeProp.position).sub(mouthPoint).normalize();
      // Lowering the hand turns the lit end out from the coat and lap.
      localRotation.copy(body.quaternion).multiply(chest.quaternion).multiply(arms[1].shoulder.quaternion).multiply(arms[1].elbow.quaternion).multiply(wrist.quaternion).invert();
      restDirection.set(.75,.09+.09*sit,.62).normalize().applyQuaternion(localRotation);
      propDirection.lerp(restDirection,1-smoke*smoke).normalize();
      r.smokeProp.quaternion.setFromUnitVectors(shaftAxis,propDirection);
    }
    if(r.cup.visible)steadyProp(r.cup,arms[1],-.14-.20*(.5+.5*Math.sin(t*1.95))**3,.04,-.08);
    if(r.phone.visible)steadyProp(r.phone,arms[0],.36,Math.PI-.15,.07);
    cloth.update();

  }
  animate();
  return {group:G,handL:arms[0].palm,handR:arms[1].palm,cigaretteTip:r.cigaretteTip,eomuk:r.eomuk,eomukTip:r.eomukTip,mouth:r.mouth,animate,dispose:cloth?.dispose};
}

/** Build a smooth, fully rigged Korean office-worker avatar. Positive Z is
 * forward. Set walk/push/pull/coffee/phone to 0..1 and time in seconds. */
export function makeWorker(THREE,style='cardigan'){
  return performer(THREE,style==='vest'?'vest':style==='honghong'?'honghong':'cardigan','');
}
export function makeGuardian(THREE,id='poseidon'){
  const ids={poseidon:'poseidon','포세이돈':'poseidon',njord:'njord','뇨르드':'njord',yi:'yi',yisunshin:'yi','이순신':'yi',jang:'jang',jangbogo:'jang','장보고':'jang'};
  const key=ids[id]||'poseidon',model=performer(THREE,'vest',key);
  model.group.scale.setScalar(guardianScale[key]);
  // Measure once in the figure’s local frame; each plinth can then position,
  // turn, or reparent the model without special-casing its hat and staff.
  model.group.updateMatrixWorld(true);
  const box=new THREE.Box3();
  model.group.traverseVisible(node=>{
    if(!node.isMesh)return;
    if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
    box.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  const labelAnchor=new THREE.Object3D();
  labelAnchor.position.y=(box.max.y+.25)/guardianScale[key];
  model.group.add(labelAnchor);
  return {...model,id:key,height:box.max.y,labelAnchor};
}