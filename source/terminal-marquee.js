export const TERMINAL_WALL={x:-2,z:14,footDepth:1,width:12,height:3.4,screenY:3.1};
export const TERMINAL_WALL_BOUNDS={minX:-8,maxX:4,minZ:13,maxZ:15,top:4.8};
export function mountTerminalMarquee(T,scene,renderer){
 const group=new T.Group(),m=new T.MeshStandardMaterial({color:0x172f3c,emissive:0x183c4b,emissiveIntensity:.7});
 const board=new T.Mesh(new T.BoxGeometry(12,3.4,.35),m);board.position.set(TERMINAL_WALL.x,3.1,TERMINAL_WALL.z);group.add(board);scene.add(group);
 let state=null;
 return {setBoard(v){state=v;},update(){},paintView(){},destroy(){scene.remove(group);},get state(){return state;}};
}
