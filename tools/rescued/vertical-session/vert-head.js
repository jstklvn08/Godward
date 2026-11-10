// ---------- Vertical mode, verse timing, subtitles, character life ----------
// ?v=1 renders a 1080x1920 portrait cut: a camera moves over the sheets, verses sit on top, subtitles below.
const VERT=/[?&]v=1/.test(location.search);
let CURT=0;
// Narration words: [text, start, end] from a word-level transcript of "Creation and the fall.wav".
const SUBW=__SUBW__;
const normW=s=>s.toLowerCase().replace(/’/g,"'").replace(/[^a-z']/g,'');
const SUBN=SUBW.map(w=>normW(w[0]));
// A verse leaves the screen about a second after the narration finishes saying it.
const VEND={};
function verseEnd(at,lines){
  const key=at+'|'+lines.join(' ');
  if(VEND[key]!=null)return VEND[key];
  const vw=lines.join(' ').split(/\s+/).map(normW).filter(Boolean);
  let best=null;
  for(let n=Math.min(3,vw.length);n>=1&&best==null;n--){
    const tail=vw.slice(-n);
    for(let i=n-1;i<SUBW.length;i++){
      if(SUBW[i][1]<at-2)continue;if(SUBW[i][1]>at+25)break;
      if(tail.every((w,j)=>SUBN[i-n+1+j]===w)){best=SUBW[i][2];break;}
    }
  }
  return VEND[key]=Math.max(best!=null?best+1.3:at+2+vw.length*.42,at+2.5);
}
// Verses: in landscape they fade out in place; in portrait they are queued for the top band.
const VQ=[];
function verse(t,at,x,y,lines,ref,o={}){
  const end=verseEnd(at,lines);
  if(VERT){VQ.push({at,end,lines,ref,o});return `<!--V${VQ.length-1}-->`;}
  const fo=prog(t,end,end+.5);
  if(fo>=1)return '';
  return G(`translate(0 ${(-30*ease.inOut(fo)).toFixed(1)})`,verse0(t,at,x,y,lines,ref,o),1-fo);
}
// Re-wrap a verse for the narrow frame, keeping the highlighted phrase on one line.
function wrapVerse(lines,size,maxW,hl){
  let text=lines.join(' ');const toks=[];
  if(hl&&text.includes(hl)){const i=text.indexOf(hl);toks.push(...text.slice(0,i).split(/\s+/).filter(Boolean),hl,...text.slice(i+hl.length).split(/\s+/).filter(Boolean));}
  else toks.push(...text.split(/\s+/).filter(Boolean));
  const out=[];let cur='';
  toks.forEach(w=>{const n=cur?cur+' '+w:w;if(cur&&tw(n,size)>maxW){out.push(cur);cur=w;}else cur=n;});
  if(cur)out.push(cur);
  // Join a hanging highlighted phrase back onto its punctuation.
  return out.map(s=>s.replace(/ ([,.;:!?”])/g,'$1'));
}
function verseOverlay(t){
  let g='',y=70;
  VQ.filter(v=>t>=v.at&&t<v.end+.5).sort((a,b)=>a.at-b.at).forEach(v=>{
    const size=Math.min(54,Math.max(44,v.o.size||46)),lines=wrapVerse(v.lines,size,880,v.o.hl);
    const w=Math.max(...lines.map(s=>tw(s,size)))+100,h=lines.length*size*1.32+size*.9,x=(1080-w)/2;
    const out=prog(t,v.end,v.end+.5);
    g+=G(`translate(0 ${(-50*ease.inOut(out)).toFixed(1)})`,verse0(t,v.at,x,y,lines,v.ref,Object.assign({},v.o,{size,labelBelow:true,maxW:0})),1-out);
    y+=h+(v.ref?70:30);
  });
  return g;
}
// Subtitles: short cues, the word being spoken turns yellow.
const CUES=(()=>{
  const cues=[];let cur=null;
  SUBW.forEach((w,i)=>{
    const prev=SUBW[i-1],len=cur?cur.w.map(x=>x[0]).join(' ').length:0;
    const brk=!cur||len+w[0].length+1>34||(prev&&/[.?!]$/.test(prev[0]))||(prev&&w[1]-prev[2]>.7)||(prev&&/[,;:]$/.test(prev[0])&&len>18);
    if(brk){cur={w:[]};cues.push(cur);}
    cur.w.push(w);
  });
  cues.forEach((c,i)=>{c.s=c.w[0][1];c.e=Math.min(c.w[c.w.length-1][2]+.6,cues[i+1]?cues[i+1].w[0][1]:1e9);});
  return cues;
})();
function subtitles(t){
  const c=CUES.find(c=>t>=c.s-.05&&t<c.e);if(!c)return '';
  const size=VERT?56:40,maxW=VERT?960:1500,cx=VERT?540:960,y0=VERT?1700:1046,F='Segoe UI',WT=800;
  const sp=tw(' ',size,F,WT),lines=[[]];let lw=0;
  c.w.forEach(w=>{const ww=tw(w[0],size,F,WT);if(lines[lines.length-1].length&&lw+sp+ww>maxW){lines.push([]);lw=0;}lines[lines.length-1].push(w);lw+=(lw?sp:0)+ww;});
  const pop=ease.back(prog(t,c.s-.05,c.s+.12)),lh=size*1.2,top=y0-(lines.length-1)*lh;
  let g='';
  lines.forEach((ln,li)=>{
    const tot=ln.reduce((a,w,i)=>a+tw(w[0],size,F,WT)+(i?sp:0),0);let x=cx-tot/2;
    ln.forEach(w=>{const said=t>=w[1];g+=T(x,top+li*lh,w[0],{size,font:F,weight:WT,fill:said?YEL:'#FFFFFF',extra:`stroke="#08081A" stroke-width="${VERT?11:9}" stroke-linejoin="round" paint-order="stroke"`});x+=tw(w[0],size,F,WT)+sp;});
  });
  return `<g transform="${sc(cx,y0,lerp(.86,1,pop))}">${g}</g>`;
}
// Characters breathe, shift their weight, tilt their heads, and gesture while they speak.
const TALK=[[129.4,131.4,1],[132.3,136.6,1],[186.9,189.3,0],[191.6,195.4,0],[196.0,198.6,1],[112.6,116.2,0]];
const chubby=(x,y,s,o={})=>{
  const ht=held(CURT,12),ph=(o.f?1.9:0)+(o.flip===-1?.7:0),br=Math.sin(ht*2.4+ph);
  const o2=Object.assign({},o);
  o2.lean=(o.lean||0)+Math.sin(ht*1.1+ph)*5;
  if(o.walk==null)o2.walk=Math.sin(ht*1.3+ph)*.25;
  const tk=TALK.find(k=>CURT>=k[0]&&CURT<k[1]&&(k[2]===1)===!!o.f);
  if(tk)o2.reach=Math.max(o.reach||0,.22+.3*Math.abs(Math.sin(ht*4.4+ph)));
  else if(!o.reach)o2.reach=.06+.06*Math.sin(ht*.8+ph);
  const sy=1+.03*br,sx=1-.018*br,rot=Math.sin(ht*.9+ph)*2.4;
  return `<g transform="translate(${x} ${y}) rotate(${rot.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-x} ${-y})">`+chubby0(x,y,s,o2)+'</g>';
};
