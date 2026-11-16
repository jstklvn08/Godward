// ---------- Portrait curses: fly into each consequence like a painting (198.8-236.9) ----------
const CST=[198.8,217.7,224.4],CNAMES=['THE SERPENT','THE WOMAN','THE MAN'],CREFS=['GENESIS 3:14–15','GENESIS 3:16','GENESIS 3:17–19'];
const CCHIPS=[[[199.4,'CURSED TO CRAWL ON ITS BELLY'],[203.4,'HOSTILITY BETWEEN THEIR OFFSPRING']],[[218.4,'PAIN IN CHILDBEARING'],[220.6,'CONFLICT IN MARRIAGE']],[[225.0,'CURSED GROUND · THORNS · THISTLES'],[229.0,'PAINFUL TOIL, UNTIL DEATH']]];
function curseCanvas(i,t,k,o={}){
  const {frame=false,dim=0,cx=540,cy=960}=o,s=DS*k;
  let g=`<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s.toFixed(4)}) translate(${-DCW/2} ${-DCH/2})">`;
  if(frame)g+=`<path d="${torn(-14,-14,DCW+28,DCH+28,160+i,6,4)}" fill="#000" opacity=".5" transform="translate(6 10)" filter="url(#dblur2)"/><path d="${torn(-12,-12,DCW+24,DCH+24,170+i,6,4)}" fill="#F7F2E6"/>`;
  const id=nid(),[bf,bd]=vg('#0E0A22','#1E1238','#2A1030');
  g+=bd+`<clipPath id="${id}"><rect width="${DCW}" height="${DCH}"/></clipPath><g clip-path="url(#${id})">`+R(0,0,DCW,DCH,0,bf);
  for(let j=0;j<40;j++)g+=C((hash(j,171+i)*DCW).toFixed(1),(hash(j,181+i)*DCH*.6).toFixed(1),.8+hash(j,191)*1.4,'#fff',{opacity:(.2+.4*Math.sin(t*2+j)**2).toFixed(2)});
  g+=glow(DCW*.5,DCH*.55,DCW*.8,['#5A2A7A','#7A2A5A','#5A3A2A'][i],.4);
  g+=curseArt(i,t,t-CST[i],0,0,DCW,DCH);
  // A darker band of earth in front.
  g+=`<path d="${ridge(140+i,DCH*.86,10,50,-20,DCW+20,DCH+40)}" fill="#241A2A"/>`;
  if(dim>0)g+=R(0,0,DCW,DCH,0,'#03040F',{opacity:dim.toFixed(3)});
  return g+'</g></g>';
}
function curseHeader(t,i,a){
  if(a<=0)return '';
  let g=piece(t,CST[i]+.05,540,230,label(540,196,CNAMES[i],{size:68,anchor:'middle'}),140+i,1.6);
  g+=piece(t,CST[i]+.3,540,300,label(540,282,CREFS[i],{size:30,anchor:'middle',bg:'#14141A'}),150+i,1.2);
  for(let k=0;k<3;k++){const x=540+(k-1)*34,on=k<=i;g+=C(x,372,on?9:7,on?(k===i?CORAL:'#F7F2E6'):'#3A3E6A')+(k===i?glow(x,372,26,CORAL,.6):'');}
  CCHIPS[i].forEach(([at,txt],k)=>g+=piece(t,at,540,1560+k*70,label(540,1540+k*70,txt,{size:32,anchor:'middle',bg:CORAL}),160+i*2+k,1.2));
  return G('',g,a);
}
function v9(t){
  VTOP=430;
  let g=DAYDEFS;
  // The promise and the dust return as verses in the top band.
  g+=fade(t,231.8,verse(t,209.2,0,0,['“He will crush your head,','and you will strike his heel.”'],'GENESIS 3:15',{size:52,hl:'He will crush your head,',hlAt:210.2,hlDur:1,seed:91,id:20}));
  g+=verse(t,232.3,0,0,['“For dust you are,','and to dust you will return.”'],'GENESIS 3:19',{size:52,hl:'to dust you will return.',hlAt:234.4,hlDur:1,seed:93,id:22});
  if(t>=231.9){
    // Pull back: the three consequences hang side by side as dust falls over them.
    const q=ease.inOut(prog(t,231.9,232.9)),KC=.3065,cell=k=>[540+(k-1)*357,1080];
    for(let k=0;k<2;k++){const a=ease.back(prog(t,232.0+k*.1,232.45+k*.1));if(a>0){const [x,y]=cell(k);g+=curseCanvas(k,t,KC*a,{frame:true,cx:x,cy:y})+label(x-162,y-306,CNAMES[k],{size:22});}}
    const [x2,y2]=cell(2);g+=curseCanvas(2,t,lerp(1.07,KC,q),{frame:q>.05,cx:lerp(540,x2,q),cy:lerp(960,y2,q)});
    if(q>=1)g+=label(x2-162,y2-306,CNAMES[2],{size:22});
    for(let j=0;j<70;j++){const p=((t-232.4)*.2+hash(j,4))%1;g+=C(hash(j,5)*1080,lerp(-40,1960,p),2+hash(j,6)*4,'#C8A27A',{opacity:((1-p)*.75*q).toFixed(2)});}
    return g;
  }
  let i=0;while(i<2&&t>=CST[i+1]-.7)i++;
  const D=CST[i],p=ease.inOut(prog(t,D-.7,D+.15)),push=1+.07*prog(t,D,i<2?CST[i+1]-.7:231.9);
  if(i>0&&p<1){const kIn=.3*Math.pow(1/.3,p),kOut=1.07*Math.pow(2.8,p);g+=G('',curseCanvas(i-1,t,kOut,{dim:.55*p}),1-p*p)+curseCanvas(i,t,kIn,{frame:true});}
  else g+=curseCanvas(i,t,i===0?lerp(1.2,1,ease.out(prog(t,198.8,199.4)))*push:push);
  // The promise: a warm light rises in the serpent's panel.
  const hope=ease.out(prog(t,209.2,210.2))*(1-prog(t,217.0,217.7));
  if(hope>0)g+=glow(540,1200,700,'#FFE08A',.4*hope);
  g+=fade(t,217.0,piece(t,214.0,540,1450,label(540,1430,'THE FIRST HINT OF A SAVIOR',{size:36,anchor:'middle',bg:'#FFE100',fill:'#141416'}),21,1.2));
  const hOut=i<2?1-prog(t,CST[i+1]-.75,CST[i+1]-.55):1-prog(t,231.5,231.9);
  g+=curseHeader(t,i,(t>=D-.1?hOut:0));
  return g;
}
