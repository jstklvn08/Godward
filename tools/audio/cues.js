// Cue-file loading: time resolution (seconds, "m:ss", marks, scenes, word cues) and event expansion into sound calls.
// The format is documented in .claude/skills/godward-episode/reference/audio.md.
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sounds');

// ---------- Words ----------
const norm = w => String(w).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, '');

// Accepts words.json ([[word,start,end],...] or {words:[...]}) or a words.js that exports the array or contains it literally.
function loadWords(file) {
  if (!fs.existsSync(file)) throw new Error(`words file not found: ${file}`);
  let data;
  if (/\.json$/i.test(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'));
  else {
    try { data = require(path.resolve(file)); } catch (e) { data = null; }
    if (!Array.isArray(data) && !(data && Array.isArray(data.words))) {
      const src = fs.readFileSync(file, 'utf8'), i = src.indexOf('[['), j = src.lastIndexOf(']]');
      if (i < 0 || j < i) throw new Error(`no [[word,start,end],...] array found in ${file}`);
      data = JSON.parse(src.slice(i, j + 2));
    }
  }
  if (!Array.isArray(data)) data = data.words;
  // Split multi-word tokens ("She ate") so each word can be cued; they share the token's times.
  const out = [];
  for (const [w, s, e] of data) for (const part of String(w).trim().split(/\s+/)) out.push({ w: part, k: norm(part), s: +s, e: +e });
  return out;
}

function findWord(words, cue, file) {
  if (!words) throw new Error(`cue ${JSON.stringify(cue)} uses a word but no words file was given (use --words or "words" in the cue file)`);
  const want = String(cue.word).trim().split(/\s+/).map(norm).filter(Boolean);
  if (!want.length) throw new Error(`empty word cue ${JSON.stringify(cue)}`);
  const hits = [];
  for (let i = 0; i + want.length <= words.length; i++) if (want.every((k, j) => words[i + j].k === k)) hits.push(i);
  const n = cue.n ?? 1;
  if (!hits.length) {
    // Suggest spoken words close to each wanted word (edit distance <= 2, or same first 4 letters).
    const lev = (a, b) => { const d = Array.from({ length: b.length + 1 }, (_, j) => j);
      for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i;
        for (let j = 1; j <= b.length; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; } }
      return d[b.length]; };
    const keys = [...new Set(words.map(x => x.k))];
    const near = [...new Set(want.flatMap(k => keys.map(x => [x, lev(x, k)])
      .filter(([x, d]) => d <= (k.length >= 5 ? 2 : 1) || (k.length >= 4 && x.startsWith(k.slice(0, 4))))
      .sort((a, b) => a[1] - b[1]).map(([x]) => x)))].slice(0, 8);
    const missing = want.filter(k => !keys.includes(k));
    throw new Error(`word cue "${cue.word}" is never spoken in ${file}` + (missing.length ? ` (unknown: ${missing.join(', ')})` : ' (each word exists, but not in this order)') + '.' + (near.length ? ` Similar words: ${near.join(', ')}` : ''));
  }
  const idx = n < 0 ? hits[hits.length + n] : hits[n - 1];
  if (idx == null) throw new Error(`word cue "${cue.word}" n=${n} but it only occurs ${hits.length} time(s) in ${file} (at ${hits.map(i => words[i].s).join(', ')} s)`);
  const t = (cue.edge === 'end') ? words[idx + want.length - 1].e : words[idx].s;
  return t + (cue.offset ?? 0);
}

// ---------- Cue context ----------
function loadCues(cueFile, { wordsFile } = {}) {
  const cue = JSON.parse(fs.readFileSync(cueFile, 'utf8'));
  const dir = path.dirname(path.resolve(cueFile));
  const wf = wordsFile || (cue.words ? path.resolve(dir, cue.words) : null);
  const ctx = { cue, dir, file: cueFile, wordsFile: wf, words: wf ? loadWords(wf) : null, marks: {}, resolving: new Set() };
  ctx.time = v => resolveTime(ctx, v);
  ctx.duration = ctx.time(cue.duration);
  return ctx;
}

function resolveMark(ctx, name) {
  const m = ctx.cue.marks || {};
  if (ctx.marks[name] != null) return ctx.marks[name];
  if (!(name in m)) {
    const scene = (ctx.cue.scenes || []).find(s => s.name === name);
    if (scene) return resolveScene(ctx, { scene: name });
    throw new Error(`unknown mark "${name}". Marks: ${Object.keys(m).join(', ') || '(none)'}; scenes: ${(ctx.cue.scenes || []).map(s => s.name).join(', ')}`);
  }
  if (ctx.resolving.has(name)) throw new Error(`mark "${name}" refers to itself`);
  ctx.resolving.add(name); const t = resolveTime(ctx, m[name]); ctx.resolving.delete(name);
  return (ctx.marks[name] = t);
}

function resolveScene(ctx, v) {
  const sc = ctx.cue.scenes || [], i = sc.findIndex(s => s.name === v.scene);
  if (i < 0) throw new Error(`unknown scene "${v.scene}". Scenes: ${sc.map(s => s.name).join(', ')}`);
  let t;
  if (v.edge === 'end') t = sc[i].end != null ? resolveTime(ctx, sc[i].end) : (sc[i + 1] ? resolveTime(ctx, sc[i + 1].start) : ctx.duration);
  else t = resolveTime(ctx, sc[i].start);
  return t + (v.offset ?? 0);
}

// Time value: number | "m:ss.s" | "markName" | "markName+0.3" | {word,n,offset,edge} | {mark,offset} | {scene,edge,offset}
function resolveTime(ctx, v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) return +s;
    let m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(s); if (m) return +m[1] * 60 + +m[2];
    m = /^([A-Za-z_][\w-]*)\s*([+-]\s*\d+(?:\.\d+)?)?$/.exec(s);
    if (m) return resolveMark(ctx, m[1]) + (m[2] ? +m[2].replace(/\s/g, '') : 0);
    throw new Error(`cannot read time "${v}"`);
  }
  if (v && typeof v === 'object') {
    if ('word' in v) return findWord(ctx.words, v, ctx.wordsFile);
    if ('mark' in v) return resolveMark(ctx, v.mark) + (v.offset ?? 0);
    if ('scene' in v) return resolveScene(ctx, v);
  }
  throw new Error(`cannot read time ${JSON.stringify(v)}`);
}

// ---------- Event expansion ----------
// Keys that steer expansion and are not passed to the sound.
const STRUCT = new Set(['inst', 'at', 'repeat', 'seq', 'pick', 'chords', 'chordEvery', 'arp', 'octaves', 'transpose', 'hold',
  'motif', 'step', 'strum', 'strumPan', 'comment', 'off', 'seed', 'scene', 'prob', 'chordFrom', 'holdClip']);

function paramValue(tr, v, u, i) {
  if (Array.isArray(v) && v.length && typeof v[0] !== 'number') return v; // nested lists (formants) pass through
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('rand' in v) return v.rand[0] + tr.rnd() * (v.rand[1] - v.rand[0]);
    if ('ramp' in v) return S.lerp(v.ramp[0], v.ramp[1], u);
    if ('alt' in v) return v.alt[i % v.alt.length];
  }
  return v;
}

// Turn one cue event into concrete sound calls on a track.
function renderEvent(ctx, tr, ev, stemSeed) {
  if (ev.off || !ev.inst) return 0; // entries without "inst" are scene markers / comments
  const reg = S.REG[ev.inst];
  if (!reg) throw new Error(`unknown inst "${ev.inst}" in ${JSON.stringify(ev).slice(0, 120)}. Known: ${Object.keys(S.REG).join(', ')}`);
  tr.reseed(ev.seed ?? S.hashSeed(stemSeed + ':' + JSON.stringify(ev)));
  const T = v => resolveTime(ctx, v);
  const motifs = ctx.cue.motifs || {};
  // Start times
  const reps = [], overrides = {};
  let r0 = null, r1 = null;
  if (ev.repeat) {
    r0 = T(ev.repeat.from); r1 = T(ev.repeat.to);
    const every = ev.repeat.every, jit = ev.repeat.jitter ?? 0;
    if (!(r1 > r0)) throw new Error(`repeat.to must be after repeat.from in ${JSON.stringify(ev)}`);
    for (let t = r0, i = 0; t < r1 && i < 100000; i++) {
      reps.push(t);
      const u = (t - r0) / (r1 - r0), st = Array.isArray(every) ? S.lerp(every[0], every[1], u) : every;
      if (!(st > 0)) throw new Error(`repeat.every must be > 0 in ${JSON.stringify(ev)}`);
      t += st + tr.rnd() * jit;
    }
  } else {
    if (ev.at == null) throw new Error(`event needs "at" or "repeat": ${JSON.stringify(ev)}`);
    // "at" may be a list: each entry a time, or {"t": time, ...param overrides}
    for (const a of [].concat(ev.at)) {
      if (a && typeof a === 'object' && 't' in a) { const { t, ...over } = a; reps.push(T(t)); overrides[reps.length - 1] = over; }
      else reps.push(T(a));
    }
  }
  const shift = ev.repeat?.shift ?? 0, prob = ev.prob ?? 1;
  let calls = 0;
  reps.forEach((t0, i) => {
    if (prob < 1 && tr.rnd() >= prob) return;
    const t = t0 + (shift ? tr.rnd() * shift : 0);
    const u = r0 == null ? 0 : (t0 - r0) / (r1 - r0);
    const p = {};
    for (const [k, v] of Object.entries(ev)) if (!STRUCT.has(k)) p[k] = paramValue(tr, v, u, i);
    if (p.to != null && typeof p.to !== 'number') p.to = T(p.to);
    if (Array.isArray(ev.pan)) p.pan = ev.pan[i % ev.pan.length];
    if (overrides[i]) Object.assign(p, overrides[i]);
    // Pitch selection
    if (ev.seq) { const val = ev.pick === 'random' ? ev.seq[Math.floor(tr.rnd() * ev.seq.length)] : ev.seq[i % ev.seq.length];
      if (Array.isArray(val)) p.notes = val; else p.note = val; }
    if (ev.chords) {
      const cf = ev.chordFrom != null ? T(ev.chordFrom) : r0;
      const ci = ev.chordEvery ? Math.floor((t0 - cf) / ev.chordEvery + 1e-9) : i, ch = ev.chords[ci % ev.chords.length];
      if (ev.arp) p.note = ch[i % ch.length]; else p.notes = ch;
    }
    if (ev.octaves && p.note != null) p.note += ev.octaves[i % ev.octaves.length];
    const tp = ev.transpose ?? 0;
    if (tp) { if (p.note != null) p.note += tp; if (p.notes) p.notes = p.notes.map(m => m + tp); }
    if (reg.span && ev.hold != null) p.to = ev.holdClip === false ? t + ev.hold : Math.min(t + ev.hold, r1 ?? Infinity);
    if (reg.span && p.to == null && p.len == null) throw new Error(`"${ev.inst}" lasts over time: give "to", "len" or "hold" in ${JSON.stringify(ev)}`);
    // Motif: a named or literal note list played every `step` seconds
    if (ev.motif) {
      const notes = typeof ev.motif === 'string' ? motifs[ev.motif] : ev.motif;
      if (!notes) throw new Error(`unknown motif "${ev.motif}". Motifs: ${Object.keys(motifs).join(', ')}`);
      notes.forEach((m, k) => { S.play(tr, ev.inst, t + k * (ev.step ?? .7), { ...p, note: m + tp }); calls++; });
      return;
    }
    if (reg.pitch === 'note' && p.note == null && p.notes) {
      const notes = p.notes, sp = ev.strumPan ?? 0, basePan = typeof p.pan === 'number' ? p.pan : .5;
      notes.forEach((m, j) => { S.play(tr, ev.inst, t + j * (ev.strum ?? 0), { ...p, notes: undefined, note: m, pan: sp ? basePan + j * sp : p.pan }); calls++; });
      return;
    }
    if (reg.pitch === 'note' && p.note == null) throw new Error(`"${ev.inst}" needs "note", "notes", "seq", "chords" or "motif": ${JSON.stringify(ev)}`);
    if (reg.pitch === 'notes' && !p.notes) throw new Error(`"${ev.inst}" needs "notes", "seq" or "chords": ${JSON.stringify(ev)}`);
    S.play(tr, ev.inst, t, p); calls++;
  });
  return calls;
}

// Render one stem section ({seed, events, reverb, autoLevel, fade, peak}) to a track.
function renderStem(ctx, name, sec) {
  const tr = S.createTrack({ dur: ctx.duration, seed: sec.seed ?? 1 });
  let calls = 0;
  (sec.events || []).forEach(ev => { calls += renderEvent(ctx, tr, ev, `${name}:${sec.seed ?? 1}`); });
  if (sec.reverb) S.reverb(tr, sec.reverb);
  if (sec.autoLevel) S.autoLevel(tr, sec.autoLevel);
  if (sec.fade) S.fadeOut(tr, { end: sec.fade.end != null ? resolveTime(ctx, sec.fade.end) : undefined, len: sec.fade.len, in: sec.fade.in });
  return { tr, calls };
}

// Resolve every time in the mix section (envelopes, hits, checks) so a bad word cue stops a build before rendering.
function validateMix(ctx) {
  const mix = ctx.cue.mix || {}, T = v => resolveTime(ctx, v);
  for (const b of [mix.voice || {}, ...(mix.buses || [])]) for (const w of (b.envelope || [])) { T(w.from); T(w.to); }
  for (const h of (mix.hits || [])) T(h.at);
  for (const c of (mix.checks || [])) { T(c.from); T(c.to); }
}

module.exports = { validateMix, loadCues, loadWords, resolveTime, renderEvent, renderStem, norm };
