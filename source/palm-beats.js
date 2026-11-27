/** Two distinct open-palm contacts in one communal push. The timestamps also
 * drive the ship, splash, sound and gesture labels in the shared scene. */
export const PALM_DURATION=1.06;
export const PALM_CONTACTS=Object.freeze([.30,.74]);
const keys=[
  // Seconds, forward reach, backswing, body recoil
  [0,0,0,0],[.14,0,1,0],[.201,.10,.74,0],
  [.30,1,0,0],[.327,1,0,0],[.424,.13,.09,.88],
  [.551,0,.98,.20],[.615,.08,.78,0],
  [.74,1,0,0],[.768,1,0,0],[.870,.20,.03,1],
  [.98,0,0,.28],[PALM_DURATION,0,0,0]
];
const smooth=t=>t*t*(3-2*t);
export function palmPose(elapsed){
  if(!(elapsed>0&&elapsed<PALM_DURATION))return {push:0,backswing:0,recoil:0};
  let i=1;while(i<keys.length-1&&elapsed>keys[i][0])i++;
  const a=keys[i-1],b=keys[i],t=smooth((elapsed-a[0])/(b[0]-a[0]));
  return {push:a[1]+(b[1]-a[1])*t,backswing:a[2]+(b[2]-a[2])*t,recoil:a[3]+(b[3]-a[3])*t};
}