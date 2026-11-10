// Scene-by-scene score for "Creation and the Fall": every instrument synthesised here, timed to the narration.
// A recurring four-note Eden motif (D A F# E) runs through it and changes with the story.
const fs=require('fs');
const out=process.argv[2];
const SR=48000,DUR=261.5,N=Math.ceil(SR*DUR);
let seed=4242;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const nz=()=>rnd()*2-1,clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),mtof=m=>440*Math.pow(2,(m-69)/12);
const ML=new Float32Array(N),MR=new Float32Array(N);
const put=(n,v,pan)=>{if(n>=0&&n<N){ML[n]+=v*(1-pan)*1.4;MR[n]+=v*pan*1.4;}};
const span=(t0,len)=>[Math.max(0,Math.floor(t0*SR)),Math.min(N,Math.floor((t0+len)*SR))];

// ---------- Instruments ----------
function pad(t0,t1,notes,lv=1,bright=.5,a=1.6,r=2.2){
  const [n0,n1]=span(t0,t1-t0+r);
  notes.forEach((m,k)=>{const f=mtof(m),ph=[rnd(),rnd(),rnd()],pan=.3+.4*(k%3)/2,g=lv*.05/Math.sqrt(notes.length);let lp=0;const cut=.02+bright*.08;
    for(let n=n0;n<n1;n++){const t=n/SR,env=clamp((t-t0)/a)*clamp((t1+r-t)/r);let s=0;for(let j=0;j<3;j++){ph[j]+=f*(1+(j-1)*.0012)/SR;ph[j]-=Math.floor(ph[j]);s+=ph[j]*2-1;}lp+=cut*(s/3-lp);put(n,lp*env*g,pan);}});
}
function choir(t0,t1,notes,lv=1,att=2.5,rel=3){
  const F=[[800,1,.08],[1150,.55,.08],[2900,.22,.1]],[n0,n1]=span(t0,t1-t0+rel);
  notes.forEach((m,k)=>{for(let v=0;v<2;v++){const f0=mtof(m)*(1+(v-.5)*.006),pan=.2+.6*((k*2+v)%5)/4,st=F.map(()=>[0,0]);let ph=rnd(),vp=rnd()*6;
    for(let n=n0;n<n1;n++){const t=n/SR,env=clamp((t-t0)/att)*clamp((t1+rel-t)/rel);vp+=2*Math.PI*(4.8+v*.4)/SR;ph+=f0*(1+.004*Math.sin(vp))/SR;ph-=Math.floor(ph);const x=ph*2-1;
      let y=0;F.forEach(([fc,gn,q],j)=>{const Fq=2*Math.sin(Math.PI*fc/SR),s_=st[j],hi=x-s_[0]-q*s_[1];s_[1]+=Fq*hi;s_[0]+=Fq*s_[1];y+=s_[1]*gn;});
      put(n,y*env*lv*.014/Math.sqrt(notes.length),pan);}}});
}
function bell(t0,m,lv=1,pan=.5,dec=2.4){const f=mtof(m),[n0,n1]=span(t0,dec*2.2),P=[[1,1],[2.01,.35],[2.76,.22],[5.4,.07]];
  for(let n=n0;n<n1;n++){const t=(n-n0)/SR;let s=0;P.forEach(([p,a])=>s+=Math.sin(2*Math.PI*f*p*t)*a*Math.exp(-t*(1.3+p*.6)/dec*2));put(n,s*lv*.05*Math.min(1,t*500),pan);}}
// Plucked string (Karplus-Strong): harp, kalimba, pizzicato.
function pluck(t0,m,lv=1,pan=.5,len=2.2,bright=.5){const f=mtof(m),P=Math.max(2,Math.round(SR/f)),buf=new Float32Array(P);for(let i=0;i<P;i++)buf[i]=nz();
  const [n0,n1]=span(t0,len);let i=0,last=0;const damp=.4+.096*bright*5;for(let n=n0;n<n1;n++){const a=buf[i],b=buf[(i+1)%P],y=(a*damp+b*(1-damp))*.996;buf[i]=y;i=(i+1)%P;last=y;const t=(n-n0)/SR;put(n,y*lv*.06*Math.min(1,t*800),pan);}}
// Soft piano-ish tone: a few decaying partials with a gentle hammer.
function piano(t0,m,lv=1,pan=.5,dec=3,detune=0){const f=mtof(m)*(1+detune),[n0,n1]=span(t0,dec*1.8);
  for(let n=n0;n<n1;n++){const t=(n-n0)/SR;const s=Math.sin(2*Math.PI*f*t)*Math.exp(-t/dec)+.4*Math.sin(2*Math.PI*f*2.003*t)*Math.exp(-t/(dec*.5))+.15*Math.sin(2*Math.PI*f*3.01*t)*Math.exp(-t/(dec*.3));put(n,s*lv*.05*Math.min(1,t*300),pan);}}
// Breathy flute: sine with a touch of 2nd harmonic, vibrato and breath noise.
function flute(t0,m,len,lv=1,pan=.5){const f=mtof(m),[n0,n1]=span(t0,len+.3);let ph=0,lp=0;
  for(let n=n0;n<n1;n++){const t=(n-n0)/SR,env=clamp(t/.12)*clamp((len+.3-t)/.3),vb=1+.006*Math.sin(2*Math.PI*5.2*t)*clamp((t-.25)/.3);ph+=f*vb/SR;lp+=.08*(nz()-lp);
    put(n,(Math.sin(2*Math.PI*ph)+.18*Math.sin(4*Math.PI*ph)+lp*.25)*env*lv*.05,pan);}}
function drum(t0,lv=1,f0=70,pan=.5){const [n0,n1]=span(t0,.5);for(let n=n0;n<n1;n++){const t=(n-n0)/SR;put(n,Math.sin(2*Math.PI*(f0-30*Math.min(t,.3))*t)*Math.exp(-t*9)*lv*.18,pan);}}
function chirp(t0,lv=1,pan=.5){const f0=2400+rnd()*1800,k=2+Math.floor(rnd()*3);for(let j=0;j<k;j++){const ts=t0+j*.11,[n0,n1]=span(ts,.08);let ph=0;for(let n=n0;n<n1;n++){const t=(n-n0)/SR,f=f0*(1+.5*Math.sin(t*60));ph+=f/SR;put(n,Math.sin(2*Math.PI*ph)*Math.sin(Math.PI*t/.08)*lv*.01,pan);}}}
function noiseBed(t0,t1,fc,lv,q=1,mod=.3,pan=.5){const [n0,n1]=span(t0,t1-t0);let lo=0,bp=0;const F=2*Math.sin(Math.PI*fc/SR);
  for(let n=n0;n<n1;n++){const t=n/SR,env=clamp((t-t0)/1.5)*clamp((t1-t)/1.5)*(1-mod+mod*(.5+.5*Math.sin(t*.7+Math.sin(t*.23)*3)));const hi=nz()-lo-q*bp;bp+=F*hi;lo+=F*bp;put(n,bp*env*lv*.05,pan);}}
function glide(t0,len,m0,m1,lv=1,pan=.5){const [n0,n1]=span(t0,len);let ph=0,lp=0;for(let n=n0;n<n1;n++){const t=(n-n0)/SR,u=t/len,f=mtof(m0+(m1-m0)*(.5-.5*Math.cos(Math.PI*u)));ph+=f/SR;ph-=Math.floor(ph);lp+=.03*((ph*2-1)-lp);put(n,lp*Math.sin(Math.PI*u)*lv*.12,pan);}}
function tick(t0,lv=1,pan=.5){const [n0,n1]=span(t0,.03);for(let n=n0;n<n1;n++){const t=(n-n0)/SR;put(n,nz()*Math.exp(-t*300)*lv*.08,pan);}}
function tremolo(t0,t1,notes,lv=1){const [n0,n1]=span(t0,t1-t0);notes.forEach((m,k)=>{const f=mtof(m);let ph=rnd(),lp=0;for(let n=n0;n<n1;n++){const t=n/SR,u=(t-t0)/(t1-t0),am=.5+.5*Math.sin(2*Math.PI*(7+5*u)*t);ph+=f/SR;ph-=Math.floor(ph);lp+=.05*((ph*2-1)-lp);put(n,lp*am*u*u*lv*.08/Math.sqrt(notes.length),.3+.4*k/notes.length);}});}
function reversed(t0,len,notes,lv=1){const [n0,n1]=span(t0,len);notes.forEach((m,k)=>{const f=mtof(m);for(let n=n0;n<n1;n++){const t=(n-n0)/SR,u=t/len;put(n,(Math.sin(2*Math.PI*f*t)+.3*Math.sin(4*Math.PI*f*t))*Math.pow(u,3)*lv*.04,.5);}});}
const EDEN=[62,69,66,64],EDENm=[62,69,65,64];
const motif=(fn,t0,step,notes,tr=0,...a)=>notes.forEach((m,i)=>fn(t0+i*step,m+tr,...a));

// ---------- 0-12.45  Opening (approved): holy choir and bells, darkness thins it ----------
pad(0,12.4,[38,50,57,62],.35,.3,3,3);
choir(0,7.4,[62,66,69,74],1.0,3);choir(7.0,9.4,[62,65,69,74],.55,1.5,.5);
for(let k=0;k<22;k++){const tt=.4+k*.32+rnd()*.2;if(tt<7.2)bell(tt,[86,90,93,98][k%4],.6,rnd(),3);}
noiseBed(7,9.6,90,1.2,.8,.4);
for(let k=0;k<14;k++)bell(10.1+k*.18,[86,90,93,98,102][k%5],.7,rnd(),3.5);
choir(10.4,13.5,[62,66,69,74,78,81],1.1,1.2,2.5);

// ---------- 12.45-40.2  Six days: each day adds a layer ----------
const DAYS=[12.56,17.0,20.98,24.52,29.04,33.72],END6=37.25;
[[62,66,69,74],[59,62,66,71],[55,62,67,71],[57,61,64,69]].forEach((c,k)=>{for(let t=12.6+k*3.5;t<END6;t+=14)pad(t,Math.min(t+3.8,END6),c,.8,.55,1.2,.4);});
pad(DAYS[0],END6,[86,90,93],.35,.9,2,.3);                                                  // day 1: glassy light
for(let t=DAYS[1];t<END6;t+=.25){const i=Math.round((t-DAYS[1])/.25)%8;pluck(t,[74,78,81,86,81,78,74,69][i],.35,.3+.4*(i%2),1.2,.8);} // day 2: water arpeggio
for(let t=DAYS[2];t<END6;t+=1.75){[50,57,62,66].forEach((m,j)=>pluck(t+j*.05,m,.55,.4+.1*j,2.2,.4));}  // day 3: warm plucked chords
for(let t=DAYS[3];t<END6;t+=.6)if(rnd()<.7)bell(t+rnd()*.2,[86,88,90,93,95,98][Math.floor(rnd()*6)],.45,rnd(),1.6); // day 4: celesta stars
motif(flute,DAYS[4]+.3,.7,EDEN,12,.65,.9,.6);motif(flute,DAYS[4]+3.2,.6,[74,76,78,81],0,.55,.8,.4);    // day 5: flute + birds + bubbles
for(let t=DAYS[4];t<END6;t+=.9+rnd()*.8)chirp(t,1,rnd());
for(let t=DAYS[4];t<END6;t+=.37){if(rnd()<.6)bell(t,86+Math.floor(rnd()*7),.3,rnd(),.3);}
for(let t=DAYS[5];t<END6;t+=.86){drum(t,1,62);drum(t+.22,.6,58);}                                 // day 6: heartbeat
// "But God wasn't finished": everything stops; a held breath, then one chord rises.
choir(38.4,41,[55,62,67,71],.7,1.2,1.5);

// ---------- 40.2-61.6  Humanity, very good, rest ----------
[[43,55,59,62,67],[40,52,55,59,64],[36,48,55,60,64],[38,50,54,57,62]].forEach((c,k)=>{for(let t=40.6+k*3.6;t<54;t+=14.4)pad(t,t+3.9,c,.8,.5,1.2,.6);});
motif(piano,42.8,.9,EDEN,5,1,.5,3);motif(piano,46.6,.9,[67,74,71,69],0,.9,.5,3);motif(piano,49.8,.7,[67,71,74,79],0,.8,.6,3);
pad(54.4,56.4,[43,55,59,62,67,71],1,.6,.3,1);bell(54.6,79,1,.5,3);bell(54.7,86,.8,.6,3);piano(54.6,55,1,.4,4);   // very good: resolve
pad(56.6,61.6,[43,55,62],.6,.2,2,1.2);bell(57,74,.4,.5,4);                                   // rest

// ---------- 61.6-71.2  Dust and breath ----------
pad(61.8,71,[36,43,48],.9,.25,2,1);noiseBed(62,67,180,1,1.2,.5);
reversed(66.6,2,[74,78,81],1);choir(68.6,71.6,[60,64,67,72],.9,.6,1.5);bell(68.7,84,.6,.5,3);

// ---------- 71.2-94.5  The garden ----------
[[43,55,59,62],[40,52,55,59],[36,48,52,55],[38,50,54,57]].forEach((c,k)=>{for(let t=71.4+k*4;t<92.3;t+=16)pad(t,Math.min(t+4.3,92.3),c,.6,.4,1.2,.6);});
for(let t=71.6,i=0;t<92.3;t+=.43,i++){const ch=[[67,71,74,79],[64,67,71,76],[60,64,67,72],[62,66,69,74]][Math.floor((t-71.4)/4)%4];pluck(t,ch[i%4]+(i%8>3?12:0),.5,.3+.4*(i%2),1.6,.6);}
noiseBed(71.4,92.4,2600,.5,1.6,.2,.7);for(let t=72;t<92;t+=1.2+rnd()*1.5)chirp(t,1.2,rnd());
motif(flute,79.6,.8,EDEN,17,.5,1,.5);
pad(92.3,94.6,[43,55,60,62,68],.9,.4,.4,.5);                                                // "certainly die": unresolved

// ---------- 94.5-124  Not alone: animals, sleep, Eve, one flesh ----------
pad(94.6,100.4,[43,55,59,62],.6,.35,1.5,1);bell(97.6,70,.5,.5,3);
[[50,54,57],[45,52,57],[55,59,62],[62,66,69],[47,54,59]].forEach((c,k)=>c.forEach((m,j)=>pluck(101+k*.9+j*.12,m+12,.7,.3+.15*k,1.2,.7)));
motif(bell,106.4,.8,EDEN,24,.5,.5,3);motif(bell,109.6,.8,[74,78,81,86],12,.4,.5,3);pad(106,109.4,[50,57,62],.5,.2,1.5,1);
choir(109.4,113,[62,66,69,74,78],1,.8,2);
[[43,55,59,62,67],[47,55,59,62],[40,52,55,64],[38,50,54,57,62]].forEach((c,k)=>pad(112+k*1.8,113.9+k*1.8,c,.75,.5,1,.6));
motif(piano,112.6,1,EDEN,5,1,.5,3);
pad(119.2,124,[43,55,59,62,67,71,74],1,.6,.8,1.4);choir(119.2,123.6,[67,71,74,79],.8,1,1.4);  // one flesh: the warmest chord

// ---------- 124-151.8  The serpent ----------
[[38,50,57,62,65],[34,46,53,58,62],[31,43,50,55,58],[33,45,52,57,61]].forEach((c,k)=>{for(let t=124.2+k*5;t<151.6;t+=20)pad(t,Math.min(t+5.4,151.6),c,.7,.35,1.4,.8);});
for(let t=124.5;t<151;t+=3.4+rnd()*2)glide(t,2.6,38+rnd()*4,33+rnd()*4,1,rnd());
for(let t=126;t<151.6;){const u=(t-126)/25.6;tick(t,1,.5+.3*Math.sin(t));t+=lerp(.6,.26,u);}
motif(flute,147.2,.7,EDENm,12,.5,.8,.6);
pad(141.3,144,[62,63,64,70],.8,.5,.3,1.5);                                                  // contradiction: cluster
function lerp(a,b,p){return a+(b-a)*p;}

// ---------- 151.8-176.3  The fruit, shame ----------
tremolo(151.8,156.55,[50,53,57,62,65],1.4);                                                 // suspense, then silence at the bite
for(let t=158;t<175.5;t+=1.6+rnd()*1.2)piano(t,[62,65,69,72,74,77][Math.floor(rnd()*6)],.7,rnd(),2.5,(rnd()-.5)*.012);
reversed(161,2.4,[57,62],.9);reversed(166.2,2.4,[53,60],.9);reversed(171,2.4,[50,57],.9);
pad(163.4,176,[26,38,50],.5,.2,1.5,1);

// ---------- 176.3-198.8  Hiding, the question, the blame ----------
noiseBed(176.3,198.8,420,1.3,.9,.6);choir(176.4,183.2,[62,69,74],.35,2,1.5);
pad(178,183.4,[57,64,69],.7,.5,4,.3);pad(183.5,189.5,[57],.8,.3,.2,1);
for(let t=189.6,i=0;t<198.6;t+=.33,i++)pluck(t,[45,48,52,51][i%4]+(i%16>7?12:0),.7,.3+.4*(i%2),.5,.3);

// ---------- 198.8-236.9  Consequences, the promise, dust ----------
pad(198.9,209,[26,33,38,45],.9,.3,2,1);pad(217.5,232,[26,33,38,45],.9,.3,2,1.5);
[198.8,217.7,224.4].forEach(t=>{drum(t,2,48);drum(t+.04,1.2,40);});
pad(209.2,217.4,[38,50,57,62,66],.8,.5,1.5,1.5);choir(209.4,216.8,[62,66,69,74],1,1.5,1.5);bell(210.2,81,.6,.5,4);  // the promise
motif(flute,212,.9,EDEN,12,.45,1.1,.5);
noiseBed(231.8,236.9,300,1.4,.9,.5);noiseBed(232.4,236.9,4500,.5,1.4,.6);

// ---------- 236.9-247.1  Eve, mercy ----------
pad(237,247,[41,53,57,60,65],.7,.45,1.5,1);motif(flute,238.2,.9,EDEN,3,.7,1.2,.5);motif(flute,242,.8,[65,69,72,77],0,.6,1,.5);
choir(242.6,246.8,[65,69,72,77],1,1,1.5);bell(242.8,84,.6,.5,3);

// ---------- 247.1-260.4  East of Eden ----------
for(let t=247.4;t<259.5;t+=1)drum(t,.5,55,.5);
pad(247.2,253.4,[38,50,57,62,65],.7,.35,1.5,1);pad(253.2,259,[34,46,53,58,62,65],.7,.35,1.5,1);
choir(250,256,[62,69,65,64].map(x=>x),.5,2,2);motif(piano,251,1.1,EDENm,0,.8,.5,3.5);
pad(256.5,260.4,[38,50,55,57,62,64],.8,.4,1,2.5);                                            // ends unresolved (sus) and open

// ---------- Reverb, then write ----------
function reverb(L,R,{room=.86,damp=.3,wet=.35}={}){
  const combs=[1557,1617,1491,1422,1277,1356,1188,1116],aps=[556,441,341,225];
  const run=(x,sp)=>{const o=new Float32Array(x.length);combs.forEach(d0=>{const d=Math.round((d0+sp)*SR/44100),buf=new Float32Array(d);let i=0,st=0;for(let n=0;n<x.length;n++){const y=buf[i];st=y*(1-damp)+st*damp;buf[i]=x[n]*.015+st*room;o[n]+=y;i=(i+1)%d;}});
    aps.forEach(d0=>{const d=Math.round((d0+sp)*SR/44100),buf=new Float32Array(d);let i=0;for(let n=0;n<x.length;n++){const b=buf[i],y=-o[n]+b;buf[i]=o[n]+b*.5;o[n]=y;i=(i+1)%d;}});return o;};
  const m=new Float32Array(L.length);for(let n=0;n<L.length;n++)m[n]=(L[n]+R[n])*.5;const wl=run(m,0),wr=run(m,23);
  for(let n=0;n<L.length;n++){L[n]=L[n]*(1-wet)+wl[n]*wet*3;R[n]=R[n]*(1-wet)+wr[n]*wet*3;}
}
reverb(ML,MR,{room:.87,damp:.32,wet:.38});
// Auto-level: hold the bed near a steady loudness, except where silence is part of the story.
const W=SR/10,nw=Math.ceil(N/W),rms=new Float32Array(nw);
for(let w=0;w<nw;w++){let s=0;for(let n=w*W;n<Math.min(N,(w+1)*W);n++)s+=ML[n]*ML[n]+MR[n]*MR[n];rms[w]=Math.sqrt(s/(2*W))+1e-6;}
const sm=new Float32Array(nw);for(let w=0;w<nw;w++){let s=0,c=0;for(let k=-15;k<=15;k++){const j=w+k;if(j>=0&&j<nw){s+=rms[j];c++;}}sm[w]=s/c;}
let ref=0;for(let w=0;w<nw;w++)ref+=sm[w];ref/=nw;
const gainW=w=>clamp(ref/sm[w],.35,4);
for(let n=0;n<N;n++){const w=Math.min(nw-1,Math.floor(n/W)),t=n/SR,g=gainW(w),fade=clamp((260.9-t)/1.5);ML[n]*=g*fade;MR[n]*=g*fade;}
let pk=0;for(let n=0;n<N;n++)pk=Math.max(pk,Math.abs(ML[n]),Math.abs(MR[n]));
const b=Buffer.alloc(44+N*4);b.write('RIFF',0);b.writeUInt32LE(36+N*4,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(N*4,40);
for(let n=0;n<N;n++){b.writeInt16LE(Math.round(ML[n]/pk*.9*32767),44+n*4);b.writeInt16LE(Math.round(MR[n]/pk*.9*32767),46+n*4);}
fs.writeFileSync(out,b);console.log('score written',out);
