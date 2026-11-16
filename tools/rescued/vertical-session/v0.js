// ---------- Portrait opening, drawn for the tall frame (0-12.45) ----------
// "In the beginning": darkness, the heavens unfolding, the earth rising as deep water,
// formless and empty, darkness swallowing it, then a crack of light when God speaks (no figure, no sun, no stars).
const torusPts=(cx,cy,r,seed,t,n=48,amp=.12)=>{let d='';for(let i=0;i<=n;i++){const a=i/n*6.283,k=1+amp*(Math.sin(a*3+seed+t*.6)*.5+Math.sin(a*7+seed*2-t*.9)*.3+(hash(i%n,seed)-.5)*.4);d+=(i?'L':'M')+(cx+Math.cos(a)*r*k).toFixed(1)+' '+(cy+Math.sin(a)*r*k).toFixed(1);}return d+'Z';};
function v0(t){
  let g=DAYDEFS;
  const [bg,bd]=vg('#070826','#0A0B2E','#03040F');
  g+=bd+R(0,0,1080,1920,0,bg);
  // The void: slow churning smoke, never still.
  for(let k=0;k<9;k++){const x=540+Math.sin(t*.13+k*1.7)*380,y=260+k*200+Math.cos(t*.11+k)*60;g+=glow(x,y,260+hash(k,3)*200,['#1A1E5A','#22185C','#12204A'][k%3],.5);}
  // "In the beginning": stamped letter by letter.
  const tt='IN THE BEGINNING',ti=prog(t,.05,1.3),tf=1-prog(t,2.0,2.5);
  if(tf>0){let x=540-tw(tt,92,'Georgia')/2;const n=Math.floor(ti*tt.length+.001);
    for(let i=0;i<n;i++){const ch=tt[i],w=tw(ch,92,'Georgia'),p=prog(t,.05+i/tt.length*1.25,.05+i/tt.length*1.25+.12);
      g+=G(sc(x+w/2,980,lerp(1.6,1,ease.out(p))),T(x,1010,ch,{size:92,font:'Georgia',fill:'#F3ECD8',ls:2}),p*tf);x+=w;}
    g+=G('',label(540,1060,'GENESIS 1:1',{size:26,anchor:'middle'}),prog(t,1.0,1.3)*tf);}
  // The heavens: layered paper vaults unfolding upward from the horizon.
  const HZ=1250,hv=k=>ease.back(prog(t,1.6+k*.1,2.5+k*.1));
  const HC=['#110D3A','#18134F','#211A66','#2B2280','#382C98','#4A3AAE'];
  for(let k=0;k<6;k++){const r=(980-k*120)*hv(k);if(r<=1)continue;g+=`<path d="${torusPts(540,HZ,r,k*3+1,t,64,.035)}" fill="${HC[k]}"/>`;}
  // Swirls of unformed light-less dust inside the vault.
  const sw=prog(t,2.2,3.2)*(1-.7*prog(t,7.4,9.4));
  for(let k=0;k<5;k++){const rx=420-k*70,ry=170-k*26,a=t*(7+k*4)*(k%2?1:-1);g+=`<ellipse cx="540" cy="${HZ-380}" rx="${rx}" ry="${ry}" fill="none" stroke="${['#5A4AD0','#4A3CB8','#6A58E0','#3A30A0','#7A68F0'][k]}" stroke-width="${8-k}" stroke-dasharray="${50+k*30} ${36+k*18}" transform="rotate(${a.toFixed(1)} 540 ${HZ-380})" opacity="${(.5*sw).toFixed(3)}"/>`;}
  // The earth: a deep, rolling body of water rising into the lower half.
  const er=ease.out(prog(t,3.3,4.5)),dy=(1-er)*760;
  const WC=['#0C2260','#0A1B50','#081640','#061030','#040A22'];
  for(let i=0;i<5;i++){const ph=t*(.5+i*.12)*(i%2?1:-1),amp=(10+i*6)*(1+.8*prog(t,4.8,6.6));
    g+=`<path d="${ridge(300+i,HZ+i*120+dy,amp,90+i*30,-60,1140,2100)}" fill="${WC[i]}" transform="translate(${(Math.sin(ph)*40).toFixed(1)} 0)"/>`;
    for(let k=0;k<6;k++){const px=((hash(k,310+i)*1200+t*(30+i*10)*(i%2?1:-1))%1200+1200)%1200-60,py=HZ+i*120+dy+30+hash(k,320+i)*60;g+=arc(px,py,16+i*4,'#3A5CB0',3,.35);}}
  // Labels: the heavens and the earth.
  const lf=1-prog(t,4.6,5.0);
  if(lf>0){g+=G('',piece(t,2.5,540,520,label(540,500,'THE HEAVENS',{size:38,anchor:'middle'}),1,1.2),lf);g+=G('',piece(t,3.7,540,1500,label(540,1480,'THE EARTH',{size:38,anchor:'middle'}),2,1.2),lf);}
  // Formless: torn scraps that try to take shape and fall apart.
  const fm=prog(t,5.3,5.9)*(1-prog(t,8.6,9.6));
  if(fm>0)for(let k=0;k<26;k++){const x=120+hash(k,41)*840+Math.sin(t*.9+k)*40,y=700+hash(k,42)*700+Math.cos(t*.7+k*2)*50,rot=t*(30+hash(k,43)*60)*(k%2?1:-1),s=18+hash(k,44)*36,life=.5+.5*Math.sin(t*1.7+k*2.3);
    g+=`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})" opacity="${(fm*life*.85).toFixed(3)}"><path d="${torn(-s,-s*.6,s*2,s*1.2,k+50,4,3,8)}" fill="${['#2A3C8A','#3B2E8E','#1E4A7A'][k%3]}"/></g>`;}
  g+=fade(t,9.4,piece(t,5.6,330,880,label(330,860,'FORMLESS',{size:40,anchor:'middle'}),3,1.4));
  if(t>6.5&&t<9.8)g+=G('',mark(scribble(700,1080,230,150,9),ease.inOut(prog(t,6.6,7.2)),CORAL,8),1-prog(t,9.3,9.8));
  g+=fade(t,9.4,piece(t,6.6,760,880,label(760,860,'EMPTY',{size:40,anchor:'middle',bg:CORAL}),4,1.4));
  // Darkness covers the deep: ink spreading in from every edge.
  const ink=k=>ease.inOut(prog(t,7.5+k*.07,9.6+k*.05));
  const IP=[[0,0],[1080,0],[0,1920],[1080,1920],[540,-80],[540,2000],[-80,700],[1160,700],[-80,1300],[1160,1300],[260,380],[820,1600],[300,1500],[800,400]];
  IP.forEach(([x,y],k)=>{const r=(520+hash(k,61)*260)*ink(k);if(r>2)g+=`<path d="${torusPts(x,y,r,k*5+7,t,40,.18)}" fill="#020207" opacity=".94"/>`;});
  const dk=ease.inOut(prog(t,8.6,9.8));
  if(dk>0)g+=R(0,0,1080,1920,0,'#020207',{opacity:(.86*dk).toFixed(3)});
  g+=fade(t,10.0,piece(t,7.8,540,680,label(540,660,'DARKNESS OVER THE DEEP',{size:38,anchor:'middle'}),5,1.4)+piece(t,8.3,540,730,label(540,716,'GENESIS 1:2',{size:24,anchor:'middle'}),6,1));
  // A breath of wind skims the hidden water (the Spirit hovering, Gen 1:2): just a moving ripple, no form.
  if(t>8.8&&t<10.4){const p=prog(t,8.8,10.4),x=lerp(-100,1180,p);g+=P(`M${x-260} ${HZ+40} Q${x-130} ${HZ+20} ${x} ${HZ+40} T${x+260} ${HZ+40}`,'none',{stroke:'#4A6AC8','stroke-width':3,opacity:(.6*Math.sin(p*Math.PI)).toFixed(3)});}
  // Then God spoke: a crack of light splits the dark from top to bottom, then opens.
  const cp=ease.inOut(prog(t,10.06,10.7)),op=ease.in?0:0,wo=Math.pow(prog(t,11.0,12.45),2.2);
  if(cp>0){
    let d='';for(let i=0;i<=32;i++){const y=-20+i*61,x=540+(hash(i,71)-.5)*70*(1-Math.abs(i-16)/20);d+=(i?'L':'M')+x.toFixed(1)+' '+y;}
    if(wo>0){const w=wo*900;let L='',Rr='';for(let i=0;i<=32;i++){const y=-20+i*61,x=540+(hash(i,71)-.5)*70*(1-Math.abs(i-16)/20);L+=(i?'L':'M')+(x-w*(.6+.4*hash(i,72))).toFixed(1)+' '+y;Rr=`L${(x+w*(.6+.4*hash(i,73))).toFixed(1)} ${y}`+Rr;}
      const [lg,ld]=vg('#FFF4D2','#FFFBEC','#FFE6A8');g+=ld+P(L+Rr+'Z',lg);}
    g+=P(d,'none',{stroke:'#FFE7A0','stroke-width':60,opacity:.55*cp,filter:'url(#dblur)'})+P(d,'none',{stroke:'#FFF6D6','stroke-width':22,opacity:.8*cp,filter:'url(#dblur2)'})+mark(d,cp,'#FFFFFF',7);
    for(let k=0;k<30;k++){const y=hash(k,74)*1920,dr=((t-10.2)*.6+hash(k,75))%1,x=540+(hash(k,76)-.5)*2*(40+dr*260);g+=C(x.toFixed(1),y.toFixed(1),2+hash(k,77)*3,'#FFE7A0',{opacity:((1-dr)*.9*cp).toFixed(2)});}
    g+=G('',piece(t,10.4,540,560,label(540,530,'THEN GOD SPOKE',{size:48,anchor:'middle'}),7,1.6),1-prog(t,11.8,12.2));
  }
  g+=glow(540,960,1100,'#FFFBE6',.9*prog(t,11.6,12.45));
  return g;
}
// Focus beats: the camera punches in and shakes only on these moments; the rest of the time it is steady.
const FOCUS=[[2.46,.6],[3.66,.7],[6.58,.6],[8.84,.5],[10.1,1.2],[12.56,.5],[17.0,.5],[20.98,.5],[24.52,.5],[29.04,.5],[33.72,.5],[37.4,.8],[54.6,.8],[68.6,.7],[97.6,.8],[130.8,.8],[141.4,.9],[156.6,.9],[157.4,1.2],[163.4,.7],[183.5,1.1],[192.4,.6],[210.2,.8],[234.4,.8],[254.0,1.0]];
function focusFx(t){
  let dx=0,dy=0,rot=0,z=1;
  FOCUS.forEach(([b,s])=>{const p=t-b;if(p<0||p>1.4)return;const e=Math.exp(-p*4.2)*s,f=Math.floor(t*24);
    dx+=(hash(f,b*7)-.5)*2*16*e;dy+=(hash(f,b*7+3)-.5)*2*12*e;rot+=(hash(f,b*7+5)-.5)*1.4*e;z*=1+.07*s*ease.out(clamp(p/.18))*Math.exp(-p*1.3);});
  return {dx,dy,rot,z};
}
