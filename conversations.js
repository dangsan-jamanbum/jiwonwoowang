export function mountConversations(root,{getState=()=>({}),onOpen=()=>{},onClose=()=>{}}={}){
 const host=root;let open=false;
 function show(zone,options){open=true;host.innerHTML='<div class="atd-conversation" role="dialog"><p>'+({shrine:'수호자와 기원',yard:'컨테이너 야드',office:'출항 공표소',eomuk:'부산 어묵',shark:'북항이'}[zone]||zone)+'</p><button type="button" data-close>닫기</button></div>';host.querySelector('[data-close]').onclick=()=>{host.replaceChildren();open=false;onClose();};}
 return {open:show,close(){host.replaceChildren();open=false;onClose();},destroy(){host.replaceChildren();}};
}
