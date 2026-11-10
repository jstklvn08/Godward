// Godward episode engine: the reusable machinery from "Creation and the Fall", configured by one episode object.
// Load order in a page:  _kit/shared.js (window.K)  ->  _kit/style-kit.js (window.S)  ->  words.js (const WORDS)
//                        ->  _kit/episode-engine.js (window.E)  ->  the episode script, which ends with E.start({...}).
// Plain script, no build step, works from file://. Every frame is a pure function of time.
// Page contract (same as the first episode): window.DUR, synchronous window.seek(t), ?render=1 stops the
// playback loop, ?v=1 switches to the 1080x1920 vertical cut. Authoring guide: .claude/skills/godward-episode/reference/engine.md
(function () {
  'use strict';
  if (!window.K || !window.S) throw new Error('episode-engine.js: load _kit/shared.js and _kit/style-kit.js before it.');
  const { G, R, C, L, T, prog, ease, lerp, mix, sc, clamp, rng } = K;
  const { tw, hash, glow, torn, ridge: ridge0, strip, tape, label, highlight, piece, paperDefs, paperOver, vignette, chubby: chubby0 } = S;

  // ---------- constants ----------
  const VERT = /[?&]v=1/.test(location.search);
  const INK = '#141416', YEL = '#FFE100', CORAL = '#FF5A48', PAPER = '#F5F0E2';
  const STN = 2100;   // landscape: distance between sheets on the wall
  const PAN = .32;    // landscape: half-length of the eased pan between sheets (s)
  const SL = .38;     // vertical: half-length of the scroll between sheets (s)
  const FW = 1080, FH = 1920;
  const BANDY = 1010; // vertical: frame y that the camera point lands on
  const VTOP = 170;   // vertical: verse cards stack down from here (top 150 px stays empty for platform UI)
  const CAP_Y = 1300; // vertical: caption baseline (about 68% of the height)

  const st = {
    list: null, flat: null, memo: new Map(), cfg: null, sheets: [], cuts: [], DUR: 0, t: 0,
    VQ: [], vtop: VTOP, cues: [], bursts: [], vend: {}, talk: [], focus: [], cast: {}, flashes: [], started: false,
  };

  // ---------- word list and timing ----------
  const norm = s => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '');
  function words(arr) {
    if (arr) {
      if (!Array.isArray(arr) || !arr.length) throw new Error('E.words: expected a non-empty [[word,start,end],...] list.');
      arr.forEach((w, i) => {
        if (!Array.isArray(w) || typeof w[0] !== 'string' || !(w[1] >= 0) || !(w[2] >= 0))
          throw new Error(`E.words: entry ${i} is not [word, start, end]: ${JSON.stringify(w)}`);
      });
      st.list = arr; st.flat = null; st.memo.clear();
    }
    if (!st.list) {
      let w;
      try { w = WORDS; } catch (e) { w = window.WORDS; } // eslint-disable-line no-undef
      if (!w) throw new Error('E: no word list. Load words.js (const WORDS=[[word,start,end],...]) before the episode script, or call E.words(list).');
      words(w);
    }
    if (!st.flat) {
      // One entry per spoken word; a token like "She ate" becomes two words with the same times.
      st.flat = [];
      st.list.forEach((x, i) => String(x[0]).split(/\s+/).map(norm).filter(Boolean).forEach(w => st.flat.push({ w, s: x[1], e: x[2], i })));
    }
    return st.list;
  }
  function find(phrase, n, fn) {
    if (n === undefined) n = 1;
    if (!Number.isInteger(n) || n < 1) throw new Error(`E.${fn}(${JSON.stringify(phrase)}, ${n}): n must be a whole number from 1 (the nth time it is spoken).`);
    const key = phrase + '|' + n, hit = st.memo.get(key);
    if (hit) return hit;
    words();
    const flat = st.flat, toks = String(phrase).split(/\s+/).map(norm).filter(Boolean);
    if (!toks.length) throw new Error(`E.${fn}(${JSON.stringify(phrase)}): empty word.`);
    let k = 0;
    for (let j = 0; j + toks.length <= flat.length; j++) {
      let ok = true;
      for (let q = 0; q < toks.length; q++) if (flat[j + q].w !== toks[q]) { ok = false; break; }
      if (ok && ++k === n) { const r = { s: flat[j].s, e: flat[j + toks.length - 1].e, i: flat[j].i }; st.memo.set(key, r); return r; }
    }
    const near = [...new Set(flat.map(f => f.w).filter(w => w.slice(0, 3) === toks[0].slice(0, 3)))].slice(0, 8);
    throw new Error(`E.${fn}(${JSON.stringify(phrase)}, ${n}): ` +
      (k ? `"${phrase}" is spoken only ${k} time(s).` : `"${phrase}" is never spoken in WORDS.`) +
      (near.length ? ` Similar words: ${near.join(', ')}.` : ''));
  }
  // Start of the nth time a word (or a run of words, 'the heavens and the earth') is spoken.
  const cue = (w, n = 1) => find(w, n, 'cue').s;
  // End of the nth time a word or phrase is spoken.
  const end = (w, n = 1) => find(w, n, 'end').e;
  // End of the nth time a word or phrase is spoken, plus an offset in seconds.
  const after = (w, n = 1, off = 0) => find(w, n, 'after').e + off;
  // Start of the nth time, minus an offset in seconds.
  const before = (w, n = 1, off = 0) => find(w, n, 'before').s - off;
  // [start, end] of the nth time a word or phrase is spoken.
  const span = (w, n = 1) => { const r = find(w, n, 'span'); return [r.s, r.e]; };
  // Two camera keys that hold one framing from time a to time b: the camera eases from the previous key to
  // this framing (arriving at a), stays put until b, then eases to the next key.
  const shot = (a, b, x, y, z) => { if (!(b >= a)) throw new Error(`E.shot(${a}, ${b}, ...): the hold must end after it starts.`); return [[a, x, y, z], [b, x, y, z]]; };

  // ---------- small helpers ----------
  const held = (t, fps = 12) => Math.floor(t * fps) / fps;
  const hv = (h, v) => (VERT ? v : h);
  const grad = (id, a, b, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  let gid = 0;
  const vgrad = (a, b, c) => { const id = 'eg' + (gid++); return [`url(#${id})`, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/>${c ? `<stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>` : `<stop offset="1" stop-color="${b}"/>`}</linearGradient>`]; };
  // In the vertical cut, ground layers reach further down so the tall frame never shows a bare band.
  const ridge = (seed, base, amp, wave, x0 = -120, x1 = 2040, bottom = 1200) => ridge0(seed, base, amp, wave, x0, x1, bottom === 1200 && VERT ? 1780 : bottom);
  const r0 = rng(404);
  const STARS = [...Array(140)].map(() => [r0() * 1920, r0() * 1080, 1 + r0() * 3.2, r0() * 6]);
  const FLIES = [...Array(30)].map(() => [r0(), r0(), r0() * 6.28, r0()]);
  const stars = (t, k = 1, maxY = 1080) => STARS.map(s => s[1] < maxY ? C(s[0], s[1], s[2], '#fff', { opacity: k * (.3 + .6 * Math.sin(t * 2.2 + s[3]) ** 2) }) : '').join('');
  const fireflies = (t, x0, y0, w, h, col, n = 24, k = 1) => {
    let g = '';
    FLIES.slice(0, n).forEach((f, i) => { const x = x0 + f[0] * w + Math.sin(t * .9 + f[2]) * 26, y = y0 + f[1] * h + Math.cos(t + f[2] * 2) * 20, pl = .5 + .5 * Math.sin(t * 3.4 + i); g += glow(x, y, 26, col, pl * .9 * k) + C(x, y, 3, '#fff', { opacity: pl * k }); });
    return g;
  };

  // ---------- verse cards ----------
  // A torn verse strip: lines of scripture, an optional highlighted phrase, and a reference label.
  function verseCard(t, at, x, y, lines, ref, o = {}) {
    const { size = 46, hl = null, hlAt = at + .6, hlDur = .5, seed = 7, labelBelow = true, id = 1, maxW = 0 } = o;
    const w = Math.max(maxW, ...lines.map(s => tw(s, size))) + 100, h = lines.length * size * 1.32 + size * .9;
    let g = strip(x, y, w, h, seed, '#F6EFDC', { ax: 12, ay: 4 });
    if (hl) { const li = lines.findIndex(s => s.includes(hl)); if (li >= 0) { const pre = lines[li].slice(0, lines[li].indexOf(hl)); g += highlight(x + 50 + tw(pre, size), y + size * .45 + li * size * 1.32, tw(hl, size), size * 1.12, ease.inOut(prog(t, hlAt, hlAt + hlDur)), YEL); } }
    lines.forEach((s, i) => g += T(x + 50, y + size * 1.25 + i * size * 1.32, s, { size, font: 'Georgia', fill: INK }));
    g += tape(x + w - 40, y + 2, 120, 8);
    if (ref) g += labelBelow ? label(x, y + h + 10, ref, { size: 26 }) : label(x + w + 10, y + h * .5 - 20, ref, { size: 26 });
    return piece(t, at, x + w / 2, y + h / 2, g, id, 1.2);
  }
  // When the card leaves: about 1.3 s after the narration finishes saying its last words.
  function verseEnd(at, lines) {
    const key = at + '|' + lines.join(' ');
    if (st.vend[key] != null) return st.vend[key];
    words();
    const F = st.flat, vw = lines.join(' ').split(/\s+/).map(norm).filter(Boolean);
    let best = null;
    for (let n = Math.min(3, vw.length); n >= 1 && best == null; n--) {
      const tail = vw.slice(-n);
      for (let i = n - 1; i < F.length; i++) {
        if (F[i].s < at - 2) continue; if (F[i].s > at + 25) break;
        if (tail.every((w, j) => F[i - n + 1 + j].w === w)) { best = F[i].e; break; }
      }
    }
    return st.vend[key] = Math.max(best != null ? best + 1.3 : at + 2 + vw.length * .42, at + 2.5);
  }
  // A verse card. Landscape: drawn in place on the sheet, fades out after it is spoken.
  // Vertical: queued and stacked in the top band of the frame (from y 170), re-wrapped to 880 px.
  function verse(t, at, x, y, lines, ref, o = {}) {
    if (!Array.isArray(lines)) throw new Error('E.verse: lines must be an array of strings.');
    const endT = o.end != null ? o.end : verseEnd(at, lines);
    if (VERT) { st.VQ.push({ at, end: endT, lines, ref, o }); return `<!--V${st.VQ.length - 1}-->`; }
    const fo = prog(t, endT, endT + .5);
    if (fo >= 1) return '';
    return G(`translate(0 ${(-30 * ease.inOut(fo)).toFixed(1)})`, verseCard(t, at, x, y, lines, ref, o), 1 - fo);
  }
  // Re-wrap a verse for the narrow frame, keeping the highlighted phrase on one line.
  function wrapVerse(lines, size, maxW, hl) {
    const text = lines.join(' '), toks = [];
    if (hl && text.includes(hl)) { const i = text.indexOf(hl); toks.push(...text.slice(0, i).split(/\s+/).filter(Boolean), hl, ...text.slice(i + hl.length).split(/\s+/).filter(Boolean)); }
    else toks.push(...text.split(/\s+/).filter(Boolean));
    for (let i = toks.length - 2; i >= 0; i--) if (/^[“‘"(]+$/.test(toks[i])) { toks[i] += toks[i + 1]; toks.splice(i + 1, 1); }
    const out = []; let cur = '';
    toks.forEach(w => { const n = cur ? cur + ' ' + w : w; if (cur && tw(n, size) > maxW) { out.push(cur); cur = w; } else cur = n; });
    if (cur) out.push(cur);
    return out.map(s => s.replace(/ ([,.;:!?”])/g, '$1'));
  }
  function verseOverlay(t) {
    let g = '', y = st.vtop;
    st.VQ.filter(v => t >= v.at && t < v.end + .5).sort((a, b) => a.at - b.at).forEach(v => {
      const size = Math.min(54, Math.max(44, v.o.size || 46)), lines = wrapVerse(v.lines, size, 880, v.o.hl);
      const w = Math.max(...lines.map(s => tw(s, size))) + 100, h = lines.length * size * 1.32 + size * .9, x = (FW - w) / 2;
      const out = prog(t, v.end, v.end + .5);
      g += G(`translate(0 ${(-50 * ease.inOut(out)).toFixed(1)})`, verseCard(t, v.at, x, y, lines, v.ref, Object.assign({}, v.o, { size, labelBelow: true, maxW: 0 })), 1 - out);
      y += h + (v.ref ? 70 : 30);
    });
    return g;
  }
  // Fade a group out at time b (0.35 s). Verse cards inside it also leave the vertical top band by b.
  const fade = (t, b, inner) => {
    inner.replace(/<!--V([0-9]+)-->/g, (m, i) => { st.VQ[i].end = Math.min(st.VQ[i].end, b); return m; });
    return t >= b + .35 ? '' : G('', inner, 1 - prog(t, b, b + .35));
  };

  // ---------- captions ----------
  function buildCaptions() {
    const W = st.list;
    // Landscape: cues of up to 34 characters, broken at sentence ends, pauses and long clauses.
    const cues = []; let cur = null;
    W.forEach((w, i) => {
      const prev = W[i - 1], len = cur ? cur.w.map(x => x[0]).join(' ').length : 0;
      const brk = !cur || len + w[0].length + 1 > 34 || (prev && /[.?!]$/.test(prev[0])) || (prev && w[1] - prev[2] > .7) || (prev && /[,;:]$/.test(prev[0]) && len > 18);
      if (brk) { cur = { w: [] }; cues.push(cur); }
      cur.w.push(w);
    });
    cues.forEach((c, i) => { c.s = c.w[0][1]; c.e = Math.min(c.w[c.w.length - 1][2] + .6, cues[i + 1] ? cues[i + 1].w[0][1] : 1e9); });
    // Vertical: bursts of one to three words, at most 15 characters, broken at punctuation and pauses over 0.45 s.
    const bursts = []; cur = null;
    W.forEach((w, i) => {
      const prev = W[i - 1], len = cur ? cur.w.map(x => x[0]).join(' ').length : 0;
      if (!cur || cur.w.length >= 3 || len + w[0].length + 1 > 15 || (prev && /[.?!,;:]$/.test(prev[0])) || (prev && w[1] - prev[2] > .45)) { cur = { w: [] }; bursts.push(cur); }
      cur.w.push(w);
    });
    bursts.forEach((c, i) => { c.s = c.w[0][1]; c.e = Math.min(c.w[c.w.length - 1][2] + .35, bursts[i + 1] ? bursts[i + 1].w[0][1] : 1e9); });
    st.cues = cues; st.bursts = bursts;
  }
  function burstCaption(t) {
    const c = st.bursts.find(c => t >= c.s - .03 && t < c.e); if (!c) return '';
    // The gap leaves room for the 14 px outline and the 8% pop of the current word (fonts with a narrow space touched).
    const size = 78, F = 'Segoe UI', WT = 900, sp = tw(' ', size, F, WT) + size * .2, y = CAP_Y;
    const ws = c.w.map(w => tw(w[0].toUpperCase(), size, F, WT)), tot = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    let x = 540 - tot / 2, g = ''; const vis = c.w.filter(w => t >= w[1] - .03);
    c.w.forEach((w, k) => {
      const p = prog(t, w[1] - .03, w[1] + .1);
      if (p > 0) {
        const curW = k === vis.length - 1, cx = x + ws[k] / 2;
        g += G(sc(cx, y - size * .35, lerp(1.5, curW ? 1.08 : 1, ease.back(p))), T(x, y, w[0].toUpperCase(), { size, font: F, weight: WT, fill: curW ? YEL : '#FFFFFF', extra: 'stroke="#06061A" stroke-width="14" stroke-linejoin="round" paint-order="stroke"' }), Math.min(1, p * 3));
      }
      x += ws[k] + sp;
    });
    return g;
  }
  function cueCaption(t) {
    const c = st.cues.find(c => t >= c.s - .05 && t < c.e); if (!c) return '';
    const size = 40, maxW = 1500, cx = 960, y0 = 1046, F = 'Segoe UI', WT = 800;
    const sp = tw(' ', size, F, WT), wd = ws => ws.reduce((a, w, i) => a + tw(w[0], size, F, WT) + (i ? sp : 0), 0); let lines = [c.w];
    if (wd(c.w) > maxW) { let bi = 1, bm = 1e9; for (let i = 1; i < c.w.length; i++) { const m = Math.max(wd(c.w.slice(0, i)), wd(c.w.slice(i))); if (m < bm) { bm = m; bi = i; } } lines = [c.w.slice(0, bi), c.w.slice(bi)]; }
    const pop = ease.back(prog(t, c.s - .05, c.s + .12)), lh = size * 1.2, top = y0 - (lines.length - 1) * lh;
    let g = '';
    lines.forEach((ln, li) => {
      const tot = ln.reduce((a, w, i) => a + tw(w[0], size, F, WT) + (i ? sp : 0), 0); let x = cx - tot / 2;
      ln.forEach(w => { const said = t >= w[1]; g += T(x, top + li * lh, w[0], { size, font: F, weight: WT, fill: said ? YEL : '#FFFFFF', extra: 'stroke="#08081A" stroke-width="9" stroke-linejoin="round" paint-order="stroke"' }); x += tw(w[0], size, F, WT) + sp; });
    });
    return `<g transform="${sc(cx, y0, lerp(.86, 1, pop))}">${g}</g>`;
  }
  const captions = t => (st.cfg && st.cfg.captions === false ? '' : VERT ? burstCaption(t) : cueCaption(t));

  // ---------- characters ----------
  // style-kit's chubby figure with life: breathing, weight shift, head tilt on 12 fps held time,
  // and a reaching gesture while one of its TALK windows is open. o.who names the speaker in TALK.
  function chubby(x, y, s, o = {}) {
    const T0 = st.t, ht = held(T0, 12), ph = (o.f ? 1.9 : 0) + (o.flip === -1 ? .7 : 0) + (o.phase || 0), br = Math.sin(ht * 2.4 + ph);
    const o2 = Object.assign({}, o);
    o2.lean = (o.lean || 0) + Math.sin(ht * 1.1 + ph) * 5;
    if (o.walk == null) o2.walk = Math.sin(ht * 1.3 + ph) * .25;
    const tk = st.talk.find(k => T0 >= k[0] && T0 < k[1] && (o.who != null ? k[2] === o.who : (k[2] === 1) === !!o.f));
    if (tk) o2.reach = Math.max(o.reach || 0, .22 + .3 * Math.abs(Math.sin(ht * 4.4 + ph)));
    else if (!o.reach) o2.reach = .06 + .06 * Math.sin(ht * .8 + ph);
    const sy = 1 + .03 * br, sx = 1 - .018 * br, rot = Math.sin(ht * .9 + ph) * 2.4;
    return `<g transform="translate(${x} ${y}) rotate(${rot.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-x} ${-y})">` + chubby0(x, y, s, o2) + '</g>';
  }
  // A cast member by name: its look from cfg.cast, plus who=name for TALK windows.
  function char(name, x, y, s, o = {}) {
    const look = st.cast[name];
    if (!look) throw new Error(`E.char("${name}"): not in the cast. Cast: ${Object.keys(st.cast).join(', ') || '(none; pass cast:{...} to E.start)'}.`);
    return chubby(x, y, s, Object.assign({ filter: 'htSoft' }, look, o, { who: name }));
  }
  const talking = (who, t = st.t) => st.talk.some(k => t >= k[0] && t < k[1] && k[2] === who);

  // ---------- focus beats ----------
  // Punch-in of up to 7% (times strength) and a decaying hash shake for 1.4 s after each beat; steady otherwise.
  function focusFx(t) {
    let dx = 0, dy = 0, rot = 0, z = 1;
    st.focus.forEach(([b, s]) => {
      const p = t - b; if (p < 0 || p > 1.4) return; const e = Math.exp(-p * 4.2) * s, f = Math.floor(t * 24);
      dx += (hash(f, b * 7) - .5) * 2 * 16 * e; dy += (hash(f, b * 7 + 3) - .5) * 2 * 12 * e; rot += (hash(f, b * 7 + 5) - .5) * 1.4 * e; z *= 1 + .07 * s * ease.out(clamp(p / .18)) * Math.exp(-p * 1.3);
    });
    return { dx, dy, rot, z };
  }
  const focusTr = (fx, cx, cy) => `translate(${cx} ${cy}) rotate(${fx.rot.toFixed(2)}) scale(${fx.z.toFixed(4)}) translate(${(-cx + fx.dx).toFixed(1)} ${(-cy + fx.dy).toFixed(1)})`;

  // ---------- sheets ----------
  // The torn paper sheet: cream edge, gradient fill, clipped. In the vertical cut it extends from y -700 to 1800
  // (with faint stars in the top part) so the camera can look above and below the landscape area.
  function sheetBase(i, s) {
    const [c1, c2] = s.bg || ['#10144A', '#05061C'];
    const y0 = VERT ? -700 : -60, hh = VERT ? 2500 : 1200, id = 'sh' + i, inner = torn(-34, y0, 1988, hh, 14 + i, 18, 0, 18);
    return grad(id, c1, c2, .7, 1) + `<path d="${torn(-44, y0, 2008, hh, 10 + i, 18, 0, 18)}" fill="${PAPER}"/><clipPath id="${id}c"><path d="${inner}"/></clipPath><g clip-path="url(#${id}c)"><path d="${inner}" fill="url(#${id})"/>` +
      (VERT && s.stars !== false ? STARS.map(q => C(q[0].toFixed(0), (-680 + q[1] * .62).toFixed(0), q[2] * .8, '#fff', { opacity: .35 })).join('') : '');
  }
  // Vertical foreground: grass, stones and glowing flowers across the lower part of the sheet (y 1000-1780).
  function vFore(i, t) {
    const s = st.sheets[i]; let f = s.fore;
    if (typeof f === 'function') f = f(t);
    if (!f) return '';
    // f.top (optional, default 1000) starts the layer lower, to keep it clear of labels under the captions.
    const gc = f.grass, fc = f.flowers || [], top = f.top || 1000, sh = top - 1000; let g = '';
    g += `<path d="${ridge0(500 + i, 1180 + sh, 22, 170, -120, 2040, 1800)}" fill="${gc[1]}" opacity=".55"/><path d="${ridge0(510 + i, 1430 + sh * .5, 26, 140, -120, 2040, 1800)}" fill="${gc[1]}"/>`;
    const it = [...Array(170)].map((_, k) => [k, top + Math.pow(hash(k, i * 13 + 1), .7) * (1780 - top)]).sort((a, b) => a[1] - b[1]);
    it.forEach(([k, y]) => {
      const x = hash(k, i * 13 + 2) * 2060 - 60, d = (y - 1010) / 760, sz = lerp(1.1, 3.6, d), sw = Math.sin(t * 1.5 + k) * 4 * sz, c = gc[k % 3];
      if (k % 9 === 0) { g += K.E(x, y, 26 * sz, 12 * sz, gc[1]) + K.E(x - 6 * sz, y - 4 * sz, 14 * sz, 6 * sz, gc[2], { opacity: .6 }); return; }
      for (let j = -1; j <= 1; j++) g += L(x + j * 5 * sz, y, x + j * 9 * sz + sw, y - (16 + hash(k, j + 5) * 20) * sz, c, 3.2 * sz);
      if (fc.length && k % 5 === 0) { const fy = y - (30 + hash(k, 9) * 16) * sz, col = fc[k % fc.length]; g += L(x, y, x + sw, fy, '#0A2A3E', 2.5 * sz) + glow(x + sw, fy, 18 * sz, col, .7) + C(x + sw, fy, 5 * sz, col); }
    });
    return g;
  }
  const drawSheet = (i, t, withFore) => { const s = st.sheets[i]; return sheetBase(i, s) + s.draw(t, t - s.at) + (withFore ? vFore(i, t) : '') + '</g>'; };
  const sheetIndex = t => { let i = 0; while (i < st.cuts.length && t >= st.cuts[i]) i++; return i; };
  // Time window in which sheet i holds still (outside the transitions).
  const holdWin = i => [i ? st.cuts[i - 1] + PAN : 0, i < st.cuts.length ? st.cuts[i] - PAN : st.DUR + 1];

  // ---------- landscape frame ----------
  const camX = t => STN * st.cuts.reduce((a, c) => a + ease.inOut(prog(t, c - PAN, c + PAN)), 0);
  function frameH(t) {
    const cx = camX(t), fx = focusFx(t);
    let w = '';
    st.sheets.forEach((s, i) => { const x = i * STN - cx; if (x > -2100 && x < 2100) w += G(`translate(${x.toFixed(1)} 0)`, drawSheet(i, t, false)); });
    let g = paperDefs(t) + R(0, 0, 1920, 1080, 0, '#07071A');
    g += st.cfg.focusLandscape === false ? w : `<g transform="${focusTr(fx, 960, 540)}">${w}</g>`;
    if (st.cfg.hud) g += st.cfg.hud(t);
    g += flashes(t, 1920, 1080);
    g += vignette(.42);
    g += paperOver({ tex: .2, grain: .32, blot: .12, texL: .3 });
    g += captions(t);
    return g + fades(t, 1920, 1080);
  }

  // ---------- vertical frame ----------
  // Camera keys per sheet: [time, x, y, zoom] in that sheet's own 1920x1080 coordinates, eased between keys.
  function camAt(i, tc) {
    const s = st.sheets[i], [a, b] = holdWin(i);
    const keys = (s.cam && s.cam.length ? s.cam : [[s.at, 960, 560, .84]]).map(k => [clamp(k[0], a, b), k[1], k[2], k[3]]);
    const K2 = [[a, ...keys[0].slice(1)], ...keys, [b, ...keys[keys.length - 1].slice(1)]];
    let j = 0; while (j < K2.length - 2 && K2[j + 1][0] <= tc) j++;
    const A = K2[j], B = K2[j + 1], d = B[0] - A[0], p = d < 1e-6 ? 1 : ease.inOut(clamp((tc - A[0]) / d));
    return { x: lerp(A[1], B[1], p), y: lerp(A[2], B[2], p), z: lerp(A[3], B[3], p) };
  }
  // One sheet through the vertical camera, held inside its paper so the wall never shows.
  // Zoom 0.845 or less is a deliberate wide shot; anything else is raised to at least 1.12.
  function sheetView(i, t, tc) {
    const c = camAt(i, tc), z = c.z <= .845 ? c.z : Math.max(c.z, 1.12);
    let x = c.x, y = c.y;
    const xa = 540 / z - 30, xb = 1950 - 540 / z; x = xa < xb ? clamp(x, xa, xb) : 960;
    const ya = -640 + BANDY / z, yb = 1720 - (FH - BANDY) / z; y = ya < yb ? clamp(y, ya, yb) : 540;
    return `<g transform="translate(${FW / 2} ${BANDY}) scale(${z.toFixed(4)}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})">` + drawSheet(i, t, true) + '</g>';
  }
  function sheetScene(i, t, tc) { const s = st.sheets[i]; return s.vdraw ? s.vdraw(t, t - s.at) : sheetView(i, t, tc); }
  function frameV(t) {
    st.VQ.length = 0; st.vtop = VTOP;
    const fx = focusFx(t), big = s => s.replace(/width="1920" height="1080"/g, `width="${FW}" height="${FH}"`);
    const [wg, wd] = vgrad('#0C1040', '#05061A', '#0A0C30');
    let g = big(paperDefs(t)) + wd + R(0, 0, FW, FH, 0, wg);
    const i = sheetIndex(t);
    // Between sheets the old scene scrolls up and away while the next rises from below (or a hard cut: vIn:'cut').
    const kn = st.cuts.findIndex(c => t >= c - SL && t < c + SL);
    let scene;
    if (kn >= 0 && st.sheets[kn + 1].vIn !== 'cut') {
      const c = st.cuts[kn], q = ease.inOut(prog(t, c - SL, c + SL));
      scene = `<g transform="translate(0 ${(-FH * q).toFixed(1)})">${sheetScene(kn, t, c - PAN)}</g><g transform="translate(0 ${(FH * (1 - q)).toFixed(1)})">${sheetScene(kn + 1, t, c + PAN)}</g>`;
    } else { const [a, b] = holdWin(i); scene = sheetScene(i, t, clamp(t, a, b)); }
    g += `<g transform="${focusTr(fx, 540, 960)}">${scene}</g>`;
    if (st.cfg.hud) g += st.cfg.hud(t);
    g += flashes(t, FW, FH);
    g += verseOverlay(t);
    g += big(vignette(.38)) + big(paperOver({ tex: .2, grain: .32, blot: .12, texL: .3 }));
    g += captions(t);
    return g + fades(t, FW, FH);
  }

  // ---------- flashes and fades ----------
  // cfg.flashes: [[time, seconds, colour]] - a full-frame flash that eases away (e.g. light breaking in).
  const flashes = (t, w, h) => st.flashes.map(([a, d = .95, col = '#FFFBEC']) => t >= a && t < a + d ? R(0, 0, w, h, 0, col, { opacity: (1 - ease.out(prog(t, a, a + d))).toFixed(3) }) : '').join('');
  function fades(t, w, h) {
    let g = '';
    const fi = st.cfg.fadeIn || 0; if (fi > 0 && t < fi) g += R(0, 0, w, h, 0, '#000', { opacity: (1 - prog(t, 0, fi)).toFixed(3) });
    const fo = st.cfg.fadeOut == null ? .9 : st.cfg.fadeOut; const p = fo > 0 ? prog(t, st.DUR - .1 - fo, st.DUR - .1) : 0;
    if (p > 0) g += R(0, 0, w, h, 0, '#000', { opacity: p.toFixed(3) });
    return g;
  }

  // ---------- start ----------
  function frame(t) { st.t = t; return VERT ? frameV(t) : frameH(t); }
  function start(cfg) {
    if (st.started) throw new Error('E.start called twice.');
    if (!cfg || !Array.isArray(cfg.sheets) || !cfg.sheets.length) throw new Error('E.start: cfg.sheets must list at least one sheet.');
    if (cfg.words) words(cfg.words); else words();
    st.cfg = cfg;
    const last = st.list[st.list.length - 1];
    st.DUR = cfg.dur || last[2] + (cfg.tail == null ? 1.6 : cfg.tail);
    st.cast = cfg.cast || {};
    st.sheets = cfg.sheets.map((s, i) => {
      const name = s.name || 'sheet ' + i;
      if (typeof s.draw !== 'function') throw new Error(`E.start: ${name} has no draw(t, lt) function.`);
      if (i === 0 && s.at && s.at !== 0) throw new Error(`E.start: the first sheet must start at 0 (it says ${s.at}).`);
      const at = i ? s.at : 0;
      if (i && !(at > (cfg.sheets[i - 1].at || 0) + 2 * PAN)) throw new Error(`E.start: ${name} starts at ${at}, which is not after the previous sheet (sheets need increasing 'at' times, at least ${(2 * PAN).toFixed(2)} s apart).`);
      return Object.assign({}, s, { name, at });
    });
    st.cuts = st.sheets.slice(1).map(s => s.at);
    // cam may mix plain keys and E.shot(...) pairs; flatten them into one list of keys.
    st.sheets.forEach(s => { if (s.cam) s.cam = s.cam.flatMap(k => Array.isArray(k) && Array.isArray(k[0]) ? k : [k]); });
    st.sheets.forEach((s, i) => {
      const nx = i + 1 < st.sheets.length ? st.sheets[i + 1].at : st.DUR;
      (s.cam || []).forEach((k, j) => {
        if (!Array.isArray(k) || k.length !== 4 || k.some(v => typeof v !== 'number' || isNaN(v))) throw new Error(`E.start: ${s.name} cam key ${j} must be [time, x, y, zoom]: ${JSON.stringify(k)}`);
        if (k[0] < s.at - .5 || k[0] > nx + .5) throw new Error(`E.start: ${s.name} cam key ${j} at ${k[0].toFixed(2)} s is outside the sheet (${s.at.toFixed(2)}-${nx.toFixed(2)} s).`);
        if (j && k[0] < s.cam[j - 1][0]) throw new Error(`E.start: ${s.name} cam keys are not in time order (key ${j}).`);
        if (!(k[3] > 0)) throw new Error(`E.start: ${s.name} cam key ${j} needs a zoom above 0.`);
      });
      if (s.fore && typeof s.fore !== 'function' && !(Array.isArray(s.fore.grass) && s.fore.grass.length === 3)) throw new Error(`E.start: ${s.name}.fore needs grass:[3 colours] (and optional flowers:[...]).`);
    });
    st.talk = (cfg.talk || []).map((k, j) => {
      if (!Array.isArray(k) || !(k[1] > k[0])) throw new Error(`E.start: talk[${j}] must be [start, end, who] with end after start: ${JSON.stringify(k)}`);
      if (typeof k[2] === 'string' && cfg.cast && !st.cast[k[2]]) throw new Error(`E.start: talk[${j}] names "${k[2]}", who is not in the cast.`);
      return k;
    });
    st.focus = (cfg.focus || []).map((k, j) => {
      if (!Array.isArray(k) || typeof k[0] !== 'number' || isNaN(k[0])) throw new Error(`E.start: focus[${j}] must be [time, strength].`);
      return [k[0], k[1] == null ? .7 : k[1]];
    });
    st.flashes = cfg.flashes || [];
    buildCaptions();
    const svg = document.querySelector('svg');
    if (!svg) throw new Error('E.start: the page needs an <svg> element.');
    svg.setAttribute('viewBox', VERT ? '0 0 1080 1920' : '0 0 1920 1080');
    // Smoke test: draw the start, middle and end of every sheet now, so a broken sheet fails at load.
    st.sheets.forEach((s, i) => {
      const [a, b] = [s.at, i + 1 < st.sheets.length ? st.sheets[i + 1].at : st.DUR];
      [a + .01, (a + b) / 2, b - .01].forEach(t => { try { frame(t); } catch (e) { throw new Error(`${s.name} at ${t.toFixed(2)} s: ${e.message}`); } });
    });
    st.started = true;
    window.DUR = st.DUR;
    window.seek = t => { svg.innerHTML = frame(Math.max(0, Math.min(t, st.DUR - .001))); };
    window.seek(0);
    if (!location.search.includes('render')) { const t0 = performance.now(); const loop = n => { window.seek(((n - t0) / 1000) % st.DUR); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  }

  window.E = {
    // orientation and constants
    VERT, W: VERT ? FW : 1920, H: VERT ? FH : 1080, INK, YEL, CORAL, PAPER, STN, PAN, SL, BANDY, VTOP, CAP_Y,
    // timing
    words, cue, end, after, before, span, norm, shot,
    get DUR() { return st.DUR; }, get t() { return st.t; },
    // drawing
    verse, verseEnd, wrapVerse, fade, chubby, char, talking, held, hv, grad, vgrad, ridge, stars, fireflies, focusFx,
    // running
    start, frame, sheetIndex, camAt,
  };
})();
