// ---------- Portrait six days: fly into each day like stepping through a painting (12.45-38) ----------
const DAYNAMES=['LIGHT','SKY · WATERS','LAND · SEAS · PLANTS','SUN · MOON · STARS','SEA CREATURES · BIRDS','LAND ANIMALS'];
const DCW=460,DCH=818,DS=1920/DCH; // each day is painted on a tall canvas that fills the frame at scale DS
function dayCanvas(i,t,k,o={}){
  // k = how far we have flown in: 1 fills the frame, <1 hangs as a framed painting ahead of us.
  const {frame=false,dim=0}=o,s=DS*k;
  let g=`<g transform="translate(540 960) scale(${s.toFixed(4)}) translate(${-DCW/2} ${-DCH/2})">`;
  if(frame)g+=`<path d="${torn(-14,-14,DCW+28,DCH+28,60+i,6,4)}" fill="#000" opacity=".5" transform="translate(6 10)" filter="url(#dblur2)"/><path d="${torn(-12,-12,DCW+24,DCH+24,70+i,6,4)}" fill="#F7F2E6"/>`;
  g+=R(0,0,DCW,DCH,0,'#070A26')+dayArt(i,t,t-DAYS[i],0,0,DCW,DCH);
  if(dim>0)g+=R(0,0,DCW,DCH,0,'#03040F',{opacity:dim.toFixed(3)});
  return g+'</g>';
}
function dayHeader(t,i,a){
  if(a<=0)return '';
  let g=piece(t,DAYS[i]+.05,540,230,label(540,196,`DAY ${i+1}`,{size:72,anchor:'middle'}),40+i,1.6);
  g+=piece(t,DAYS[i]+.3,540,300,label(540,282,DAYNAMES[i],{size:34,anchor:'middle',bg:'#14141A'}),50+i,1.2);
  // Progress: six dots, this one lit.
  for(let k=0;k<6;k++){const x=540+(k-2.5)*34,on=k<=i;g+=C(x,372,on?9:7,on?(k===i?YEL:'#F7F2E6'):'#3A3E6A')+(k===i?glow(x,372,26,YEL,.6):'');}
  return G('',g,a);
}
function v1(t){
  let g=DAYDEFS;
  // Which day we are in, and how far through the fly-in to the next one.
  let i=0;while(i<5&&t>=DAYS[i+1]-.7)i++;
  const D=DAYS[i],p=ease.inOut(prog(t,D-.7,D+.15));
  const push=1+.07*prog(t,D,i<5?DAYS[i+1]-.7:37.0);
  if(i>0&&p<1){
    // Fly through: the day we are leaving rushes past, the next hangs as a framed painting and fills the screen.
    const kIn=.3*Math.pow(1/.3,p),kOut=(1+.07)*Math.pow(2.8,p);
    g+=G('',dayCanvas(i-1,t,kOut,{dim:.55*p}),1-ease.in2(p));
    g+=dayCanvas(i,t,kIn*(p>=1?push:1),{frame:true});
  }else if(i===0&&t<D+.15){
    // Out of the light of "Then God spoke", straight into Day 1.
    g+=dayCanvas(0,t,lerp(1.25,1,ease.out(prog(t,CUTS[0],D+.15))));
  }else g+=dayCanvas(i,t,push);
  // Header replaces the empty top band; it hands over between days.
  const hOut=i<5?1-prog(t,DAYS[i+1]-.75,DAYS[i+1]-.55):1-prog(t,36.9,37.3);
  g+=dayHeader(t,i,Math.min(prog(t,D-.1,D+.15)*(t>=D-.1?1:0)+(t>=D?1:0),1)*hOut);
  return g;
}
