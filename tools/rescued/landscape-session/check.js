const fs=require('fs');
const kjv=[1,2,3].map(c=>JSON.parse(fs.readFileSync(`gen${c}.json`,'utf8')).verses.map(v=>v.text).join(' ')).join(' ').replace(/\s+/g,' ');
const md=fs.readFileSync(process.argv[2],'utf8');
const qs=[...new Set([...md.matchAll(/"([^"]+)"/g)].map(m=>m[1]))];
let bad=0;
for(const q of qs){const n=q.replace(/\s+/g,' ').trim();const ok=kjv.includes(n)||kjv.toLowerCase().includes(n.toLowerCase());console.log((kjv.includes(n)?'OK   ':ok?'CASE ':'MISS ')+n);if(!kjv.includes(n))bad++;}
// narration word count: blockquote lines
const words=md.split('\n').filter(l=>l.startsWith('> ')&&!l.includes('[pause]')).join(' ').replace(/^> /gm,'').split(/\s+/).filter(Boolean).length;
console.log('narration words:',words);
