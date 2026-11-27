export function mountHarborChat(root,{api=async()=>({}),onMessage=()=>{}}={}){
 const form=root.querySelector('form'),input=form?.querySelector('input'),button=form?.querySelector('button'),status=root.querySelector('[role=status]');let terminal='busan',after=0,closed=false;
 async function poll(){if(closed)return;try{const r=await api('chat?terminal='+encodeURIComponent(terminal)+'&after='+after);for(const m of r.messages||[]){after=Math.max(after,Number(m.id)||after);onMessage(m,false);}}catch{}}
 const timer=setInterval(poll,3500);form?.addEventListener('submit',async e=>{e.preventDefault();const value=input.value.trim();if(!value)return;button.disabled=true;try{await api('chat',{terminal,text:value,requestId:crypto.randomUUID()});input.value='';if(status)status.textContent='전송했어요.';poll();}catch(err){if(status)status.textContent=err.message;}finally{button.disabled=false;}});
 return {setTerminal(v){terminal=v||'busan';after=0;poll();},destroy(){closed=true;clearInterval(timer);}};
}
