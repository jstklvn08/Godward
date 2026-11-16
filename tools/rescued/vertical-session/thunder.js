// A thunderclap: a sharp crack, a deep sub boom, and a long rolling rumble. 48 kHz stereo WAV.
const fs=require('fs'),SR=48000,D=6,N=SR*D;let seed=777;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const L=new Float32Array(N),R=new Float32Array(N);
// Rolling envelope: a few irregular rolls that decay.
const rolls=[[0,1],[.35,.8],[.9,.65],[1.6,.5],[2.4,.35],[3.3,.22]];
const env=t=>rolls.reduce((a,[t0,g])=>a+(t>=t0?g*Math.exp(-(t-t0)*1.6)*Math.min(1,(t-t0)/.04):0),0);
let l1=0,l2=0,r1=0,r2=0,hp=0,prev=0;
for(let n=0;n<N;n++){const t=n/SR;
  // Rumble: twice low-passed noise, slightly different per side.
  const a=.035,nl=rnd()*2-1,nr=rnd()*2-1;l1+=a*(nl-l1);l2+=a*(l1-l2);r1+=a*(nr-r1);r2+=a*(r1-r2);
  const rum=env(t)*6.5;
  // Crack: bright noise burst in the first 120 ms.
  const cr=(rnd()*2-1)*Math.exp(-t*28)*Math.min(1,t/.002)*.9,c2=(rnd()*2-1)*Math.exp(-Math.max(0,t-.09)*22)*(t>.09?.5:0);
  // Sub boom.
  const boom=Math.sin(2*Math.PI*(52-14*Math.min(t,1))*t)*Math.exp(-t*1.4)*.75*Math.min(1,t/.01);
  L[n]=l2*rum+cr+c2*.8+boom;R[n]=r2*rum+cr*.9+c2+boom;}
let pk=0;for(let n=0;n<N;n++)pk=Math.max(pk,Math.abs(L[n]),Math.abs(R[n]));
const b=Buffer.alloc(44+N*4);b.write('RIFF',0);b.writeUInt32LE(36+N*4,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(N*4,40);
for(let n=0;n<N;n++){b.writeInt16LE(Math.round(L[n]/pk*.95*32767),44+n*4);b.writeInt16LE(Math.round(R[n]/pk*.95*32767),46+n*4);}
fs.writeFileSync(process.argv[2],b);console.log('thunder ok');
