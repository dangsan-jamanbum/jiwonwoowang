export const PALM_CONTACTS=[.38,.92,1.48];
export const PALM_DURATION=1.92;
export function palmPose(age){
 const pulse=(t)=>Math.max(0,1-Math.abs(age-t)/.22);
 const push=Math.max(pulse(.38),pulse(.92),pulse(1.48));
 return {push,backswing:Math.max(0,Math.sin(Math.PI*Math.max(0,Math.min(1,age/.38)))),recoil:pulse(1.48)};
}
