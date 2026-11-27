export function crewIdentity(style){return {department:'영업지원팀',name:'최대리',style:style==='vest'?'vest':'cardigan'};}
export function crewPortrait(style){return './crew-cardigan-face.webp';}
export function editCrewProfile(root,{getProfile=()=>({}),save=async()=>{},done=()=>{},showError=()=>{}}={}){
 const p=getProfile()||{};root.innerHTML='<label>이름 <input id="crew-name" maxlength="16"></label><label>복장 <select id="crew-style"><option value="cardigan">가디건</option><option value="vest">조끼</option></select></label><button id="crew-save">저장</button>';
 root.querySelector('#crew-name').value=p.name||'최대리';root.querySelector('#crew-style').value=p.style||'cardigan';
 root.querySelector('#crew-save').onclick=async()=>{try{await save({name:root.querySelector('#crew-name').value,style:root.querySelector('#crew-style').value});done();}catch(e){showError(e.message);}};
 return ()=>{};
}
