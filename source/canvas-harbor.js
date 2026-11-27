/* Perspective software renderer for devices that deny a WebGL context.
   It rasterizes the same Three scene and articulated meshes into a color and
   reciprocal-depth buffer. It never substitutes a backdrop for a 3D view. */
import {Matrix4,SphereGeometry,CylinderGeometry,ConeGeometry,TorusGeometry} from './vendor/three.module.js';
const clamp=(a,l,h)=>Math.max(l,Math.min(h,a));
const toByte=Array.from({length:4097},(_,i)=>Math.round(255*(i/4096<=.0031308?12.92*i/4096:1.055*(i/4096)**(1/2.4)-.055)));
const srgb=x=>toByte[clamp((x*4096)|0,0,4096)];
const rgb=(r,g,b)=>0xff000000|(clamp(b,0,255)<<16)|(clamp(g,0,255)<<8)|clamp(r,0,255);
const geoCache=new WeakMap(),materialMaps=new WeakMap(),replacements=new WeakMap();
function textureData(tex){
  if(!tex?.image)return null;let cached=materialMaps.get(tex);
  if(cached?.version===tex.version)return cached;
  const cv=tex.image;if(!cv.width||!cv.height)return null;
  try{
    const fit=tex.userData?.harborDisplay?Math.min(1,1024/cv.width,512/cv.height):tex.userData?.harborPaving?Math.min(1,768/cv.width,1152/cv.height):Math.min(1,512/cv.width,256/cv.height);let source=cv;
    if(!cv.getContext||fit<1){source=document.createElement('canvas');source.width=Math.max(1,Math.round(cv.width*fit));source.height=Math.max(1,Math.round(cv.height*fit));source.getContext('2d').drawImage(cv,0,0,source.width,source.height);}
    const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
    cached={buf:new Uint32Array(pixels.buffer,pixels.byteOffset,pixels.length/4),w:source.width,h:source.height,version:tex.version};materialMaps.set(tex,cached);return cached;
  }catch{return null;}
}
function coarse(g){
  if(replacements.has(g))return replacements.get(g);
  let other=g;const a=g.parameters||{};
  if(g.type==='SphereGeometry')other=new SphereGeometry(a.radius,7,5);
  if(g.type==='CylinderGeometry'&&a.radialSegments>6)other=new CylinderGeometry(a.radiusTop,a.radiusBottom,a.height,7,a.heightSegments,a.openEnded);
  if(g.type==='ConeGeometry'&&a.radialSegments>7)other=new ConeGeometry(a.radius,a.height,7);
  if(g.type==='TorusGeometry')other=new TorusGeometry(a.radius,a.tube,5,10);
  replacements.set(g,other);return other;
}
/* Rigid cloth, hair, and props have close-spaced vertices from their modeling
   meshes. Clustering only within a color preserves the face, badge and ID. */
function geometry(g,quality=0){
  if(!geoCache.has(g))geoCache.set(g,[]);
  const list=geoCache.get(g);if(list[quality])return list[quality];
  const p=g.attributes.position, n=g.attributes.normal, color=g.attributes.color, uv=g.attributes.uv;
  const raw=p.array, inds=g.index?.array||Uint32Array.from({length:p.count},(_,k)=>k);
  let data={p:raw,n:n?.array,col:color?.array,uv:uv?.array,tri:inds};
  if(quality&&color&&p.count>110){
    if(!g.boundingBox)g.computeBoundingBox();const bounds=g.boundingBox,bb=bounds.min;
    const maxExtent=Math.max(bounds.max.x-bb.x,bounds.max.y-bb.y,bounds.max.z-bb.z,.02), step=maxExtent/(quality===1?22:quality===2?13:7);
    const buckets=new Map(),mp=new Uint32Array(p.count),vp=[],vn=[],vc=[],ns=[];
    for(let i=0,k=0;i<p.count;i++,k+=3){
      const x=Math.round((raw[k]-bb.x)/step),y=Math.round((raw[k+1]-bb.y)/step),z=Math.round((raw[k+2]-bb.z)/step);
      const key=(x*64+y)*64+z+':'+Math.round(color.array[k]*510)+','+Math.round(color.array[k+1]*510)+','+Math.round(color.array[k+2]*510);
      let id=buckets.get(key);if(id===undefined){id=ns.length;buckets.set(key,id);ns.push(0);vp.push(0,0,0);vn.push(0,0,0);vc.push(color.array[k],color.array[k+1],color.array[k+2]);}mp[i]=id;
      ns[id]++;for(let j=0;j<3;j++){vp[id*3+j]+=raw[k+j];vn[id*3+j]+=n.array[k+j];}
    }
    for(let i=0;i<ns.length;i++){const k=i*3,l=Math.hypot(vn[k],vn[k+1],vn[k+2])||1;for(let j=0;j<3;j++){vp[k+j]/=ns[i];vn[k+j]/=l;}}
    const ix=[],seen=new Set();for(let i=0;i<inds.length;i+=3){const a=mp[inds[i]],b=mp[inds[i+1]],c=mp[inds[i+2]];if(a===b||a===c||b===c)continue;const code=(a*8192+b)*8192+c;
      if(!seen.has(code)){seen.add(code);ix.push(a,b,c);}}
    data={p:new Float32Array(vp),n:new Float32Array(vn),col:new Float32Array(vc),uv:null,tri:new Uint32Array(ix)};
  }
  const cnt=data.p.length/3;
  for(const k of ['cx','cy','cz','px','py','inv','red','green','blue'])data[k]=new Float32Array(cnt);
  list[quality]=data;return data;
}

export class CanvasHarborRenderer {
  constructor(){
    this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d',{alpha:false,desynchronized:true});
    if(!this.ctx)throw Error('Canvas 2D unavailable');
    this.shadowMap={enabled:false};this.isCanvasHarborRenderer=true;
    this.w=0;this.h=0;this.cssW=0;this.cssH=0;this.quality=1;this.limit=800;this.last=-10000;this.avg=32;this.samples=0;
    this.vw=new Matrix4();this.mw=new Matrix4();this.im=new Matrix4();
    this.transparent=[];this.extras=[];this._counts={instances:0,triangles:0};
  }
  setPixelRatio(v){this.ratio=clamp(Number(v)||1,.5,1.4);}
  setSize(width,height,updateStyle=true){
    this.cssW=Math.max(1,Math.round(width));this.cssH=Math.max(1,Math.round(height));this.allocate();
    if(updateStyle){this.domElement.style.width=width+'px';this.domElement.style.height=height+'px';}
  }
  allocate(){
    const scale=Math.min(this.ratio||1,Math.min(this.limit/Math.max(this.cssW,this.cssH),Math.sqrt(350000/(this.cssW*this.cssH))));
    this.w=Math.max(1,Math.round(this.cssW*scale));this.h=Math.max(1,Math.round(this.cssH*scale));
    this.domElement.width=this.w;this.domElement.height=this.h;
    this.frame=this.ctx.createImageData(this.w,this.h);this.out=new Uint32Array(this.frame.data.buffer);this.depth=new Float32Array(this.w*this.h);
  }
  dispose(){this.frame=this.depth=this.out=null;this.transparent.length=this.extras.length=0;}
  render(scene,camera){
    if(!this.out)return;const start=performance.now();if(start-this.last<30)return;this.last=start;
    scene.updateMatrixWorld();camera.updateMatrixWorld();this.view=camera.matrixWorldInverse;
    const pm=camera.projectionMatrix.elements;
    this.fx=pm[0]*this.w*.5;this.fy=pm[5]*this.h*.5;this.ox=this.w*.5*(1-pm[8]);this.oy=this.h*.5*(1+pm[9]);this.near=Math.max(.075,camera.near);this.far=camera.far;
    const sky=scene.background, fog=scene.fog;
    this.fogRGB=fog?[srgb(fog.color.r),srgb(fog.color.g),srgb(fog.color.b)]:[190,213,211];
    this.fogNear=fog?.near??65;this.fogInv=1/((fog?.far??170)-this.fogNear);
    const skyR=srgb(sky?.r??.53),skyG=srgb(sky?.g??.75),skyB=srgb(sky?.b??.82);
    this.night=scene.userData.atdSky?.night??clamp((188-skyR)/65,0,1);
    for(let y=0;y<this.h;y++){const f=Math.min(1,y/(this.h*.70));this.out.fill(rgb(skyR+7*f-(8+12*this.night)*(1-f),skyG+5*f-(4+12*this.night)*(1-f),skyB+f),y*this.w,(y+1)*this.w);}
    this.depth.fill(0);this.transparent.length=this.extras.length=0;this._counts={instances:0,triangles:0};
    scene.traverseVisible(o=>{
      if(o.isMesh&&o.geometry?.attributes.position && !Array.isArray(o.material) && o.material.visible!==false){
        if(o.material.transparent){if(o.material.opacity>.009)this.transparent.push(o);}else this.drawObject(o);
      }else if(o.isLine||o.isPoints||o.isSprite)this.extras.push(o);
    });
    for(const o of this.transparent)this.drawObject(o);
    this.ctx.putImageData(this.frame,0,0);this.overlays();
    const elapsed=performance.now()-start;this.avg=this.avg*.89+elapsed*.11;this.samples++;
    if(this.samples>22&&this.samples%30===0&&this.avg>48&&this.limit>480){this.limit=Math.max(480,this.limit-96);this.allocate();}
  }
  drawObject(o){
    const g=o.geometry;if(!g.boundingSphere)g.computeBoundingSphere();const bounds=g.boundingSphere;
    if(o.isInstancedMesh){
      const color=o.instanceColor?.array;
      for(let i=0;i<o.count;i++){
        this.im.fromArray(o.instanceMatrix.array,i*16);this.mw.multiplyMatrices(o.matrixWorld,this.im);
        this.drawMesh(g,bounds,this.mw,o.material,color,i*3,true);
      }
    }else this.drawMesh(g,bounds,o.matrixWorld,o.material,null,0,false);
  }
  drawMesh(g,bs,world,mat,instance,colorOffset,instanced){
    this.vw.multiplyMatrices(this.view,world);const m=this.vw.elements,t=world.elements;
    const bx=bs.center.x,by=bs.center.y,bz=bs.center.z;
    const xx=m[0]*bx+m[4]*by+m[8]*bz+m[12],yy=m[1]*bx+m[5]*by+m[9]*bz+m[13],zz=-(m[2]*bx+m[6]*by+m[10]*bz+m[14]);
    const normX=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],normY=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],normZ=t[8]*t[8]+t[9]*t[9]+t[10]*t[10], radius=bs.radius*Math.sqrt(Math.max(normX,normY,normZ));
    if(zz+radius<this.near||zz-radius>this.far)return;
    const d=Math.max(zz,0);
    if((xx-radius)*this.fx>(this.w-this.ox)*(d+radius)||(-xx-radius)*this.fx>this.ox*(d+radius)||(yy-radius)*this.fy>this.oy*(d+radius)||(-yy-radius)*this.fy>(this.h-this.oy)*(d+radius))return;
    const projected=radius*this.fy/Math.max(.10,zz);
    if(projected<.68)return;
    // The cluster mesh drops UVs. Preserve the carving and grain on stone faces.
    const litStone=mat.map?.userData?.harborLitStone===true;
    const cluster=g.attributes.color && !g.userData.preserveTopology && !litStone?(projected<13?3:projected<43?2:1):0;
    const shape=geometry(instanced&&projected<140?coarse(g):g,cluster);
    const {p,n,col,cx,cy,cz,px,py,inv,red,green,blue}=shape,tris=shape.tri;
    const cr=mat.color.r*(instance?instance[colorOffset]:1),cg=mat.color.g*(instance?instance[colorOffset+1]:1),cb=mat.color.b*(instance?instance[colorOffset+2]:1);
    const singleR=srgb(cr),singleG=srgb(cg),singleB=srgb(cb);
    const ambient=mat.isMeshBasicMaterial?1:.73-.14*this.night,sun=mat.isMeshBasicMaterial?0:.36-.03*this.night;
    // Transform light direction to local coordinates; reciprocal axis scale
    // accounts for elongated beams, oval trees and flattened ripples.
    const nx=Math.sqrt(normX)||1,ny=Math.sqrt(normY)||1,nz=Math.sqrt(normZ)||1;
    const lx=(-.41*t[0]+.79*t[1]+.45*t[2])/nx,ly=(-.41*t[4]+.79*t[5]+.45*t[6])/ny,lz=(-.41*t[8]+.79*t[9]+.45*t[10])/nz;
    const emission=mat.emissiveIntensity>0&&mat.emissive?(mat.emissive.r+mat.emissive.g+mat.emissive.b)*mat.emissiveIntensity*.042:0;
    const fogR=this.fogRGB[0],fogG=this.fogRGB[1],fogB=this.fogRGB[2],texture=textureData(mat.map);
    const invX=1/nx,invY=1/ny,invZ=1/nz;
    for(let i=0,j=0;j<p.length;i++,j+=3){
      const x=p[j],y=p[j+1],z=p[j+2],vx=m[0]*x+m[4]*y+m[8]*z+m[12],vy=m[1]*x+m[5]*y+m[9]*z+m[13],vz=-(m[2]*x+m[6]*y+m[10]*z+m[14]);
      cx[i]=vx;cy[i]=vy;cz[i]=vz;const rz=vz>0?1/vz:0;inv[i]=rz;px[i]=this.ox+vx*this.fx*rz;py[i]=this.oy-vy*this.fy*rz;
      let light=ambient+emission;
      if(n&&sun){const a=n[j]*invX,b=n[j+1]*invY,c=n[j+2]*invZ;const den=Math.sqrt(a*a+b*b+c*c)||1;light+=sun*Math.max(0,(a*lx+b*ly+c*lz)/den);}
      const fog=clamp((vz-this.fogNear)*this.fogInv,0,.89);const lit=light*(1-fog);
      red[i]=(col?srgb(cr*col[j]):singleR)*lit+fogR*fog;green[i]=(col?srgb(cg*col[j+1]):singleG)*lit+fogG*fog;blue[i]=(col?srgb(cb*col[j+2]):singleB)*lit+fogB*fog;
    }
    this._counts.instances++;
    this.tex=texture;this.litStone=litStone;this.alpha=mat.opacity??1;this.writeDepth=mat.depthWrite!==false;this.bias=mat.polygonOffset?0.00014:0;
    for(let t=0;t<tris.length;t+=3){
      const a=tris[t],b=tris[t+1],c=tris[t+2],za=cz[a],zb=cz[b],zc=cz[c];
      if(Math.max(za,zb,zc)<this.near||Math.min(za,zb,zc)>this.far)continue;
      const tint=rgb((red[a]+red[b]+red[c])*.3333,(green[a]+green[b]+green[c])*.3333,(blue[a]+blue[b]+blue[c])*.3333);
      if(Math.min(za,zb,zc)<this.near){this.clipped(shape,a,b,c,tint,mat.side);continue;}
      const xa=px[a],xb=px[b],xc=px[c],ya=py[a],yb=py[b],yc=py[c];
      if((xa<0&&xb<0&&xc<0)||(xa>this.w&&xb>this.w&&xc>this.w)||(ya<0&&yb<0&&yc<0)||(ya>this.h&&yb>this.h&&yc>this.h))continue;
      const A=(xb-xa)*(yc-ya)-(yb-ya)*(xc-xa);
      if(Math.abs(A)<.10||(mat.side===0&&A>0)||(mat.side===1&&A<0))continue;
      this.fill(xa,ya,inv[a],xb,yb,inv[b],xc,yc,inv[c],tint,shape.uv,a,b,c);
    }
  }
  clipped(s,a,b,c,tint,side){
    const points=[a,b,c].map(i=>[s.cx[i],s.cy[i],s.cz[i],s.uv?.[i*2]||0,s.uv?.[i*2+1]||0]),out=[];
    for(let i=0;i<3;i++){
      const p=points[i],q=points[(i+1)%3],pin=p[2]>=this.near,qin=q[2]>=this.near;
      if(pin)out.push(p);
      if(pin!==qin){const t=(this.near-p[2])/(q[2]-p[2]);out.push(p.map((val,k)=>val+(q[k]-val)*t));}
    }
    if(out.length<3)return;
    const v=out.map(([x,y,z,u,k])=>[this.ox+this.fx*x/z,this.oy-this.fy*y/z,1/z,u,k]);
    const uv=v.flatMap(p=>p.slice(3));
    for(let i=1;i+1<v.length;i++){const [p,q,r]=[v[0],v[i],v[i+1]],area=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
      if((side===0&&area>0)||(side===1&&area<0))continue;
      this.fill(p[0],p[1],p[2],q[0],q[1],q[2],r[0],r[1],r[2],tint,uv,0,i,i+1);}
  }
  fill(xa,ya,za,xb,yb,zb,xc,yc,zc,tint,uv,ia,ib,ic){
    const w=this.w,h=this.h,out=this.out,depth=this.depth;
    const det=(xb-xa)*(yc-ya)-(xc-xa)*(yb-ya);
    if(!Number.isFinite(det)||Math.abs(det)<.095)return;
    const zdx=((zb-za)*(yc-ya)-(zc-za)*(yb-ya))/det,zdy=((xb-xa)*(zc-za)-(xc-xa)*(zb-za))/det;
    const tex=this.tex,opacity=this.alpha,opaque=!tex&&opacity>.998,write=this.writeDepth;
    const shadeStone=tex&&this.litStone;
    const lightR=(tint&255)/255,lightG=((tint>>>8)&255)/255,lightB=((tint>>>16)&255)/255;
    let u0=0,v0=0,udx=0,udy=0,vdx=0,vdy=0;
    if(tex&&uv){
      u0=uv[ia*2]*za;v0=uv[ia*2+1]*za;
      const ub=uv[ib*2]*zb-u0,uc=uv[ic*2]*zc-u0,vb=uv[ib*2+1]*zb-v0,vc=uv[ic*2+1]*zc-v0;
      udx=(ub*(yc-ya)-uc*(yb-ya))/det;udy=((xb-xa)*uc-(xc-xa)*ub)/det;
      vdx=(vb*(yc-ya)-vc*(yb-ya))/det;vdy=((xb-xa)*vc-(xc-xa)*vb)/det;
    }
    let topX=xa,topY=ya,midX=xb,midY=yb,botX=xc,botY=yc,swap;
    if(topY>midY){swap=topY;topY=midY;midY=swap;swap=topX;topX=midX;midX=swap;}
    if(midY>botY){swap=botY;botY=midY;midY=swap;swap=botX;botX=midX;midX=swap;}
    if(topY>midY){swap=topY;topY=midY;midY=swap;swap=topX;topX=midX;midX=swap;}
    const long=(botX-topX)/(botY-topY||1),upper=(midX-topX)/(midY-topY||1),lower=(botX-midX)/(botY-midY||1);
    const first=Math.max(0,Math.ceil(topY-.5)),last=Math.min(h,Math.ceil(botY-.5));
    if(first>=last)return;this._counts.triangles++;
    const eps=this.bias+(tex&&!write?.000009:0);
    for(let y=first;y<last;y++){
      const sy=y+.5,e1=topX+(sy-topY)*long,e2=sy<midY?topX+(sy-topY)*upper:midX+(sy-midY)*lower;
      const left=Math.max(0,Math.ceil(Math.min(e1,e2)-.5)),right=Math.min(w,Math.ceil(Math.max(e1,e2)-.5));
      if(left>=right)continue;
      const dx=left+.5-xa,dy=sy-ya;
      let iz=za+dx*zdx+dy*zdy;
      let px=y*w+left;const end=y*w+right;
      if(opaque&&write){
        for(;px<end;px++,iz+=zdx){if(iz+eps>depth[px]){depth[px]=iz;out[px]=tint;}}continue;
      }
      let u=u0+dx*udx+dy*udy,v=v0+dx*vdx+dy*vdy;
      for(;px<end;px++,iz+=zdx,u+=udx,v+=vdx){
        if(iz+eps<=depth[px])continue;
        let ink=tint,a=opacity;
        if(tex){
          const tx=clamp((u/iz*(tex.w-1)+.5)|0,0,tex.w-1), ty=clamp(((1-v/iz)*(tex.h-1)+.5)|0,0,tex.h-1);
          ink=tex.buf[ty*tex.w+tx];a*=((ink>>>24)&255)/255;
          if(shadeStone)ink=rgb((ink&255)*lightR,((ink>>>8)&255)*lightG,((ink>>>16)&255)*lightB);
        }
        if(a<.02)continue;
        if(write)depth[px]=iz;
        if(a>.99){out[px]=ink|0xff000000;continue;}
        const back=out[px],q=1-a;
        out[px]=0xff000000|((((ink>>>16)&255)*a+((back>>>16)&255)*q)<<16)|((((ink>>>8)&255)*a+((back>>>8)&255)*q)<<8)|(((ink&255)*a+(back&255)*q)|0);
      }
    }
  }
  project(x,y,z,m){
    const vx=m[0]*x+m[4]*y+m[8]*z+m[12],vy=m[1]*x+m[5]*y+m[9]*z+m[13],vz=-(m[2]*x+m[6]*y+m[10]*z+m[14]);
    if(vz<this.near||vz>this.far)return null;return [this.ox+vx*this.fx/vz,this.oy-vy*this.fy/vz,vz];
  }
  overlays(){
    const ctx=this.ctx;ctx.save();
    for(const o of this.extras){
      const m=this.vw.multiplyMatrices(this.view,o.matrixWorld).elements,mat=o.material;
      ctx.globalAlpha=mat.opacity??1;
      if(o.isSprite){
        const p=this.project(0,0,0,m),im=mat.map?.image;if(!p||!im)continue;
        const wi=Math.abs(o.scale.x*this.fx/p[2]),he=Math.abs(o.scale.y*this.fy/p[2]);ctx.drawImage(im,p[0]-wi*.5,p[1]-he*.5,wi,he);continue;
      }
      const a=o.geometry.attributes.position.array,s=mat.color;ctx.fillStyle=ctx.strokeStyle='rgb('+srgb(s.r)+','+srgb(s.g)+','+srgb(s.b)+')';
      ctx.lineWidth=1.4;ctx.beginPath();let cont=false;
      for(let i=0;i<a.length;i+=3){
        const p=this.project(a[i],a[i+1],a[i+2],m);if(!p||p[0]<0||p[0]>=this.w||p[1]<0||p[1]>=this.h){cont=false;continue;}
        const behind=1/p[2]+.00025<this.depth[(p[1]|0)*this.w+(p[0]|0)];
        if(behind){cont=false;continue;}
        if(o.isPoints){const sz=clamp((mat.size||.06)*this.fy/p[2],.65,4);ctx.fillRect(p[0],p[1],sz,sz);continue;}
        if(cont)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);cont=true;
      }
      if(o.isLine)ctx.stroke();
    }
    ctx.restore();
  }
}