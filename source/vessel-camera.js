export function makeVesselCameraGuard(THREE,hulls=[]){
 let revision=0;
 return {update(){revision++;},padding(camera){return Math.max(.22,Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*.12);},
  constrain(anchor,desired,padding,out=desired){out.copy(desired);const dx=out.x-anchor.x,dz=out.z-anchor.z;for(const h of hulls||[]){if(out.x>h.minX-padding&&out.x<h.maxX+padding&&out.z>h.minZ-padding&&out.z<h.maxZ+padding&&out.y<h.top+padding){if(Math.abs(dx)>Math.abs(dz))out.x=dx>0?h.minX-padding:h.maxX+padding;else out.z=dz>0?h.minZ-padding:h.maxZ+padding;}}return out;}
 };
}
