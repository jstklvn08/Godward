// "But God wasn't finished": pull back from Day 6 to all six days hung as a gallery that fills the frame.
function dayGallery(t){
  const q=ease.inOut(prog(t,36.9,37.9)),KC=.3065,cell=k=>[540+((k%3)-1)*357,1030+(Math.floor(k/3)-.5)*640];
  let g='';
  g+=piece(t,37.2,540,250,label(540,210,'GENESIS 1:3–25',{size:44,anchor:'middle'}),70,1.2);
  g+=piece(t,37.0,540,330,label(540,300,'SIX DAYS',{size:34,anchor:'middle',bg:'#14141A'}),71,1.2);
  for(let k=0;k<5;k++){const a=ease.back(prog(t,37.0+k*.09,37.45+k*.09));if(a<=0)continue;const [x,y]=cell(k);
    g+=`<g transform="${jit(t,80+k,x,y,1,8)}">`+dayCanvas(k,t,KC*a,{frame:true,cx:x,cy:y})+label(x-162,y-306,`DAY ${k+1}`,{size:24})+'</g>';}
  const [x6,y6]=cell(5);
  g+=dayCanvas(5,t,lerp(1.07,KC,q),{frame:q>.05,cx:lerp(540,x6,q),cy:lerp(960,y6,q)});
  if(q>=1)g+=label(x6-162,y6-306,'DAY 6',{size:24});
  if(t>37.4){g+=mark(scribble(x6,y6,210,330,12),ease.inOut(prog(t,37.4,38.1)),CORAL,10);
    g+=piece(t,38.0,540,1720,label(540,1690,'BUT GOD WASN’T FINISHED',{size:44,anchor:'middle',bg:CORAL}),72,1.4);}
  return g;
}
