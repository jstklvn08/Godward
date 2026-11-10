// Godward sound library: every instrument, scene sound and one-shot used by the episodes, synthesised from scratch.
// Refactored from the rescued Creation scripts (gen-score.js, gen-ambience.js, gen-audio.js, thunder.js).
//
// Everything renders into a Track: 48 kHz stereo Float32 buffers plus a seeded random source.
// Each generator has the signature  fn(track, t0, params)  with times in seconds. Params are plain objects so a
// cue file can drive them; every field has the default the Creation episode used.
//
//   const S = require('./sounds');
//   const tr = S.createTrack({ dur: 30, seed: 7 });
//   S.play(tr, 'choir', 0, { to: 7.4, notes: [62, 66, 69, 74], lv: 1 });
//   S.reverb(tr); S.fadeOut(tr, { end: 29.5, len: 1.5 });
//   require('./wav').writeWav('out.wav', tr.L, tr.R);
'use strict';

// ---------- Track and helpers ----------
function makeRng(seed) {
  let s = Math.floor(Math.abs(seed)) % 2147483647 || 1; // same state as the rescued scripts for the same seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
// Stable 31-bit hash of a string (FNV-1a), for per-event seeds.
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 2147483646 + 1;
}

function createTrack({ dur, sr = 48000, seed = 1, panGain = 1.4 }) {
  const N = Math.ceil(sr * dur);
  const tr = { sr, N, dur, L: new Float32Array(N), R: new Float32Array(N), seed };
  tr.rnd = makeRng(seed);
  tr.reseed = s => { tr.rnd = makeRng(s); };
  tr.nz = () => tr.rnd() * 2 - 1;
  tr.put = (n, v, pan) => { if (n >= 0 && n < N) { tr.L[n] += v * (1 - pan) * panGain; tr.R[n] += v * pan * panGain; } };
  tr.putLR = (n, l, r) => { if (n >= 0 && n < N) { tr.L[n] += l; tr.R[n] += r; } };
  tr.span = (t0, len) => [Math.max(0, Math.floor(t0 * sr)), Math.min(N, Math.floor((t0 + len) * sr))];
  return tr;
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const fade = (t, t0, t1, a = 1, b = 1) => clamp((t - t0) / a) * clamp((t1 - t) / b);
const endOf = (t0, p, dflt) => p.to != null ? p.to : t0 + (p.len != null ? p.len : dflt);
const panOf = (tr, p, d = 0.5) => p.pan == null ? d : p.pan === 'random' ? tr.rnd() : p.pan;
// State-variable filter: returns a stepper (x, fc, q) -> [low, band].
const svf = (tr, fc0) => { let lo = 0, bp = 0; const sr = tr.sr;
  return (x, f = fc0, q = 1) => { const F = 2 * Math.sin(Math.PI * Math.min(f, sr / 6) / sr), hi = x - lo - q * bp; bp += F * hi; lo += F * bp; return [lo, bp]; }; };

// =====================================================================================================
// MUSIC (score) instruments
// =====================================================================================================

// Pad: three detuned saws per note through a one-pole low-pass. {to, notes, lv=1, bright=.5, a=1.6 (attack), r=2.2 (release)}
function pad(tr, t0, p) {
  const t1 = endOf(t0, p, 4), lv = p.lv ?? 1, bright = p.bright ?? 0.5, a = p.a ?? 1.6, r = p.r ?? 2.2, notes = p.notes;
  const [n0, n1] = tr.span(t0, t1 - t0 + r), sr = tr.sr;
  notes.forEach((m, k) => {
    const f = mtof(m), ph = [tr.rnd(), tr.rnd(), tr.rnd()], pan = .3 + .4 * (k % 3) / 2, g = lv * .05 / Math.sqrt(notes.length), cut = .02 + bright * .08;
    let lp = 0;
    for (let n = n0; n < n1; n++) {
      const t = n / sr, env = clamp((t - t0) / a) * clamp((t1 + r - t) / r); let s = 0;
      for (let j = 0; j < 3; j++) { ph[j] += f * (1 + (j - 1) * .0012) / sr; ph[j] -= Math.floor(ph[j]); s += ph[j] * 2 - 1; }
      lp += cut * (s / 3 - lp); tr.put(n, lp * env * g, pan);
    }
  });
}

// Choir: two detuned buzzing voices per note through 'ah' formants with vibrato. {to, notes, lv=1, att=2.5, rel=3}
function choir(tr, t0, p) {
  const t1 = endOf(t0, p, 4), lv = p.lv ?? 1, att = p.att ?? 2.5, rel = p.rel ?? 3, notes = p.notes, sr = tr.sr;
  const F = p.formants || [[800, 1, .08], [1150, .55, .08], [2900, .22, .1]], [n0, n1] = tr.span(t0, t1 - t0 + rel);
  notes.forEach((m, k) => {
    for (let v = 0; v < 2; v++) {
      const f0 = mtof(m) * (1 + (v - .5) * .006), pan = .2 + .6 * ((k * 2 + v) % 5) / 4, st = F.map(() => [0, 0]);
      let ph = tr.rnd(), vp = tr.rnd() * 6;
      for (let n = n0; n < n1; n++) {
        const t = n / sr, env = clamp((t - t0) / att) * clamp((t1 + rel - t) / rel);
        vp += 2 * Math.PI * (4.8 + v * .4) / sr; ph += f0 * (1 + .004 * Math.sin(vp)) / sr; ph -= Math.floor(ph);
        const x = ph * 2 - 1; let y = 0;
        F.forEach(([fc, gn, q], j) => { const Fq = 2 * Math.sin(Math.PI * fc / sr), s_ = st[j], hi = x - s_[0] - q * s_[1]; s_[1] += Fq * hi; s_[0] += Fq * s_[1]; y += s_[1] * gn; });
        tr.put(n, y * env * lv * .014 / Math.sqrt(notes.length), pan);
      }
    }
  });
}

// Bell / celesta: inharmonic decaying partials. {note, lv=1, pan=.5, dec=2.4}
function bell(tr, t0, p) {
  const f = mtof(p.note), lv = p.lv ?? 1, pan = panOf(tr, p), dec = p.dec ?? 2.4, sr = tr.sr;
  const [n0, n1] = tr.span(t0, dec * 2.2), P = [[1, 1], [2.01, .35], [2.76, .22], [5.4, .07]];
  for (let n = n0; n < n1; n++) {
    const t = (n - n0) / sr; let s = 0;
    P.forEach(([q, a]) => s += Math.sin(2 * Math.PI * f * q * t) * a * Math.exp(-t * (1.3 + q * .6) / dec * 2));
    tr.put(n, s * lv * .05 * Math.min(1, t * 500), pan);
  }
}

// Plucked string (Karplus-Strong): harp, kalimba, pizzicato. {note, lv=1, pan=.5, len=2.2, bright=.5}
function pluck(tr, t0, p) {
  const f = mtof(p.note), lv = p.lv ?? 1, pan = panOf(tr, p), len = p.len ?? 2.2, bright = p.bright ?? .5, sr = tr.sr;
  const P = Math.max(2, Math.round(sr / f)), buf = new Float32Array(P);
  for (let i = 0; i < P; i++) buf[i] = tr.nz();
  const [n0, n1] = tr.span(t0, len); let i = 0; const damp = .4 + .096 * bright * 5;
  for (let n = n0; n < n1; n++) {
    const a = buf[i], b = buf[(i + 1) % P], y = (a * damp + b * (1 - damp)) * .996; buf[i] = y; i = (i + 1) % P;
    tr.put(n, y * lv * .06 * Math.min(1, (n - n0) / sr * 800), pan);
  }
}

// Soft piano: decaying partials with a gentle hammer. {note, lv=1, pan=.5, dec=3, detune=0}
function piano(tr, t0, p) {
  const f = mtof(p.note) * (1 + (p.detune ?? 0)), lv = p.lv ?? 1, pan = panOf(tr, p), dec = p.dec ?? 3, sr = tr.sr;
  const [n0, n1] = tr.span(t0, dec * 1.8);
  for (let n = n0; n < n1; n++) {
    const t = (n - n0) / sr;
    const s = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / dec) + .4 * Math.sin(2 * Math.PI * f * 2.003 * t) * Math.exp(-t / (dec * .5)) + .15 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t / (dec * .3));
    tr.put(n, s * lv * .05 * Math.min(1, t * 300), pan);
  }
}

// Breathy flute: sine + 2nd harmonic, delayed vibrato, breath noise. {note, len=.8, lv=1, pan=.5}
function flute(tr, t0, p) {
  const f = mtof(p.note), len = p.len ?? .8, lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr;
  const [n0, n1] = tr.span(t0, len + .3); let ph = 0, lp = 0;
  for (let n = n0; n < n1; n++) {
    const t = (n - n0) / sr, env = clamp(t / .12) * clamp((len + .3 - t) / .3), vb = 1 + .006 * Math.sin(2 * Math.PI * 5.2 * t) * clamp((t - .25) / .3);
    ph += f * vb / sr; lp += .08 * (tr.nz() - lp);
    tr.put(n, (Math.sin(2 * Math.PI * ph) + .18 * Math.sin(4 * Math.PI * ph) + lp * .25) * env * lv * .05, pan);
  }
}

// Low drum (frame drum / heartbeat / walking pulse). {lv=1, f0=70, pan=.5}
function drum(tr, t0, p) {
  const lv = p.lv ?? 1, f0 = p.f0 ?? 70, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, .5);
  for (let n = n0; n < n1; n++) { const t = (n - n0) / sr; tr.put(n, Math.sin(2 * Math.PI * (f0 - 30 * Math.min(t, .3)) * t) * Math.exp(-t * 9) * lv * .18, pan); }
}
// Heartbeat: a strong beat and a softer echo 0.22 s later. {lv=1, f0=62, pan=.5}
function heartbeat(tr, t0, p) { const lv = p.lv ?? 1, f0 = p.f0 ?? 62; drum(tr, t0, { ...p, lv, f0 }); drum(tr, t0 + .22, { ...p, lv: lv * .6, f0: f0 - 4 }); }

// Bird chirp inside the score. Keep these quiet (default .01 already includes the -65..70% correction). {lv=1, pan=.5}
function chirp(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, f0 = 2400 + tr.rnd() * 1800, k = 2 + Math.floor(tr.rnd() * 3);
  for (let j = 0; j < k; j++) {
    const [n0, n1] = tr.span(t0 + j * .11, .08); let ph = 0;
    for (let n = n0; n < n1; n++) { const t = (n - n0) / sr, f = f0 * (1 + .5 * Math.sin(t * 60)); ph += f / sr; tr.put(n, Math.sin(2 * Math.PI * ph) * Math.sin(Math.PI * t / .08) * lv * .01, pan); }
  }
}

// Band-passed, slowly breathing noise bed. {to, fc=400, lv=1, q=1, mod=.3, pan=.5}
function noiseBed(tr, t0, p) {
  const t1 = endOf(t0, p, 4), fc = p.fc ?? 400, lv = p.lv ?? 1, q = p.q ?? 1, mod = p.mod ?? .3, pan = panOf(tr, p), sr = tr.sr;
  const [n0, n1] = tr.span(t0, t1 - t0); let lo = 0, bp = 0; const F = 2 * Math.sin(Math.PI * fc / sr);
  for (let n = n0; n < n1; n++) {
    const t = n / sr, env = clamp((t - t0) / 1.5) * clamp((t1 - t) / 1.5) * (1 - mod + mod * (.5 + .5 * Math.sin(t * .7 + Math.sin(t * .23) * 3)));
    const hi = tr.nz() - lo - q * bp; bp += F * hi; lo += F * bp; tr.put(n, bp * env * lv * .05, pan);
  }
}

// Sliding low tone (serpent). {len=2.6, from (midi), to_note (midi), lv=1, pan=.5}
function glide(tr, t0, p) {
  const len = p.len ?? 2.6, m0 = p.from ?? 40, m1 = p.toNote ?? 35, lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr;
  const [n0, n1] = tr.span(t0, len); let ph = 0, lp = 0;
  for (let n = n0; n < n1; n++) {
    const u = (n - n0) / sr / len, f = mtof(m0 + (m1 - m0) * (.5 - .5 * Math.cos(Math.PI * u)));
    ph += f / sr; ph -= Math.floor(ph); lp += .03 * ((ph * 2 - 1) - lp); tr.put(n, lp * Math.sin(Math.PI * u) * lv * .12, pan);
  }
}

// Dry clock tick. {lv=1, pan=.5}
function tick(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, .03);
  for (let n = n0; n < n1; n++) tr.put(n, tr.nz() * Math.exp(-(n - n0) / sr * 300) * lv * .08, pan);
}

// String tremolo that accelerates and grows (suspense). {to, notes, lv=1}
function tremolo(tr, t0, p) {
  const t1 = endOf(t0, p, 4), lv = p.lv ?? 1, notes = p.notes, sr = tr.sr, [n0, n1] = tr.span(t0, t1 - t0);
  notes.forEach((m, k) => {
    const f = mtof(m); let ph = tr.rnd(), lp = 0;
    for (let n = n0; n < n1; n++) {
      const t = n / sr, u = (t - t0) / (t1 - t0), am = .5 + .5 * Math.sin(2 * Math.PI * (7 + 5 * u) * t);
      ph += f / sr; ph -= Math.floor(ph); lp += .05 * ((ph * 2 - 1) - lp);
      tr.put(n, lp * am * u * u * lv * .08 / Math.sqrt(notes.length), .3 + .4 * k / notes.length);
    }
  });
}

// Reversed swell: tone that grows cubically and stops dead (a breath in, a shock). {len=2, notes, lv=1}
function reversed(tr, t0, p) {
  const len = p.len ?? 2, lv = p.lv ?? 1, sr = tr.sr, [n0, n1] = tr.span(t0, len);
  p.notes.forEach(m => { const f = mtof(m);
    for (let n = n0; n < n1; n++) { const t = (n - n0) / sr, u = t / len; tr.put(n, (Math.sin(2 * Math.PI * f * t) + .3 * Math.sin(4 * Math.PI * f * t)) * Math.pow(u, 3) * lv * .04, .5); } });
}

// =====================================================================================================
// SCENE SOUNDS (ambience)
// =====================================================================================================

// Ocean: low rolling surf with slow swells. {to, lv=1, pan=.5, period=6.5, fc=500}
function ocean(tr, t0, p) {
  const t1 = endOf(t0, p, 6), lv = p.lv ?? 1, pan = panOf(tr, p), period = p.period ?? 6.5, fc = p.fc ?? 500, sr = tr.sr;
  const [n0, n1] = tr.span(t0, t1 - t0), f = svf(tr, fc), g = svf(tr, 2200), ph = tr.rnd() * 6;
  for (let n = n0; n < n1; n++) {
    const t = n / sr, sw = Math.pow(.5 + .5 * Math.sin(2 * Math.PI * t / period + ph), 2), x = tr.nz();
    const [lo] = f(x, fc * (.6 + .8 * sw), .7), [, hb] = g(x, 2200, .9);
    tr.put(n, (lo * .9 + hb * .25 * sw) * sw * lv * .35 * fade(t, t0, t1, 1.2, 1.2), pan);
  }
}
// Waves lapping a shore (short, brighter swells). {to, lv=1, pan=.5}
function lap(tr, t0, p) { ocean(tr, t0, { ...p, lv: (p.lv ?? 1) * .7, period: p.period ?? 2.3, fc: p.fc ?? 900 }); }
// Single water drop. {lv=1, pan=.5}
function drip(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, f0 = 900 + tr.rnd() * 1400, [n0, n1] = tr.span(t0, .06); let ph = 0;
  for (let n = n0; n < n1; n++) { const t = (n - n0) / sr; ph += f0 * (1 + t * 30) / sr; tr.put(n, Math.sin(2 * Math.PI * ph) * Math.exp(-t * 60) * lv * .25, pan); }
}
// Stream: babbling bands plus droplets. {to, lv=1, pan=.5}
function stream(tr, t0, p) {
  const t1 = endOf(t0, p, 6), lv = (p.lv ?? 1) * .7, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, t1 - t0);
  const bands = [700, 1300, 2600], fs_ = bands.map(b => svf(tr, b));
  for (let n = n0; n < n1; n++) {
    const t = n / sr, x = tr.nz(); let s = 0;
    fs_.forEach((f, j) => { const [, b] = f(x, bands[j] * (1 + .3 * Math.sin(t * (3 + j * 2.3) + j)), .35); s += b * (.6 - .15 * j); });
    tr.put(n, s * lv * .12 * fade(t, t0, t1, 1, 1), pan);
  }
  for (let t = t0; t < t1; t += .12 + tr.rnd() * .25) drip(tr, t, { lv: lv * .35, pan: tr.rnd() });
}
// Splash with droplets. {lv=1, pan=.5, len=.6}
function splash(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), len = p.len ?? .6, sr = tr.sr, [n0, n1] = tr.span(t0, len), f = svf(tr, 1800);
  for (let n = n0; n < n1; n++) { const t = (n - n0) / sr, [, b] = f(tr.nz(), lerp(3000, 900, t / len), .8); tr.put(n, b * Math.exp(-t * 6) * lv * .6, pan); }
  for (let k = 0; k < 6; k++) drip(tr, t0 + .05 + tr.rnd() * len * .6, { lv: lv * .6, pan: pan + (tr.rnd() - .5) * .3 });
}
// Underwater bubbles. {to, lv=1, rate=8}
function bubbles(tr, t0, p) {
  const t1 = endOf(t0, p, 4), lv = p.lv ?? 1, rate = p.rate ?? 8, sr = tr.sr;
  for (let t = t0; t < t1; t += tr.rnd() * 2 / rate) {
    const f0 = 300 + tr.rnd() * 900, [n0, n1] = tr.span(t, .05); let ph = 0; const pan = tr.rnd();
    for (let n = n0; n < n1; n++) { const u = (n - n0) / sr; ph += f0 * (1 + u * 25) / sr; tr.put(n, Math.sin(2 * Math.PI * ph) * Math.sin(Math.PI * u / .05) * lv * .12, pan); }
  }
}
// Wind: slowly sweeping band of noise. Low fc (200-400) = cold/dark; fc ~700 = warm presence (use for God, never footsteps).
// {to, lv=1, fc=500, pan=.5}
function wind(tr, t0, p) {
  const t1 = endOf(t0, p, 6), lv = p.lv ?? 1, fc = p.fc ?? 500, pan = panOf(tr, p), sr = tr.sr;
  const [n0, n1] = tr.span(t0, t1 - t0), f = svf(tr, fc), ph = tr.rnd() * 9;
  for (let n = n0; n < n1; n++) {
    const t = n / sr, m = .5 + .5 * Math.sin(t * .45 + ph + Math.sin(t * .17) * 2), [, b] = f(tr.nz(), fc * (.6 + .9 * m), .5);
    tr.put(n, b * (.4 + .6 * m) * lv * .22 * fade(t, t0, t1, 1.5, 1.5), pan);
  }
}
// Deep earth rumble. {to, lv=1}
function rumble(tr, t0, p) {
  const t1 = endOf(t0, p, 2), lv = p.lv ?? 1, sr = tr.sr, [n0, n1] = tr.span(t0, t1 - t0); let a = 0, b = 0;
  for (let n = n0; n < n1; n++) { const t = n / sr; a += .01 * (tr.nz() - a); b += .01 * (a - b); tr.put(n, b * 8 * lv * fade(t, t0, t1, .8, 1.2) * (.7 + .3 * Math.sin(t * 1.3)), .5); }
}
// Flame: low roar plus crackles (the sun, a sword of fire, a burning bush). {to, lv=1, pan=.5}
function flame(tr, t0, p) {
  const t1 = endOf(t0, p, 4), lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, t1 - t0), f = svf(tr, 380), h = svf(tr, 1600);
  for (let n = n0; n < n1; n++) {
    const t = n / sr, x = tr.nz(), [lo] = f(x, 380 * (1 + .25 * Math.sin(t * 5.3)), .6), [, hb] = h(x, 1600, .7);
    tr.put(n, (lo * 1.2 + hb * .25 * (.5 + .5 * Math.sin(t * 9.7))) * lv * .4 * fade(t, t0, t1, .6, .8) * (.75 + .25 * Math.sin(t * 2.1)), pan);
  }
  for (let t = t0 + .2; t < t1 - .2; t += .03 + tr.rnd() * .14) {
    const [m0, m1] = tr.span(t, .012), a = lv * (.15 + tr.rnd() * .3), pp = pan + (tr.rnd() - .5) * .4;
    for (let n = m0; n < m1; n++) tr.put(n, tr.nz() * a * Math.exp(-(n - m0) / (sr * .002)), pp);
  }
}
// Twinkling high sparkles over a span (light, stars, fireflies). {to, lv=1}
function shimmer(tr, t0, p) {
  const t1 = endOf(t0, p, 3), lv = p.lv ?? 1, sr = tr.sr;
  for (let t = t0; t < t1; t += .08 + tr.rnd() * .25) {
    const f = 2600 + tr.rnd() * 3600, [n0, n1] = tr.span(t, .5), pan = tr.rnd();
    for (let n = n0; n < n1; n++) { const u = (n - n0) / sr; tr.put(n, Math.sin(2 * Math.PI * f * u) * Math.exp(-u * 7) * lv * .05 * Math.min(1, u * 300), pan); }
  }
}
// Crickets (night). {to, lv=1}
function crickets(tr, t0, p) {
  const t1 = endOf(t0, p, 6), lv = p.lv ?? 1, sr = tr.sr;
  for (let v = 0; v < 3; v++) {
    const f = 4200 + v * 450, pan = .2 + v * .3;
    for (let t = t0 + tr.rnd(); t < t1; t += .7 + tr.rnd() * .6) for (let q = 0; q < 3; q++) {
      const [n0, n1] = tr.span(t + q * .045, .03);
      for (let n = n0; n < n1; n++) { const u = (n - n0) / sr; tr.put(n, Math.sin(2 * Math.PI * f * u) * Math.sin(Math.PI * u / .03) * lv * .05 * fade(t, t0, t1, 1, 1), pan); }
    }
  }
}
// Songbird phrase. {lv=1, pan=.5}
function bird(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, f0 = 2400 + tr.rnd() * 2000, k = 2 + Math.floor(tr.rnd() * 4);
  for (let j = 0; j < k; j++) {
    const [n0, n1] = tr.span(t0 + j * .1, .07); let ph = 0;
    for (let n = n0; n < n1; n++) { const u = (n - n0) / sr, f = f0 * (1 + .6 * Math.sin(u * 70)); ph += f / sr; tr.put(n, Math.sin(2 * Math.PI * ph) * Math.sin(Math.PI * u / .07) * lv * .025, pan); }
  }
}
// Gull cry (two falling calls). {lv=1, pan=.5}
function gull(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr;
  for (let j = 0; j < 2; j++) {
    const [n0, n1] = tr.span(t0 + j * .42, .34), f = svf(tr, 2000); let ph = 0;
    for (let n = n0; n < n1; n++) { const u = (n - n0) / sr, fr = lerp(1500, 950, u / .34); ph += fr / sr; ph -= Math.floor(ph); const [, b] = f(ph * 2 - 1, 2200, .3); tr.put(n, b * Math.sin(Math.PI * u / .34) * lv * .25, pan); }
  }
}
// Wing flaps. {lv=1, pan=.5, n=4}
function flap(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, cnt = p.n ?? 4;
  for (let k = 0; k < cnt; k++) {
    const [m0, m1] = tr.span(t0 + k * .16, .09), f = svf(tr, 900);
    for (let n = m0; n < m1; n++) { const u = (n - m0) / sr, [, b] = f(tr.nz(), 900, .9); tr.put(n, b * Math.sin(Math.PI * u / .09) * lv * .35, pan); }
  }
}
// Whale song (3.2 s falling moan). {lv=1, pan=.5}
function whale(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, 3.2); let ph = 0;
  for (let n = n0; n < n1; n++) { const u = (n - n0) / sr, f = lerp(260, 140, Math.sin(Math.PI * u / 3.2 * .5)) * (1 + .02 * Math.sin(u * 30)); ph += f / sr; tr.put(n, (Math.sin(2 * Math.PI * ph) + .3 * Math.sin(4 * Math.PI * ph)) * Math.sin(Math.PI * u / 3.2) * lv * .12, pan); }
}
// Voiced animal call: buzzing source through formants, pitch and loudness shaped over time.
function voiced(tr, t0, len, fn, forms, lv, pan, growl) {
  const sr = tr.sr, [n0, n1] = tr.span(t0, len), fs_ = forms.map(() => svf(tr, 500)); let ph = 0;
  for (let n = n0; n < n1; n++) {
    const u = (n - n0) / sr, q = u / len, [f0, amp] = fn(q);
    ph += f0 * (1 + growl * .08 * Math.sin(u * 2 * Math.PI * 30)) / sr; ph -= Math.floor(ph);
    const x = (ph * 2 - 1) + tr.nz() * growl * .6; let y = 0;
    forms.forEach(([fc, g, qq], j) => { const [, b] = fs_[j](x, fc, qq); y += b * g; });
    tr.put(n, y * amp * lv * .35, pan);
  }
}
const animal = (len, fn, forms, growl) => (tr, t0, p) => voiced(tr, t0, len, fn, forms, p.lv ?? 1, panOf(tr, p), growl);
const roar = animal(1.8, q => [lerp(140, 95, q), Math.sin(Math.PI * Math.pow(q, .6))], [[500, 1, .3], [1100, .6, .4], [2400, .3, .5]], 1);
const trumpet = animal(1.3, q => [lerp(420, 640, Math.sin(Math.PI * q * .8)), Math.sin(Math.PI * q)], [[900, 1, .25], [1800, .7, .25], [3000, .3, .3]], .15);
const moo = animal(1.6, q => [lerp(125, 100, q), Math.sin(Math.PI * q)], [[320, 1, .25], [750, .5, .3]], .1);
const whinny = animal(1.2, q => [lerp(950, 480, q) * (1 + .08 * Math.sin(q * 80)), Math.sin(Math.PI * q) * (.6 + .4 * Math.sin(q * 40))], [[1200, 1, .3], [2600, .5, .3]], .1);
const screech = animal(.7, q => [lerp(2600, 1700, q), Math.sin(Math.PI * q)], [[2800, 1, .3], [4200, .5, .4]], .2);
const bleat = animal(.6, q => [lerp(520, 460, q) * (1 + .05 * Math.sin(q * 90)), Math.sin(Math.PI * q)], [[900, 1, .3], [2000, .5, .3]], .05);
// Footstep on earth/grass. Never use for God (use warm wind). {lv=1, pan=.5, soft=1}
function step(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), soft = p.soft ?? 1, sr = tr.sr, [n0, n1] = tr.span(t0, .12), f = svf(tr, 400);
  for (let n = n0; n < n1; n++) { const u = (n - n0) / sr, [lo] = f(tr.nz(), 400, .8); tr.put(n, (lo * .9 + Math.sin(2 * Math.PI * 70 * u) * .4) * Math.exp(-u * 35) * lv * .6 * soft, pan); }
}
// Hoof click. {lv=1, pan=.5}
function hoof(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, .05);
  for (let n = n0; n < n1; n++) { const u = (n - n0) / sr; tr.put(n, (tr.nz() * .5 + Math.sin(2 * Math.PI * 900 * u)) * Math.exp(-u * 90) * lv * .3, pan); }
}
// Leaves / bushes / cloth rustle. {to, lv=1, pan=.5}
function rustle(tr, t0, p) {
  const t1 = endOf(t0, p, 1.5), lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, t1 - t0), f = svf(tr, 3500);
  for (let n = n0; n < n1; n++) { const t = n / sr, g = Math.max(0, Math.sin(t * 23) * Math.sin(t * 7.7)) ** 2, [, b] = f(tr.nz(), 3500, .6); tr.put(n, b * g * lv * .3 * fade(t, t0, t1, .3, .3), pan); }
}
// Serpent hiss. {len=1, lv=1, pan=.5}
function hiss(tr, t0, p) {
  const len = p.len ?? 1, lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, len), f = svf(tr, 6000);
  for (let n = n0; n < n1; n++) { const u = (n - n0) / sr, [, b] = f(tr.nz(), 6000, .5); tr.put(n, b * Math.sin(Math.PI * u / len) ** .5 * lv * .4, pan); }
}
// Blowing sand / dust grains plus a high wind. {to, lv=1}
function sand(tr, t0, p) {
  const t1 = endOf(t0, p, 4), lv = p.lv ?? 1;
  for (let t = t0; t < t1; t += .004 + tr.rnd() * .012) {
    const [n0, n1] = tr.span(t, .004), a = lv * .06 * fade(t, t0, t1, .6, .8) * tr.rnd(), pan = tr.rnd();
    for (let n = n0; n < n1; n++) tr.put(n, tr.nz() * a, pan);
  }
  wind(tr, t0, { to: t1, lv: lv * .5, fc: 1800 });
}
// An inhaled breath (rising band of noise). {len=2.6, lv=1}
function breath(tr, t0, p) {
  const len = p.len ?? 2.6, lv = p.lv ?? 1, sr = tr.sr, [n0, n1] = tr.span(t0, len), f = svf(tr, 1200);
  for (let n = n0; n < n1; n++) { const u = (n - n0) / sr, q = u / len, [, b] = f(tr.nz(), lerp(600, 2400, q), .7); tr.put(n, b * Math.sin(Math.PI * q) * lv * .5, .5); }
}
// Spade scraping earth, then a thud (digging). {lv=1, pan=.5}
function scrape(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, .45), f = svf(tr, 1400);
  for (let n = n0; n < n1; n++) { const u = (n - n0) / sr, [, b] = f(tr.nz(), 1400 + 600 * Math.sin(u * 40), .5); tr.put(n, b * Math.sin(Math.PI * u / .45) * lv * .4, pan); }
  step(tr, t0 + .4, { lv: lv * .8, pan });
}

// =====================================================================================================
// ONE-SHOTS (sfx and hits)
// =====================================================================================================

// Band-passed noise burst with an envelope and an optional moving centre. Writes directly.
function bandNoise(tr, t0, len, fcFn, q, envFn, lv, pan) {
  const sr = tr.sr, [n0, n1] = tr.span(t0, len); let lo = 0, bp = 0;
  for (let n = n0; n < n1; n++) {
    const t = (n - n0) / sr, f = fcFn(t), F = 2 * Math.sin(Math.PI * Math.min(f, sr / 6) / sr), hi = tr.nz() - lo - q * bp;
    bp += F * hi; lo += F * bp; tr.put(n, bp * envFn(t) * lv, pan);
  }
}
// Soft paper tap when a sheet/piece lands (the rattly version was removed; keep it low). {lv=1, pan=.5}
function paperTap(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr;
  bandNoise(tr, t0, .09, () => 900, 1.2, t => clamp(t / .004) * Math.exp(-t * 60) * .28, lv, pan);
  const [n0, n1] = tr.span(t0, .09);
  for (let n = n0; n < n1; n++) { const t = (n - n0) / sr; tr.put(n, Math.sin(2 * Math.PI * (110 - 200 * t) * t) * Math.exp(-t * 45) * .25 * lv, pan); }
}
// Whoosh (camera move between sheets). {len=.8, up=true, lv=1, pan=.5}
function whoosh(tr, t0, p) {
  const len = p.len ?? .8, up = p.up ?? true, lv = p.lv ?? 1, pan = panOf(tr, p);
  bandNoise(tr, t0, len, t => up ? 300 + 3200 * (t / len) : 3500 - 3000 * (t / len), .7, t => Math.sin(Math.PI * clamp(t / len)) ** 2 * .5, lv, pan);
}
// Soft swish for a marker stroke or highlight (replaces the squeaky marker). {len=.6, lv=1, pan=.5}
function swish(tr, t0, p) {
  const len = (p.len ?? .6) + .15, lv = p.lv ?? 1, pan = panOf(tr, p);
  bandNoise(tr, t0, len, () => 1500, .9, t => .1 * Math.sin(Math.PI * clamp(t / len)) ** 2, lv, pan);
}
// Chime: a sustained bell-ish note. {note, lv=1, pan=.5}
function chime(tr, t0, p) {
  const f = mtof(p.note), lv = (p.lv ?? 1) * .18, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, 3);
  for (let n = n0; n < n1; n++) { const t = (n - n0) / sr; tr.put(n, (Math.sin(2 * Math.PI * f * t) + .4 * Math.sin(2 * Math.PI * f * 2.756 * t) * Math.exp(-t * 3) + .2 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 6)) * Math.exp(-t * 1.6) * lv * Math.min(1, t * 300), pan); }
}
// Sparkle: a burst of 26 high pings over `len` seconds (a moment of light). {len=1.6, lv=1, pan=.5}
function sparkle(tr, t0, p) {
  const len = p.len ?? 1.6, lv = (p.lv ?? 1) * .12, pan = panOf(tr, p), sr = tr.sr;
  for (let k = 0; k < 26; k++) {
    const ts = t0 + tr.rnd() * len * .8, f = mtof(84 + Math.floor(tr.rnd() * 14)), [n0, n1] = tr.span(ts, Math.min(1.2, t0 + len - ts));
    for (let n = n0; n < n1; n++) { const t = (n - n0) / sr; tr.put(n, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 4) * lv * .35 * Math.min(1, t * 200), pan); }
  }
}
// Tearing rip (the world tears). {len=.8, lv=1, pan=.5}
function rip(tr, t0, p) {
  const len = p.len ?? .8, lv = p.lv ?? 1, pan = panOf(tr, p);
  bandNoise(tr, t0, len, t => 900 + 1600 * Math.sin(t * 40) ** 2, .6, t => (tr.rnd() < .35 ? 1 : .3) * clamp(t / .02) * Math.exp(-t * 2.2) * .6, lv, pan);
}
// Low thump (footfall of a big animal, the bite). {lv=1, pan=.5}
function thump(tr, t0, p) {
  const lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, .2);
  for (let n = n0; n < n1; n++) { const t = (n - n0) / sr; tr.put(n, Math.sin(2 * Math.PI * (90 - 120 * t) * t) * Math.exp(-t * 30) * .4 * lv, pan); }
}
// Crisp bite/snap click. {lv=1, pan=.5}
function click(tr, t0, p) { bandNoise(tr, t0, .12, () => 3000, .8, t => Math.exp(-t * 30) * .6, p.lv ?? 1, panOf(tr, p)); }
// Fire burst with crackles (one-shot version of flame). {len=5.5, lv=1, pan=.5}
function fire(tr, t0, p) {
  const len = p.len ?? 5.5, lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr;
  bandNoise(tr, t0, len, () => 600, 1.2, t => clamp(t / .3) * clamp((len - t) / .6) * .35, lv, pan);
  for (let k = 0; k < len * 6; k++) { const ts = t0 + tr.rnd() * len, [n0, n1] = tr.span(ts, 120 / sr);
    for (let n = n0; n < n1; n++) tr.put(n, tr.nz() * Math.exp(-(n - n0) / 25) * .5 * lv, pan); }
}
// Swell: low fifth that rises and falls (an arrival, a realisation). {len=3, note, lv=1, pan=.5}
function swell(tr, t0, p) {
  const len = p.len ?? 3, f = mtof(p.note ?? 38), lv = p.lv ?? 1, pan = panOf(tr, p), sr = tr.sr, [n0, n1] = tr.span(t0, len);
  for (let n = n0; n < n1; n++) { const t = (n - n0) / sr; tr.put(n, (Math.sin(2 * Math.PI * f * t) + .5 * Math.sin(2 * Math.PI * f * 1.5 * t)) * Math.sin(Math.PI * t / len) ** 2 * .12 * lv, pan); }
}
// Dust: long soft low-mid noise swell. {len=4, lv=1, pan=.5}
function dust(tr, t0, p) { const len = p.len ?? 4; bandNoise(tr, t0, len, () => 500, 1.4, t => Math.sin(Math.PI * t / len) * .18, p.lv ?? 1, panOf(tr, p)); }

// Thunderclap: sharp crack, sub boom, long rolling rumble (6 s), left/right decorrelated. {lv=1, len=6}
function thunder(tr, t0, p) {
  const lv = p.lv ?? 1, len = p.len ?? 6, sr = tr.sr, [n0, n1] = tr.span(t0, len);
  const rolls = p.rolls || [[0, 1], [.35, .8], [.9, .65], [1.6, .5], [2.4, .35], [3.3, .22]];
  const env = t => rolls.reduce((a, [r0, g]) => a + (t >= r0 ? g * Math.exp(-(t - r0) * 1.6) * Math.min(1, (t - r0) / .04) : 0), 0);
  let l1 = 0, l2 = 0, r1 = 0, r2 = 0; const a = .035;
  for (let n = n0; n < n1; n++) {
    const t = (n - n0) / sr, nl = tr.nz(), nr = tr.nz();
    l1 += a * (nl - l1); l2 += a * (l1 - l2); r1 += a * (nr - r1); r2 += a * (r1 - r2);
    const rum = env(t) * 6.5;
    const cr = tr.nz() * Math.exp(-t * 28) * Math.min(1, t / .002) * .9, c2 = tr.nz() * Math.exp(-Math.max(0, t - .09) * 22) * (t > .09 ? .5 : 0);
    const boom = Math.sin(2 * Math.PI * (52 - 14 * Math.min(t, 1)) * t) * Math.exp(-t * 1.4) * .75 * Math.min(1, t / .01);
    tr.putLR(n, (l2 * rum + cr + c2 * .8 + boom) * lv, (r2 * rum + cr * .9 + c2 + boom) * lv);
  }
}

// =====================================================================================================
// Registry: how the cue expander treats each sound.
//   pitch: 'note' (one note per call; a `notes` list is strummed), 'notes' (chord), or null
//   span:  true if it lasts from t0 to `to` (or t0+len)
// =====================================================================================================
const REG = {
  // music
  pad: { fn: pad, pitch: 'notes', span: true }, choir: { fn: choir, pitch: 'notes', span: true },
  bell: { fn: bell, pitch: 'note' }, pluck: { fn: pluck, pitch: 'note' }, piano: { fn: piano, pitch: 'note' },
  flute: { fn: flute, pitch: 'note' }, drum: { fn: drum }, heartbeat: { fn: heartbeat }, chirp: { fn: chirp },
  noiseBed: { fn: noiseBed, span: true }, glide: { fn: glide }, tick: { fn: tick },
  tremolo: { fn: tremolo, pitch: 'notes', span: true }, reversed: { fn: reversed, pitch: 'notes' },
  // scene sounds
  ocean: { fn: ocean, span: true }, lap: { fn: lap, span: true }, stream: { fn: stream, span: true }, drip: { fn: drip },
  splash: { fn: splash }, bubbles: { fn: bubbles, span: true }, wind: { fn: wind, span: true }, rumble: { fn: rumble, span: true },
  flame: { fn: flame, span: true }, shimmer: { fn: shimmer, span: true }, crickets: { fn: crickets, span: true },
  bird: { fn: bird }, gull: { fn: gull }, flap: { fn: flap }, whale: { fn: whale },
  roar: { fn: roar }, trumpet: { fn: trumpet }, moo: { fn: moo }, whinny: { fn: whinny }, screech: { fn: screech }, bleat: { fn: bleat },
  step: { fn: step }, hoof: { fn: hoof }, rustle: { fn: rustle, span: true }, hiss: { fn: hiss }, sand: { fn: sand, span: true },
  breath: { fn: breath }, scrape: { fn: scrape },
  // one-shots
  paperTap: { fn: paperTap }, whoosh: { fn: whoosh }, swish: { fn: swish }, chime: { fn: chime, pitch: 'note' },
  sparkle: { fn: sparkle }, rip: { fn: rip }, thump: { fn: thump }, click: { fn: click }, fire: { fn: fire },
  swell: { fn: swell }, dust: { fn: dust }, thunder: { fn: thunder },
};

function play(tr, name, t0, params = {}) {
  const r = REG[name];
  if (!r) throw new Error(`unknown sound "${name}". Known: ${Object.keys(REG).join(', ')}`);
  r.fn(tr, t0, params);
}

// =====================================================================================================
// Processing
// =====================================================================================================

// Freeverb-style stereo reverb (mono in, two decorrelated tails). {room=.86, damp=.3, wet=.35}
function reverb(tr, { room = .86, damp = .3, wet = .35 } = {}) {
  const { L, R, sr } = tr, combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116], aps = [556, 441, 341, 225];
  const run = (x, sp) => {
    const o = new Float32Array(x.length);
    combs.forEach(d0 => { const d = Math.round((d0 + sp) * sr / 44100), buf = new Float32Array(d); let i = 0, st = 0;
      for (let n = 0; n < x.length; n++) { const y = buf[i]; st = y * (1 - damp) + st * damp; buf[i] = x[n] * .015 + st * room; o[n] += y; i = (i + 1) % d; } });
    aps.forEach(d0 => { const d = Math.round((d0 + sp) * sr / 44100), buf = new Float32Array(d); let i = 0;
      for (let n = 0; n < x.length; n++) { const b = buf[i], y = -o[n] + b; buf[i] = o[n] + b * .5; o[n] = y; i = (i + 1) % d; } });
    return o;
  };
  const m = new Float32Array(L.length); for (let n = 0; n < L.length; n++) m[n] = (L[n] + R[n]) * .5;
  const wl = run(m, 0), wr = run(m, 23);
  for (let n = 0; n < L.length; n++) { L[n] = L[n] * (1 - wet) + wl[n] * wet * 3; R[n] = R[n] * (1 - wet) + wr[n] * wet * 3; }
}

// Auto-level: hold the bed near its average loudness (window RMS smoothed over +-smooth windows), gain clamped.
// Silence stays silent because the gain is clamped. {window=.1 s, smooth=15, min=.35, max=4}
function autoLevel(tr, { window = .1, smooth = 15, min = .35, max = 4 } = {}) {
  const { L, R, N, sr } = tr, W = Math.round(sr * window), nw = Math.ceil(N / W), rms = new Float32Array(nw);
  for (let w = 0; w < nw; w++) { let s = 0; for (let n = w * W; n < Math.min(N, (w + 1) * W); n++) s += L[n] * L[n] + R[n] * R[n]; rms[w] = Math.sqrt(s / (2 * W)) + 1e-6; }
  const sm = new Float32Array(nw);
  for (let w = 0; w < nw; w++) { let s = 0, c = 0; for (let k = -smooth; k <= smooth; k++) { const j = w + k; if (j >= 0 && j < nw) { s += rms[j]; c++; } } sm[w] = s / c; }
  let ref = 0; for (let w = 0; w < nw; w++) ref += sm[w]; ref /= nw;
  for (let n = 0; n < N; n++) { const g = clamp(ref / sm[Math.min(nw - 1, Math.floor(n / W))], min, max); L[n] *= g; R[n] *= g; }
}

// Linear fade to silence ending at `end`. {end, len=1.5}; also optional fade-in {in: seconds}
function fadeOut(tr, { end, len = 1.5, in: fin = 0 } = {}) {
  const { L, R, N, sr } = tr;
  for (let n = 0; n < N; n++) { const t = n / sr, g = (end != null ? clamp((end - t) / len) : 1) * (fin > 0 ? clamp(t / fin) : 1); L[n] *= g; R[n] *= g; }
}

module.exports = { createTrack, makeRng, hashSeed, play, REG, reverb, autoLevel, fadeOut, mtof, clamp, lerp };
