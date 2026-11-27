const fs=require('fs');const f=process.argv[2];let s=fs.readFileSync(f,'utf8');
const P=[
['`<g filter="url(#sticker)"><path d="M520 950 C500 860 560 800 620 830 C640 760 740 760 760 830 C820 790 900 840 880 950Z" fill="#1E1C30"/></g>`',
 '`<g transform="translate(700 900)"><g filter="url(#sticker)"><path d="M-180 50 C-200 -40 -140 -100 -80 -70 C-60 -140 40 -140 60 -70 C120 -110 200 -60 180 50Z" fill="#1E1C30"/></g></g>`'],
["g+=piece(t,253.6,1040,300,label(895,270,'CHERUBIM',{size:28}),3,1.2)+arrow(1080,320,1120,360,1180,392,","g+=piece(t,253.6,1000,360,label(880,330,'CHERUBIM',{size:28}),3,1.2)+arrow(1060,380,1120,390,1180,400,"],
];
let miss=0;for(const [a,b] of P){if(!s.includes(a)){console.log('MISSING:',a.slice(0,80));miss++;}else s=s.replace(a,b);}
fs.writeFileSync(f,s);console.log('applied',P.length-miss);
