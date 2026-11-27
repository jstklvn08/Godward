const DAYS=[12.56,17.0,20.98,24.52,29.04,33.72];
// Day-panel kit: a thin sticker edge sized for the small panels, and soft blurs.
const DAYDEFS=`<filter id="dstk" x="-40%" y="-40%" width="180%" height="190%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="3" result="fat"/><feFlood flood-color="#fff" result="wf"/><feComposite in="wf" in2="fat" operator="in" result="white"/><feGaussianBlur in="fat" stdDeviation="3" result="b"/><feOffset in="b" dx="3" dy="5" result="o"/><feFlood flood-color="#000" flood-opacity=".45" result="sf"/><feComposite in="sf" in2="o" operator="in" result="shadow"/><feMerge><feMergeNode in="shadow"/><feMergeNode in="white"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="dblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter><filter id="dblur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>`;
// A small sticker: inner drawn in local units, placed at (x,y), the white edge stays panel-sized.
const stk=(x,y,s,inner,fx=1,rot=0)=>s<=0?'':`<g filter="url(#dstk)"><g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(2)}) scale(${(s*fx).toFixed(3)} ${s.toFixed(3)})">${inner}</g></g>`;
const spark=(x,y,r,c,o=1)=>P(`M${x} ${y-r}Q${x} ${y} ${x+r} ${y}Q${x} ${y} ${x} ${y+r}Q${x} ${y} ${x-r} ${y}Q${x} ${y} ${x} ${y-r}Z`,c,{opacity:o.toFixed(3)});
const vg=(a,b,c)=>{const id=nid();return [`url(#${id})`,`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/>${c?`<stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>`:`<stop offset="1" stop-color="${b}"/>`}</linearGradient>`];};
const arc=(px,py,r,c,wd=3,o=.6,up=1)=>P(`M${(px-r).toFixed(1)} ${py.toFixed(1)}Q${px.toFixed(1)} ${(py-r*.7*up).toFixed(1)} ${(px+r).toFixed(1)} ${py.toFixed(1)}`,'none',{stroke:c,'stroke-width':wd,opacity:o});
const wrapX=(x,w,u,v,pad=80)=>x-pad+(((u*(w+2*pad)+v)%(w+2*pad))+(w+2*pad))%(w+2*pad);

// Day 1: light with no source, set apart from the dark.
function dayLight(t,lt,x,y,w,h){
  let g=R(x,y,w,h,0,'#03041A');
  const dcx=x+w*.2,dcy=y+h*.5;
  for(let k=0;k<4;k++)g+=`<ellipse cx="${dcx}" cy="${dcy}" rx="${170-k*38}" ry="${110-k*24}" fill="none" stroke="${['#141C55','#18226A','#121A50','#1C2A78'][k]}" stroke-width="${7-k}" stroke-dasharray="${50+k*20} ${34+k*12}" transform="rotate(${(t*(9+k*5)*(k%2?-1:1)).toFixed(1)} ${dcx} ${dcy})"/>`;
  const sp=ease.out(prog(lt,0,1.6)),bx=x+w*lerp(1.12,.42,sp);
  const ex=(yy,off,amp)=>bx+off+Math.sin(yy/38+t*1.1)*amp+Math.sin(yy/14-t*1.9)*amp*.4;
  const edge=(off,amp)=>{let d=`M${x+w+60} ${y-30}`;for(let yy=y-30;yy<=y+h+30;yy+=10)d+=`L${ex(yy,off,amp).toFixed(1)} ${yy}`;return d+`L${x+w+60} ${y+h+30}Z`;};
  const lid=nid(),cid=nid();
  g+=`<linearGradient id="${lid}" x1="0" y1="0" x2="1" y2=".25"><stop offset="0" stop-color="#FFD27A"/><stop offset=".3" stop-color="#FFF3D2"/><stop offset="1" stop-color="#FFE2A4"/></linearGradient>`;
  // A warm halo that bleeds into the dark, then the light itself.
  g+=`<path d="${edge(-40,16)}" fill="#FF9E3A" opacity=".5" filter="url(#dblur)"/><path d="${edge(-16,12)}" fill="#FFE29A" opacity=".8" filter="url(#dblur)"/>`;
  g+=`<clipPath id="${cid}"><path d="${edge(0,10)}"/></clipPath><path d="${edge(0,10)}" fill="url(#${lid})"/><g clip-path="url(#${cid})">`;
  // Drifting pools of brightness: several, so no single source.
  for(let k=0;k<6;k++)g+=glow(bx+50+hash(k,31)*w*.55+Math.sin(t*.4+k)*24,y+hash(k,32)*h+Math.cos(t*.3+k)*16,80+hash(k,33)*70,'#FFFFFF',.5+.18*Math.sin(t*1.3+k*2));
  // Slanting shafts.
  for(let k=0;k<7;k++){const sx=bx-30+k*52+Math.sin(t*.5+k)*14,wd=10+hash(k,35)*24;g+=P(`M${sx.toFixed(1)} ${y-10}L${(sx+wd).toFixed(1)} ${y-10}L${(sx+wd-110).toFixed(1)} ${y+h+10}L${(sx-110).toFixed(1)} ${y+h+10}Z`,'#FFFFFF',{opacity:(.2+.14*Math.sin(t*1.7+k*1.3)).toFixed(3)});}
  // Faint warm streaks in the light.
  for(let k=0;k<5;k++){const yy=y+30+k*70+Math.sin(t*.6+k)*8;g+=P(`M${bx+20} ${yy} Q${bx+140} ${yy-14} ${x+w+10} ${yy+6}`,'none',{stroke:'#FFC66A','stroke-width':3,opacity:.35});}
  g+='</g>';
  // A bright filament on the boundary.
  let fl='';for(let yy=y-30;yy<=y+h+30;yy+=10)fl+=(fl?'L':'M')+ex(yy,0,10).toFixed(1)+' '+yy;
  g+=P(fl,'none',{stroke:'#FFFFFF','stroke-width':3,opacity:.85*sp})+P(fl,'none',{stroke:'#FFE7A0','stroke-width':12,opacity:.5*sp,filter:'url(#dblur2)'});
  // Motes: golden sparks drifting up, a few straying out over the dark and fading.
  for(let k=0;k<36;k++){
    const yy=y+(((hash(k,42)-lt*.05*(.5+hash(k,43)))%1)+1)%1*h,xx=bx-40+hash(k,41)*(x+w-bx+50)+Math.sin(t*1.2+k)*10,tw=.5+.5*Math.sin(t*3+k*1.7);
    const dark=xx<ex(yy,0,10),fade=dark?clamp(1-(ex(yy,0,10)-xx)/40):1;
    if(fade<=0)continue;
    if(k%3===0)g+=glow(xx,yy,14,'#FFC24C',.7*tw*fade)+spark(xx,yy,(5+hash(k,44)*6)*(.6+.4*tw),'#FFB02E',.95*tw*fade);
    else g+=C(xx.toFixed(1),yy.toFixed(1),(1.4+hash(k,44)*2.2).toFixed(2),dark?'#FFD27A':'#FFB848',{opacity:((.45+.55*tw)*fade).toFixed(3)});
  }
  return g;
}

// Day 2: waters above, sky between, waters below.
function daySky(t,lt,x,y,w,h){
  const sep=ease.inOut(prog(lt,.05,1.3)),cy=y+h/2,cx=x+w/2;
  const wb=lerp(cy,y+h*.3,sep),st=lerp(cy,y+h*.68,sep);
  const [sf,sd]=vg('#1A3C96','#3A7ED0','#7CC4EE');
  let g=sd+R(x,y,w,h,0,sf);
  // Clouds drifting in the open sky.
  [[.15,.45,.9],[.55,.3,.75],[.85,.62,.6]].forEach(([u,v,s],k)=>{
    const px=wrapX(x,w,u,held(lt,8)*(9+k*3)),py=lerp(wb,st,v)+Math.sin(t*.7+k)*3;
    g+=glow(px,py,60*s,'#FFFFFF',.25*sep)+stk(px,py,s*sep,C(-30,4,17,'#D6E8FF')+C(28,2,18,'#D6E8FF')+C(-14,-8,22,'#EAF4FF')+C(10,-14,25,'#F4FAFF')+R(-44,2,90,18,9,'#D6E8FF')+E(0,14,38,5,'#B4CEF2'));
  });
  // The vault: the dividing line bows into a dome as the waters part.
  const vd=`M${x+4} ${st.toFixed(1)} Q${cx} ${(2*(wb+14)-st).toFixed(1)} ${x+w-4} ${st.toFixed(1)}`;
  g+=P(vd+'Z','#A8F0FF',{opacity:.12*sep});
  // Waters above: layered, wavy underside.
  const UW=['#12AFCB','#0B88B0','#08658E','#05456C'];
  for(let i=0;i<4;i++){const sh=Math.sin(t*.6+i*1.4)*18;g+=`<path d="${ridge(140+i,wb-i*20,6-i,28+i*8,x-60,x+w+60,y-60)}" fill="${UW[i]}" transform="translate(${sh.toFixed(1)} 0)"/>`;}
  for(let k=0;k<16;k++){const px=wrapX(x,w,hash(k,51),lt*(k%2?10:-10),30),py=y+8+hash(k,52)*Math.max(0,wb-y-22);if(py<wb-12)g+=arc(px,py,9+hash(k,53)*6,'#8FEAFF',3,.45,-1);}
  // Waters below.
  const SW=['#12AFCB','#0C8DB5','#086A96','#054A74'];
  for(let i=0;i<4;i++){const sh=Math.sin(t*.7+i*1.2+2)*18;g+=`<path d="${ridge(150+i,st+i*22,6,28+i*8,x-60,x+w+60,y+h+60)}" fill="${SW[i]}" transform="translate(${sh.toFixed(1)} 0)"/>`;}
  for(let k=0;k<18;k++){const px=wrapX(x,w,hash(k,55),lt*(k%2?12:-8),30),py=st+14+hash(k,56)*(y+h-st-10);g+=arc(px,py,8+hash(k,57)*8,'#8FEAFF',3,.45);}
  for(let k=0;k<14;k++){const px=wrapX(x,w,k/14,lt*14,20),py=st+2+Math.sin(px/28+t*2)*3;g+=C(px.toFixed(1),py.toFixed(1),2.5+hash(k,58)*2,'#E8FCFF',{opacity:(.7*sep).toFixed(2)});}
  // Sparkles on both water edges.
  for(let k=0;k<10;k++){const tw=Math.max(0,Math.sin(t*2.5+k*1.9));g+=spark(x+hash(k,59)*w,k%2?wb-6:st+8,7*tw,'#FFFFFF',.8*tw*sep);}
  // The firmament line itself, drawn on and glowing.
  const mp=ease.inOut(prog(lt,.2,1.2));
  g+=P(vd,'none',{stroke:'#55F0FF','stroke-width':16,opacity:.45*mp,filter:'url(#dblur2)'})+mark(vd,mp,'#7DF8FF',6);
  return g;
}

// Day 3: land rising out of the sea, then plants.
function dayLand(t,lt,x,y,w,h){
  const sea=y+h*.6,[sf,sd]=vg('#0A1F55','#1A4E92'),[wf,wd]=vg('#1287B8','#0A4E86','#06305E');
  let g=sd+wd+R(x,y,w,h,0,sf);
  for(let k=0;k<3;k++)g+=E(wrapX(x,w,hash(k,61),lt*6,90),y+30+k*34,60+k*10,8,'#2D6CB4',{opacity:.5});
  g+=R(x,sea,w,h,0,wf);
  for(let k=0;k<14;k++){const px=wrapX(x,w,hash(k,62),lt*(k%2?9:-9),20),py=sea+12+hash(k,63)*(h*.36);g+=L(px,py,px+16+hash(k,64)*16,py,'#4FC6EE',3,{opacity:.45});}
  const rise=ease.out(prog(lt,0,1.2)),dy=(1-rise)*h*.6;
  const shape=px=>{const b=Math.sin(Math.PI*(px-x+w*.18)/(w*1.06));return Math.sign(b)*Math.pow(Math.abs(b),.85);};
  const top=px=>sea+8-112*shape(px)-Math.sin((px-x)/26)*4+dy;
  const shore=x+w*.88;
  const landPath=(lift,f)=>{let d=`M${x-20} ${y+h+40}`;for(let px=x-20;px<=x+w+20;px+=8)d+=`L${px} ${(top(px)+f(px)-lift).toFixed(1)}`;return d+`L${x+w+20} ${y+h+40}Z`;};
  // Ripples spreading as the land breaks the surface.
  for(let k=0;k<3;k++){const rp=prog(lt,.15+k*.25,1.5+k*.25);if(rp>0&&rp<1)g+=`<ellipse cx="${x+w*.4}" cy="${sea+4}" rx="${(w*.3+rp*w*.5).toFixed(1)}" ry="${(10+rp*16).toFixed(1)}" fill="none" stroke="#BDF4FF" stroke-width="3" opacity="${(.6*(1-rp)).toFixed(3)}"/>`;}
  // Sand, then grass that stops short of the shore.
  g+=`<path d="${landPath(0,()=>0)}" fill="#F2C470"/>`;
  g+=`<path d="${landPath(0,px=>Math.max(0,(px-(x+w*.66))/(w*.2))*16)}" fill="#1FAE7C"/>`;
  g+=`<path d="${landPath(-14,px=>Math.max(0,(px-(x+w*.66))/(w*.2))*16)}" fill="#169068"/>`;
  g+=`<path d="${landPath(-34,px=>Math.max(0,(px-(x+w*.66))/(w*.2))*16)}" fill="#11795A"/>`;
  // Water over the drowned slope, then foam at the waterline.
  g+=R(shore-4,sea+4,x+w-shore+10,h,0,'#0A5A92',{opacity:.7});
  for(let k=0;k<4;k++){const lap=Math.sin(t*1.8+k*1.4),px=shore-26+k*20+lap*6;g+=arc(px,sea+6+k%2*3,12+k*3,'#FFFFFF',4,.85*rise);}
  for(let k=0;k<12;k++){const px=shore-30+hash(k,65)*70+Math.sin(t*2+k)*4,py=sea+2+hash(k,66)*10;g+=C(px.toFixed(1),py.toFixed(1),1.5+hash(k,67)*2.5,'#FFFFFF',{opacity:(.8*rise).toFixed(2)});}
  for(let k=0;k<6;k++){const px=x+w*.92+k*14,py=sea+4+Math.sin(t*2.4+k)*2;g+=arc(px,py,7,'#DDF8FF',3,.6);}
  if(rise<1)for(let k=0;k<10;k++){const px=x+30+hash(k,68)*w*.75,dp=(lt*1.6+hash(k,69))%1;g+=C(px,top(px)+dp*40,3,'#9FE6FF',{opacity:(.8*(1-rise)).toFixed(2)});}
  // Grass tufts along the hill.
  for(let k=0;k<46;k++){
    const px=x+4+k*(w*.84/46);if(px>shore-24)continue;
    const py=top(px)+4,gr=ease.out(prog(lt,.9+k*.01,1.3+k*.01));if(gr<=0)continue;
    const sw=Math.sin(t*1.8+k*.5)*3;
    for(let j=-1;j<=1;j++)g+=L(px+j*3,py,px+j*6+sw,py-(9+hash(k,70+j)*10)*gr,k%2?'#3BE0A0':'#27C08A',3);
  }
  // Two small trees.
  [[.15,.95,1.15],[.6,.8,1.4]].forEach(([u,s,at],k)=>{
    const px=x+w*u,py=top(px)+4,gr=ease.back(prog(lt,at,at+.5));if(gr<=0)return;
    const sw=Math.sin(t*1.2+k)*3;
    g+=glow(px,py-58*s,60*s*gr,'#35F2B4',.35)+stk(px,py,s*gr,P('M-6 0 L-4 -36 L-12 -50 M-4 -36 L4 -38 L10 -54 M4 -38 L6 0Z','#8A4A2A',{stroke:'#8A4A2A','stroke-width':3})+`<g transform="rotate(${sw.toFixed(1)} 0 -40)">`+C(-20,-50,17,'#16A876')+C(20,-52,18,'#16A876')+C(0,-64,24,'#1FCB86')+C(-10,-74,15,'#35E59A')+C(12,-72,13,'#35E59A')+C(-14,-56,4.5,'#FF7BD5')+C(14,-60,4.5,'#FFD45E')+C(2,-80,4.5,'#FF7BD5')+C(22,-46,4,'#FF8A5C')+`</g>`);
  });
  // Flowers and glowing plants, all different.
  const FL=[[.04,0,'#FF7BD5'],[.1,1,'#FFD45E'],[.25,2,'#FF8A5C'],[.31,3,'#35F2B4'],[.38,0,'#B98CFF'],[.44,1,'#FF7BD5'],[.5,2,'#7CFFE6'],[.69,3,'#FFD45E'],[.75,0,'#35F2B4'],[.81,1,'#FF8A5C'],[.21,1,'#B98CFF'],[.53,0,'#FFD45E']];
  FL.forEach(([u,ty,c],k)=>{
    const px=x+w*u,py=top(px)+4,gr=ease.back(prog(lt,1.0+k*.09,1.4+k*.09));if(gr<=0)return;
    const hh=(24+hash(k,75)*20)*gr,sw=Math.sin(t*1.6+k)*5,hx=px+sw,hy=py-hh;
    g+=P(`M${px} ${py} Q${px-3} ${py-hh*.5} ${hx} ${hy}`,'none',{stroke:'#0E6A52','stroke-width':3.5})+E(px+5+sw*.4,py-hh*.4,6*gr,2.6*gr,'#2ED69A',{transform:`rotate(-30 ${px+5+sw*.4} ${py-hh*.4})`});
    g+=glow(hx,hy,22*gr,c,.75);
    if(ty===0)g+=C(hx,hy,7*gr,c)+C(hx-2,hy-2,2.4*gr,'#FFFFFF',{opacity:.7});
    else if(ty===1){for(let p=0;p<6;p++){const a=p/6*6.283+t*.3;g+=C(hx+Math.cos(a)*6*gr,hy+Math.sin(a)*6*gr,4*gr,c);}g+=C(hx,hy,3.6*gr,'#FFF3B0');}
    else if(ty===2)g+=`<g transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)}) scale(${gr.toFixed(3)})">`+P('M-8 -8 Q-10 6 0 8 Q10 6 8 -8 L4 -3 L0 -10 L-4 -3Z',c)+`</g>`;
    else g+=`<g transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)}) scale(${gr.toFixed(3)})">`+E(-7,6,8,3.5,'#2ED69A',{transform:'rotate(-35 -7 6)'})+E(7,4,8,3.5,'#2ED69A',{transform:'rotate(35 7 4)'})+E(0,-3,4,7,c)+`</g>`;
  });
  return g;
}

// Day 4: sun, moon and stars.
function dayLights(t,lt,x,y,w,h){
  const [sf,sd]=vg('#050A2E','#0B1650','#1C1462');
  let g=sd+R(x,y,w,h,0,sf);
  g+=`<ellipse cx="${x+w*.6}" cy="${y+h*.45}" rx="${w*.7}" ry="46" fill="#7A5CFF" opacity=".16" transform="rotate(-24 ${x+w*.6} ${y+h*.45})" filter="url(#dblur)"/>`;
  const sx=x+w*.27,sy=y+h*.52,mx=x+w*.74,my=y+h*.3;
  const SC=['#FFFFFF','#CFE4FF','#FFE6B0','#FFC2E8'];
  for(let k=0;k<56;k++){
    const px=x+hash(k,71)*w,py=y+hash(k,72)*h;
    if(Math.hypot(px-sx,py-sy)<95||Math.hypot(px-mx,py-my)<55)continue;
    const sa=prog(lt,.2+hash(k,74)*1.4,.5+hash(k,74)*1.4),tw=.3+.7*Math.sin(t*(1.4+hash(k,73)*2.2)+k)**2,c=SC[k%4];
    if(sa<=0)continue;
    if(k%6===0)g+=glow(px,py,16,c,.6*tw*sa)+spark(px,py,(5+hash(k,75)*5)*(.7+.3*tw),c,.95*sa);
    else g+=C(px.toFixed(1),py.toFixed(1),(.8+hash(k,75)*1.8).toFixed(2),c,{opacity:(tw*sa).toFixed(3)});
  }
  // A constellation joined up.
  const CN=[[.55,.7],[.62,.58],[.7,.64],[.79,.55],[.9,.6],[.86,.73],[.7,.64]].map(([u,v])=>[x+w*u,y+h*v]);
  const cp=ease.inOut(prog(lt,1.6,3.2));
  g+=mark('M'+CN.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L'),cp,'#A9D4FF',2,{opacity:.7});
  CN.slice(0,6).forEach(([px,py],k)=>{const tw=.7+.3*Math.sin(t*2.6+k*2),a=prog(lt,1.4+k*.12,1.7+k*.12);g+=glow(px,py,20,'#BFE0FF',.7*a*tw)+spark(px,py,8*tw,'#FFFFFF',a);});
  // Sun: layered glow, a turning corona and a warm disc.
  const sp=ease.back(prog(lt,0,.7));
  if(sp>0){
    g+=glow(sx,sy,200*sp,'#FF8A2A',.5)+glow(sx,sy,130*sp,'#FFD45E',.85);
    const rays=(n,r0,r1,rot,c,o)=>{let d='';for(let i=0;i<n*2;i++){const a=i/(n*2)*6.283+rot,r=(i%2?r0:r1+Math.sin(t*3+i)*5)*sp;d+=(i?'L':'M')+(sx+Math.cos(a)*r).toFixed(1)+' '+(sy+Math.sin(a)*r).toFixed(1);}return P(d+'Z',c,{opacity:o});};
    g+=rays(16,56,92,-t*.12,'#FF7A2A',.6)+rays(12,56,80,t*.2,'#FFB03A',.85);
    const sg=nid();
    g+=`<radialGradient id="${sg}" cx=".42" cy=".4"><stop offset="0" stop-color="#FFF8D0"/><stop offset=".55" stop-color="#FFD040"/><stop offset="1" stop-color="#FF9A26"/></radialGradient>`;
    g+=stk(sx,sy,sp,C(0,0,52,`url(#${sg})`)+C(-18,-18,12,'#FFFBE6',{opacity:.55})+C(18,14,6,'#FFB43A',{opacity:.6})+C(-8,22,4,'#FFB43A',{opacity:.6}));
  }
  // Moon: a cratered crescent.
  const mp=ease.back(prog(lt,.35,1));
  if(mp>0){
    const mid=nid(),mg=nid();
    g+=glow(mx-6,my+4,110*mp,'#9CC8FF',.45);
    g+=`<mask id="${mid}" maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120"><circle r="40" fill="#fff"/><circle cx="17" cy="-12" r="34" fill="#000"/></mask><radialGradient id="${mg}" cx=".3" cy=".6"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#C6DCFF"/></radialGradient>`;
    g+=stk(mx,my,mp,`<g mask="url(#${mid})">`+C(0,0,40,`url(#${mg})`)+C(-22,8,6,'#AFC6EE')+C(-12,24,4,'#AFC6EE')+C(-28,-10,3.5,'#AFC6EE')+`</g>`,1,Math.sin(t*.8)*5);
  }
  // An occasional shooting star.
  const ss=(lt%3.4)/.6;
  if(lt>1&&ss<1){const ax=x+w*(.4+ss*.3),ay=y+h*(.12+ss*.12);g+=L(ax-50,ay-20,ax,ay,'#FFFFFF',2.5,{opacity:(1-ss).toFixed(2)})+C(ax,ay,3,'#FFFFFF',{opacity:(1-ss).toFixed(2)});}
  return g;
}

// Day 5 creatures, facing +x.
const FISH=[
  (c,a)=>`<g transform="rotate(${a} -16 0)">${P('M-14 0 L-32 -13 L-28 0 L-32 13Z',c)}</g>`+P('M-4 -12 Q4 -24 12 -12Z',c)+E(0,0,21,15,c)+E(-5,0,4,13,'#FFFFFF',{opacity:.35})+C(10,-3,3.4,'#081038')+C(11,-4,1.1,'#FFFFFF'),
  (c,a)=>`<g transform="rotate(${a} -24 0)">${P('M-22 0 L-40 -11 L-34 0 L-40 11Z',c)}</g>`+P('M-10 -6 L2 -16 L10 -6Z',c)+E(0,0,29,8.5,c)+L(-14,2,18,2,'#FFFFFF',2,{opacity:.4})+C(18,-2,2.6,'#081038'),
  (c,a)=>P('M-4 -12 L-20 -34 L6 -16Z',c)+P('M-4 12 L-20 34 L6 16Z',c)+`<g transform="rotate(${a} -12 0)">${P('M-10 0 L-24 -9 L-24 9Z',c)}</g>`+P('M-14 0 Q0 -26 20 0 Q0 26 -14 0Z',c)+L(-2,-16,-2,16,'#141436',3,{opacity:.5})+L(7,-12,7,12,'#141436',3,{opacity:.5})+C(11,-3,2.6,'#081038'),
  (c,a)=>[0,1,2,3,4,5,6,7].map(i=>{const q=i/8*6.283;return P(`M${(Math.cos(q)*15).toFixed(1)} ${(Math.sin(q)*15).toFixed(1)}L${(Math.cos(q+.2)*22).toFixed(1)} ${(Math.sin(q+.2)*22).toFixed(1)}L${(Math.cos(q+.4)*15).toFixed(1)} ${(Math.sin(q+.4)*15).toFixed(1)}Z`,c);}).join('')+`<g transform="rotate(${a} -16 0)">${P('M-14 0 L-26 -8 L-26 8Z',c)}</g>`+C(0,0,17,c)+E(2,7,12,7,'#FFF3D0',{opacity:.6})+C(7,-4,5,'#FFFFFF')+C(8,-4,2.6,'#081038'),
];
const whale=(t)=>P('M-82 -6 L-116 -30 Q-112 -10 -100 -2 Q-114 8 -114 28 Z','#2B4FB0',{transform:`rotate(${(Math.sin(t*1.6)*8).toFixed(1)} -82 0)`})+E(0,0,90,34,'#2B4FB0')+E(12,14,70,16,'#7FA8E8')+[0,1,2,3].map(i=>L(-16+i*18,8,-12+i*18,26,'#5A80CC',2.5)).join('')+E(16,24,20,7,'#2240A0',{transform:'rotate(28 16 24)'})+C(58,-6,4,'#081038')+C(59,-7,1.4,'#FFFFFF')+P('M60 8 Q74 10 86 4','none',{stroke:'#16307A','stroke-width':2.5})+C(-20,-18,4,'#3F64C8')+C(4,-24,3,'#3F64C8');
const ray=(t)=>{const f=Math.sin(t*2.6)*8;return L(-30,0,-80,4,'#5A3EC0',3)+P(`M40 0 Q20 -16 -4 ${-30-f} Q-14 -10 -30 0 Q-14 10 -4 ${30+f} Q20 16 40 0Z`,'#7A5CE0')+C(0,-8,3,'#B9A6FF')+C(6,10,3,'#B9A6FF')+C(-12,2,2.4,'#B9A6FF')+C(26,-4,2.2,'#081038')+C(26,4,2.2,'#081038');};
const bird=(f,c)=>P(`M-4 -2 Q-12 ${(-18*f-4).toFixed(1)} -22 ${(-26*f).toFixed(1)} Q2 ${(-12*f).toFixed(1)} 6 -2Z`,c,{opacity:.75})+P('M-12 -2 L-26 -9 L-23 4Z',c)+E(0,0,14,8,c)+C(12,-5,7,c)+P('M18 -7 L27 -4 L18 -1Z','#FFB03A')+P(`M-6 -2 Q0 ${(-22*f-2).toFixed(1)} -14 ${(-30*f).toFixed(1)} Q8 ${(-14*f).toFixed(1)} 8 -1Z`,c)+C(14,-6,1.8,'#081038');

// Day 5: sea creatures and birds.
function daySea(t,lt,x,y,w,h){
  const sl=y+h*.42,lh=held(lt,12);
  const [kf,kd]=vg('#13307E','#3576C4'),[wf,wd]=vg('#0D64A6','#073E7C','#04204C');
  let g=kd+wd+R(x,y,w,sl-y+10,0,kf)+R(x,sl,w,h,0,wf);
  for(let k=0;k<2;k++)g+=E(wrapX(x,w,.2+k*.5,lt*5,80),y+26+k*30,70,9,'#5C94D8',{opacity:.45});
  // Light falling into the water.
  for(let k=0;k<5;k++){const sx=x+40+k*110+Math.sin(t*.5+k)*12;g+=P(`M${sx} ${sl}L${sx+34} ${sl}L${sx-30} ${y+h}L${sx-84} ${y+h}Z`,'#BFF0FF',{opacity:(.07+.04*Math.sin(t*1.3+k)).toFixed(3)});}
  // Seabed and swaying weed.
  g+=`<path d="${ridge(171,y+h-20,8,40,x-20,x+w+20,y+h+40)}" fill="#0A2E4A"/>`;
  for(let k=0;k<7;k++){const px=x+18+k*76+hash(k,81)*24,hh=40+hash(k,82)*44;let d=`M${px} ${y+h}`;for(let j=1;j<=5;j++)d+=`L${(px+Math.sin(t*1.5+j*.9+k)*j*2.2).toFixed(1)} ${(y+h-hh*j/5).toFixed(1)}`;g+=P(d,'none',{stroke:k%2?'#1FB38A':'#2ED69A','stroke-width':6});}
  // Whale and ray in the deep.
  const wp=ease.out(prog(lt,.2,1.2));
  g+=stk(x+w+110-lh*60,y+h*.72+Math.sin(t*.8)*4,.55*wp,whale(t),-1);
  g+=stk(wrapX(x,w,.05,lh*40,90),y+h*.56+Math.sin(t*1.1)*6,.6*ease.back(prog(lt,.8,1.2)),ray(t));
  // Fish of every shape.
  const FS=[[0,1,'#FF9A5C',-1,.55,48,0],[1,.95,'#7CFFE6',1,.6,64,.3],[2,1,'#FFD45E',-1,.74,34,.62],[3,.85,'#FF7BD5',1,.86,28,.1],[0,.6,'#7CFFE6',-1,.66,52,.85],[1,.75,'#FF8A7A',1,.9,58,.48],[2,.65,'#B98CFF',1,.5,40,.75],[3,.6,'#FFD45E',-1,.8,30,.35]];
  FS.forEach(([ty,s,c,dir,v,sp,ph],k)=>{
    const p=ease.back(prog(lt,.3+k*.12,.7+k*.12));if(p<=0)return;
    const px=dir>0?wrapX(x,w,ph,lh*sp,60):x+w-(wrapX(x,w,ph,lh*sp,60)-x),py=y+h*v+Math.sin(t*2+k)*5;
    g+=stk(px,py,s*p,FISH[ty](c,Math.sin(t*10+k)*14),dir);
  });
  // A small school.
  for(let k=0;k<6;k++){const px=x+w-(wrapX(x,w,.4,lh*72,90)-x)+(k%3)*18+Math.floor(k/3)*9,py=y+h*.64+Math.floor(k/3)*14+Math.sin(t*3+k)*2;g+=E(px,py,7,3.5,'#E8FCFF',{opacity:(.85*prog(lt,.5,1)).toFixed(2)})+P(`M${px+6} ${py}L${px+12} ${py-4}L${px+12} ${py+4}Z`,'#E8FCFF',{opacity:(.85*prog(lt,.5,1)).toFixed(2)});}
  // Bubbles.
  for(let k=0;k<16;k++){const q=(lt*.22*(.6+hash(k,84))+hash(k,85))%1,bx=x+hash(k,83)*w+Math.sin(t*2+k)*4,by=y+h-q*(y+h-sl-8);g+=C(bx.toFixed(1),by.toFixed(1),(2+hash(k,86)*4).toFixed(1),'none',{stroke:'#BFF4FF','stroke-width':1.6,opacity:(.75*Math.min(1,(1-q)*4)).toFixed(2)});}
  // The surface, with foam.
  g+=`<path d="${ridge(172,sl,5,22,x-40,x+w+40,sl+12)}" fill="#3FA9E0" transform="translate(${(Math.sin(t*.9)*14).toFixed(1)} 0)"/>`;
  for(let k=0;k<12;k++){const px=wrapX(x,w,k/12,lt*16,20);g+=arc(px,sl+2+Math.sin(px/30+t*2)*2,9,'#FFFFFF',3,.7);}
  // Birds with beating wings.
  const BD=[[1,'#FFFFFF',.13,52,0],[.7,'#FFD45E',.24,64,.3],[.85,'#FF8A7A',.32,44,.55],[.6,'#BFE8FF',.1,70,.7],[.75,'#FFFFFF',.27,58,.88]];
  BD.forEach(([s,c,v,sp,ph],k)=>{
    const p=ease.back(prog(lt,.1+k*.15,.5+k*.15));if(p<=0)return;
    const f=Math.sin(held(t,12)*9+k*1.7),px=wrapX(x,w,ph,lh*sp,60),py=y+h*v+Math.sin(t*1.4+k)*6+f*3;
    g+=stk(px,py,s*p,bird(f,c));
  });
  return g;
}

// Day 6 animals, facing +x, standing on y=0.
const lion=(t,k)=>{const s=Math.floor(t*6+k)%2,lg=(dx,up,c)=>R(dx,-28-(up?4:0),13,28,6,c);let g='';
  g+=P('M-42 -46 Q-68 -50 -66 -80','none',{stroke:'#E8A43A','stroke-width':7})+C(-66,-82,8,'#B5562A');
  g+=lg(-34,s,'#D08A28')+lg(26,1-s,'#D08A28')+E(0,-42,48,25,'#F5B640')+lg(-26,1-s,'#F5B640')+lg(34,s,'#F5B640');
  for(let i=0;i<11;i++){const a=i/11*6.283;g+=C(40+Math.cos(a)*27,-62+Math.sin(a)*27,11,'#D2602A');}
  g+=C(40,-62,28,'#D2602A')+C(28,-84,7,'#F5B640')+C(52,-84,7,'#F5B640')+C(42,-60,20,'#F7C64C')+E(52,-52,11,8,'#FFE6A8')+P('M52 -58 L60 -58 L56 -53Z','#5A2A1A')+C(36,-65,2.8,'#1A0A10')+C(50,-65,2.8,'#1A0A10');
  return g;};
const elephant=(t,k)=>{const s=Math.floor(t*4+k)%2,sw=Math.sin(t*1.6)*8;let g='';
  g+=P('M-64 -62 L-74 -38','none',{stroke:'#7068C0','stroke-width':5})+R(-46,-34-s*3,24,34,9,'#7068C0')+R(14,-34-(1-s)*3,24,34,9,'#7068C0');
  g+=E(-6,-58,60,42,'#8C84DC')+R(-34,-34-(1-s)*3,24,34,9,'#8C84DC')+R(28,-34-s*3,24,34,9,'#8C84DC');
  g+=C(50,-76,32,'#8C84DC')+P(`M70 -66 Q92 -54 ${(88+sw).toFixed(1)} -26 Q${(86+sw).toFixed(1)} -12 ${(98+sw).toFixed(1)} -16`,'none',{stroke:'#8C84DC','stroke-width':15});
  g+=E(30,-72,22,30,'#7A72CC')+E(32,-70,13,20,'#E6A0E0')+P('M68 -56 Q76 -44 88 -48','none',{stroke:'#FFF6E0','stroke-width':5})+C(60,-86,3.6,'#141032')+C(61,-87,1.2,'#FFFFFF');
  return g;};
const deer=(t,k)=>{const gz=clamp(Math.sin(held(t,6)*.9+1)*1.8),a=gz*58;let g='';
  g+=R(-30,-46,7,46,3,'#B8622A')+R(16,-46,7,46,3,'#B8622A')+C(-38,-64,6,'#FFF0D8');
  g+=E(0,-56,38,17,'#D97E36')+E(2,-47,26,6,'#F5C890')+[[-14,-62],[-2,-66],[10,-62],[-20,-54],[4,-58]].map(([a1,b1])=>C(a1,b1,2.6,'#FFF0D8')).join('');
  g+=R(-22,-46,7,46,3,'#D97E36')+R(24,-46,7,46,3,'#D97E36');
  g+=`<g transform="rotate(${a.toFixed(1)} 24 -62)">`+P('M24 -62 L38 -92','none',{stroke:'#D97E36','stroke-width':14})+P('M38 -106 L32 -128 M34 -120 L24 -126 M42 -106 L48 -128 M46 -120 L56 -124','none',{stroke:'#FFE6B8','stroke-width':3.5})+E(32,-104,8,4,'#C26A2E',{transform:'rotate(-30 32 -104)'})+E(46,-98,15,10,'#D97E36')+C(58,-95,3.5,'#3A1A10')+C(47,-101,2.5,'#1A0A10')+`</g>`;
  return g;};
const rabbit=()=>C(-18,-16,6,'#FFFFFF')+E(0,-16,18,15,'#EDE4FF')+E(-6,-2,12,4,'#D8CCF4')+E(10,-52,4.5,14,'#EDE4FF',{transform:'rotate(-12 10 -40)'})+E(20,-52,4.5,14,'#EDE4FF',{transform:'rotate(10 20 -40)'})+E(10,-52,2,9,'#FF9AC8',{transform:'rotate(-12 10 -40)'})+E(20,-52,2,9,'#FF9AC8',{transform:'rotate(10 20 -40)'})+C(16,-30,12,'#EDE4FF')+C(21,-32,2.4,'#1A0A20')+C(28,-29,2,'#FF7BAA');
const groundBird=(t,k)=>{const pk=Math.max(0,Math.sin(held(t,8)*3.2+k))**4*45;
  return L(-3,-10,-4,0,'#FF9A3A',3)+L(4,-10,5,0,'#FF9A3A',3)+P('M-12 -22 L-32 -34 L-30 -16Z','#2F7FE0')+C(0,-20,15,'#3FA9FF')+E(-4,-20,10,7,'#2F7FE0')+E(5,-15,9,8,'#CDEBFF')+`<g transform="rotate(${pk.toFixed(1)} 8 -28)">`+P('M8 -45 L4 -56 M12 -46 L12 -58 M16 -45 L20 -55','none',{stroke:'#FFD45E','stroke-width':3})+C(12,-36,10,'#3FA9FF')+P('M20 -39 L31 -35 L20 -31Z','#FFB03A')+C(15,-38,2.2,'#081038')+`</g>`;};

// Day 6: animals of the land.
function dayBeasts(t,lt,x,y,w,h){
  const [sf,sd]=vg('#0E2A5C','#1C5E8A');
  let g=sd+R(x,y,w,h,0,sf);
  for(let k=0;k<14;k++)g+=C(x+hash(k,91)*w,y+hash(k,92)*h*.4,1.2+hash(k,93),'#FFFFFF',{opacity:(.3+.4*Math.sin(t*2+k)**2).toFixed(2)});
  g+=`<path d="${ridge(181,y+h*.52,14,50,x-20,x+w+20,y+h+40)}" fill="#14506E"/>`;
  [[.08,.5],[.3,.47],[.9,.5]].forEach(([u,v],k)=>{const px=x+w*u,py=y+h*v+4;g+=L(px,py,px,py-16,'#0E3A50',4)+C(px,py-22,11,'#18607A');});
  g+=`<path d="${ridge(61,y+h*.66,8,70,x-20,x+w+20,y+h+60)}" fill="#22B890"/><path d="${ridge(62,y+h*.82,6,50,x-20,x+w+20,y+h+60)}" fill="#1DA483"/>`;
  const pop=k=>ease.back(prog(lt,.15+k*.3,.55+k*.3)),lh=held(lt,6);
  g+=stk(x+w*.52,y+h*.73,.92*pop(0),elephant(t,0));
  g+=stk(x+w*.84,y+h*.77,.82*pop(2),deer(t,2),-1);
  g+=stk(x+w*.13+Math.min(lh,6)*9,y+h*.82,.82*pop(1),lion(t,1));
  // The rabbit hops along in short bounds.
  const hp=lt*1.5,hi=Math.floor(hp),hf=held(hp%1,12),hop=hf<.45?Math.sin(hf/.45*Math.PI):0;
  g+=stk(x+w*.3+Math.min(hi+Math.min(hf/.45,1),9)*9,y+h*.95-hop*20,1*pop(3),rabbit());
  g+=stk(x+w*.07,y+h*.97,.85*pop(4),groundBird(t,4));
  // Foreground grass and a few flowers.
  for(let k=0;k<62;k++){const px=x-4+k*(w+8)/61,hh=12+hash(k,95)*22,sw=Math.sin(t*1.6+k*.4)*5;g+=L(px,y+h+4,px+sw,y+h+4-hh,['#2ED69A','#17A378','#45F0B0'][k%3],4);}
  [[.2,'#FF7BD5'],[.45,'#FFD45E'],[.62,'#7CFFE6']].forEach(([u,c],k)=>{const px=x+w*u+Math.sin(t*1.4+k)*3,py=y+h-26;g+=glow(px,py,16,c,.7)+C(px,py,5,c);});
  return g;
}

const DAYFN=[dayLight,daySky,dayLand,dayLights,daySea,dayBeasts];
function dayArt(i,t,lt,x,y,w,h){
  const id=nid();
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/></clipPath><g clip-path="url(#${id})">`+DAYFN[i](t,lt,x,y,w,h)+'</g>';
}
