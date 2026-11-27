// Godward fire kit (window.FX): fire that clings to a mountain's ridge, kiln smoke, firelight, embers, quakes.
// Load after episode-engine.js. Pure functions of time, like the rest of the kit; nothing here changes existing pages.
//
//   const pts = FX.peak(seed, cx, topY, {halfW, bottom, rough})        // jagged mountain outline [[x,y],...]
//   g += FX.summitFire(t, pts, intensity, quake, {fill, H, cap, smoke, smokeH, drift, light, embers, wrap, seed})
//   g += FX.flames(t, pts, {H, sp, seed, k})                           // fire along any polyline (a fire pit, a ridge)
//   FX.quakeAmp(t, [[a,b],...])  -> 0..1 envelope;   FX.shake(t, amp, seed) -> {dx, dy}
//
// Exodus 19:18: the mountain wrapped in smoke because the LORD descended on it in fire; the smoke went up like the
// smoke of a kiln; the whole mountain trembled greatly. So: flames hug the ridge (base follows the rock), hot white-
// yellow at the base to red tips, tongues flicker on noise and tear off upward; smoke billows out of the fire as a
// widening, drifting column, lit orange from below and darker as it rises; wraps of smoke circle the upper slopes;
// the slopes and the cloud underside take the firelight; embers rise; on quake words the mountain jitters and rocks fall.
(function () {
  'use strict';
  if (!window.K || !window.S) throw new Error('fire.js: load shared.js and style-kit.js first.');
  const { C, P, G, lerp, clamp, mix } = K;
  const { hash, glow } = S;
  const f2 = v => v.toFixed(1);

  // smooth value noise 0..1 and a 3-octave sum
  const vn = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, s), hash(i + 1, s), u); };
  const fbm = (x, s) => vn(x, s) * .6 + vn(x * 2.13, s + 7) * .28 + vn(x * 4.37, s + 13) * .12;

  // Shared gradients, emitted with each call (identical, so duplicate ids are harmless).
  // Smoke puffs are soft-edged paper discs (solid to 78% of the radius), so the column reads as billows, not fog.
  const puff = (id, c, o) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset=".78" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  const DEFS = `<defs>${puff('fxSmA', '#7E625C', .96)}${puff('fxSmB', '#54464C', .96)}${puff('fxSmC', '#221A22', .96)}${puff('fxSmH', '#A08478', .9)}
    <radialGradient id="fxSmW"><stop offset="0" stop-color="#FF9A4C" stop-opacity=".95"/><stop offset=".6" stop-color="#E0602E" stop-opacity=".7"/><stop offset="1" stop-color="#A03A22" stop-opacity="0"/></radialGradient>
    ${puff('fxSmD', '#2E262E', .9)}${puff('fxSmM', '#5E5054', .85)}
    <radialGradient id="fxDust"><stop offset="0" stop-color="#8A7A6A" stop-opacity=".7"/><stop offset="1" stop-color="#8A7A6A" stop-opacity="0"/></radialGradient>
  </defs>`;

  // ---------- geometry ----------
  // Jagged named-mountain outline from x0 to x1: one summit at (cx, top) with a shoulder crag on each side.
  function peak(seed, cx, top, o = {}) {
    const { halfW = 760, bottom = 1800, rough = 16, x0 = -200, x1 = 2120, step = 16, crag = 1 } = o;
    const pts = [];
    for (let x = x0; x <= x1; x += step) {
      const d = Math.abs(x - cx) / halfW, side = x < cx ? -1 : 1;
      let y = top + Math.pow(d, 1.18) * (bottom - top) * .78;
      // shoulders and crags near the top so it reads as rock, not a pyramid
      y -= crag * 38 * Math.exp(-Math.pow((d - .16) / .05, 2)) * (side < 0 ? 1 : .7);
      y += crag * 26 * Math.exp(-Math.pow((d - .3) / .06, 2));
      y += (vn(x / 60, seed) - .5) * rough * 2 + (hash(x, seed) - .5) * rough * .5 * Math.min(1, d * 3);
      pts.push([x, Math.min(Math.max(y, top), bottom)]);
    }
    return pts;
  }
  const closed = (pts, bottom = 1800) => 'M' + pts.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L') + `L${f2(pts[pts.length - 1][0])} ${bottom}L${f2(pts[0][0])} ${bottom}Z`;
  const yAt = (pts, x) => {
    for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const a = pts[i - 1], b = pts[i], u = (x - a[0]) / ((b[0] - a[0]) || 1); return lerp(a[1], b[1], clamp(u)); }
    return pts[pts.length - 1][1];
  };
  // Even samples along a polyline (arc length), keeping those that pass keep(p).
  function samples(pts, sp, keep = () => true) {
    const out = []; let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      while (acc <= len) { const u = acc / (len || 1), p = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; if (keep(p)) out.push(p); acc += sp; }
      acc -= len;
    }
    return out;
  }

  // ---------- quake ----------
  // Envelope 0..1 over windows [[a,b],...]: a fast rise at a, a long shudder that dies away by b.
  const quakeAmp = (t, q) => {
    if (typeof q === 'number') return q;
    if (typeof q === 'function') return q(t);
    if (!Array.isArray(q)) return 0;
    return q.reduce((m, [a, b]) => t < a || t > b ? m : Math.max(m, clamp((t - a) / .15) * Math.pow(1 - (t - a) / (b - a), .7)), 0);
  };
  const shake = (t, amp, seed = 1) => { const f = Math.floor(t * 30); return { dx: (hash(f, seed) - .5) * 2 * 14 * amp, dy: (hash(f, seed + 3) - .5) * 2 * 6 * amp }; };

  // ---------- flames ----------
  // One tongue: base centred at (x, y), width w, height h, tip displaced by sway, S-curve by wig.
  const tongue = (x, y, w, h, sway, wig) => {
    const l = x - w / 2, r = x + w / 2, tx = x + sway, ty = y - h;
    return `M${f2(l)} ${f2(y)}C${f2(l - w * .08)} ${f2(y - h * .38)} ${f2(x + sway * .3 - w * .32 + wig)} ${f2(y - h * .66)} ${f2(tx)} ${f2(ty)}` +
      `C${f2(x + sway * .3 + w * .28 + wig)} ${f2(y - h * .6)} ${f2(r + w * .08)} ${f2(y - h * .34)} ${f2(r)} ${f2(y)}Q${f2(x)} ${f2(y + w * .35)} ${f2(l)} ${f2(y)}Z`;
  };
  const LAYERS = [['#B81E16', 1, 1, .82], ['#FF5A1A', .8, .84, .9], ['#FFA42A', .58, .68, .95], ['#FFE07A', .36, .5, .95], ['#FFFBE0', .17, .34, .9]];
  // Fire along a list of base points. Each base: [x, y, weight 0..1]. o.H tallest tongue, o.sp spacing, o.k intensity.
  function fireAlong(t, bases, o = {}) {
    const { H = 200, sp = 14, seed = 3, k = 1, drift = .14, licks = true } = o;
    if (k <= 0 || !bases.length) return '';
    const T = bases.map(([x, y, w], i) => {
      // low spatial frequency groups neighbouring tongues into masses with a few tall leaders
      const n = fbm(t * 1.7 + i * .16, seed), fl = vn(t * 9 + i * 1.7, seed + 5), big = hash(i, seed + 19) > .78;
      const h = H * k * w * (.3 + .95 * n * n + .15) * (.84 + .28 * fl) * (.8 + .4 * hash(i, seed + 2)) * (big ? 1.25 : 1);
      const bw = sp * (1.9 + 1.1 * hash(i, seed + 4)) * (.7 + .4 * w) * (big ? 1.7 : 1);
      const sway = ((fbm(t * 1.2 + i * .23, seed + 9) - .5) * .4 + drift) * h, wig = (vn(t * 6.5 + i, seed + 11) - .5) * bw * .7;
      return { x, y: y + 7, h, bw: Math.min(bw, h * .75 + 4), sway, wig, i, w };
    });
    let g = '';
    // the hot glow inside the body of the fire
    T.forEach(q => { if (q.i % 4 === 0 && q.h > 8) g += glow(q.x, q.y - q.h * .3, q.h * .95 + 20, '#FFA03C', .3 * Math.min(1, k)); });
    LAYERS.forEach(([c, hk, wk, op], L) => {
      let d = '';
      T.forEach(q => {
        if (L === 4 && q.w < .62) return;
        const jk = L ? (.72 + .5 * vn(t * 5 + q.i * .7 + L * 3, seed + L)) : 1, hh = q.h * hk * jk;
        if (hh > Math.max(3, H * k * .14 * hk)) d += tongue(q.x, q.y, q.bw * wk, hh, q.sway * hk * jk, q.wig * wk);
      });
      if (d) g += P(d, c, { opacity: op });
    });
    if (licks) T.forEach(q => {
      if (q.i % 3) return;
      // a lick tears off the top of the tongue, reddens and fades as it rises
      const c = (t * 1.5 + hash(q.i, seed + 17)) % 1, sz = q.bw * .38 * (1 - c) * (q.h / (H * k + 1) + .3);
      if (sz < 1.5) return;
      const lx = q.x + q.sway * (1 + c * .6), ly = q.y - q.h * (.86 + c * .8);
      g += P(tongue(lx, ly, sz, sz * 2.4, sz * .6 * (vn(t * 4 + q.i, seed) - .5), 0), mix('#FF8A2A', '#B81E16', c), { opacity: (.75 * (1 - c)).toFixed(2) });
    });
    return g;
  }
  // Fire along any polyline (all of it burns), e.g. a fire pit rim or a ridge.
  const flames = (t, pts, o = {}) => DEFS + fireAlong(t, samples(pts, o.sp || 14).map(p => [p[0], p[1], 1]), o);

  // ---------- smoke ----------
  // Billowing column out of the fire: puffs are born in the flames, rise, widen, drift and darken; warm underside near the fire.
  function smokeColumn(t, src, top, o) {
    const { smoke = 1, smokeH = 1000, drift = 160, seed = 3, I = 1, n = 54, rate = .075 } = o;
    if (smoke <= 0) return '';
    const P0 = [];
    for (let i = 0; i < n; i++) {
      const k = (t * rate + hash(i, seed + 31)) % 1, s = src[Math.floor(hash(i, seed + 33) * src.length)] || [0, top];
      const rise = Math.pow(k, .8) * smokeH, spread = (hash(i, seed + 35) - .5) * (50 + k * smokeH * .42);
      const x = s[0] + spread + drift * Math.pow(k, 1.4) + Math.sin(t * .7 + i * 1.3) * 26 * k;
      const y = s[1] - 30 - rise;
      const r = lerp(60, smokeH * .32, Math.pow(k, .7)) * (.75 + .5 * hash(i, seed + 37));
      const op = Math.min(1, k / .07) * Math.pow(1 - k, .55) * smoke;
      P0.push({ k, x, y, r, op });
    }
    P0.sort((a, b) => b.k - a.k);
    let g = '';
    P0.forEach(p => {
      // body (younger puffs lighter and lit; older ones darker), a highlight lobe up-wind, a shadowed lobe below
      const fill = p.k < .28 ? 'url(#fxSmA)' : p.k < .6 ? 'url(#fxSmB)' : 'url(#fxSmC)';
      g += C(f2(p.x), f2(p.y), f2(p.r), fill, { opacity: p.op.toFixed(2) });
      g += C(f2(p.x - p.r * .38), f2(p.y - p.r * .34), f2(p.r * .55), p.k < .5 ? 'url(#fxSmH)' : 'url(#fxSmB)', { opacity: (p.op * .5).toFixed(2) });
      const lit = Math.pow(1 - p.k, 1.8) * I;
      if (lit > .04) g += C(f2(p.x + p.r * .1), f2(p.y + p.r * .42), f2(p.r * .7), 'url(#fxSmW)', { opacity: Math.min(.85, lit * .85).toFixed(2) });
    });
    return g;
  }
  // Slow wraps of smoke around the upper slopes (in front of the rock).
  function wraps(t, cx, top, cap, o) {
    const { wrap = 1, seed = 3, I = 1, wrapW = 900 } = o;
    if (wrap <= 0) return '';
    let g = '';
    for (let i = 0; i < 16; i++) {
      const ph = (t * .018 + hash(i, seed + 41)) % 1, x = cx + (ph - .5) * wrapW * 1.3, y = top + cap * (1.0 + .8 * hash(i, seed + 43)) + Math.sin(t * .4 + i) * 12;
      if (Math.abs(x - cx) < cap * .55) continue;
      const r = 60 + 60 * hash(i, seed + 45), edge = Math.sin(ph * Math.PI), op = .3 * wrap * edge;
      g += C(f2(x), f2(y), f2(r), 'url(#fxSmM)', { opacity: op.toFixed(2) }) +
        C(f2(x), f2(y + r * .3), f2(r * .7), 'url(#fxSmW)', { opacity: (op * .5 * I * (1 - (y - top) / (cap * 3))).toFixed(2) });
    }
    return g;
  }

  // ---------- summit fire ----------
  function summitFire(t, pts, intensity = 1, quake = 0, o = {}) {
    const { fill = null, H = 210, cap = 150, light = 760, embers = 46, seed = 3, bottom = 1800, sky = 1, rocks = true, spacing = Math.max(13, (o.H || 210) * .065) } = o;
    const I = clamp(intensity, 0, 1.6);
    let top = 1e9, sx = 0; pts.forEach(p => { if (p[1] < top) { top = p[1]; sx = p[0]; } });
    const qa = quakeAmp(t, quake), sh = shake(t, qa, seed);
    const zone = samples(pts, spacing, p => p[1] < top + cap).map(p => [p[0], p[1], Math.pow(1 - (p[1] - top) / cap, .65)]);
    const fl = .85 + .15 * vn(t * 7, seed + 50), body = closed(pts, bottom), cid = 'fxB' + S.nid();
    let g = DEFS;
    // sky and cloud-underside glow
    if (I > 0 && sky) g += glow(sx, top - H * .4, H * 4.4, '#FF5A22', .42 * I * fl) + glow(sx, top - 20, H * 1.8, '#FFB04C', .5 * I * fl);
    g += smokeColumn(t, zone.length ? zone : [[sx, top]], top, Object.assign({ seed, I }, o, { smoke: (o.smoke ?? 1) * (o.smokeOn ?? 1) }));
    let m = '';
    if (fill) m += P(body, fill);
    // firelight down the slopes, fading with distance; the lit rock rim along the burning ridge
    if (I > 0) {
      m += `<clipPath id="${cid}"><path d="${body}"/></clipPath><g clip-path="url(#${cid})">` +
        glow(sx, top + 40, light, '#FF7A2A', .42 * I * fl) + glow(sx, top + 10, light * .34, '#FFD27A', .32 * I * fl) + '</g>';
      const rim = pts.filter(p => p[1] < top + cap * 1.6);
      if (rim.length > 1) m += P('M' + rim.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L'), 'none', { stroke: '#FF9A4C', 'stroke-width': 3, opacity: (.45 * I).toFixed(2), 'stroke-linejoin': 'round' });
    }
    // glowing fissures when the mountain trembles
    if (qa > .05) for (let j = 0; j < 3; j++) {
      const x0 = sx + (j - 1) * cap * .7; let d = `M${f2(x0)} ${f2(yAt(pts, x0) + 10)}`, x = x0, y = yAt(pts, x0) + 10;
      for (let s = 0; s < 4; s++) { x += (hash(j * 9 + s, seed) - .5) * 70 + (j - 1) * 18; y += 60 + hash(j * 9 + s, seed + 1) * 50; d += `L${f2(x)} ${f2(y)}`; }
      m += P(d, 'none', { stroke: '#FF6A2A', 'stroke-width': 6, opacity: (qa * .9).toFixed(2), 'stroke-linejoin': 'round' }) + P(d, 'none', { stroke: '#FFE07A', 'stroke-width': 2, opacity: (qa * .9).toFixed(2) });
    }
    // rock glowing hot just under the flames, so the fire grows out of the mountain instead of sitting on a line
    if (I > 0 && zone.length > 1) m += P('M' + zone.map(p => f2(p[0]) + ' ' + f2(p[1] + 14)).join('L'), 'none', { stroke: '#FF6A22', 'stroke-width': 34, opacity: (.35 * Math.min(1, I)).toFixed(2), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }) +
      P('M' + zone.map(p => f2(p[0]) + ' ' + f2(p[1] + 6)).join('L'), 'none', { stroke: '#FFB04C', 'stroke-width': 14, opacity: (.45 * Math.min(1, I)).toFixed(2), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    // the summit itself burns: a hot core glow on the upper face, then rows of flames rising from the surface below
    // the ridge (back to front), denser in the middle where the rows overlap, shorter further down the face
    if (I > 0) m += glow(sx, top + cap * .45, cap * 1.5, '#FF7A2A', .55 * Math.min(1, I) * fl) + glow(sx, top + cap * .3, cap * .8, '#FFD27A', .45 * Math.min(1, I) * fl);
    m += fireAlong(t, zone, { H, sp: spacing, seed, k: I, drift: .12 });
    const rows = o.rows ?? 4, deep = cap * 1.25;
    for (let r = 1; r <= rows; r++) {
      const dy = r * cap * .26, base = [];
      zone.forEach(([x, y], i) => { if (i % 2 === r % 2) return; const yy = y + dy + (hash(i, seed + r * 7) - .5) * 14, dd = (yy - top) / (deep * (.7 + .6 * vn(x / 70, seed + 3))); if (dd < .9) base.push([x + (hash(i, seed + r) - .5) * spacing, yy, Math.pow(1 - dd, .8) * (1 - r * .1)]); });
      m += fireAlong(t, base, { H: H * .82, sp: spacing * 1.15, seed: seed + r * 11, k: I, drift: .12, licks: r < 2 });
    }
    g += G(`translate(${f2(sh.dx)} ${f2(sh.dy)})`, m);
    // embers and sparks rising out of the fire
    for (let j = 0; j < embers * Math.min(1, I); j++) {
      const k = (t * (.3 + .2 * hash(j, seed + 61)) + hash(j, seed + 62)) % 1, s = zone[Math.floor(hash(j, seed + 63) * zone.length)] || [sx, top];
      const x = s[0] + (hash(j, seed + 64) - .5) * 50 + Math.sin(t * 2.3 + j) * 22 * k + (o.drift ?? 160) * .5 * k, y = s[1] - k * (H * 1.6 + hash(j, seed + 65) * 380);
      const r = 1.6 + 2.6 * hash(j, seed + 66), bl = .55 + .45 * Math.sin(t * 13 + j * 3.1), op = (1 - k) * bl;
      g += C(f2(x), f2(y), f2(r * 3.2), mix('#FFD27A', '#FF5A22', k), { opacity: (op * .25).toFixed(2) }) + C(f2(x), f2(y), f2(r), mix('#FFF6C8', '#FF7A2A', k), { opacity: op.toFixed(2) });
    }
    g += wraps(t, sx, top, cap, Object.assign({ seed, I }, o));
    // rocks breaking loose and tumbling down the slopes while it trembles
    if (rocks && Array.isArray(quake)) quake.forEach(([a, b], w) => {
      for (let j = 0; j < 9; j++) {
        const st = a + .1 + j * (b - a) * .09, p = (t - st) / 1.7;
        if (p <= 0 || p >= 1) continue;
        const side = j % 2 ? 1 : -1, x0 = sx + side * (16 + hash(j + w * 9, seed + 71) * cap * .7), span = 260 + hash(j + w * 9, seed + 72) * 420;
        const x = x0 + side * span * p, hop = Math.abs(Math.sin(p * Math.PI * 3)) * 34 * (1 - p), y = yAt(pts, x) - 12 - hop, r = 9 + 10 * hash(j, seed + 73);
        g += G(`translate(${f2(x + sh.dx)} ${f2(y + sh.dy)}) rotate(${f2(p * 560 * side)})`, P(`M${-r} ${r * .3}L${-r * .5} ${-r * .8}L${r * .6} ${-r * .7}L${r} ${r * .2}L${r * .3} ${r * .9}Z`, '#3A2E30', { stroke: '#FF8A4C', 'stroke-width': 2, 'stroke-opacity': .6 }), (1 - Math.pow(p, 4)).toFixed(2));
        if (hop < 6) g += C(f2(x), f2(y + 6), f2(18 + 30 * p), 'url(#fxDust)', { opacity: (.8 * (1 - p)).toFixed(2) });
      }
    });
    return g;
  }

  window.FX = { peak, closed, yAt, samples, quakeAmp, shake, flames, fireAlong, summitFire, smokeColumn, vn, fbm };
})();
