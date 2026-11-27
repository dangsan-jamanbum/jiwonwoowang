export const CHEER_PEAKS=[.38,1.02,1.72,2.48,3.18];
export const CHEER_DURATION=3.85;
export function cheerPose(age){const p=Math.max(0,Math.sin(Math.PI*Math.max(0,Math.min(1,age/3.7))));return {cheer:p,arms:p};}
export function mountCheers(T,labels){
 const active=[];
 return {say(id,anchor,message){const el=document.createElement('div');el.textContent=String(message).slice(0,80);el.style.cssText='position:absolute;padding:5px 9px;border-radius:12px;background:#fff8e8;color:#29434b;font:600 12px system-ui;';labels.append(el);active.push({el,anchor,until:performance.now()+3200});},
 exclaim(id,anchor,call,beat,at){if(beat===0)this.say(id,anchor,(call?.name||'우리 배')+' 무사 출항!');},
 paint(camera,player,w,h){const now=performance.now();for(let i=active.length-1;i>=0;i--){const a=active[i];if(now>a.until){a.el.remove();active.splice(i,1);continue;}const g=typeof a.anchor==='function'?a.anchor():null;if(!g)continue;const p=g.position.clone();p.y+=2.5;p.project(camera);a.el.style.transform='translate('+((p.x+1)*w/2)+'px,'+((1-p.y)*h/2)+'px) translate(-50%,-100%)';}},
 clear(){for(const a of active)a.el.remove();active.length=0;}
 };
}
