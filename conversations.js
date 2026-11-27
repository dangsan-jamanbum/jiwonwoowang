export function mountConversations(root,{getState=()=>({}),onOpen=()=>{},onClose=()=>{}}={}){
 let current=null;
 function show(zone,options){current=zone;root.innerHTML='<div class="atd-conversation" role="dialog" aria-modal="true"><p>'+({shrine:'수호자와 기원',yard:'컨테이너 야드',office:'출항 공표소',eomuk:'부산 어묵',shark:'북항이'}[zone]||zone)+'</p><button type="button" data-close>닫기</button></div>';root.querySelector('[data-close]').onclick=hide;onOpen(zone,options);}
 function hide(){if(!current)return;current=null;root.replaceChildren();onClose();}
 return {show,hide,close:hide,get isOpen(){return !!current;},destroy:hide};
}
