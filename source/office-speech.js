// Screen-space text stays readable even when the 3D scene uses a reduced-size
// canvas renderer. Only its anchor is projected into the scene.
export function mountOfficeSpeech(THREE,layer,anchor){
  const point=new THREE.Vector3(),tags=new Map();
  const stack=document.createElement('div');
  stack.className='harbor-office-speech';
  stack.style.cssText='position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:3px;width:max-content;max-width:min(82%,19rem);pointer-events:none;visibility:hidden;';
  layer.append(stack);
  function paint(camera,player,width,height,messages=[]){
    const expected=new Set(messages.map(m=>m.id));
    for(const [id,tag] of tags)if(!expected.has(id)){tag.remove();tags.delete(id);}
    for(const message of messages){
      let tag=tags.get(message.id);
      if(!tag){
        tag=document.createElement('div');tag.className='harbor-office-bubble';
        tag.style.cssText='box-sizing:border-box;width:max-content;max-width:100%;padding:5px 9px;border:1px solid #a58c73;border-radius:12px 12px 12px 4px;background:#fff9edfa;color:#263a45;box-shadow:0 2px 7px #19303833;font:650 13px/1.35 system-ui,sans-serif;text-align:center;overflow-wrap:anywhere;';
        tag.textContent=message.text;stack.append(tag);tags.set(message.id,tag);
      }
      tag.style.opacity=String(message.opacity??1);
    }
    const target=anchor();
    let visible=messages.length>0&&Boolean(target?.parent)&&width>0&&height>0;
    if(visible){
      target.getWorldPosition(point);point.y+=.70;
      visible=point.distanceToSquared(player)<22*22;point.project(camera);
      visible=visible&&point.z>=-1&&point.z<1&&Math.abs(point.x)<1.1&&Math.abs(point.y)<1.1;
    }
    stack.style.visibility=visible?'visible':'hidden';
    if(!visible)return;
    const half=stack.offsetWidth/2,tall=stack.offsetHeight;
    const x=Math.max(half+8,Math.min(width-half-8,(1+point.x)*width/2));
    const y=Math.max(Math.min(tall+8,height-8),Math.min(height-8,(1-point.y)*height/2));
    stack.style.transform='translate('+Math.round(x)+'px,'+Math.round(y)+'px) translate(-50%,-100%)';
  }
  return {paint,dispose(){stack.remove();tags.clear();}};
}