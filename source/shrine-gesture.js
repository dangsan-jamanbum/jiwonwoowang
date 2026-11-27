// Each of the three raised-arm peaks belongs to the same recorded cheer.
export const CHEER_PEAKS = [.93, 1.95, 2.97];
export const CHEER_DURATION = 3.86;
const sat=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=sat(x);return x*x*(3-2*x);};

export function cheerPose(age) {
  const kneel=smooth(age/.40)*(1-smooth((age-3.45)/.41));
  let raise=0;
  for(const peak of CHEER_PEAKS) {
    const incoming=smooth((age-peak+.39)/.39);
    const outgoing=1-smooth((age-peak-.10)/.34);
    raise=Math.max(raise,incoming*outgoing);
  }
  return {prayKneel:kneel,prayRaise:raise};
}

// A message starts its reading time on the first frame in which its speaker
// is visible. Keep unresolved speakers through one full presence timeout.
export const CHAT_VISIBLE_MS=5600;
const PRESENCE_TIMEOUT_MS=22000;

export function mountCheers(THREE,layer,clock=()=>performance.now()) {
  const speakers=new Map(),point=new THREE.Vector3();
  function node(className,style) {
    const tag=document.createElement('div');
    tag.className=className;tag.style.cssText=style;return tag;
  }
  function speaker(key,anchor) {
    let row=speakers.get(key);
    if(!row){
      const tag=node('harbor-speech-stack','position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:4px;width:max-content;max-width:min(82%,21rem);pointer-events:none;');
      // visibility keeps a newly inserted stack measurable without painting
      // it at (0,0) while its speaker's position is still in transit.
      tag.style.visibility='hidden';layer.append(tag);
      row={tag,anchor,messages:[],ritual:null};speakers.set(key,row);
    }
    return row;
  }
  function prune(row,now,sceneTime) {
    row.messages=row.messages.filter(m=>{
      const until=m.shownAt===null?m.created+PRESENCE_TIMEOUT_MS:m.shownAt+CHAT_VISIBLE_MS;
      if(now<until)return true;
      m.tag.remove();return false;
    });
    if(row.ritual && sceneTime>=row.ritual.until){
      row.ritual.tag.remove();
      row.ritual=null;
    }
  }
  function say(key,anchor,message) {
    const words=String(message??'').trim().replace(/\s+/g,' ');
    if(!key||!words)return false;
    const row=speaker(key,anchor),now=clock();
    prune(row,now,-Infinity);
    const tag=node('harbor-chat-bubble','box-sizing:border-box;max-width:100%;width:max-content;padding:6px 11px;border:1px solid #a8b3b0;border-radius:13px 13px 13px 4px;color:#23383e;background:#fffffcfa;box-shadow:0 2px 6px #19303829;font:600 clamp(12px,1.3vw,15px)/1.43 system-ui;text-align:left;overflow-wrap:anywhere;');
    tag.textContent=words;
    if(row.ritual)row.tag.insertBefore(tag,row.ritual.tag);
    else row.tag.append(tag);
    row.messages.push({tag,created:now,shownAt:null});return true;
  }
  function acclamation(text,beat) {
    const intro=beat===0;
    const style='box-sizing:border-box;width:max-content;max-width:100%;border:1px solid #a4bdb5;border-radius:13px 13px 13px 4px;box-shadow:0 1px 3px #25453924;text-align:center;overflow-wrap:anywhere;';
    const tag=node('harbor-ritual-bubble',style+(intro
      ? 'padding:4px 9px;background:#fff8e4;color:#415449;font:700 12px/1.3 system-ui;'
      : 'padding:4px 7px;background:#f3fff7;color:#28584e;font:750 13px/1.2 system-ui;'));
    tag.dataset.beat=String(beat);
    tag.textContent=text;
    if(!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
      tag.animate?.([{opacity:.45,transform:'translateY(3px) scale(.92)'},{opacity:1,transform:'none'}],{duration:140,easing:'ease-out'});
    }
    return tag;
  }
  function exclaim(key,anchor,call,beat,sceneTime) {
    if(!key||!call?.name||!Number.isInteger(beat)||beat<0||beat>3||!Number.isFinite(sceneTime))return;
    const row=speaker(key,anchor);
    prune(row,clock(),sceneTime);
    if(beat===0 || !row.ritual){
      if(beat===0 && row.ritual?.call===call && row.ritual.lastBeat===0)return;
      row.ritual?.tag.remove();
      const tag=node('harbor-ritual','display:flex;flex-direction:column;align-items:center;max-width:min(100%,17rem);gap:5px;');
      const responses=node('harbor-ritual-responses','display:flex;align-items:center;justify-content:center;gap:6px;');
      const vessel=[call.name,call.voy].filter(Boolean).join(' ');
      tag.append(acclamation(vessel,0),responses);
      row.tag.append(tag);
      row.ritual={tag,responses,call,lastBeat:0,until:sceneTime+CHEER_DURATION};
    }
    const ritual=row.ritual;
    if(beat<=ritual.lastBeat)return;
    ritual.responses.append(acclamation(call.direction==='import'?'입항!':'출항!',beat));
    ritual.lastBeat=beat;
    ritual.until=Math.max(ritual.until,sceneTime+1.42);
  }
  function paint(camera,player,w,h,sceneTime,local) {
    const now=clock();
    for(const [key,row] of speakers){
      prune(row,now,sceneTime);
      if(!row.messages.length&&!row.ritual){row.tag.remove();speakers.delete(key);continue;}
      const person=row.anchor();
      let x,y,visible=Boolean(person?.parent);
      if(visible){
        point.copy(person.position);point.y+=person===local?2.75:2.99;
        visible=point.distanceToSquared(player)<35*35;
        point.project(camera);
        visible=visible&&point.z>=-1&&point.z<1&&Math.abs(point.x)<1.05&&Math.abs(point.y)<1.05;
        x=(1+point.x)*w/2;y=(1-point.y)*h/2;
      }
      row.tag.style.visibility=visible?'visible':'hidden';
      if(!visible)continue;
      // Flex lays out wrapped messages at their actual height. Clamp the
      // complete stack to the viewport when a speaker is near an edge.
      const half=row.tag.offsetWidth/2, tall=row.tag.offsetHeight;
      x=Math.max(half+6,Math.min(w-half-6,x));
      y=Math.max(Math.min(tall+8,h-8),Math.min(h-8,y));
      row.tag.style.transform='translate('+Math.round(x)+'px,'+Math.round(y)+'px) translate(-50%,-100%)';
      for(const m of row.messages)if(m.shownAt===null)m.shownAt=now;
    }
  }
  function clear(){for(const row of speakers.values())row.tag.remove();speakers.clear();}
  return {exclaim,say,paint,clear};
}