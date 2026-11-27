export function buildGuardianCourt(T,scene){
 const mat=new T.MeshStandardMaterial({color:0xc4b89c,roughness:.9}),gold=new T.MeshStandardMaterial({color:0xc49b50,metalness:.35,roughness:.55});
 const center={x:-25,y:0,z:10},base=new T.Mesh(new T.CylinderGeometry(5.5,6.2,.45,12),mat);base.position.set(center.x,.22,center.z);base.receiveShadow=true;scene.add(base);
 const spots=[{id:'guardian-east',x:-20.4,y:.45,z:10,yaw:-Math.PI/2,front:{x:-1,z:0},approach:{x:-22.3,z:10}},{id:'guardian-west',x:-29.6,y:.45,z:10,yaw:Math.PI/2,front:{x:1,z:0},approach:{x:-27.7,z:10}}];
 for(const s of spots){const p=new T.Mesh(new T.CylinderGeometry(.65,.8,1.4,10),gold);p.position.set(s.x,s.y+.7,s.z);scene.add(p);const head=new T.Mesh(new T.SphereGeometry(.48,12,10),mat);head.position.set(s.x,s.y+1.55,s.z);scene.add(head);}
 const wishEntries={left:{x:-27.8,z:13,radius:2.3},right:{x:-22.2,z:13,radius:2.3}};
 return {spots,wishEntries,blocks(x,z){return Math.hypot(x-center.x,z-center.z)<2.1;},update(){},destroy(){},setWishes(){}};
}
