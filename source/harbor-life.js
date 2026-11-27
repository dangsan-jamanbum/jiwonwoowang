export function buildHarborLife(T,scene){
 const water=new T.MeshStandardMaterial({color:0x367e91,roughness:.3,metalness:.12}),body=new T.Mesh(new T.SphereGeometry(.72,16,10),water),fin=new T.Mesh(new T.ConeGeometry(.35,.8,8),water);
 const shark=new T.Group();body.scale.set(1.9,.55,.72);shark.add(body);fin.position.y=.65;shark.add(fin);shark.position.set(8,-.35,-27);scene.add(shark);
 const approach={x:-32,z:-1,yaw:0},sharkWatch={x:8,z:-26,radius:12,yaw:0};
 return {approach,sharkWatch,blocks(x,z){return Math.hypot(x-sharkWatch.x,z-sharkWatch.z)<1.4;},update(t){shark.position.x=8+Math.sin(t*.45)*3;shark.position.z=-27+Math.cos(t*.3)*1.8;shark.rotation.y=Math.sin(t*.45)*.5;},destroy(){scene.remove(shark);}};
}
