export function connectPresence({getRoom=()=>null,getPose=()=>null,onUpdate=()=>{},onStatus=()=>{}}={}){
 let closed=false,seq=0,timer=null,last=0;
 async function beat(){if(closed)return;const room=getRoom(),pose=getPose();if(!room||!pose)return;try{const r=await fetch('/api/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-ATD-Browser':'atd-harbor-web'},body:JSON.stringify({...room,...pose,instanceId:'web-'+(sessionStorage.getItem('atd.instance')||(sessionStorage.setItem('atd.instance',crypto.randomUUID()),sessionStorage.getItem('atd.instance'))),seq:++seq})});if(r.ok){const data=await r.json();onUpdate(data);onStatus(true);}}catch{onStatus(false);}}
 function wake(){beat();}timer=setInterval(beat,700);beat();
 return {wake,destroy(){closed=true;clearInterval(timer);},close(){closed=true;clearInterval(timer);}};
}
