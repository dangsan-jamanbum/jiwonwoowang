export function buildDepartureOffice(T,scene,options={}){
 const approach={x:-2,z:12,yaw:0},group=new T.Group(),wall=new T.MeshStandardMaterial({color:0xe0d7c4}),glass=new T.MeshStandardMaterial({color:0x5c8990,transparent:true,opacity:.72});
 const b=new T.Mesh(new T.BoxGeometry(5,3.4,4),wall);b.position.set(-2,1.7,17);group.add(b);
 const w=new T.Mesh(new T.BoxGeometry(2.6,1.45,.08),glass);w.position.set(-2,2.2,14.96);group.add(w);scene.add(group);
 let calls=[],terminal='pnc',speech=null;
 return {approach,blocks(x,z){return x>-4.7&&x<.7&&z>14.7&&z<19.2;},mountSpeech(root){speech=document.createElement('div');speech.className='harbor-office-speech';speech.style.cssText='position:absolute;left:0;top:0;display:none;padding:8px 12px;border-radius:12px;background:#fff8e8;color:#263e46;font:600 12px system-ui;';root.append(speech);},paintSpeech(camera,player,width,height){if(!speech)return;speech.style.display=Math.hypot(player.x-approach.x,player.z-approach.z)<8?'block':'none';speech.textContent='출항 안내 · 부산항';speech.style.transform='translate('+width*.5+'px,'+height*.22+'px) translate(-50%,-100%)';},setDepartures(v,t){calls=Array.isArray(v)?v:[];terminal=t||terminal;},replay(){if(!calls.length)return false;options.onAnnouncement?.({call:calls[0]});return true;},update(){},dispose(){scene.remove(group);speech?.remove();}};
}
