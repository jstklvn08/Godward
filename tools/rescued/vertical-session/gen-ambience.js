// Scene ambience for "Creation and the Fall": what you see, you hear. Water where there is sea, animals where there
// are animals, flame where there is the sun or the sword. Everything synthesised; timed to the portrait cut.
const fs=require('fs');
const out=process.argv[2];
const SR=48000,DUR=261.5,N=Math.ceil(SR*DUR);
let seed=9091;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const nz=()=>rnd()*2-1,clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),lerp=(a,b,p)=>a+(b-a)*p;
const L=new Float32Array(N),R=new Float32Array(N);
const put=(n,v,pan)=>{if(n>=0&&n<N){L[n]+=v*(1-pan)*1.4;R[n]+=v*pan*1.4;}};
const span=(t0,len)=>[Math.max(0,Math.floor(t0*SR)),Math.min(N,Math.floor((t0+len)*SR))];
const fade=(t,t0,t1,a=1,b=1)=>clamp((t-t0)/a)*clamp((t1-t)/b);
// State-variable filter helper: returns a stepper for band/low output.
const svf=fc=>{let lo=0,bp=0;return (x,f=fc,q=1)=>{const F=2*Math.sin(Math.PI*Math.min(f,SR/6)/SR),hi=x-lo-q*bp;bp+=F*hi;lo+=F*bp;return [lo,bp];};};

// ---------- Generators ----------
// Ocean: low rolling surf with slow swells.
function ocean(t0,t1,lv=1,pan=.5,period=6.5,fc=500){const [n0,n1]=span(t0,t1-t0),f=svf(fc),g=svf(2200);const ph=rnd()*6;
  for(let n=n0;n<n1;n++){const t=n/SR,sw=Math.pow(.5+.5*Math.sin(2*Math.PI*t/period+ph),2),x=nz();const [lo]=f(x,fc*(.6+.8*sw),.7),[,hb]=g(x,2200,.9);
    put(n,(lo*.9+hb*.25*sw)*sw*lv*.35*fade(t,t0,t1,1.2,1.2),pan);}}
// Lapping water at a shore.
function lap(t0,t1,lv=1,pan=.5){ocean(t0,t1,lv*.7,pan,2.3,900);}
// Stream: babbling bands plus droplets.
function stream(t0,t1,lv=1,pan=.5){lv*=.7;const [n0,n1]=span(t0,t1-t0),fs_=[svf(700),svf(1300),svf(2600)];
  for(let n=n0;n<n1;n++){const t=n/SR,x=nz();let s=0;fs_.forEach((f,j)=>{const [,b]=f(x,[700,1300,2600][j]*(1+.3*Math.sin(t*(3+j*2.3)+j)),.35);s+=b*(.6-.15*j);});put(n,s*lv*.12*fade(t,t0,t1,1,1),pan);}
  for(let t=t0;t<t1;t+=.12+rnd()*.25)drip(t,lv*.35,rnd());}
function drip(t0,lv=1,pan=.5){const f0=900+rnd()*1400,[n0,n1]=span(t0,.06);let ph=0;for(let n=n0;n<n1;n++){const t=(n-n0)/SR;ph+=f0*(1+t*30)/SR;put(n,Math.sin(2*Math.PI*ph)*Math.exp(-t*60)*lv*.25,pan);}}
function splash(t0,lv=1,pan=.5,len=.6){const [n0,n1]=span(t0,len),f=svf(1800);for(let n=n0;n<n1;n++){const t=(n-n0)/SR,[,b]=f(nz(),lerp(3000,900,t/len),.8);put(n,b*Math.exp(-t*6)*lv*.6,pan);}for(let k=0;k<6;k++)drip(t0+.05+rnd()*len*.6,lv*.6,pan+(rnd()-.5)*.3);}
function bubbles(t0,t1,lv=1,rate=8){for(let t=t0;t<t1;t+=rnd()*2/rate){const f0=300+rnd()*900,[n0,n1]=span(t,.05);let ph=0;for(let n=n0;n<n1;n++){const u=(n-n0)/SR;ph+=f0*(1+u*25)/SR;put(n,Math.sin(2*Math.PI*ph)*Math.sin(Math.PI*u/.05)*lv*.12,rnd());}}}
// Wind: slowly sweeping band of noise.
function wind(t0,t1,lv=1,fc=500,pan=.5){const [n0,n1]=span(t0,t1-t0),f=svf(fc);const ph=rnd()*9;
  for(let n=n0;n<n1;n++){const t=n/SR,m=.5+.5*Math.sin(t*.45+ph+Math.sin(t*.17)*2),[,b]=f(nz(),fc*(.6+.9*m),.5);put(n,b*(.4+.6*m)*lv*.22*fade(t,t0,t1,1.5,1.5),pan);}}
function rumble(t0,t1,lv=1){const [n0,n1]=span(t0,t1-t0);let a=0,b=0;for(let n=n0;n<n1;n++){const t=n/SR;a+=.01*(nz()-a);b+=.01*(a-b);put(n,b*8*lv*fade(t,t0,t1,.8,1.2)*(.7+.3*Math.sin(t*1.3)),.5);}}
// Flame: low roar plus crackles (the sun, the sword).
function flame(t0,t1,lv=1,pan=.5){const [n0,n1]=span(t0,t1-t0),f=svf(380),h=svf(1600);
  for(let n=n0;n<n1;n++){const t=n/SR,x=nz(),[lo]=f(x,380*(1+.25*Math.sin(t*5.3)),.6),[,hb]=h(x,1600,.7);put(n,(lo*1.2+hb*.25*(.5+.5*Math.sin(t*9.7)))*lv*.4*fade(t,t0,t1,.6,.8)*(.75+.25*Math.sin(t*2.1)),pan);}
  for(let t=t0+.2;t<t1-.2;t+=.03+rnd()*.14){const [m0,m1]=span(t,.012);const a=lv*(.15+rnd()*.3);for(let n=m0;n<m1;n++)put(n,nz()*a*Math.exp(-(n-m0)/(SR*.002)),pan+(rnd()-.5)*.4);}}
function shimmer(t0,t1,lv=1){for(let t=t0;t<t1;t+=.08+rnd()*.25){const f=2600+rnd()*3600,[n0,n1]=span(t,.5);for(let n=n0;n<n1;n++){const u=(n-n0)/SR;put(n,Math.sin(2*Math.PI*f*u)*Math.exp(-u*7)*lv*.05*Math.min(1,u*300),rnd());}}}
function crickets(t0,t1,lv=1){for(let v=0;v<3;v++){const f=4200+v*450,pan=.2+v*.3;for(let t=t0+rnd();t<t1;t+=.7+rnd()*.6){for(let p=0;p<3;p++){const [n0,n1]=span(t+p*.045,.03);for(let n=n0;n<n1;n++){const u=(n-n0)/SR;put(n,Math.sin(2*Math.PI*f*u)*Math.sin(Math.PI*u/.03)*lv*.05*fade(t,t0,t1,1,1),pan);}}}}}
function bird(t0,lv=1,pan=.5){const f0=2400+rnd()*2000,k=2+Math.floor(rnd()*4);for(let j=0;j<k;j++){const [n0,n1]=span(t0+j*.1,.07);let ph=0;for(let n=n0;n<n1;n++){const u=(n-n0)/SR,f=f0*(1+.6*Math.sin(u*70));ph+=f/SR;put(n,Math.sin(2*Math.PI*ph)*Math.sin(Math.PI*u/.07)*lv*.025,pan);}}}
function gull(t0,lv=1,pan=.5){for(let j=0;j<2;j++){const [n0,n1]=span(t0+j*.42,.34),f=svf(2000);let ph=0;for(let n=n0;n<n1;n++){const u=(n-n0)/SR,fr=lerp(1500,950,u/.34);ph+=fr/SR;ph-=Math.floor(ph);const [,b]=f(ph*2-1,2200,.3);put(n,b*Math.sin(Math.PI*u/.34)*lv*.25,pan);}}}
function flap(t0,lv=1,pan=.5,n_=4){for(let k=0;k<n_;k++){const [m0,m1]=span(t0+k*.16,.09),f=svf(900);for(let n=m0;n<m1;n++){const u=(n-m0)/SR,[,b]=f(nz(),900,.9);put(n,b*Math.sin(Math.PI*u/.09)*lv*.35,pan);}}}
function whale(t0,lv=1,pan=.5){const [n0,n1]=span(t0,3.2);let ph=0;for(let n=n0;n<n1;n++){const u=(n-n0)/SR,f=lerp(260,140,Math.sin(Math.PI*u/3.2*.5))*(1+.02*Math.sin(u*30));ph+=f/SR;put(n,(Math.sin(2*Math.PI*ph)+.3*Math.sin(4*Math.PI*ph))*Math.sin(Math.PI*u/3.2)*lv*.12,pan);}}
// Voiced animal call: a buzzing source through formants, pitch and loudness shaped over time.
function voiced(t0,len,fn,forms,lv=1,pan=.5,growl=0){const [n0,n1]=span(t0,len),fs_=forms.map(()=>svf(500));let ph=0;
  for(let n=n0;n<n1;n++){const u=(n-n0)/SR,p=u/len,[f0,amp]=fn(p);ph+=f0*(1+growl*.08*Math.sin(u*2*Math.PI*30))/SR;ph-=Math.floor(ph);const x=(ph*2-1)+nz()*growl*.6;
    let y=0;forms.forEach(([fc,g,q],j)=>{const [,b]=fs_[j](x,fc,q);y+=b*g;});put(n,y*amp*lv*.35,pan);}}
const roar=(t,lv=1,pan=.5)=>voiced(t,1.8,p=>[lerp(140,95,p),Math.sin(Math.PI*Math.pow(p,.6))],[[500,1,.3],[1100,.6,.4],[2400,.3,.5]],lv,pan,1);
const trumpet=(t,lv=1,pan=.5)=>voiced(t,1.3,p=>[lerp(420,640,Math.sin(Math.PI*p*.8)),Math.sin(Math.PI*p)],[[900,1,.25],[1800,.7,.25],[3000,.3,.3]],lv,pan,.15);
const moo=(t,lv=1,pan=.5)=>voiced(t,1.6,p=>[lerp(125,100,p),Math.sin(Math.PI*p)],[[320,1,.25],[750,.5,.3]],lv,pan,.1);
const whinny=(t,lv=1,pan=.5)=>voiced(t,1.2,p=>[lerp(950,480,p)*(1+.08*Math.sin(p*80)),Math.sin(Math.PI*p)*(.6+.4*Math.sin(p*40))],[[1200,1,.3],[2600,.5,.3]],lv,pan,.1);
const screech=(t,lv=1,pan=.5)=>voiced(t,.7,p=>[lerp(2600,1700,p),Math.sin(Math.PI*p)],[[2800,1,.3],[4200,.5,.4]],lv,pan,.2);
const bleat=(t,lv=1,pan=.5)=>voiced(t,.6,p=>[lerp(520,460,p)*(1+.05*Math.sin(p*90)),Math.sin(Math.PI*p)],[[900,1,.3],[2000,.5,.3]],lv,pan,.05);
function step(t0,lv=1,pan=.5,soft=1){const [n0,n1]=span(t0,.12),f=svf(400);for(let n=n0;n<n1;n++){const u=(n-n0)/SR,[lo]=f(nz(),400,.8);put(n,(lo*.9+Math.sin(2*Math.PI*70*u)*.4)*Math.exp(-u*35)*lv*.6*soft,pan);}}
function hoof(t0,lv=1,pan=.5){const [n0,n1]=span(t0,.05);for(let n=n0;n<n1;n++){const u=(n-n0)/SR;put(n,(nz()*.5+Math.sin(2*Math.PI*900*u))*Math.exp(-u*90)*lv*.3,pan);}}
function rustle(t0,t1,lv=1,pan=.5){const [n0,n1]=span(t0,t1-t0),f=svf(3500);for(let n=n0;n<n1;n++){const t=n/SR,g=Math.max(0,Math.sin(t*23)*Math.sin(t*7.7))**2,[,b]=f(nz(),3500,.6);put(n,b*g*lv*.3*fade(t,t0,t1,.3,.3),pan);}}
function hiss(t0,len,lv=1,pan=.5){const [n0,n1]=span(t0,len),f=svf(6000);for(let n=n0;n<n1;n++){const u=(n-n0)/SR,[,b]=f(nz(),6000,.5);put(n,b*Math.sin(Math.PI*u/len)**.5*lv*.4,pan);}}
function sand(t0,t1,lv=1){for(let t=t0;t<t1;t+=.004+rnd()*.012){const [n0,n1]=span(t,.004);const a=lv*.06*fade(t,t0,t1,.6,.8)*rnd();for(let n=n0;n<n1;n++)put(n,nz()*a,rnd());}wind(t0,t1,lv*.5,1800);}
function breath(t0,len,lv=1){const [n0,n1]=span(t0,len),f=svf(1200);for(let n=n0;n<n1;n++){const u=(n-n0)/SR,p=u/len,[,b]=f(nz(),lerp(600,2400,p),.7);put(n,b*Math.sin(Math.PI*p)*lv*.5,.5);}}
function scrape(t0,lv=1,pan=.5){const [n0,n1]=span(t0,.45),f=svf(1400);for(let n=n0;n<n1;n++){const u=(n-n0)/SR,[,b]=f(nz(),1400+600*Math.sin(u*40),.5);put(n,b*Math.sin(Math.PI*u/.45)*lv*.4,pan);}step(t0+.4,lv*.8,pan);}

// ---------- The scenes ----------
// 0-12.45: the void, the heavens, the deep water, darkness.
wind(0,3,.5,300);shimmer(1.6,4.2,.6);
ocean(3.3,9.7,1.2,.5,6);ocean(3.8,9.7,.8,.3,4.7,420);rumble(7.4,9.7,.5);wind(7.6,9.8,.9,220);
rustle(5.4,7.2,.35,.6);
// Day 1 (12.56): light hums and sparkles.
shimmer(12.6,17,.9);
// Day 2 (17.0): waters part above and below.
ocean(17,21,1.1,.3,3.5,600);ocean(17,21,.9,.7,4.1,500);splash(17.3,.9,.4);splash(17.8,.7,.65);wind(17.5,21,.4,900);
// Day 3 (20.98): land rises, water streams off, waves lap the shore, leaves rustle.
rumble(21,22.3,.7);splash(21.3,1,.5,.9);for(let t=21.4;t<22.6;t+=.04)drip(t,.6,rnd());lap(21.6,24.6,1.1,.7);rustle(22.6,24.6,.5,.4);
// Day 4 (24.52): the sun burns, stars twinkle.
flame(24.6,29.1,1.2,.4);shimmer(25,29,.6);
// Day 5 (29.04): under the sea, a whale; above, gulls and wings.
ocean(29.1,33.8,.9,.5,4,450);bubbles(29.2,33.7,1,9);whale(29.6,1,.6);gull(30.2,.9,.3);flap(31,.8,.7);gull(32.2,.7,.75);bird(32.8,1,.4);
// Day 6 (33.72): a lion, an elephant, a deer, a rabbit, birds; footsteps on grass.
roar(34.0,1.1,.3);trumpet(35.0,.9,.55);for(let k=0;k<6;k++)step(33.9+k*.42,.5,.3);bleat(35.9,.6,.8);for(let k=0;k<5;k++)step(36+k*.18,.35,.4,.6);bird(36.3,.9,.2);
// 40-61.6: night garden, the first people; crickets and fireflies; rest.
crickets(40.5,61.4,1);wind(40.5,61.4,.35,600);shimmer(47.4,49,.4);
// 61.6-71.2: dust gathers, the breath of life.
sand(62.6,66.8,1);breath(66.8,2.6,1.1);
// 71.2-94.5: the garden: stream, birds, leaves, crickets.
stream(71.4,94.4,1);for(let t=72;t<92;t+=1+rnd()*1.6)bird(t,1,rnd());rustle(76.2,78,.4,.6);crickets(80,94.4,.6);
// 94.5-124: garden; the animals come to be named; sleep; the woman; one flesh.
stream(94.6,124,.6);for(let t=95;t<123;t+=1.4+rnd()*2)bird(t,.8,rnd());
const AN=[[100.9,moo],[101.8,roar],[102.7,bleat],[103.6,screech],[104.5,whinny]];
AN.forEach(([t,fn],k)=>{fn(t+.6,.9,.65);for(let s=0;s<5;s++)(k===4?hoof:step)(t+s*.3,k===4?.8:.45,.7-s*.05);});
for(let k=0;k<3;k++)hoof(104.5+1.6+k*.18,.6,.4);
flap(103.9,.6,.6,5);
shimmer(109.4,111,.6);crickets(112,124,.5);
// 124-151.8: the serpent: hisses, cold wind, leaves.
hiss(124.2,1.6,.9,.65);wind(124,151.6,.6,450);hiss(130.0,.9,.6,.6);hiss(140.4,1.1,.7,.6);hiss(147.0,1,.6,.65);rustle(125,127,.3,.6);
// 151.8-176.3: the fruit; the tear; cold wind; fig leaves falling.
wind(151.8,176.2,.7,380);rustle(152.6,154,.35,.5);rustle(171.5,173.5,.7,.5);
// 176.3-198.8: a warm presence moving in the garden (a sound of wind and light, not footsteps); hiding in the bushes.
wind(176.3,183.5,1,700,.8);rustle(179.6,181.2,.8,.4);rustle(186.8,188,.6,.4);hiss(195.9,1,.6,.25);
// 198.8-236.9: the serpent crawls; the woman; the man digs cursed ground; dust returns to dust.
hiss(199.2,1.4,.7,.3);for(let t=199;t<208;t+=.5)rustle(t,t+.4,.2,.35);
for(let t=225;t<231.5;t+=1.6)scrape(t,.9,.5);wind(217.7,231.5,.5,500);
sand(232.3,236.8,1.2);wind(232.3,236.8,.7,300);
// 236.9-247.1: mercy: cloth and gentle birds return.
rustle(242.6,243.6,.6,.5);rustle(243.4,244.2,.5,.55);for(let t=238;t<246.5;t+=1.6+rnd())bird(t,.6,rnd());
// 247.1-260.4: east of Eden: wind, footsteps walking away, the flaming sword.
wind(247.2,260.3,.8,360);for(let t=247.8;t<259.2;t+=.48)step(t,.45,lerp(.6,.2,(t-247.8)/11.4),.8);flame(254,260.3,1.3,.7);

// ---------- Write ----------
let pk=0;for(let n=0;n<N;n++){const t=n/SR,f=clamp((260.8-t)/1.2);L[n]*=f;R[n]*=f;pk=Math.max(pk,Math.abs(L[n]),Math.abs(R[n]));}
const b=Buffer.alloc(44+N*4);b.write('RIFF',0);b.writeUInt32LE(36+N*4,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(N*4,40);
for(let n=0;n<N;n++){b.writeInt16LE(Math.round(L[n]/pk*.9*32767),44+n*4);b.writeInt16LE(Math.round(R[n]/pk*.9*32767),46+n*4);}
fs.writeFileSync(out,b);console.log('ambience written, peak',pk.toFixed(3));
