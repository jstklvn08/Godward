// Day 3: an island rising out of the sea, then plants.
function dayLand(t,lt,x,y,w,h){
  const sea=y+h*.64,[sf,sd]=vg('#0A1F55','#1E5698'),[wf,wd]=vg('#1490C0','#0A5290','#06305E');
  let g=sd+wd+R(x,y,w,h,0,sf);
  for(let k=0;k<3;k++)g+=E(wrapX(x,w,hash(k,61),lt*6,90),y+30+k*34,60+k*10,8,'#2D6CB4',{opacity:.5});
  // The far sea behind the island.
  g+=R(x,sea-14,w,30,0,'#0E5E98');
  const rise=ease.out(prog(lt,0,1.2)),dy=(1-rise)*130;
  const u0=.03,u1=.76,sh=px=>{const u=(px-x)/w;return Math.sin(Math.PI*clamp((u-u0)/(u1-u0)));};
  const top=px=>sea+10-118*Math.pow(sh(px),.7)-Math.sin((px-x)/26)*3*sh(px)+dy;
  const landPath=f=>{let d=`M${x+w*u0-10} ${sea+40}`;for(let px=x+w*u0-10;px<=x+w*u1+10;px+=6)d+=`L${px.toFixed(1)} ${(top(px)+f(px)).toFixed(1)}`;return d+`L${x+w*u1+10} ${sea+40}Z`;};
  const beach=px=>{const u=(px-x)/w;return Math.max(0,(u-.6)/.16,(.13-u)/.1)*12;};
  // Sand, then grass that stops short of the beaches, with shaded bands.
  g+=`<path d="${landPath(()=>0)}" fill="#F2C470"/><path d="${landPath(beach)}" fill="#1FAE7C"/><path d="${landPath(px=>beach(px)+18)}" fill="#169068"/><path d="${landPath(px=>beach(px)+44)}" fill="#11795A"/>`;
  // Grass tufts along the island.
  for(let k=0;k<44;k++){
    const px=x+w*(.12+k*(.5/44));
    const py=top(px)+beach(px)+3,gr=ease.out(prog(lt,.9+k*.01,1.3+k*.01));if(gr<=0)continue;
    const sw=Math.sin(t*1.8+k*.5)*3;
    for(let j=-1;j<=1;j++)g+=L(px+j*3,py,px+j*6+sw,py-(9+hash(k,70+j)*10)*gr,k%2?'#3BE0A0':'#27C08A',3);
  }
  // Two small trees.
  [[.2,.85,1.15],[.52,.72,1.4]].forEach(([u,s,at],k)=>{
    const px=x+w*u,py=top(px)+6,gr=ease.back(prog(lt,at,at+.5));if(gr<=0)return;
    const sw=Math.sin(t*1.2+k)*3;
    g+=glow(px,py-56*s,60*s*gr,'#35F2B4',.35)+stk(px,py,s*gr,P('M-9 0 L-6 -40 L6 -40 L9 0Z','#9A5430')+`<g transform="rotate(${sw.toFixed(1)} 0 -40)">`+C(-20,-50,17,'#16A876')+C(20,-52,18,'#16A876')+C(0,-62,24,'#1FCB86')+C(-10,-72,15,'#35E59A')+C(12,-70,13,'#35E59A')+C(-14,-54,4.5,'#FF7BD5')+C(14,-58,4.5,'#FFD45E')+C(2,-78,4.5,'#FF7BD5')+C(22,-44,4,'#FF8A5C')+`</g>`);
  });
  // Flowers and glowing plants, all different.
  const FL=[[.1,0,'#FF7BD5'],[.14,1,'#FFD45E'],[.27,2,'#FF8A5C'],[.32,3,'#35F2B4'],[.38,0,'#B98CFF'],[.43,1,'#FF7BD5'],[.47,2,'#7CFFE6'],[.58,3,'#FFD45E'],[.63,0,'#35F2B4'],[.67,1,'#FF8A5C'],[.24,1,'#B98CFF'],[.35,0,'#FFD45E']];
  FL.forEach(([u,ty,c],k)=>{
    const px=x+w*u,py=top(px)+beach(px)+4,gr=ease.back(prog(lt,1.0+k*.09,1.4+k*.09));if(gr<=0)return;
    const hh=(22+hash(k,75)*18)*gr,sw=Math.sin(t*1.6+k)*5,hx=px+sw,hy=py-hh;
    g+=P(`M${px} ${py} Q${px-3} ${py-hh*.5} ${hx} ${hy}`,'none',{stroke:'#0E6A52','stroke-width':3.5})+E(px+5+sw*.4,py-hh*.4,6*gr,2.6*gr,'#2ED69A',{transform:`rotate(-30 ${px+5+sw*.4} ${py-hh*.4})`});
    g+=glow(hx,hy,22*gr,c,.75);
    if(ty===0)g+=C(hx,hy,7*gr,c)+C(hx-2,hy-2,2.4*gr,'#FFFFFF',{opacity:.7});
    else if(ty===1){for(let p=0;p<6;p++){const a=p/6*6.283+t*.3;g+=C(hx+Math.cos(a)*6*gr,hy+Math.sin(a)*6*gr,4*gr,c);}g+=C(hx,hy,3.6*gr,'#FFF3B0');}
    else if(ty===2)g+=`<g transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)}) scale(${gr.toFixed(3)})">`+P('M-8 -8 Q-10 6 0 8 Q10 6 8 -8 L4 -3 L0 -10 L-4 -3Z',c)+`</g>`;
    else g+=`<g transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)}) scale(${gr.toFixed(3)})">`+E(-7,6,8,3.5,'#2ED69A',{transform:'rotate(-35 -7 6)'})+E(7,4,8,3.5,'#2ED69A',{transform:'rotate(35 7 4)'})+E(0,-3,4,7,c)+`</g>`;
  });
  // Water streaming off the land as it rises.
  if(rise<1)for(let k=0;k<12;k++){const px=x+w*(u0+.04+hash(k,68)*(u1-u0-.08)),dp=(lt*1.6+hash(k,69))%1;g+=C(px.toFixed(1),(top(px)+dp*50).toFixed(1),3,'#9FE6FF',{opacity:(.8*(1-rise)).toFixed(2)});}
  // The near sea in front, with waves.
  g+=`<path d="${ridge(64,sea+6,4,20,x-40,x+w+40,y+h+40)}" fill="${wf}" transform="translate(${(Math.sin(t*.8)*10).toFixed(1)} 0)"/>`;
  for(let k=0;k<16;k++){const px=wrapX(x,w,hash(k,62),lt*(k%2?9:-9),20),py=sea+22+hash(k,63)*(y+h-sea-30);g+=arc(px,py,8+hash(k,64)*8,'#5FD0F2',3,.5);}
  // Ripples as the land breaks the surface.
  for(let k=0;k<3;k++){const rp=prog(lt,.15+k*.25,1.5+k*.25);if(rp>0&&rp<1)g+=`<ellipse cx="${x+w*.4}" cy="${sea+10}" rx="${(w*.3+rp*w*.5).toFixed(1)}" ry="${(8+rp*14).toFixed(1)}" fill="none" stroke="#BDF4FF" stroke-width="3" opacity="${(.6*(1-rp)).toFixed(3)}"/>`;}
  // Foam where the waves meet the shore.
  for(let k=0;k<14;k++){const px=x+w*(u0+.02)+k*(w*(u1-u0-.04)/13),lap=Math.sin(t*1.8+k*1.1);g+=arc(px+lap*4,sea+8+(k%2)*3,14+(k%3)*4,'#FFFFFF',3.5,.8*rise);}
  for(let k=0;k<16;k++){const px=x+w*(u0+hash(k,65)*(u1-u0))+Math.sin(t*2+k)*4,py=sea+6+hash(k,66)*10;g+=C(px.toFixed(1),py.toFixed(1),1.5+hash(k,67)*2.5,'#FFFFFF',{opacity:(.8*rise).toFixed(2)});}
  for(let k=0;k<5;k++){const px=x+w*.84+k*16,py=sea+12+Math.sin(t*2.4+k)*2;g+=arc(px,py,7,'#DDF8FF',3,.6);}
  return g;
}

