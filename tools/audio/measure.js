#!/usr/bin/env node
// Measurement helpers: you cannot listen, so check a mix with numbers.
//
//   node tools/audio/measure.js report <mix-dir>                      loudness + voice-vs-bed + moments for a mix.js output folder
//   node tools/audio/measure.js compare <a.wav> <b.wav> [--until s]   loudness and 1 s level-curve difference of two mixes
//   node tools/audio/measure.js windows <file.wav> t0-t1 [t0-t1 ...]   RMS (dBFS) in time windows
'use strict';
const fs = require('fs');
const path = require('path');
const { decodePower, durationOf, loudness } = require('./wav');

const SR = 24000;
const db = x => 20 * Math.log10(x + 1e-9);

function rmsDb(a, t0, t1, sr = SR) {
  const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(a.length, Math.floor(t1 * sr)); let s = 0;
  for (let i = i0; i < i1; i++) s += a[i] * a[i];
  return i1 > i0 ? db(Math.sqrt(s / (i1 - i0))) : -180;
}
function curve(a, win = 1, sr = SR) { const out = []; for (let t = 0; t + win <= a.length / sr; t += win) out.push(rmsDb(a, t, t + win, sr)); return out; }
const pct = (arr, q) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };

// Voice-to-bed difference in dB over windows where the voice is speaking (within 15 dB of its loud windows) and the bed is not silent.
function voiceVsBed(voice, bed, { win = .4, from = 0, until = Infinity } = {}) {
  const v = curve(voice, win), b = curve(bed, win), n = Math.min(v.length, b.length);
  const vmax = pct(v.filter(x => x > -90), .95), d = [];
  for (let i = Math.floor(from / win); i < n && i * win < until; i++) if (v[i] > vmax - 15 && b[i] > -90) d.push(v[i] - b[i]);
  return { median: pct(d, .5), p10: pct(d, .1), p90: pct(d, .9), windows: d.length };
}

// Moments worth checking in every Godward mix; defaults are the Creation opening (pass your own).
function moments(a, list) { return list.map(([label, t0, t1]) => ({ label, t0, t1, dB: +rmsDb(a, t0, t1).toFixed(1) })); }

function compare(fa, fb, { until = Infinity, win = 1 } = {}) {
  const A = decodePower(fa, SR), B = decodePower(fb, SR);
  const ca = curve(A, win), cb = curve(B, win), n = Math.min(ca.length, cb.length, Math.floor(until / win));
  const d = []; for (let i = 0; i < n; i++) if (ca[i] > -70 && cb[i] > -70) d.push(cb[i] - ca[i]);
  const mad = d.reduce((s, x) => s + Math.abs(x), 0) / d.length;
  return { a: { file: fa, dur: durationOf(fa), ...loudness(fa) }, b: { file: fb, dur: durationOf(fb), ...loudness(fb) },
    curve: { windows: d.length, meanAbsDiffDb: +mad.toFixed(2), meanDiffDb: +(d.reduce((s, x) => s + x, 0) / d.length).toFixed(2) } };
}

module.exports = { SR, rmsDb, curve, voiceVsBed, moments, compare, decodePower, pct };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = k => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === 'compare') {
    console.log(JSON.stringify(compare(rest[0], rest[1], { until: +(opt('until') ?? Infinity) }), null, 1));
  } else if (cmd === 'windows') {
    const a = decodePower(rest[0], SR);
    rest.slice(1).forEach(w => { const [t0, t1] = w.split('-').map(Number); console.log(`${w}: ${rmsDb(a, t0, t1).toFixed(1)} dBFS`); });
  } else if (cmd === 'report') {
    const f = path.join(rest[0], 'mix-report.json');
    if (!fs.existsSync(f)) throw new Error('no mix-report.json in ' + rest[0] + ' (run mix.js first)');
    console.log(fs.readFileSync(f, 'utf8'));
  } else {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 7).join('\n'));
  }
}
