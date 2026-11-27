import * as T from './vendor/three.module.js';
const material=(c,r=.82)=>new T.MeshStandardMaterial({color:c,roughness:r});
function box(scene,w,h,d,x,y,z,m){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
function cylinder(scene,r1,r2,h,x,y,z,m){const o=new T.Mesh(new T.CylinderGeometry(r1,r2,h,12),m);o.position.set(x,y,z);o.castShadow=true;scene.add(o);return o;}
export function buildHarbor(THREE,scene){
 const concrete=material(0x899b9b),edge=material(0x526c73),water=material(0x28677a,.28),yellow=material(0xe5b64d),red=material(0xb65b4a),blue=material(0x466d83),white=material(0xd7d8cf),dark=material(0x253b45);
 const ground=box(scene,94,.8,92,0,-.48,-5,concrete);ground.receiveShadow=true;
 const sea=box(scene,62,.18,78,43,-.38,-4,water);
 box(scene,34,.55,8,13,-.1,-3,edge);
 for(let i=0;i<9;i++){box(scene,4.2,2.5,2.8,-11+(i%3)*4.8,1.25,-16+Math.floor(i/3)*4.2,i%2?red:blue);box(scene,4.2,2.5,2.8,9+(i%3)*4.8,1.25,-16+Math.floor(i/3)*4.2,i%2?yellow:blue);}
 // quay rails, bollards and container handling cranes
 for(let x=-4;x<34;x+=8){cylinder(scene,.24,.24,.65,x,.28,1.2,dark);box(scene,.12,.12,2,x,.72,1.2,yellow);}
 for(const x of [-7,19]){
  box(scene,.55,13,.65,x,6.5,-8,yellow);box(scene,14,.5,.65,x+6.7,12.7,-8,yellow);box(scene,.35,5,.45,x+13,10,-8,dark);
  box(scene,1.1,.8,1.1,x+9,10.1,-8,dark);
 }
 // Vessel with hull, deck, bridge, hatch covers and mast.
 const hullMat=material(0x263f4d),deckMat=material(0x9caaa7),hull=box(scene,18,2.3,5.6,15,.25,-2,hullMat);
 hull.rotation.z=-.035;
 box(scene,15,.32,5.25,15,1.52,-2,deckMat);
 for(let i=0;i<4;i++)for(let j=0;j<2;j++)box(scene,3.25,1.45,2.25,9+i*4,2.38,-3.25+j*2.5,[red,blue,yellow][(i+j)%3]);
 box(scene,3.2,3.2,4.2,22,3.5,-2,white);box(scene,2.8,.2,3.5,22,5.2,-2,blue);
 cylinder(scene,.12,.12,3,23,6.7,-2,dark);
 const arrival=box(scene,15,1.7,4.6,37,.15,-4,hullMat);arrival.userData.vessel='arrival';
 box(scene,12,.3,4.3,37,1.15,-4,deckMat);
 for(let i=0;i<3;i++)box(scene,3,1.3,2,33+i*3.7,1.9,-4,[blue,red,yellow][i]);
 const mainShip=hull;
 const zones={
  departure:{x:15,z:4,radius:3.8,yaw:Math.PI,anchor:{x:6,y:1.1,z:-2},},
  arrival:{x:37,z:-4,radius:4.8,yaw:-Math.PI/2,anchor:{x:29,y:1.1,z:-4}},
  shrine:{x:-25,z:10,radius:10,yaw:.15},
  control:{x:0,z:16,radius:5,yaw:0},
  smoking:{x:-28,z:-5,radius:3.5,yaw:0},
  yard:{x:-8,z:-10,radius:7,yaw:Math.PI/2}
 };
 // Wharf office and board markers
 box(scene,5,3.5,4,-2,1.75,17,white);box(scene,5.2,.35,4.2,-2,3.65,17,blue);
 for(let i=0;i<5;i++)box(scene,2.4,2.4,2.4,-29+(i%2)*3,1.2,-5+Math.floor(i/2)*3,i%2?red:blue);
 // lamp posts
 for(const [x,z] of [[-19,6],[-4,8],[28,8],[4,-21]]){cylinder(scene,.12,.16,5,x,2.5,z,dark);const lamp=new T.PointLight(0xffd49a,1.2,9);lamp.position.set(x,5,z);scene.add(lamp);box(scene,.65,.15,.65,x,5,z,yellow);}
 const seats=Array.from({length:3},(_,i)=>({id:'quay-seat-'+i,x:-19+i*2.2,z:8,y:.48,yaw:Math.PI/2,approach:{x:-19+i*2.2,z:9.1}}));
 const worldBounds={minX:-43,maxX:48,minZ:-37,maxZ:35};
 const canWalk=(x,z)=>x>worldBounds.minX&&x<worldBounds.maxX&&z>worldBounds.minZ&&z<worldBounds.maxZ&&!(x>7&&x<25&&z>-5&&z<1)&&!(x>28&&x<45&&z>-8&&z<0)&&!(x>-14&&x<-1&&z>-19&&z<3);
 const collisionHullSpec=[{minX:5,maxX:25,minZ:-5,maxZ:1,top:7},{minX:28,maxX:45,minZ:-8,maxZ:0,top:5}];
 const spawn={x:5,z:8,yaw:2.2};
 let selected=null;
 return {zones,mainShip,arrivalShip:arrival,worldBounds,collisionHullSpec,spawn,seats,
  canWalk,groundHeight:()=>0,
  getRopeAnchor(out){return out.set(29,1.1,-4);},
  bindVessels(v){selected=v?.departure||null;mainShip.userData.call=selected;arrival.userData.call=v?.arrival||null;},
  destroy(){},get selected(){return selected;}
 };
}
