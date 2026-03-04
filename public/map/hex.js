
export function hexPath(cx,cy,r){
  const pts=[];
  for(let i=0;i<6;i++){
    const a=Math.PI/3*i+Math.PI/6;
    pts.push([
      cx+Math.cos(a)*r,
      cy+Math.sin(a)*r
    ]);
  }
  return pts.map(p=>p.join(',')).join(' ');
}
