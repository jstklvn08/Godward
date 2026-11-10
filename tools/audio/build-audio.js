#!/usr/bin/env node
// Build every audio stem of an episode from its cue file.
//
//   node tools/audio/build-audio.js <audio-cues.json> [--out <dir>] [--words <words.json|words.js>] [--only score,ambience,sfx,hits] [--serial]
//
// Writes <out>/<stem>.wav for every entry of "stems" (score.wav, ambience.wav, sfx.wav ...) and <out>/hit-<name>.wav for
// every entry of "mix.hits" (e.g. the thunder). Default <out> is an "audio" folder next to the cue file.
// Stems render in parallel child processes unless --serial.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { loadCues, renderStem, validateMix } = require('./cues');
const S = require('./sounds');
const { writeWav } = require('./wav');

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) { const key = k.slice(2); if (['serial', 'help'].includes(key)) a[key] = true; else a[key] = argv[++i]; }
    else a._.push(k);
  }
  return a;
}

function renderHit(ctx, h, out) {
  if (!h.sound) throw new Error(`hit "${h.name}" needs "sound"`);
  const len = h.len ?? 6;
  const tr = S.createTrack({ dur: len, seed: h.seed ?? S.hashSeed('hit:' + h.name) });
  S.play(tr, h.sound, 0, { ...(h.params || {}), len });
  const f = path.join(out, `hit-${h.name}.wav`);
  writeWav(f, tr.L, tr.R, { peak: h.peak ?? .95 });
  return f;
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a.help || !a._[0]) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).join('\n')); process.exit(a.help ? 0 : 1); }
  const cueFile = a._[0];
  const ctx = loadCues(cueFile, { wordsFile: a.words });
  validateMix(ctx);
  const out = path.resolve(a.out || path.join(ctx.dir, 'audio'));
  fs.mkdirSync(out, { recursive: true });
  const stems = ctx.cue.stems || {};
  const all = [...Object.keys(stems), 'hits'];
  const only = a.only ? a.only.split(',').map(s => s.trim()) : all;
  for (const o of only) if (!all.includes(o)) throw new Error(`--only ${o}: no such stem. Stems: ${all.join(', ')}`);

  if (only.length > 1 && !a.serial) {
    const t0 = Date.now();
    const extra = [...(a.words ? ['--words', a.words] : []), '--out', out];
    const runs = only.map(name => new Promise((res, rej) => {
      const p = spawn(process.execPath, [__filename, cueFile, '--only', name, ...extra], { stdio: 'inherit' });
      p.on('exit', c => c === 0 ? res() : rej(new Error(`stem ${name} failed (exit ${c})`)));
    }));
    await Promise.all(runs);
    console.log(`all stems done in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out}`);
    return;
  }
  for (const name of only) {
    const t0 = Date.now();
    if (name === 'hits') {
      for (const h of (ctx.cue.mix?.hits || [])) console.log('hit', h.name, '->', renderHit(ctx, h, out));
      continue;
    }
    const sec = stems[name];
    const { tr, calls } = renderStem(ctx, name, sec);
    const f = path.join(out, `${name}.wav`);
    const { peak } = writeWav(f, tr.L, tr.R, { peak: sec.peak ?? .9 });
    console.log(`${name}: ${calls} sound calls, ${ctx.duration.toFixed(2)} s, raw peak ${peak.toFixed(3)}, ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${f}`);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
