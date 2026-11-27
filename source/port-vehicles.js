// Six enlarged forklifts and six container carriers patrol the working harbor.
export function buildPortVehicles(T,scene){
  const root=new T.Group();root.name='항만 작업 차량 12대';scene.add(root);
  const materials={
    yellow:new T.MeshStandardMaterial({color:'#e5a52d',roughness:.72}),
    dark:new T.MeshStandardMaterial({color:'#27383d',roughness:.86}),
    glass:new T.MeshStandardMaterial({color:'#86b8c0',metalness:.22,roughness:.24,transparent:true,opacity:.72}),
    steel:new T.MeshStandardMaterial({color:'#69777a',metalness:.58,roughness:.52}),
    red:new T.MeshStandardMaterial({color:'#b64e3f',roughness:.76}),
    rubber:new T.MeshStandardMaterial({color:'#202629',roughness:.98}),
    light:new T.MeshStandardMaterial({color:'#f4d77a',emissive:'#f4b947',emissiveIntensity:.45})
  };
  const unit=new T.BoxGeometry(1,1,1),wheelGeo=new T.CylinderGeometry(.34,.34,.20,16);
  function box(parent,mat,x,y,z,w,h,d){
    const m=new T.Mesh(unit,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function wheel(parent,x,y,z){
    const m=new T.Mesh(wheelGeo,materials.rubber);m.position.set(x,y,z);m.rotation.z=Math.PI/2;m.castShadow=true;parent.add(m);return m;
  }
  function makeForklift(){
    const g=new T.Group();root.add(g);
    box(g,materials.yellow,0,.72,0,1.25,.48,1.95);
    box(g,materials.dark,0,1.04,-.38,1.08,.12,.70);
    box(g,materials.glass,0,1.55,-.42,.88,.82,.78);
    box(g,materials.yellow,0,2.01,-.42,1.02,.12,.92);
    for(const x of [-.47,.47])for(const z of [-.72,.68])wheel(g,x,.38,z);
    for(const x of [-.43,.43]){
      box(g,materials.steel,x,.98,.91,.10,1.9,.12);
      box(g,materials.steel,x,.12,1.36,.12,.10,1.05);
    }
    box(g,materials.yellow,0,1.04,1.02,1.06,.12,.18);
    box(g,materials.dark,0,.31,1.48,.10,.10,1.02);
    box(g,materials.light,-.42,.88,-1.0,.16,.12,.06);
    box(g,materials.light,.42,.88,-1.0,.16,.12,.06);
    g.scale.setScalar(1.28);return g;
  }
  function makeCarrier(){
    const g=new T.Group();root.add(g);
    box(g,materials.red,0,2.05,0,3.15,.28,5.2);
    box(g,materials.dark,0,1.85,0,2.45,.10,4.55);
    for(const x of [-1.36,1.36])for(const z of [-2.15,2.15]){
      box(g,materials.red,x,1.25,z,.28,2.35,.32);
      wheel(g,x*1.06,.38,z);
      box(g,materials.light,x,1.55,z+(z>0?.18:-.18),.10,.10,.08);
    }
    box(g,materials.steel,0,1.63,0,2.35,.12,4.4);
    const suspended=box(g,materials.yellow,0,1.04,0,2.05,.94,3.75);
    for(let x=-.8;x<=.8;x+=1.6)for(let z=-1.35;z<=1.35;z+=2.7)
      box(g,materials.dark,x,1.50,z,.08,.9,.08);
    g.scale.setScalar(1.22);return {group:g,suspended};
  }
  const forkliftRoutes=[
    {x:-31,z:-42,rx:4.5,rz:2.5,speed:.23,phase:0},
    {x:-7,z:-42,rx:4.5,rz:2.5,speed:.21,phase:1.4},
    {x:18,z:-42,rx:4.5,rz:2.5,speed:.22,phase:2.8},
    {x:-7.2,z:-72.5,rx:1.0,rz:5.5,speed:.18,phase:.6},
    {x:28.5,z:-72.5,rx:1.0,rz:5.5,speed:.17,phase:2.1},
    {x:10,z:-84.4,rx:8.0,rz:.8,speed:.16,phase:4.0}
  ];
  const carrierRoutes=[
    {x:-31,z:-54.5,rx:4,rz:.8,speed:.14,phase:1.0},
    {x:-7,z:-54.5,rx:4,rz:.8,speed:.15,phase:2.5},
    {x:18,z:-54.5,rx:4,rz:.8,speed:.14,phase:4.0},
    {x:-7.2,z:-94,rx:.8,rz:6,speed:.12,phase:.2},
    {x:28.5,z:-94,rx:.8,rz:6,speed:.13,phase:2.2},
    {x:10,z:-104,rx:8,rz:.55,speed:.11,phase:4.3}
  ];
  const forklifts=forkliftRoutes.map(()=>makeForklift());
  const carriers=carrierRoutes.map(()=>makeCarrier());
  function pose(group,route,t){
    const a=t*route.speed+route.phase;
    group.position.set(route.x+Math.sin(a)*route.rx,0,route.z+Math.cos(a)*route.rz);
    group.rotation.y=Math.atan2(Math.cos(a)*route.rx,-Math.sin(a)*route.rz||.0001);
    return a;
  }
  function update(time=0){
    const t=Number(time)||0;
    forklifts.forEach((g,i)=>pose(g,forkliftRoutes[i],t));
    carriers.forEach(({group,suspended},i)=>{
      pose(group,carrierRoutes[i],t);
      suspended.position.y=1.04+.07*Math.sin(t*1.1+i);
    });
  }
  function blocks(x,z){
    for(const g of forklifts){
      const dx=x-g.position.x,dz=z-g.position.z,c=Math.cos(g.rotation.y),s=Math.sin(g.rotation.y);
      if(Math.abs(dx*c-dz*s)<1.20&&Math.abs(dx*s+dz*c)<1.70)return true;
    }
    for(const {group:g} of carriers){
      const dx=x-g.position.x,dz=z-g.position.z,c=Math.cos(g.rotation.y),s=Math.sin(g.rotation.y);
      if(Math.abs(dx*c-dz*s)<2.45&&Math.abs(dx*s+dz*c)<3.75)return true;
    }
    return false;
  }
  update(0);
  return {update,blocks,destroy(){scene.remove(root);unit.dispose();wheelGeo.dispose();Object.values(materials).forEach(m=>m.dispose());}};
}
