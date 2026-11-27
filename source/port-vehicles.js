// Lightweight yard vehicles for the original 3D harbor scene.
export function buildPortVehicles(T,scene){
  const root=new T.Group();root.name='항만 작업 차량';scene.add(root);
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
  function box(parent,mat,x,y,z,w,h,d){const m=new T.Mesh(unit,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function wheel(parent,x,y,z){const m=new T.Mesh(wheelGeo,materials.rubber);m.position.set(x,y,z);m.rotation.z=Math.PI/2;m.castShadow=true;parent.add(m);return m;}
  const forklift=new T.Group();root.add(forklift);
  box(forklift,materials.yellow,0,.72,0,1.25,.48,1.95);
  box(forklift,materials.dark,0,1.04,-.38,1.08,.12,.70);
  box(forklift,materials.glass,0,1.55,-.42,.88,.82,.78);
  box(forklift,materials.yellow,0,2.01,-.42,1.02,.12,.92);
  for(const x of [-.47,.47])for(const z of [-.72,.68])wheel(forklift,x,.38,z);
  for(const x of [-.43,.43]){
    box(forklift,materials.steel,x,.98,.91,.10,1.9,.12);
    box(forklift,materials.steel,x,.12,1.36,.12,.10,1.05);
  }
  box(forklift,materials.yellow,0,1.04,1.02,1.06,.12,.18);
  box(forklift,materials.dark,0,.31,1.48,.10,.10,1.02);
  box(forklift,materials.light,-.42,.88,-1.0,.16,.12,.06);
  box(forklift,materials.light,.42,.88,-1.0,.16,.12,.06);
  const carrier=new T.Group();root.add(carrier);
  box(carrier,materials.red,0,2.05,0,3.15,.28,5.2);
  box(carrier,materials.dark,0,1.85,0,2.45,.10,4.55);
  for(const x of [-1.36,1.36])for(const z of [-2.15,2.15]){
    box(carrier,materials.red,x,1.25,z,.28,2.35,.32);
    wheel(carrier,x*1.06,.38,z);
    box(carrier,materials.light,x,1.55,z+(z>0?.18:-.18),.10,.10,.08);
  }
  box(carrier,materials.steel,0,1.63,0,2.35,.12,4.4);
  const suspended=box(carrier,materials.yellow,0,1.04,0,2.05,.94,3.75);
  for(let x=-.8;x<=.8;x+=1.6)for(let z=-1.35;z<=1.35;z+=2.7)
    box(carrier,materials.dark,x,1.50,z,.08,.9,.08);
  function update(time=0){
    const t=Number(time)||0;
    const fx=-13+Math.sin(t*.29)*5.2,fz=-53+Math.sin(t*.58)*1.4;
    forklift.position.set(fx,0,fz);
    forklift.rotation.y=Math.atan2(Math.cos(t*.29)*5.2,Math.cos(t*.58)*1.4);
    const a=t*.19;
    carrier.position.set(2.2+Math.sin(a)*5.2,0,-56+Math.cos(a)*3.1);
    carrier.rotation.y=Math.atan2(Math.cos(a)*5.2,-Math.sin(a)*3.1);
    suspended.position.y=1.04+.05*Math.sin(t*1.2);
  }
  function blocks(x,z){
    const f=forklift.position,c=carrier.position;
    return Math.hypot(x-f.x,z-f.z)<1.18 || (Math.abs(x-c.x)<2.05&&Math.abs(z-c.z)<3.05);
  }
  update(0);
  return {update,blocks,destroy(){scene.remove(root);}};
}
