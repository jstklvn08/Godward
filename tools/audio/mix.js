#!/usr/bin/env node
// Final mix of an episode from its cue file: narration on top, ducked score and ambience, sfx, one-shot hits (thunder).
//
//   node tools/audio/mix.js <audio-cues.json> --narration <voice.wav> [--out <dir>] [--stems <dir>] [--words <words.json>] [--no-solos]
//
// Reads the stems written by build-audio.js (default: <out>, which defaults to an "audio" folder next to the cue file).
// Writes  premix.wav  (sum through the limiter, before loudness normalisation)
//         mix.wav     (two-pass loudnorm to mix.loudnorm targets, default -14 LUFS / -1 dBTP, 48 kHz stereo 16-bit)
//         solo-voice.wav, solo-<bus>.wav, solo-hit-<name>.wav  (each part exactly as it sits in the premix, for checking)
//         mix-graph.txt (the ffmpeg filtergraph) and mix-report.json (measurements, also printed).
'use strict';
const fs = require('fs');
const path = require('path');
const { loadCues, resolveTime } = require('./cues');
const { runFfmpeg, durationOf, loudness, momentary } = require('./wav');
const M = require('./measure');

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) { const key = k.slice(2); if (['no-solos', 'help'].includes(key)) a[key] = true; else a[key] = argv[++i]; }
    else a._.push(k);
  }
  return a;
}
const opts = o => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(':');
const num = x => +(+x).toFixed(4);

// Envelope windows -> ffmpeg volume expression (evaluated per frame).
//   {from,to,db,in,out}: +db dB, ramping in over `in` s after `from` and out over `out` s before `to` (overlapping windows add)
//   {from,to,mute:true,in,out}: fade to silence over `in`, silent, back over `out`
function envelopeExpr(ctx, env) {
  const terms = [], mutes = [];
  for (const w of env) {
    if (w.off) continue;
    const F = num(resolveTime(ctx, w.from)), T = num(resolveTime(ctx, w.to));
    if (!(T > F)) throw new Error(`envelope window ends before it starts: ${JSON.stringify(w)}`);
    const I = num(Math.max(w.in ?? .05, .001)), O = num(Math.max(w.out ?? .05, .001));
    const shape = `clip((t-${F})/${I},0,1)*clip((${T}-t)/${O},0,1)`;
    if (w.mute) mutes.push(`(1-${shape})`);
    else terms.push(`${num(w.db)}*${shape}`);
  }
  if (!terms.length && !mutes.length) return null;
  const g = terms.length ? `pow(10,(${terms.join('+')})/20)` : '1';
  return `volume='${[g, ...mutes].join('*')}':eval=frame`;
}

function buildGraph(ctx, mix, inputs, voiceDur, solos) {
  const lines = [], amixIn = [], soloOut = [];
  const ducked = (mix.buses || []).filter(b => !b.off && b.duck).length;
  const voice = mix.voice || {};
  const vSplits = 1 + ducked + (solos ? 1 : 0);
  const vChain = [`aresample=48000`, `pan=stereo|c0=c0|c1=c0`, `volume=${voice.volume ?? 1}`];
  if (mix.tail) vChain.push(`apad=pad_dur=${mix.tail}`);
  if (voice.envelope) { const e = envelopeExpr(ctx, voice.envelope); if (e) vChain.push(e); }
  const vLabels = Array.from({ length: vSplits }, (_, i) => `v${i}`);
  lines.push(`[0:a]${vChain.join(',')},asplit=${vSplits}${vLabels.map(l => `[${l}]`).join('')}`);
  amixIn.push('[v0]');
  let sc = 1; // next voice split used as sidechain
  if (solos) soloOut.push(['voice', `[v${vSplits - 1}]`]);

  inputs.forEach((inp, idx) => {
    const k = idx + 1, b = inp.cfg, tag = inp.kind === 'hit' ? `h_${inp.name}` : `b_${inp.name}`;
    const ch = [`aresample=48000`, `aformat=channel_layouts=stereo`];
    if (b.volume != null && inp.kind === 'bus') ch.push(`volume=${b.volume}`);
    if (b.eq) ch.push(...[].concat(b.eq));                       // raw ffmpeg filters, e.g. "highpass=f=80"
    if (b.compressor) ch.push(`acompressor=${opts(b.compressor)}`);
    if (b.volume != null && inp.kind === 'hit') ch.push(`volume=${b.volume}`);
    if (inp.kind === 'hit') { const ms = Math.round(inp.at * 1000); ch.push(`adelay=${ms}|${ms}`, 'apad'); }
    let cur = `${tag}_pre`;
    lines.push(`[${k}:a]${ch.join(',')}[${cur}]`);
    if (inp.kind === 'bus' && b.duck) {
      lines.push(`[${cur}][v${sc++}]sidechaincompress=${opts(b.duck)}[${tag}_dk]`); cur = `${tag}_dk`;
    }
    const post = [];
    if (b.envelope) { const e = envelopeExpr(ctx, b.envelope); if (e) post.push(e); }
    if (solos) post.push('asplit=2');
    if (post.length) {
      lines.push(`[${cur}]${post.join(',')}[${tag}]${solos ? `[${tag}_solo]` : ''}`);
      cur = tag;
    }
    amixIn.push(`[${cur}]`);
    if (solos) soloOut.push([inp.kind === 'hit' ? `hit-${inp.name}` : inp.name, `[${tag}_solo]`]);
  });
  const lim = { limit: .89, attack: 1, release: 60, ...(mix.limiter || {}) };
  lines.push(`${amixIn.join('')}amix=inputs=${amixIn.length}:duration=first:normalize=0,alimiter=${opts(lim)}[mix]`);
  // Solos trimmed to the mix length.
  const D = num(voiceDur + (mix.tail || 0));
  const soloMaps = soloOut.map(([name, lab], i) => { lines.push(`${lab}atrim=end=${D}[s${i}]`); return [name, `[s${i}]`]; });
  return { graph: lines.join(';\n'), soloMaps, D };
}

function main() {
  const a = args(process.argv.slice(2));
  if (a.help || !a._[0] || !a.narration) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 11).join('\n')); process.exit(a.help ? 0 : 1); }
  const t0 = Date.now();
  const ctx = loadCues(a._[0], { wordsFile: a.words });
  const mix = ctx.cue.mix;
  if (!mix) throw new Error('cue file has no "mix" section');
  const out = path.resolve(a.out || path.join(ctx.dir, 'audio'));
  const stems = path.resolve(a.stems || out);
  fs.mkdirSync(out, { recursive: true });
  if (!fs.existsSync(a.narration)) throw new Error('narration not found: ' + a.narration);
  const voiceDur = durationOf(a.narration);
  const solos = !a['no-solos'];

  const inputs = [];
  for (const b of (mix.buses || [])) {
    if (b.off) continue;
    const f = path.resolve(stems, b.stem);
    if (!fs.existsSync(f)) throw new Error(`bus "${b.name}": stem not found ${f} (run build-audio.js first)`);
    inputs.push({ kind: 'bus', name: b.name, file: f, cfg: b });
  }
  for (const h of (mix.hits || [])) {
    if (h.off) continue;
    const f = path.resolve(stems, h.file || `hit-${h.name}.wav`);
    if (!fs.existsSync(f)) throw new Error(`hit "${h.name}": ${f} not found (run build-audio.js first)`);
    inputs.push({ kind: 'hit', name: h.name, file: f, cfg: h, at: resolveTime(ctx, h.at) });
  }
  const { graph, soloMaps, D } = buildGraph(ctx, mix, inputs, voiceDur, solos);
  const gfile = path.join(out, 'mix-graph.txt');
  fs.writeFileSync(gfile, graph + '\n');

  const premix = path.join(out, 'premix.wav');
  const ff = ['-i', a.narration, ...inputs.flatMap(i => ['-i', i.file]), '-filter_complex_script', gfile,
    '-map', '[mix]', '-c:a', 'pcm_s16le', premix];
  soloMaps.forEach(([name, lab]) => ff.push('-map', lab, '-c:a', 'pcm_s16le', path.join(out, `solo-${name}.wav`)));
  runFfmpeg(ff, 'premix');

  // Two-pass loudness normalisation (linear when the targets allow it).
  const ln = { I: -14, TP: -1.0, LRA: 18, ...(mix.loudnorm || {}) };
  const p1 = runFfmpeg(['-i', premix, '-af', `loudnorm=I=${ln.I}:TP=${ln.TP}:LRA=${ln.LRA}:print_format=json`, '-f', 'null', '-'], 'loudnorm pass 1');
  const js = JSON.parse(p1.slice(p1.lastIndexOf('{'), p1.lastIndexOf('}') + 1));
  const final = path.join(out, 'mix.wav');
  runFfmpeg(['-i', premix, '-af', `loudnorm=I=${ln.I}:TP=${ln.TP}:LRA=${ln.LRA}:measured_I=${js.input_i}:measured_TP=${js.input_tp}:measured_LRA=${js.input_lra}:measured_thresh=${js.input_thresh}:offset=${js.target_offset}:linear=true,aresample=48000`,
    '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', final], 'loudnorm pass 2');

  // ---------- Measurements ----------
  const rep = { cue: path.resolve(a._[0]), narration: path.resolve(a.narration), duration: num(durationOf(final)), mix: loudness(final), premix: loudness(premix) };
  if (solos) {
    const solo = Object.fromEntries(soloMaps.map(([n]) => [n, M.decodePower(path.join(out, `solo-${n}.wav`), M.SR)]));
    const mixA = M.decodePower(final, M.SR);
    rep.solosLUFS = Object.fromEntries(soloMaps.map(([n]) => [n, loudness(path.join(out, `solo-${n}.wav`)).I]));
    rep.voiceOverBed = {};
    for (const [n] of soloMaps) if (n !== 'voice' && !n.startsWith('hit-')) rep.voiceOverBed[n] = M.voiceVsBed(solo.voice, solo[n]);
    // Loudest half-second of the mix vs the voice's typical speaking level (median of active 0.5 s windows of the voice solo, mix scale).
    const gain = rep.mix.I - rep.premix.I;
    const c = M.curve(mixA, .5), vc = M.curve(solo.voice, .5), vmax = M.pct(vc.filter(x => x > -90), .95);
    const vMed = M.pct(vc.filter(x => x > vmax - 15), .5) + gain;
    let im = 0; c.forEach((x, i) => { if (x > c[im]) im = i; });
    rep.loudest = { at: im * .5, dB: +c[im].toFixed(1), overVoiceDb: +(c[im] - vMed).toFixed(1) };
    // EBU momentary loudness (400 ms) of the final mix: speaking median vs the loudest moments.
    const mom = momentary(final), vActive = M.curve(solo.voice, .1);
    const speaking = mom.filter(([t]) => { const i = Math.round(t * 10) - 2; return vActive[i] > vmax - 15; }).map(x => x[1]);
    const speechM = M.pct(speaking, .5), top = mom.reduce((a, b) => b[1] > a[1] ? b : a);
    rep.momentary = { speechMedianLUFS: +speechM.toFixed(1), maxLUFS: top[1], maxAt: top[0] };
    rep.checks = (mix.checks || []).map(ch => {
      const f = resolveTime(ctx, ch.from), t = resolveTime(ctx, ch.to), src = ch.solo ? solo[ch.solo] : mixA;
      if (!src) throw new Error(`check "${ch.label}": no solo "${ch.solo}"`);
      const v = M.rmsDb(src, f, t) + (ch.solo ? gain : 0);
      const r = { label: ch.label, from: num(f), to: num(t), on: ch.solo || 'mix', dB: +v.toFixed(1), overVoiceDb: +(v - vMed).toFixed(1) };
      if (!ch.solo) { const w = mom.filter(([tt]) => tt >= f + .3 && tt <= t + .1); if (w.length) { const mm = Math.max(...w.map(x => x[1])); r.maxMomentaryLUFS = mm; r.overSpeechLU = +(mm - speechM).toFixed(1); } }
      return r;
    });
  }
  rep.seconds = +((Date.now() - t0) / 1000).toFixed(1);
  fs.writeFileSync(path.join(out, 'mix-report.json'), JSON.stringify(rep, null, 1));
  console.log(`mix.wav: ${rep.duration} s, ${rep.mix.I} LUFS, LRA ${rep.mix.LRA} LU, true peak ${rep.mix.TP} dBTP (premix ${rep.premix.I} LUFS)`);
  if (rep.voiceOverBed) for (const [n, v] of Object.entries(rep.voiceOverBed)) console.log(`voice over ${n}: median ${v.median.toFixed(1)} dB (p10 ${v.p10.toFixed(1)}, p90 ${v.p90.toFixed(1)}) over ${v.windows} speaking windows`);
  const sg = x => (x >= 0 ? '+' : '') + x;
  if (rep.loudest) console.log(`loudest 0.5 s: ${rep.loudest.at} s, ${sg(rep.loudest.overVoiceDb)} dB over the voice; momentary max ${rep.momentary.maxLUFS} LUFS at ${rep.momentary.maxAt} s, speech median ${rep.momentary.speechMedianLUFS} LUFS`);
  for (const c of rep.checks || []) console.log(`check ${c.label} [${c.from}-${c.to}] ${c.on}: ${c.dB} dBFS (${sg(c.overVoiceDb)} dB vs voice)` + (c.maxMomentaryLUFS != null ? `, momentary max ${c.maxMomentaryLUFS} LUFS (${sg(c.overSpeechLU)} LU vs speech)` : ''));
  console.log(`done in ${rep.seconds} s -> ${out}`);
}

try { main(); } catch (e) { console.error('ERROR:', e.message); process.exit(1); }
