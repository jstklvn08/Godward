// Generates an ambient score and a sound-effects track for "Creation and the Fall", as two 48 kHz stereo WAVs.
// Deterministic: a seeded noise source, no samples from anywhere else.
const fs=require('fs');
const [htmlPath,outDir]=process.argv.slice(2);
const SR=48000,DUR=261.5,N=Math.ceil(SR*DUR);
let seed=12345;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const nz=()=>rnd()*2-1;
const mtof=m=>440*Math.pow(2,(m-69)/12);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));

// ---------- Simple stereo reverb (Freeverb-style) ----------
function reverb(L,R,{room=.86,damp=.3,wet=.35}={}){
  const combs=[1557,1617,1491,1422,1277,1356,1188,1116],aps=[556,441,341,225];
  const run=(x,spread)=>{
    const out=new Float32Array(x.length);
    combs.forEach(d0=>{const d=Math.round((d0+spread)*SR/44100),buf=new Float32Array(d);let i=0,st=0;
      for(let n=0;n<x.length;n++){const y=buf[i];st=y*(1-damp)+st*damp;buf[i]=x[n]*.015+st*room;out[n]+=y;i=(i+1)%d;}});
    aps.forEach(d0=>{const d=Math.round((d0+spread)*SR/44100),buf=new Float32Array(d);let i=0;
      for(let n=0;n<x.length;n++){const b=buf[i],y=-out[n]+b;buf[i]=out[n]+b*.5;out[n]=y;i=(i+1)%d;}});
    return out;
  };
  const m=new Float32Array(L.length);for(let n=0;n<L.length;n++)m[n]=(L[n]+R[n])*.5;
  const wl=run(m,0),wr=run(m,23);
  for(let n=0;n<L.length;n++){L[n]=L[n]*(1-wet)+wl[n]*wet*3;R[n]=R[n]*(1-wet)+wr[n]*wet*3;}
}

// ---------- Music ----------
// Sections: [start, end, chords (MIDI notes), seconds per chord, brightness, level, chime density]
const SECT=[
  [0,12.4,[[38,50,57,62,66],[38,50,57,62,69]],6.2,.35,.35,0],                         // the deep: dark, open
  [12.4,40.2,[[38,50,57,62,66,69],[35,47,54,59,62,66],[43,55,59,62,66,71],[45,57,61,64,69,73]],3.5,.75,.9,.9], // six days: wonder
  [40.2,61.6,[[43,55,59,62,67,71],[40,52,55,59,64,67],[36,48,55,60,64,67],[38,50,54,57,62,66]],5,.7,.85,.6], // humanity, rest
  [61.6,124,[[43,55,59,62,67],[40,52,55,59,64],[36,48,55,60,64],[38,50,57,62,66]],6,.6,.75,.45], // the garden
  [124,151.8,[[38,50,57,62,65],[34,46,53,58,62],[31,43,50,55,58],[33,45,52,57,61]],5,.45,.75,.2], // the serpent: minor
  [151.8,176.3,[[38,50,53,57,62],[34,46,50,53,58],[36,48,51,55,60],[33,45,49,52,57]],4.5,.4,.8,.1], // the fruit
  [176.3,236.9,[[26,38,50,53,57],[26,38,49,53,58],[22,34,46,50,53],[24,36,48,51,55]],7,.3,.7,.05], // judgment: low, bare
  [236.9,247.1,[[41,53,57,60,65,69],[38,50,57,60,65,69]],5,.65,.8,.5],                // mercy: warm
  [247.1,261.5,[[38,50,57,62,65],[34,46,53,58,62,65],[41,53,57,60,65,72],[38,50,57,62,66,69]],3.6,.5,.85,.3], // exile, last chord bittersweet major
];
const ML=new Float32Array(N),MR=new Float32Array(N);
// Pad voice: detuned soft saws through a gentle one-pole low-pass, slow swell.
function pad(t0,t1,notes,bright,level){
  const a=1.6,r=2.2,n0=Math.max(0,Math.floor(t0*SR)),n1=Math.min(N,Math.floor((t1+r)*SR));
  notes.forEach((m,k)=>{
    const f=mtof(m),dets=[-.11,0,.09],pan=.5+(k%2?.18:-.18)*(k/notes.length+.3),g=level*.042/Math.sqrt(notes.length)*(m<40?1.3:1);
    const ph=dets.map(()=>rnd());let lp=0;const cut=clamp(.02+bright*.09*(m<50?.6:1),0,.5);
    for(let n=n0;n<n1;n++){
      const t=n/SR,env=clamp((t-t0)/a)*clamp((t1+r-t)/r)*(t<t1?1:1)*(.85+.15*Math.sin(t*.7+k));
      let s=0;dets.forEach((d,j)=>{ph[j]+=f*(1+d/100)/SR;ph[j]-=Math.floor(ph[j]);s+=ph[j]*2-1;});
      lp+=cut*(s/3-lp);
      const v=lp*env*g;ML[n]+=v*(1-pan)*2*.5+v*.5;MR[n]+=v*pan*2*.5+v*.5;
    }
  });
}
function bell(t,m,amp,pan=.5,dec=2.6){
  const f=mtof(m),parts=[[1,1],[2.01,.35],[2.76,.25],[5.4,.08]],n0=Math.floor(t*SR),n1=Math.min(N,n0+Math.floor(dec*2*SR));
  for(let n=n0;n<n1;n++){const tt=(n-n0)/SR;let s=0;parts.forEach(([p,a])=>s+=Math.sin(2*Math.PI*f*p*tt)*a*Math.exp(-tt*(1.4+p*.5)/dec*2.2));const v=s*amp*Math.min(1,tt*400);ML[n]+=v*(1-pan);MR[n]+=v*pan;}
}
SECT.forEach(([s0,s1,ch,per,br,lv,chime])=>{
  let k=0;
  for(let t=s0;t<s1;t+=per,k++){
    const c=ch[k%ch.length];pad(t,Math.min(t+per+.6,s1+.4),c,br,lv);
    // Sparse chimes from the chord's upper notes.
    for(let b=0;b<4;b++)if(rnd()<chime){const tt=t+b*per/4+rnd()*.3;if(tt<s1)bell(tt,c[2+Math.floor(rnd()*(c.length-2))]+12,.05*lv,rnd(),2.2);}
  }
});
// Angelic choir: detuned saw voices through 'ah' formants, slow vibrato, swelling at "Then God spoke".
function choir(t0,t1,notes,level,att=2.5,rel=3){
  const F=[[800,1,.08],[1150,.55,.08],[2900,.22,.1],[3300,.12,.1]],n0=Math.floor(t0*SR),n1=Math.min(N,Math.floor((t1+rel)*SR));
  notes.forEach((m,k)=>{for(let v=0;v<3;v++){
    const f0=mtof(m)*(1+(v-1)*.004),pan=.25+.5*((k*3+v)%5)/4,st=F.map(()=>[0,0]);let ph=rnd(),vp=rnd()*6;
    for(let n=n0;n<n1;n++){const t=n/SR,env=clamp((t-t0)/att)*clamp((t1+rel-t)/rel);
      vp+=2*Math.PI*(4.6+v*.3)/SR;const f=f0*(1+.004*Math.sin(vp)*clamp((t-t0)/1.5));ph+=f/SR;ph-=Math.floor(ph);const x=ph*2-1;
      let y=0;F.forEach(([fc,gn,q],j)=>{const Fq=2*Math.sin(Math.PI*fc/SR),s_=st[j],hi=x-s_[0]-q*s_[1];s_[1]+=Fq*hi;s_[0]+=Fq*s_[1];y+=s_[1]*gn;});
      const out=y*env*level*.012/Math.sqrt(notes.length);ML[n]+=out*(1-pan);MR[n]+=out*pan;}}});
}
choir(0,7.4,[62,66,69,74],1.0,3);                  // heavens: D major, wide and soft
choir(7.0,10.2,[62,65,69,74],.55,1.5,2);            // darkness: the third falls minor, thinner
choir(10.06,14.5,[62,66,69,74,78,81],1.5,.8,3.5);   // "Then God spoke": bright swell
choir(14.0,38,[66,69,74,78],.45,3,4);               // under the six days, distant
// High shimmer of bells over the heavens.
for(let k=0;k<22;k++){const tt=.4+k*.32+rnd()*.2;if(tt<7.2)bell(tt,[86,90,93,98][k%4],.03,rnd(),3);}
for(let k=0;k<14;k++)bell(10.1+k*.18,[86,90,93,98,102][k%5],.04,rnd(),3.5);
// A low sub drone under the darker half.
for(let n=Math.floor(124*SR);n<Math.floor(237*SR);n++){const t=n/SR,e=clamp((t-124)/6)*clamp((237-t)/4),v=Math.sin(2*Math.PI*36.7*t)*.05*e;ML[n]+=v;MR[n]+=v;}
// Fade out at the very end.
for(let n=0;n<N;n++){const t=n/SR,f=clamp((260.6-t)/3.5)*clamp(t/2.5);ML[n]*=f;MR[n]*=f;}
reverb(ML,MR,{room:.88,damp:.35,wet:.45});

// ---------- Sound effects ----------
const XL=new Float32Array(N),XR=new Float32Array(N);
const add=(t,arr,pan=.5,gain=1)=>{const n0=Math.floor(t*SR);for(let i=0;i<arr.length&&n0+i<N;i++){if(n0+i<0)continue;XL[n0+i]+=arr[i]*(1-pan)*2*gain*.5+arr[i]*gain*.5*0;XR[n0+i]+=arr[i]*pan*2*gain*.5;XL[n0+i]+=arr[i]*gain*.25;XR[n0+i]+=arr[i]*gain*.25;}};
// Band-pass noise helper (state-variable filter).
function bandNoise(len,fc,q,envF,fcF=null){
  const out=new Float32Array(Math.floor(len*SR));let lo=0,bp=0;
  for(let n=0;n<out.length;n++){const t=n/SR,f=fcF?fcF(t):fc,F=2*Math.sin(Math.PI*Math.min(f,SR/6)/SR);const hi=nz()-lo-q*bp;bp+=F*hi;lo+=F*bp;out[n]=bp*envF(t);}
  return out;
}
const slap=()=>{const a=bandNoise(.09,900,1.2,t=>clamp(t/.004)*Math.exp(-t*60)*.28),b=new Float32Array(a.length);for(let n=0;n<a.length;n++){const t=n/SR;b[n]=a[n]+Math.sin(2*Math.PI*(110-200*t)*t)*Math.exp(-t*45)*.25;}return b;};
const whoosh=(len=.75,up=true)=>bandNoise(len,0,.7,t=>Math.sin(Math.PI*clamp(t/len))**2*.5,t=>up?300+3200*(t/len):3500-3000*(t/len));
const marker=len=>bandNoise(len+.15,1500,.9,t=>.1*Math.sin(Math.PI*clamp(t/(len+.15)))**2);
const chime=(m,amp=.18)=>{const f=mtof(m),len=3,o=new Float32Array(len*SR);for(let n=0;n<o.length;n++){const t=n/SR;o[n]=(Math.sin(2*Math.PI*f*t)+.4*Math.sin(2*Math.PI*f*2.756*t)*Math.exp(-t*3)+.2*Math.sin(2*Math.PI*f*5.4*t)*Math.exp(-t*6))*Math.exp(-t*1.6)*amp*Math.min(1,t*300);}return o;};
const shimmer=(len,amp=.12)=>{const o=new Float32Array(Math.floor(len*SR));for(let k=0;k<26;k++){const t0=rnd()*len*.8,f=mtof(84+Math.floor(rnd()*14)),n0=Math.floor(t0*SR);for(let n=n0;n<o.length&&n<n0+SR*1.2;n++){const t=(n-n0)/SR;o[n]+=Math.sin(2*Math.PI*f*t)*Math.exp(-t*4)*amp*.35*Math.min(1,t*200);}}return o;};
const rip=len=>bandNoise(len,1800,.6,t=>(rnd()<.35?1:.3)*clamp(t/.02)*Math.exp(-t*2.2)*.6,t=>900+1600*Math.sin(t*40)**2);
const thump=()=>{const o=new Float32Array(.2*SR);for(let n=0;n<o.length;n++){const t=n/SR;o[n]=Math.sin(2*Math.PI*(90-120*t)*t)*Math.exp(-t*30)*.4;}return o;};
const fire=len=>{const o=bandNoise(len,600,1.2,t=>clamp(t/.3)*clamp((len-t)/.6)*.35);for(let k=0;k<len*6;k++){const n0=Math.floor(rnd()*o.length);for(let i=0;i<120&&n0+i<o.length;i++)o[n0+i]+=nz()*Math.exp(-i/25)*.5;}return o;};
const swell=(len,m)=>{const f=mtof(m),o=new Float32Array(Math.floor(len*SR));for(let n=0;n<o.length;n++){const t=n/SR;o[n]=(Math.sin(2*Math.PI*f*t)+.5*Math.sin(2*Math.PI*f*1.5*t))*Math.sin(Math.PI*t/len)**2*.12;}return o;};

const src=fs.readFileSync(htmlPath,'utf8');
const pieces=[...src.matchAll(/(?:piece|verse)\(t,(\d*\.?\d+)/g)].map(m=>+m[1]);
const DAYS=[12.56,17.0,20.98,24.52,29.04,33.72];
pieces.push(...DAYS.map(d=>d+.3),199.1,217.98,224.68);
pieces.sort((a,b)=>a-b).forEach((t,i)=>add(t,slap(),.35+.3*rnd(),.8));
[...src.matchAll(/hlAt:(\d*\.?\d+),hlDur:(\d*\.?\d+)/g)].forEach(m=>add(+m[1],marker(+m[2]),.6,.55));
[...src.matchAll(/(?:mark|arrow)\([^;]*?prog\(t,(\d*\.?\d+),(\d*\.?\d+)\)/g)].forEach(m=>add(+m[1],marker(+m[2]-+m[1]),.5,.5));
// Camera moves between sheets.
const CUTS=[12.45,40.2,61.6,71.2,94.5,123.9,151.8,176.3,198.8,236.9,247.1];
CUTS.forEach(c=>add(c-.4,whoosh(.8),.5,.75));
// Each day of creation rings a note, rising.
const scale=[74,76,78,81,83,86];DAYS.forEach((d,i)=>{add(d,chime(scale[i],.16),.3+i*.08);add(d+.1,shimmer(1.6,.1),.6);});
// Story moments.
add(10.1,whoosh(1.6),.5,.9);add(10.6,shimmer(2.2,.14),.5);                 // light crosses the dark
add(66.8,shimmer(3.4,.13),.6);add(67,whoosh(2.8),.6,.5);                    // breath of life
add(76.2,chime(71,.12),.4);add(76.4,chime(78,.1),.6);                       // the two trees
for(let k=0;k<5;k++)for(let s=0;s<3;s++)add(100.8+k*.9+s*.8,thump(),.5,.2); // animals walking past
add(109.4,chime(83,.16),.6);add(109.5,shimmer(2,.12),.6);                   // the woman
add(119.3,chime(79,.12),.5);add(119.4,chime(83,.1),.5);                     // one flesh
add(124,swell(4,38),.6,.8);                                                 // the serpent arrives
add(156.6,thump(),.5,.8);add(156.7,bandNoise(.12,3000,.8,t=>Math.exp(-t*30)*.6),.5); // the bite
add(157.4,rip(.8),.5,.5);                                                  // the world tears
add(163.3,swell(3,33),.5,.9);                                               // eyes opened
add(183.5,swell(3.5,45),.6,.9);                                             // "Where are you?"
add(232.4,bandNoise(4,500,1.4,t=>Math.sin(Math.PI*t/4)*.18),.5);           // dust
add(242.6,chime(77,.14),.5);add(242.7,shimmer(2.4,.12),.5);                 // mercy
add(253.2,whoosh(1.2),.5,.6);add(254.0,fire(5.5),.7,.8);                    // cherubim, flaming sword

// ---------- Write ----------
function wav(path,L,R,gain){
  let peak=0;for(let n=0;n<N;n++)peak=Math.max(peak,Math.abs(L[n]),Math.abs(R[n]));
  const g=gain/Math.max(peak,1e-6),b=Buffer.alloc(44+N*4);
  b.write('RIFF',0);b.writeUInt32LE(36+N*4,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(N*4,40);
  for(let n=0;n<N;n++){b.writeInt16LE(Math.round(clamp(L[n]*g,-1,1)*32767),44+n*4);b.writeInt16LE(Math.round(clamp(R[n]*g,-1,1)*32767),46+n*4);}
  fs.writeFileSync(path,b);console.log(path,'peak',peak.toFixed(3));
}
wav(outDir+'/music.wav',ML,MR,.9);
wav(outDir+'/sfx.wav',XL,XR,.9);
