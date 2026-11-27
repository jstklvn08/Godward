  // The heavens: a vast vault of slow nebula veils and layered paper cloud banks rising in tiers.
  // No stars, sun or light source yet: the colours are deep and self-lit, like ink on dark paper.
  const HZ=1250,hv=k=>ease.back(prog(t,1.5+k*.14,2.4+k*.14)),veil=prog(t,1.4,3.0)*(1-.75*prog(t,7.4,9.4));
  // Nebula veils sweeping in an S through the upper frame.
  for(let k=0;k<16;k++){const u=k/15,x=540+Math.sin(u*5.2+t*.18)*360+Math.sin(t*.3+k)*30,y=lerp(160,1120,u)+Math.cos(t*.22+k*.7)*30;
    g+=glow(x,y,(240+hash(k,81)*200)*(.6+.4*veil),['#6A2A9E','#2A4AB0','#8A2A8A','#1E6A9A','#4A2ABE'][k%5],.42*veil);}
  // Fine curling filaments through the veils.
  for(let k=0;k<7;k++){let d='';for(let j=0;j<=24;j++){const u=j/24,x=lerp(-60,1140,u),y=260+k*120+Math.sin(u*6+k*1.3+t*.35)*70+Math.sin(u*13+k)*18;d+=(j?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);}
    g+=P(d,'none',{stroke:['#B89CFF','#7FC8FF','#E09CF0'][k%3],'stroke-width':2.5,opacity:(.22*veil).toFixed(3),'stroke-dasharray':`${80+k*20} ${50+k*10}`,'stroke-dashoffset':(-t*40*(k%2?1:-1)).toFixed(1)});}
  // Paper cloud banks, far to near, each rising from the horizon with a soft rim.
  const bank=(seed,base,col,rim,drift)=>{let d=`M-200 ${HZ+60}L-200 ${base}`,x=-200+((t*drift)%120);
    let i=0;while(x<1300){const r=46+hash(i,seed)*70;d+=`A${r.toFixed(1)} ${(r*.8).toFixed(1)} 0 0 1 ${(x+2*r).toFixed(1)} ${(base+(hash(i,seed+1)-.5)*30).toFixed(1)}`;x+=2*r;i++;}
    d+=`L1300 ${HZ+60}Z`;return `<path d="${d}" fill="#000" opacity=".35" transform="translate(0 -12)" filter="url(#dblur2)"/><path d="${d}" fill="${col}"/><path d="${d}" fill="none" stroke="${rim}" stroke-width="3" opacity=".45"/>`;};
  const BK=[[220,'#14104A','#6A5CD8',6],[420,'#1C1462','#7A66E8',-9],[600,'#28187A','#9A7CF0',12],[780,'#2A2A92','#8A9CFF',-15],[950,'#253CA0','#8AB8FF',18],[1100,'#2A4EAE','#A8D0FF',-22]];
  BK.forEach(([b,c,rm,dr],k)=>{const r=hv(k);if(r<=0)return;g+=`<g transform="translate(0 ${((1-r)*(HZ+60-b)).toFixed(1)})">${bank(200+k*7,b,c,rm,dr)}</g>`;});
  // Drifting mist between the banks.
  for(let k=0;k<6;k++){const x=((hash(k,91)*1400+t*(20+k*6))%1400)-160,y=300+k*150;g+=E(x,y,200,22,'#C8B8FF',{opacity:(.08*veil).toFixed(3)});}
