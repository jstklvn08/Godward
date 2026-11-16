#!/usr/bin/env node
// Stand-in word timings from a script, for drawing an episode before its narration exists.
//   node tools/standin-words.js scripts/<name>.md videos/<slug>/words.js
// Narration lines (> ...) at ~2.6 words/s (grave 2.2), the natural edit's gaps, [beat]/[pause]/[hold] pauses.
// An unfilled {{ESV ...}} placeholder becomes ~N tokens "ESV" (N from the reference's verse count) so cue words
// around it keep roughly the right spacing. align_words.py output replaces this file once the voice is recorded.
'use strict';
const fs = require('fs');
const [src, out] = process.argv.slice(2);
const lines = fs.readFileSync(src, 'utf8').split('\n');
const W = []; let t = 0, lastSec = null;
const PAUSE = { beat: .3, pause: .8, hold: 1.5 };
for (const ln of lines) {
  const sec = ln.match(/^## (\d+)\./); if (sec) { if (lastSec !== null) t += 1.1; lastSec = sec[1]; continue; }
  if (!ln.startsWith('> ')) continue;
  let s = ln.slice(2);
  // split into sentences keeping tags
  const parts = s.split(/(?<=[.?!”"])\s+(?=\[|[A-Z{])/);
  for (const p of parts) {
    const tag = (p.match(/^\[(grave|talk|story|pivot)\]/) || [])[1] || 'story';
    const rate = tag === 'grave' ? 2.2 : tag === 'pivot' ? 2.4 : 2.65;
    let body = p.replace(/^\[(grave|talk|story|pivot)\]\s*/, '');
    const pz = [...body.matchAll(/\[(beat|pause|hold)\]/g)].map(m => PAUSE[m[1]]).reduce((a, b) => a + b, 0);
    body = body.replace(/\[(beat|pause|hold)\]/g, '').trim();
    body = body.replace(/\{\{ESV ([^}]*)\}\}/g, (_, ref) => { const m = ref.match(/(\d+)-(\d+)$/); const n = m ? (+m[2] - +m[1] + 1) * 16 : 12; return Array(n).fill('ESV').join(' '); });
    if (tag === 'pivot') t += .15;
    for (const w of body.split(/\s+/).filter(Boolean)) { const d = Math.max(.18, (w.length + 2) / 6.5 / rate); W.push([w, +t.toFixed(2), +(t + d * .9).toFixed(2)]); t += d; }
    t += (tag === 'grave' ? .65 : .45) + pz;
  }
}
fs.writeFileSync(out, `// STAND-IN word timings (tools/standin-words.js from ${src}); replace with align_words.py output for the real narration.\nconst WORDS=${JSON.stringify(W)};\n`);
console.log(W.length + ' words, ' + t.toFixed(1) + ' s');
