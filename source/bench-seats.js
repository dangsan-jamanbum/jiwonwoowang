// Shared by the visible benches, seated avatars and terminal presence.
export const smokingSeats=[-1,1].flatMap(side=>[-2.02,2.02].map(along=>{
  const x=-14.85+side*2.30,z=12.2+along;
  return {
    id:(side<0?'west':'east')+'-'+(along<0?'north':'south'),
    x,y:.8275,z,yaw:-side*Math.PI/2,approach:{x:x-side*1.1,z},
  };
}));