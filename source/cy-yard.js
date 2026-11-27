// Shared by the scene, navigator and server-side presence checks. In the
// working yard, public walking space follows aisles rather than the whole slab.
export const HARBOR_BOUNDS=Object.freeze({minX:-42,maxX:31,minZ:-108.4,maxZ:55.20});
// Finished coping bounds in world coordinates, clockwise from the approach.
// Both the concrete quay and the water cutout consume these same rectangles.
export const SHRINE_QUAY=[
  [-19.575,11.775,20.125,37.3],[-34.5,23.9,37.3,50.575],
  [-34.5,-19.05,50.575,55.8],[9.1,23.9,50.575,55.8]
];
export const withinShrineQuay=(x,z)=>SHRINE_QUAY.some(([l,r,b,f])=>x>=l&&x<=r&&z>=b&&z<=f);
const WALK_AREAS=[
  [-19,11.2,-32,47.4],[-33.9,23.3,37.9,47.4],
  [-33.9,-19.65,47.2,55.20],[9.70,23.3,47.2,55.20],[-42,31,-62,-31],
  [-10.8,-3.8,-108.4,-61],[26.5,31,-105.3,-61],
  [-10.8,31,-87.4,-81.4],[-10.8,31,-105.3,-102.7],
];
export function onHarborLand(x,z,margin=0){
  return WALK_AREAS.some(([left,right,back,front])=>
    x>=left-margin && x<=right+margin && z>=back-margin && z<=front+margin);
}

// Each cell describes the boxes that are actually drawn. The camera guard
// reads their contact bounds, including the real height of each stack.
const CELL_WIDTH=2.82,CELL_LENGTH=6.13,CELL_HEIGHT=2.42,LEVEL_STEP=2.49;
function makeBlocks(){
  let state=12713;
  const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
  const blocks=[];
  function block(x,z,heading){
    const cells=[],sideways=heading!==0;
    for(let row=0;row<3;row++)for(let bay=0;bay<4;bay++){
      const dx=(row-1)*3.38,dz=(bay-1.5)*6.45;
      const count=1+Math.floor(random()*3+(row===1?.55:0));
      const paints=Array.from({length:count},()=>Math.floor(random()*8));
      cells.push({x:x+(sideways?dz:dx),z:z+(sideways?-dx:dz),paints});
    }
    blocks.push({x,z,heading,cells});
  }
  for(const x of [-63,-26,12,50])for(const z of [-72.8,-96.0])block(x,z,Math.PI/2);
  for(const side of [-1,1])for(const x of [66,86])for(const z of [-35,4,43])block(side*x+(side<0?-20:40),z,0);
  // The extra working bays live on the perimeter's landward side. The
  // rectangular public wharf remains clear from the north apron to the sea court.
  const cells=[];
  for(const x of [137.2,140.28])for(const z of [-15.9,-9.45,-3,3.45,9.9,16.35]){
    const count=1+Math.floor(random()*3);
    cells.push({x,z,paints:Array.from({length:count},()=>Math.floor(random()*8))});
  }
  blocks.push({x:138.74,z:.2,heading:0,cells,serviceBays:true});
  return blocks;
}
const BLOCKS=makeBlocks();
export const CY_STACK_BOUNDS=Object.freeze(BLOCKS.flatMap(({heading,cells})=>{
  const halfX=(heading?CELL_LENGTH:CELL_WIDTH)/2,halfZ=(heading?CELL_WIDTH:CELL_LENGTH)/2;
  return cells.map(({x,z,paints})=>Object.freeze({minX:x-halfX,maxX:x+halfX,
    minZ:z-halfZ,maxZ:z+halfZ,top:CELL_HEIGHT+(paints.length-1)*LEVEL_STEP}));
}));


export function buildContainerYard(T,kit){
  const {root,geo,meshMat,mesh,box,cyl,orb,put,beam,solid,metal,lamp,boxG,textures,sign}=kit;
  const yardDeck=meshMat({color:'#b5b8ab',roughness:.95});
  const courtDeck=meshMat({color:'#c8c5b6',roughness:.94});
  const stripMat=meshMat({color:'#80928c',roughness:.97});
  const white='#f0f3ea',line='#e4ba5c';
  function earth(x,z,w,d,mat){
    box(x,-.88,z,w,1.67,d,'#9e9988');
    box(x,-.055,z,w,.11,d,'#ffffff',mat);
  }
  // A broad, single slab joins both container walls to the central public
  // court. The short rear returns leave open water directly behind the statues.
  const quayMasonry=meshMat({color:'#b4afa1',roughness:.94});
  for(const [left,right,back,front] of SHRINE_QUAY){
    const x=(left+right)/2,z=(back+front)/2,w=right-left,d=front-back;
    box(x,-1.28,z,w,2.40,d,'#ffffff',quayMasonry);
    box(x,-.07,z,w,.14,d,'#ffffff',courtDeck);
  }
  // Reinforced pads and their casting plates are flush with the adjoining
  // apron. The pads extend past the full three-container stack on each wing.
  const padMat=meshMat({color:'#a7a59b',roughness:.95});
  for(const [left,right] of [[-29.35,-19.55],[9.45,19.25]]){
    const x=(left+right)/2,w=right-left;
    box(x,.009,47.35,w,.018,10.50,'#ffffff',padMat);
    for(const z of [42.25,47.35,52.45])box(x,.021,z,w-.19,.009,.035,'#797c77');
    for(const xx of [left+.24,right-.24])for(const z of [42.53,52.17]){
      box(xx,.025,z,.43,.019,.38,'#687773');
      box(xx,.038,z,.21,.009,.075,'#434f51');
    }
  }
  // Flush expansion joints make the breadth of the continuous apron visible.
  for(const x of [-31.45,-17.65,-9.1,-1.1,7.2,21.0]){
    box(x,.006,43.91,.032,.010,12.90,'#747a7c');
  }
  earth(-5.5,-46.75,74.25,32.66,courtDeck);
  earth(-5.0,-90.1,177,56.6,yardDeck);
  earth(119.25,-.5,59,124,yardDeck);
  earth(-99.45,-.5,58,124,yardDeck);
  // Above-ground seam joints in the apron establish scale. Inlaid strips,
  // signs and lamps stop before the front of the open guardian court.
  for(let z=22;z<31;z+=4.75)box(-11.15,.021,z,.135,.021,2.08,white);
  for(const x of [-13.65,-8.62])box(x,.017,25.45,.11,.019,10.3,white);
  for(const x of [-1.4,7.25]){box(x,.023,22.7,.17,.043,4.83,'#606a70');box(x,.049,22.7,.052,.018,4.83,'#b8c4c5');}
  for(let x=-39;x<31;x+=8)box(x,.005,-46.85,.035,.011,31.65,'#aaa99e');
  for(let z=-58.5;z<-31.5;z+=7.5)box(-5.45,.006,z,73.15,.012,.035,'#aaa99e');
  // Thin inset stone leads people around the outside of the court; the center
  // stays open for a procession without posts or overhead wires.
  for(const x of [-29,17.4]){
    box(x,.014,-46.72,3.1,.021,31.21,'#ffffff',stripMat);
    for(const side of [-1,1])box(x+side*1.55,.028,-46.72,.055,.02,31.2,line);
  }
  box(-5.45,.014,-54.7,73.1,.021,3.0,'#ffffff',stripMat);
  for(const side of [-1,1])box(-5.45,.029,-54.7+side*1.50,73.1,.02,.055,line);
  // A broad, unbroken approach ends at the four guardian plinths. Thin
  // perimeter strips frame the plaza without bisecting the congregation.
  for(const x of [-18.80,11.0])box(x,.017,28.60,.075,.021,15.90,line);
  function quayEdge(x,z,w,d){box(x,.038,z,w,.075,d,'#c8b69b');}
  for(const x of [-19.42,11.60]){
    quayEdge(x,28.68,.27,17.05);
    box(x+(x>0?-.42:.42),.02,28.68,.095,.030,17.0,'#dcc183');
    for(let z=21;z<36.9;z+=5.44){
      cyl(x+(x<0?.52:-.52),.18,z,.45,.34,.45,'#818579');
      orb(x+(x<0?.52:-.52),.41,z,.58,.22,.42,'#b27b60');
      for(const p of [-1,1])box(x,.085,z+p*.45,.25,.035,.31,'#827e6f');
    }
  }
  // Stone coping and vertical rubber fenders describe the real waterfront
  // perimeter; no rail or stripe divides either container from the plaza.
  for(const [outer,neck,inner] of [[-34.5,-19.575,-19.05],[23.9,11.775,9.1]]){
    const side=Math.sign(outer),landward=-side;
    const half=(outer+inner)/2,depth=55.8-37.3;
    quayEdge(outer+landward*.11,46.55,.30,depth);
    quayEdge((outer+neck)/2,37.38,Math.abs(outer-neck),.24);
    quayEdge(half,55.69,Math.abs(outer-inner),.30);
    quayEdge(inner+side*.11,53.2,.25,5.21);
    box(outer+landward*.52,.022,46.55,.10,.018,depth-.7,'#d8af68');
    box(half,.022,55.26,Math.abs(outer-inner)-.80,.018,.10,'#d8af68');
    for(const z of [39.1,43.9,48.7,53.5]){
      box(outer,-.63,z,.28,1.16,.86,'#535957',metal);
      box(outer+side*.16,-.54,z,.05,.29,.52,'#69706e',metal);
    }
  }
  quayEdge(-4.975,50.48,28.15,.30);
  for(const [x,d] of [[-42.48,32.4],[31.49,32.4]])quayEdge(x,-46.64,.28,d);
  quayEdge(-31.1,-30.64,22.55,.27);quayEdge(21.51,-30.64,19.82,.27);
  function narrowLamp(x,z){
    cyl(x,2.02,z,.14,4.05,.14,'#74868a');cyl(x,.15,z,.34,.30,.34,'#8e9990');
    box(x,4.11,z,.54,.10,.37,'#6d7a7e');orb(x,4.01,z,.38,.22,.29,'#ffdda0',lamp);
  }
  for(const [x,z] of [[-18.65,25.2],[10.72,35.1],[-41.5,-39.1],[-41.5,-56],[30.45,-39.3],[30.45,-56.2]])narrowLamp(x,z);
  // Fabricate a shared texture atlas per container color. A rack remains one
  // twelve-triangle box even when its pressed-steel sides and doors are seen.
  const colors=['#a85444','#b64437','#227d85','#376d95','#4b6281','#c69557','#ded6bd','#497e62'];
  const shell=geo(boxG.clone()),uv=shell.attributes.uv;
  for(let f=0;f<6;f++)for(let j=0;j<4;j++){
    const n=f*4+j,u=uv.getX(n),v=uv.getY(n);
    // Side x faces run down the long axis, z faces are the narrow doors.
    const region=f<2?[0,0]:f<4?[0,1]:[1,0];
    uv.setXY(n,(region[0]+.02+u*.96)/2,(1-region[1]+.02+v*.96)/2);
  }
  function atlas(color){
    const c=document.createElement('canvas');c.width=256;c.height=128;
    const d=c.getContext('2d');d.fillStyle=color;d.fillRect(0,0,256,128);
    for(let x=5;x<126;x+=6){
      d.fillStyle='rgba(26,43,47,.20)';d.fillRect(x,6,1.5,52);
      d.fillStyle='rgba(255,246,216,.17)';d.fillRect(x+1.8,6,1,52);
    }
    d.fillStyle='rgba(42,52,53,.28)';d.fillRect(0,0,256,3.2);d.fillRect(0,60.8,256,3.2);
    for(const x of [1,123,129,190,251])d.fillRect(x,1,3,62);
    d.fillStyle='rgba(249,239,209,.55)';for(const x of [151,172,211,232])d.fillRect(x,6,1.7,51);
    d.fillStyle='rgba(250,244,224,.65)';d.fillRect(12,12,17,1.7);d.fillRect(12,15,10,1.1);d.fillRect(234,14,10,2);
    for(let x=4;x<254;x+=8){d.fillStyle='rgba(84,96,97,.24)';d.fillRect(x,68,1.4,55);}
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=2;textures.push(tex);
    return meshMat({map:tex,roughness:.88});
  }
  const paint=colors.map(atlas);
  const industrialSigns=[];
  BLOCKS.forEach(({x,z,heading,cells,serviceBays},index)=>{
    for(const cell of cells){
      cell.paints.forEach((p,l)=>{
        put(shell,cell.x,CELL_HEIGHT/2+l*LEVEL_STEP,cell.z,CELL_WIDTH,CELL_HEIGHT,CELL_LENGTH,'#ffffff',paint[p],root,0,heading);
      });
    }
    if(serviceBays)return;
    for(const dir of [-1,1]){
      const offset=dir*1.75*3.38;
      box(x+Math.cos(heading)*offset,.022,z-Math.sin(heading)*offset,.10,.025,4*6.45+1.7,'#dad2af',solid,root,0,heading);
    }
    if(index%4===0)industrialSigns.push({x,z:z+4.5,mark:String(index+1).padStart(2,'0')});
  });
  for(const {x,z,mark} of industrialSigns){
    // Physical row plates face the public side of the yard.
    box(x,1.1,z+4.8,.11,2.2,.11,'#717f79');
    sign(mark,x,2.0,z+4.92,1.42,.60,'#415864','#eee4c6');
  }
  for(const z of [-82.8,-106.4]){
    box(-4,.014,z,165,.025,.12,white);
    for(let x=-81;x<79;x+=7.5)box(x,.020,z+2.95,3.0,.025,.11,'#d7c9a6');
  }
  for(const side of [-1,1]){
    const shift=side<0?-20:40,x=side*53.55+shift;
    box(x,.05,-.5,.15,.09,116,'#6f7370');box(x+side*7.2,.05,-.5,.15,.09,116,'#6f7370');
    box(side*50.2+shift,.065,-.65,.34,.12,117,'#c4b092');
  }

  // Two small chevrons at each junction, flush with the existing CY paint.
  for(const x of [-7.3,28.7])for(const z of [-64,-84.4,-104]){
    const forward=x<0?-1:1;
    for(const side of [-1,1])box(x+side*.17,.021,z,.055,.018,.51,line,solid,root,0,-side*forward*.7);
  }

  // Ship-to-shore cranes stand on the remote berth rails. Each has two portal
  // frames, a cross travel beam, a high apex, and a water-side outreach boom.
  function dockCrane(x,z,outward,accent,lift=0,openPortal=false){
    const local=(u,y,v)=>[x+u*outward,y,z+v];
    const B=(u,y,v,w,h,d,col)=>box(...local(u,y,v),w,h,d,col,metal);
    const R=(a,b,r,col)=>beam(local(...a),local(...b),r,col,root,metal);
    const lg='#e8b45f';
    for(const v of [-3.85,3.85]){
      for(const u of [-5.3,3.35]){
        B(u,.46,v,.86,.85,1.96,'#5d6969');
        R([u,1,v],[u+(u<0?.72:-.68),14.6,v],.31,accent);
      }
      B(-.90,14.64,v,10.1,.66,.49,accent);
      if(openPortal){
        R([-4.65,10.8,v],[-2.8,14.48,v],.16,accent);
        R([2.97,10.8,v],[1.05,14.48,v],.16,accent);
      }else{
        R([-5.12,1.44,v],[2.65,13.9,v],.135,accent);
        R([2.95,1.34,v],[-4.34,13.87,v],.135,accent);
      }
      R([-3.65,14.92,v],[-1.24,26.1,v],.29,accent);
      R([2.46,14.92,v],[-1.24,26.1,v],.29,accent);
      B(.35,15.91,v,17.02,.42,.45,accent);
      for(let n=0;n<8;n++){
        const a=-8+n*2.18;
        R([a,15.92,v],[a+1.08,17.42,v],.079,lg);R([a+1.08,17.42,v],[a+2.15,15.92,v],.079,lg);
      }
      B(.52,17.43,v,17.34,.20,.26,lg);
      const tip=lift?24:29,tipH=lift?29.9:16.30;
      R([8.95,15.94,v],[tip,tipH,v],.17,accent);
      R([8.95,17.41,v],[tip,tipH+1.17,v],.14,accent);
      for(let n=0;n<6;n++){
        const a=n/6,b=(n+.48)/6,c=(n+1)/6;
        const p=t=>[8.95+(tip-8.95)*t,15.94+(tipH-15.94)*t,v];
        const A=p(a),M=p(b),C=p(c);M[1]+=1.22;
        R(A,M,.065,lg);R(M,C,.065,lg);
      }
      R([-1.24,26.0,v],[tip-1.1,tipH+.9,v],.078,lg);R([-1.24,26,v],[-8.1,16.14,v],.085,lg);
    }
    for(const u of [-5.28,3.27])B(u,14.4,0,.5,.55,8.4,accent);
    B(-1.22,26.05,0,.49,.39,8.36,accent);
    B(-5.1,17.1,0,4.25,2.4,5.6,'#bfbdad');B(-5.12,18.38,0,4.55,.18,5.85,lg);
    B(3.02,15.15,-2.63,1.34,1.35,1.54,'#e4d2ae');
    B(3.70,15.2,-2.63,.07,.72,1.21,'#587b88');
    if(!lift){
      for(const v of [-.62,.62])R([14.1,15.75,v],[14.1,10.8,v],.032,'#879695');
      B(14.1,10.65,0,2.43,.34,4.08,'#a79b82');
    }
    orb(...local(-1.22,26.48,-3.85),.22,.24,.22,'#eba082',lamp);
  }
  // The near quay's long rail line carries two amber ship-to-shore cranes.
  // Their working booms extend over the water, perpendicular to the berth.
  dockCrane(24,-45,1,'#dd993c',0,true);
  dockCrane(24,-57.6,1,'#dca247',1,true);
  dockCrane(-76.4,51,1,'#d39b47',1,true);
  for(const x of [18.7,27.35]){
    box(x,.026,-46.8,.17,.047,31.15,'#697479');
    box(x,.057,-46.8,.05,.019,31.15,'#c1c8c8');
  }
  for(const z of [-38,-8,22,48])dockCrane(96.2,z,-1,'#c18748',z===22);
  for(const z of [-35,-4,27])dockCrane(-76.4,z,1,'#c88645',z===-35);
  // Smaller silhouettes on the next terminal beyond the northern stacks give
  // depth above the skyline while the entire court remains beneath open sky.
  for(const [x,z] of [[-48,-104],[13,-111],[59,-105]])dockCrane(x,z,x>0?1:-1,'#b78e67',x===13);
  // Only two parked terminal tractors and a reach stacker occupy this
  // service strip in the far corner; public walking paths remain clear.
  function tractor(x,z,v){
    box(x,.58,z,1.75,.48,3.0,'#606d70');box(x,1.37,z+.75,1.65,1.48,1.37,v);
    box(x,1.68,z+1.46,1.36,.67,.06,'#637f87');box(x,.80,z-1.20,1.63,.38,1.18,'#939c90');
    for(const side of [-1,1])for(const dz of [-.88,.91])cyl(x+side*.86,.40,z+dz,.78,.26,.78,'#49555a',solid,root,0,0,Math.PI/2);
  }
  tractor(-73.5,-82.3,'#b1a88a');tractor(-78.4,-82.3,'#9faba0');
  tractor(-82.9,-77.2,'#ac846d');beam([-82.9,.88,-76.95],[-82.9,4.75,-70.9],.28,'#957865');
  box(-82.9,4.56,-70.9,4.02,.44,.58,'#716f68');

  const dayA=new T.Color('#8d9395'),nightA=new T.Color('#46515a');
  const dayB=new T.Color('#8a9094'),nightB=new T.Color('#45525e');
  const dayS=new T.Color('#7e898c'),nightS=new T.Color('#4a5861');
  let previous=-1;
  return function updateYard(night){
    if(Math.abs(previous-night)<.001)return;previous=night;
    quayMasonry.color.set(night>.45?'#797d78':'#b4afa1');padMat.color.set(night>.45?'#69716f':'#a7a59b');
    yardDeck.color.copy(dayA).lerp(nightA,night);courtDeck.color.copy(dayB).lerp(nightB,night);stripMat.color.copy(dayS).lerp(nightS,night);
  };
}