// Lightweight fallback renderer for environments where WebGL is unavailable.
export class CanvasHarborRenderer{
 constructor(){const c=document.createElement('canvas');this.domElement=c;this.ctx=c.getContext('2d');this.toneMappingExposure=1;this.shadowMap={enabled:false};}
 setPixelRatio(){} setSize(w,h){this.domElement.width=w;this.domElement.height=h;}
 render(scene,camera){const c=this.ctx,w=this.domElement.width,h=this.domElement.height;c.fillStyle='#9cc7cb';c.fillRect(0,0,w,h);c.fillStyle='#477c89';c.fillRect(0,h*.56,w,h*.44);c.fillStyle='#a1a9a2';c.fillRect(0,h*.7,w,h*.3);c.fillStyle='#d6d0bd';c.font='bold 18px sans-serif';c.fillText('ATD · 3D 항구 대체 렌더링',20,34);}
 dispose(){}
}
