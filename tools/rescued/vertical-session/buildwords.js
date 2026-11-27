const [SP,O]=process.argv.slice(2);
const main=require(SP+'/words.json').chunks.map(c=>[c.text.trim(),c.timestamp[0],c.timestamp[1]]);
const seg=(f,off,stopAt=1e9)=>require(O+'/asr/'+f+'.json').chunks.map(c=>[c.text.trim(),c.timestamp[0]+off,c.timestamp[1]+off]).filter(w=>w[1]<stopAt);
let out=main.slice(0,142);
out[141][2]=63.2;
// The gap Whisper skipped: spread the script's words over 63.4-69.95 by length.
const gap='The Lord God formed the man from the dust of the ground, and breathed into his nostrils the breath'.split(' ');
const tot=gap.reduce((a,w)=>a+w.length+2,0)+6;let tt=63.4;const span=69.95-63.4;
gap.forEach(w=>{const d=(w.length+2+(w.endsWith(',')?6:0))/tot*span;out.push([w,tt,tt+d*.9]);tt+=d;});
out.push(...seg('s70',70));out[out.length-1][2]=75.9;
const s76=seg('s76',76,80.0);s76[0][1]=76.9;out.push(...s76);
out.push(...main.slice(142));
const fix={'sees':'seas,','lolled':'called','Quite':'She ate','forgiving':'for giving','His':'his'};
out.forEach(w=>{if(fix[w[0]])w[0]=fix[w[0]];});
for(let i=0;i<out.length;i++){if(out[i][0]==='and'&&out[i+1]&&out[i+1][0]==='childbearing')out[i][0]='in';if(out[i][0]==='land'&&out[i+1][0]==='seas,')out[i][0]='land,';}
// sanity: monotonic
for(let i=1;i<out.length;i++)if(out[i][1]<out[i-1][1]-.05)console.error('nonmono',i,out[i-1],out[i]);
out.forEach(w=>{w[1]=+w[1].toFixed(2);w[2]=+Math.max(w[2],w[1]+.08).toFixed(2);});
require('fs').writeFileSync(SP+'/subw.json',JSON.stringify(out));
console.log(out.length, out.slice(138,175).map(w=>w[0]+'@'+w[1]).join(' '));
