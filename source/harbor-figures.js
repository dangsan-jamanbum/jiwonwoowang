import * as T from './vendor/three.module.js';
const mat=(c,rough=.78)=>new T.MeshStandardMaterial({color:c,roughness:rough});
function part(g,geo,m,x,y,z){const o=new T.Mesh(geo,m);o.position.set(x,y,z);g.add(o);return o;}
export function makeWorker(THREE=T,style='cardigan'){return makePerson(THREE,style,false);}
export function makeGuardian(THREE=T,id='guardian'){return makePerson(THREE,id,true);}
function makePerson(T,style,guardian){
 const group=new T.Group(),skin=mat(0xe8b995),dark=mat(0x263b45),shirt=mat(guardian?0xe7d9b8:style==='vest'?0x526d79:0x78959a),pants=mat(0x344957),hair=mat(0x292b2d),shoe=mat(0x29343a);
 const body=part(group,new T.CapsuleGeometry(.29,.58,4,8),shirt,0,1.03,0);body.scale.set(.78,1,0.48);
 const head=part(group,new T.SphereGeometry(.235,16,12),skin,0,1.78,0);
 part(group,new T.SphereGeometry(.245,14,10),hair,0,1.91,-.035).scale.set(1,.55,1);
 const legL=part(group,new T.CapsuleGeometry(.105,.48,3,7),pants,-.12,.48,0);
 const legR=part(group,new T.CapsuleGeometry(.105,.48,3,7),pants,.12,.48,0);
 const armL=part(group,new T.CapsuleGeometry(.075,.48,3,7),shirt,-.31,1.16,0);
 const armR=part(group,new T.CapsuleGeometry(.075,.48,3,7),shirt,.31,1.16,0);
 const handR=new T.Object3D();handR.position.set(.34,.88,.02);group.add(handR);
 const labelAnchor=new T.Object3D();labelAnchor.position.y=2.02;group.add(labelAnchor);
 const mouth=new T.Object3D();mouth.position.set(0,1.72,.21);group.add(mouth);
 const cigaretteTip=new T.Object3D();cigaretteTip.position.set(.4,.94,.12);group.add(cigaretteTip);
 const shade=new T.Object3D();
 function animate(o={}){
  const t=o.time||0,w=o.walk||0,p=o.walkPhase||0;
  legL.rotation.x=Math.sin(p)*.62*w;legR.rotation.x=-Math.sin(p)*.62*w;
  armL.rotation.x=-Math.sin(p)*.45*w;armR.rotation.x=Math.sin(p)*.45*w;
  group.position.y=Math.sin(p*2)*.035*w;
  if(o.sit){legL.rotation.x=-.9*o.sit;legR.rotation.x=-.9*o.sit;}
  armR.rotation.x-=((o.push||0)*.75+(o.pull||0)*.55+(o.smoke||0)*.9+(o.eat||0)*.65);
  armL.rotation.x+=(o.coffee||0)*.5+(o.phone||0)*.35;
  body.rotation.z=(o.recoil||0)*.08;
  head.rotation.y=Math.sin(t*.55)*.035;
 }
 return {group,handR,labelAnchor,mouth,cigaretteTip,shade,animate,dispose(){},vapor:null};
}
