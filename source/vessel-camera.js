// The camera must keep its near plane on the quay side of every moving ship.
// The hull's tapered waterline supplies a convex footprint. Extending that
// footprint through the mast protects stacks, bridge and open deck spaces too.
export function makeVesselCameraGuard(THREE, {sections,levels,ships}) {
  const vector=()=>new THREE.Vector3();
  const faces=[];
  function face(x,y,z,offset) {
    const normal=new THREE.Vector3(x,y,z);
    const length=normal.length();
    faces.push({normal:normal.divideScalar(length), offset:offset/length});
  }
  const widest=Math.max(...levels.map(row=>row[1]));
  for(let i=1;i<sections.length;i++) {
    const [z0,w0]=sections[i-1], [z1,w1]=sections[i];
    const slope=(w1-w0)*widest/(z1-z0), intercept=w0*widest-slope*z0;
    face(1,0,-slope,intercept);face(-1,0,-slope,intercept);
  }
  face(0,0,-1,-sections[0][0]);face(0,0,1,sections.at(-1)[0]);
  face(0,-1,0,-Math.min(...levels.map(row=>row[0])));face(0,1,0,10.4);
  const volumes=ships.map(ship=>({ship,inverse:new THREE.Matrix4(),scale:1}));
  const a=vector(), b=vector(), from=vector(), to=vector(), hit=vector();
  const normal=vector(), tangent=vector(), offset=vector(), alternate=vector();
  const gap=.006, exteriorTrim=.085;
  function update() {
    for(const v of volumes) {
      v.ship.updateWorldMatrix(true,false);
      v.inverse.copy(v.ship.matrixWorld).invert();
      v.scale=v.ship.matrixWorld.getMaxScaleOnAxis();
    }
  }
  // Covers the furthest near-plane corner even as the phone rotates. Both
  // renderers are supported: the CPU rasterizer uses a minimum near of .075.
  function padding(camera) {
    const near=Math.max(.075,camera.near);
    const halfHeight=near*Math.tan(camera.fov*Math.PI/360)/camera.zoom;
    return Math.hypot(near,halfHeight,halfHeight*camera.aspect)+.012;
  }
  function nearestExit(point,v,pad) {
    a.copy(point).applyMatrix4(v.inverse);
    let best=-Infinity, side;
    for(const f of faces) {
      const separation=f.normal.dot(a)-f.offset-pad;
      if(separation>0)return;
      if(separation>best){best=separation;side=f;}
    }
    normal.copy(side.normal).transformDirection(v.ship.matrixWorld);
    point.addScaledVector(normal,(-best+gap)*v.scale);
  }
  function clearOrigin(origin,radius) {
    from.copy(origin);
    for(const v of volumes) if(v.ship.visible)nearestExit(from,v,radius/v.scale+exteriorTrim);
  }
  // Cyrus–Beck clipping of a swept camera sphere against each convex ship.
  function firstHit(start,end,radius) {
    let closest=Infinity,side=null,vessel=null;
    for(const v of volumes) {
      if(!v.ship.visible)continue;
      a.copy(start).applyMatrix4(v.inverse);b.copy(end).applyMatrix4(v.inverse);
      const pad=radius/v.scale+exteriorTrim;
      let enter=-1,exit=1,entryFace=null;
      for(const f of faces) {
        const s=f.normal.dot(a)-f.offset-pad, e=f.normal.dot(b)-f.offset-pad;
        if(s>0 && e>0){enter=Infinity;break;}
        if(s>0) {
          const t=s/(s-e);
          if(t>enter){enter=t;entryFace=f;}
        } else if(e>0) exit=Math.min(exit,s/(s-e));
        if(enter>exit)break;
      }
      if(entryFace && enter>=0 && enter<=exit && enter<closest) {
        closest=enter;side=entryFace;vessel=v;
      }
    }
    if(!side)return false;
    normal.copy(side.normal).transformDirection(vessel.ship.matrixWorld);
    hit.copy(start).lerp(end,closest).addScaledVector(normal,gap);
    return true;
  }
  function constrain(origin,desired,radius,out,previous,slide=false) {
    to.copy(desired);clearOrigin(origin,radius);
    if(!firstHit(from,to,radius))return out.copy(to);
    if(!slide || Math.abs(normal.y)>.7)return out.copy(hit);

    // An orbit toward the hull glides along its exterior instead of parking
    // the camera inside the avatar. The previous side stabilizes head-on turns.
    alternate.copy(to).addScaledVector(normal,offset.subVectors(hit,to).dot(normal));
    tangent.set(normal.z,0,-normal.x).normalize();
    offset.subVectors(alternate,from);
    const along=offset.dot(tangent), minSide=Math.min(3,from.distanceTo(to)*.65);
    if(Math.abs(along)<minSide) {
      const prev=previous ? offset.subVectors(previous,from).dot(tangent) : 0;
      const sign=Math.abs(along)>.9?Math.sign(along):(Math.sign(prev)||Math.sign(along)||1);
      alternate.addScaledVector(tangent,sign*minSide-along);
    }
    return out.copy(firstHit(from,alternate,radius)?hit:alternate);
  }
  update();
  return {update,padding,constrain};
}