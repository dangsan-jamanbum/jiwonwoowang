export function connectPresence({getRoom=()=>null,getPose=()=>null,onPeers=()=>{},onStatus=()=>{}}={}){
 let closed=false,seq=0;let timer=null;
 async function beat(){if(closed)return;const room=getRoom(),pose=getPose();if(!room||!pose)return;try{
 const response=await fetch('/api/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-ATD-Browser':'atd-harbor-web'},body:JSON.stringify({...room,...pose,instanceId:'atd-'+getInstance(),seq:++seq})});
 if(response.ok){const data=await response.json();onPeers(data.peers||[],data.serverTime||Date.now());onStatus({selfId:data.selfId,selfName:data.selfName,online:data.online!==false});}
 }catch{onStatus({online:false});}}
 function getInstance(){try{let id=sessionStorage.getItem('atd.instance');if(!id){id=crypto.randomUUID();sessionStorage.setItem('atd.instance',id);}return id;}catch{return 'guest';}}
 function wake(){beat();}timer=setInterval(beat,850);beat();
 return {wake,destroy(){closed=true;clearInterval(timer);},close(){closed=true;clearInterval(timer);}};
}
