// A continuous granite sea wall supports the four statues. The dry forecourt
// ends at its first course; the seaward edge drops to the real harbour below.
export function makeHonorHall(T,parent,centerX=-5.15) {
  const group=new T.Group();group.name='해문 · 수호 석벽';group.position.set(centerX,0,46.20);parent.add(group);
  const geometries=new Set(),materials=new Map();
  const unit=new T.BoxGeometry();geometries.add(unit);
  function mesh(g,color){
    if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.86,metalness:.035}));
    const item=new T.Mesh(g,materials.get(color));group.add(item);item.castShadow=true;item.receiveShadow=true;return item;
  }
  function block(name,x,y,z,w,h,d,c) {
    const item=mesh(unit,c);item.name=name;item.scale.set(w,h,d);item.position.set(x,y,z);return item;
  }
  function section(name,x,y,z,bottom,top,lowDepth,topDepth,height,shade) {
    const vertices=[];
    const bottomRing=[[-bottom/2,0,-lowDepth/2],[bottom/2,0,-lowDepth/2],[bottom/2,0,lowDepth/2],[-bottom/2,0,lowDepth/2]];
    const topRing=[[-top/2,height,-topDepth/2],[top/2,height,-topDepth/2],[top/2,height,topDepth/2],[-top/2,height,topDepth/2]];
    function triangle(a,b,c){vertices.push(...a,...b,...c);}
    for(let i=0;i<4;i++){
      const n=(i+1)%4;triangle(bottomRing[i],topRing[i],topRing[n]);triangle(bottomRing[i],topRing[n],bottomRing[n]);
    }
    triangle(topRing[0],topRing[2],topRing[1]);triangle(topRing[0],topRing[3],topRing[2]);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();geometries.add(g);
    const item=mesh(g,shade);item.name=name;item.position.set(x,y,z);
  }
  const upper=.89;
  const flank='#697971',top='#c2bba4',trim='#9a9a84',dark='#414f51';
  block('안벽 앞 굽돌',0,.13,3.18,27.0,.26,6.36,flank);
  block('해안 석단 하인방',0,.35,3.32,26.93,.18,6.14,trim);
  block('물가까지 이어진 해안 성벽',0,1.40,4.0,26.6,2.05,6.1,'#71827d');
  const ashlar=['#919b8b','#9da18f','#90978a','#879489','#9a9e8c'];
  for(let row=0;row<5;row++){
    const n=row%2?9:10,w=26.45/n;
    for(let i=0;i<n;i++)
      block('장대석',-13.225+(i+.5)*w,.59+row*.42,1.12,w-.022,.399,.44,ashlar[(i+2*row)%ashlar.length]);
  }
  block('안벽 돌 난간',0,1.65+upper,3.71,26.91,.24,5.97,top);
  // Stone ears to either side of the statues frame the water, leaving the
  // entire horizon and the two central silhouettes open between them.
  for(const side of [-1,1]){
    const x=side*12.90;
    section('해문 날개벽',x,.30,2.76,1.92,1.16,3.28,1.61,3.37+upper,flank);
    block('날개벽 머릿돌',x,3.79+upper,2.76,1.47,.19,1.94,top);
    const obelisk=side*12.48;
    section('연안 표석',obelisk,1.73+upper,5.2,1.21,.76,1.42,.87,3.22,'#7e8c83');
    block('표석 청동띠',obelisk,4.80+upper,5.20,.86,.17,.99,dark);
    section('표석 돌갓',obelisk,4.92+upper,5.20,.95,.42,1.07,.53,.47,top);
  }
  // Stepped piers beneath the raised central figures form two distinct ranks.
  for(const x of [-3.05,3.05]){
    section('성벽 중앙 부벽',x,1.64+upper,3.48,4.82,4.20,4.30,3.69,.71,flank);
    block('중앙 화강석 갑석',x,2.39+upper,3.48,4.45,.16,3.88,top);
  }
  // The front has three blind sea arches built in dressed voussoirs and
  // four narrow battered cutwaters. There is no opening to the statues.
  for(const x of [-6.1,0,6.1]){
    block('해문 아치 안쪽',x,1.03,.878,1.48,1.32,.12,'#536668');
    const r=.73, midY=1.53, n=11;
    for(let i=0;i<n;i++){
      const theta=(i+.5)*Math.PI/n;
      const stone=block('홍예 쐐기돌',x+Math.cos(theta)*r,midY+Math.sin(theta)*r,.81,.262,.32,.27,i%2?trim:top);
      stone.rotation.z=theta-Math.PI*.5;
    }
    for(const side of [-1,1])for(const h of [.62,1.00,1.38])
      block('홍예 기둥돌',x+side*.72,h,.80,.32,.365,.28,trim);
    block('석벽 물길 음각',x,.97,.795,.78,.055,.09,'#839e93');
    block('석벽 물길 음각',x,.83,.795,.50,.045,.09,'#a9b5a0');
  }
  for(const x of [-9.15,-3.05,3.05,9.15]){
    section('석단 앞 부벽',x,.25,.80,1.36,.95,1.06,.43,2.02,flank);
    block('부벽 돌머리',x,2.33,.80,1.15,.17,.55,top);
  }
  return {group,blocks(x,z){return Math.abs(x-centerX)<=13.59&&z>=46.20&&z<=54.1;},destroy(){
    parent.remove(group);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }};
}