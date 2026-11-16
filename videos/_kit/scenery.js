// Godward scenery kit (window.SC): rich, layered settings and big, characterful animals in the house paper-collage
// style. Load after episode-engine.js (people.js / fire.js optional). Pure functions of time like the rest of the kit;
// nothing here changes existing pages: a page opts in by calling SC. Everything is drawn in sheet coordinates
// (1920 wide, y -700..1800 in the vertical cut) and returns an SVG string.
//
// Why: "why does every video look so boring with small animals and background". Old scenes were a flat gradient,
// one or two smooth ridges, a thin ground line with small figures, and the same glowing-flower grass at the bottom.
// SC builds a scene in depth instead: sky -> sun / rays / clouds -> far range in haze -> mid hills with texture ->
// near ground with stones, puddles, flowers -> subjects (big) -> FOREGROUND framing close to the camera -> light.
//
// SKY AND LIGHT
//   SC.sky(t,{mood,hz,sun,stars})          gradient sky; moods: dawn day golden dusk night clearing (after a storm)
//   SC.sun(t,x,y,r,{col,rays,k})           sun disc with halo and a slowly turning corona
//   SC.godRays(t,x,y,{n,a0,a1,len,col,op}) soft beams fanning from a point (angles in radians, PI/2 = straight down)
//   SC.clouds(t,{seed,n,y,h,x0,x1,s,cols:[body,shade,rim],sun:{x,y},drift,op,storm})  layered cumulus lit from the sun
//   SC.birds(t,{n,x,y,spread,s,col,dx,seed})  a flock of flapping birds far away
//   SC.rainbow(t,cx,cy,r,{p,w,op})         vivid bow (7 bands, glow, brighter sky inside, faint second bow); p draws it on
//   SC.light(x,y,r,col,op)                 soft light pool (warm rim light behind a subject)
//   SC.haze(y0,y1,col,op0,op1)             atmospheric band;  SC.vig(cx,cy,r,op) sheet-space vignette round a subject
// TERRAIN (far -> near)
//   SC.range(seed,{y,h,peaks,col,light,snow,haze,hazeOp,sunX})   far mountains with lit faces, snow, haze at the foot
//   SC.hills(seed,{y,amp,wave,col,light,shade,terraces,fields,trees,treeCol,haze,hazeOp})  mid hills with texture
//   SC.ground(t,seed,{y,col,col2,stones,tufts,flowers,wet,grassCols})  near ground: blades, stones, tufts, flowers, wet glints
//   SC.profile(pts,{seed,rough,step}) / SC.yAt(pts,x) / SC.fill(pts,bottom)   custom ridges (a named mountain, a ledge)
//   SC.rock(x,y,w,h,{col,light,dark,seed,wet,moss})   faceted paper rock, bottom at y
//   SC.puddle(t,x,y,w,{sky,sky2,rainbow,rim})          wet puddle reflecting the sky (and the rainbow), with ripples
//   SC.tree(t,x,y,s,{kind:'round'|'olive'|'cypress'|'palm'|'acacia',col,col2,trunk,wind})
//   SC.tuft(t,x,y,s,{cols,n,h}) / SC.flower(t,x,y,s,{col,kind:'daisy'|'poppy'|'bell'}) / SC.reeds(t,x,y,s,{col})
//   SC.house(x,y,s,{col,roof,door}) a flat-roofed mud-brick house
// ENVIRONMENTS (whole backgrounds, sky to near ground; add subjects and SC.fore on top)
//   SC.env(t,'meadow'|'river'|'desert'|'village',{seed,mood,hz,sun,gy})
// FOREGROUND FRAMING (drawn last, big and close to the camera; fills the lower frame)
//   SC.fore(t,{y,bottom,x0,x1,edges:[xl,xr],cols:[dark,mid,light],flowers,rocks,rockAt:[[x,y,w]],wet,reeds,density,seed,
//            under (svg or pts=>svg, drawn on the band under the blades: puddles, lambs in the grass), over (svg on top)})
//   SC.branch(t,x,y,s,{side,col,leaf,blossom,len})   an overhanging branch entering from a frame edge
// ANIMALS (feet at x,y; s = 1 is the same scale as a PPL person at s = 1, who is ~215 tall)
//   SC.animal(t,kind,x,y,s,o)  kinds: sheep goat ox cow donkey camel lion deer dove bird
//   SC.pair(t,kind,x,y,s,o)    a male and female walking together (o.gap, o.dy), partner behind and a little smaller
//   o: face (1 right, -1 left), walk (phase in radians, e.g. t*6; 0/omit = standing), graze (0..1 or 'auto'),
//      look ('up'|'down'), phase, female, flat (no paper filter, for tiny far animals), op, fly (dove/bird),
//      leaf (dove carries an olive leaf), col (main colour override), antlers, mane, spots
//   Lengths at s=1: sheep 150, goat 140, ox/cow 230, donkey 190, camel 230 (300 tall), lion 200, deer 170, dove 70.
// Rules (see reference/scene-pacing.md "Scenery kit"): subjects big, layered depth, foreground framing, rich lower frame.
(function () {
  'use strict';
  if (!window.K || !window.S) throw new Error('scenery.js: load shared.js and style-kit.js first.');
  const { lerp, clamp } = K;
  const { hash, glow, nid } = S;
  const f1 = v => (+v).toFixed(1);
  const hx = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mx = (a, b, p) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p))).toString(16).padStart(2, '0')).join(''); };
  const vn = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, s), hash(i + 1, s), u); };
  const fbm = (x, s) => vn(x, s) * .6 + vn(x * 2.13, s + 7) * .28 + vn(x * 4.37, s + 13) * .12;
  const E = (x, y, rx, ry, fill, extra = '') => `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(Math.abs(rx))}" ry="${f1(Math.abs(ry))}" fill="${fill}" ${extra}/>`;
  const Er = (x, y, rx, ry, rot, fill, extra = '') => `<ellipse cx="0" cy="0" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(rot)})" ${extra}/>`;
  const Ci = (x, y, r, fill, extra = '') => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(Math.abs(r))}" fill="${fill}" ${extra}/>`;
  const Pa = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const Li = (x1, y1, x2, y2, c, w, extra = '') => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${c}" stroke-width="${f1(w)}" stroke-linecap="round" ${extra}/>`;
  const op = v => `opacity="${clamp(v).toFixed(3)}"`;
  // linear gradient in user space from (x1,y1) to (x2,y2): returns [url, defs]
  const lin = (stops, x1, y1, x2, y2) => { const id = nid(); return [`url(#${id})`, `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`]; };
  const rad = (stops, cx, cy, r) => { const id = nid(); return [`url(#${id})`, `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`]; };
  const poly = (pts, close = true) => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + (close ? 'Z' : '');

  // ---------- paper look: the house halftone with a thin cream sticker edge (same recipe as people.js) ----------
  const dotTile = (() => {
    const T = 11, d = T / 2, c = (x, y) => `<circle cx='${x}' cy='${y}' r='${d}' fill='url(#d)'/>`;
    const s = `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'><defs><radialGradient id='d'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#fff'/></radialGradient></defs><rect width='${T}' height='${T}' fill='#fff'/>${c(d, d)}${c(0, 0)}${c(T, 0)}${c(0, T)}${c(T, T)}</svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(s);
  })();
  const FILTERS = `<defs><filter id="scHt" filterUnits="userSpaceOnUse" x="-520" y="-560" width="1040" height="640" color-interpolation-filters="sRGB">
     <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="g0"/>
     <feComponentTransfer in="g0" result="g"><feFuncR type="linear" slope="1" intercept=".4"/><feFuncG type="linear" slope="1" intercept=".4"/><feFuncB type="linear" slope="1" intercept=".4"/></feComponentTransfer>
     <feImage href="${dotTile}" x="0" y="0" width="11" height="11" result="t0"/><feTile in="t0" result="tile"/>
     <feComposite in="g" in2="tile" operator="arithmetic" k1="0" k2=".5" k3=".5" k4="0" result="sum"/>
     <feComponentTransfer in="sum" result="bw"><feFuncR type="linear" slope="9" intercept="-4"/><feFuncG type="linear" slope="9" intercept="-4"/><feFuncB type="linear" slope="9" intercept="-4"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
     <feComponentTransfer in="SourceGraphic" result="bright"><feFuncR type="linear" slope="1.22"/><feFuncG type="linear" slope="1.22"/><feFuncB type="linear" slope="1.22"/></feComponentTransfer>
     <feBlend in="bw" in2="bright" mode="multiply" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in" result="ink"/>
     <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="fat"/><feGaussianBlur in="fat" stdDeviation=".6" result="fats"/>
     <feFlood flood-color="#FFF8EC" result="wh"/><feComposite in="wh" in2="fats" operator="in" result="white"/>
     <feGaussianBlur in="fat" stdDeviation="5" result="b"/><feOffset in="b" dx="4" dy="6" result="o"/>
     <feFlood flood-color="#000" flood-opacity=".32" result="sc"/><feComposite in="sc" in2="o" operator="in" result="shadow"/>
     <feMerge><feMergeNode in="shadow"/><feMergeNode in="white"/><feMergeNode in="ink"/></feMerge></filter></defs>`;

  // =====================================================================================================
  // SKY AND LIGHT
  // =====================================================================================================
  const MOODS = {
    dawn: { top: '#2E3A7A', mid: '#C88AB0', hz: '#FFD2A0', sun: '#FFE8B8', cloud: ['#F8D8D0', '#A07A9E', '#FFE6B8'], far: '#9A86B0', haze: '#F0C4B4' },
    day: { top: '#2F7FD6', mid: '#86C4EE', hz: '#E8F4F6', sun: '#FFF8E0', cloud: ['#FFFFFF', '#B0C4DC', '#FFFFFF'], far: '#7E9CC0', haze: '#DCEAF2' },
    golden: { top: '#4A5AA8', mid: '#E8A678', hz: '#FFE2A0', sun: '#FFE9A8', cloud: ['#FFE6C8', '#C08478', '#FFD890'], far: '#A88A9C', haze: '#F8D0A0' },
    dusk: { top: '#1E1846', mid: '#A04A78', hz: '#FF9A58', sun: '#FFB070', cloud: ['#E88A80', '#4A2A52', '#FFB080'], far: '#5A3A6A', haze: '#D87A70' },
    night: { top: '#04061A', mid: '#0E1840', hz: '#24386A', sun: '#F4F0DC', cloud: ['#3A4A7A', '#141C3A', '#8A9AC8'], far: '#1A2448', haze: '#2A3A6A' },
    clearing: { top: '#34507E', mid: '#86B2D6', hz: '#FFF0C8', sun: '#FFF6D8', cloud: ['#F2F4FA', '#6E7E9E', '#FFF0C0'], far: '#7088A6', haze: '#E6EAE0', storm: '#4A5470' },
  };
  const mood = m => MOODS[m] || MOODS.day;
  function sky(t, o = {}) {
    const M = mood(o.mood), hz = o.hz ?? 700, y0 = o.y0 ?? -720, y1 = o.y1 ?? 1800;
    const [u, d] = lin([[0, M.top], [.58, M.mid], [1, M.hz]], 0, y0, 0, hz + 60);
    let g = d + `<rect x="-120" y="${y0}" width="2160" height="${y1 - y0}" fill="${u}"/>`;
    if (o.mood === 'night' || o.stars) for (let i = 0; i < 140; i++) {
      const x = hash(i, 801) * 2000 - 40, y = y0 + Math.pow(hash(i, 802), 1.4) * (hz - y0) * .9, r = .8 + 2.2 * hash(i, 803) ** 3;
      g += Ci(x, y, r, '#FFFFFF', op((.35 + .6 * Math.sin(t * 2 + i) ** 2) * (o.mood === 'night' ? 1 : .5)));
    }
    if (o.sun) g += sun(t, o.sun.x, o.sun.y, o.sun.r || 70, { col: M.sun, rays: o.sun.rays ?? 1 });
    g += glow(o.sun ? o.sun.x : 960, hz, 1400, M.hz, .35);
    return g;
  }
  function sun(t, x, y, r, o = {}) {
    const col = o.col || '#FFF6D8', k = o.k ?? 1;
    let g = glow(x, y, r * 9, col, .32 * k) + glow(x, y, r * 3.6, col, .55 * k) + glow(x, y, r * 1.7, '#FFFFFF', .7 * k);
    if (o.rays) { let sp = ''; for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + t * .05, l = r * (1.9 + .7 * (i % 2)) * (1 + .08 * Math.sin(t * 1.7 + i)), w = .07; sp += `M${f1(x + Math.cos(a - w) * r * 1.05)} ${f1(y + Math.sin(a - w) * r * 1.05)}L${f1(x + Math.cos(a) * l)} ${f1(y + Math.sin(a) * l)}L${f1(x + Math.cos(a + w) * r * 1.05)} ${f1(y + Math.sin(a + w) * r * 1.05)}Z`; } g += Pa(sp, col, op(.35 * k * o.rays)); }
    g += Ci(x, y, r, '#FFFDF0', op(.95 * k)) + Ci(x - r * .18, y - r * .2, r * .62, '#FFFFFF', op(.6 * k));
    return g;
  }
  function godRays(t, x, y, o = {}) {
    const { n = 9, a0 = .95, a1 = 2.3, len = 2600, col = '#FFF4D0', op: o0 = .2, w = .045, seed = 3 } = o;
    const [u, d] = rad([[0, col, 1], [.45, col, .6], [1, col, 0]], x, y, len);
    let g = d;
    for (let i = 0; i < n; i++) {
      const a = lerp(a0, a1, n > 1 ? i / (n - 1) : .5) + (hash(i, seed) - .5) * .08 + Math.sin(t * .2 + i) * .012, ww = w * (.5 + hash(i, seed + 1));
      const o1 = o0 * (.55 + .45 * Math.sin(t * .6 + i * 1.9)) * (.6 + .6 * hash(i, seed + 2));
      g += Pa(`M${f1(x)} ${f1(y)}L${f1(x + Math.cos(a - ww) * len)} ${f1(y + Math.sin(a - ww) * len)}L${f1(x + Math.cos(a + ww) * len)} ${f1(y + Math.sin(a + ww) * len)}Z`, u, op(o1));
    }
    return g;
  }
  // one cumulus: puffs on a flat base; shade below, body shifted toward the sun, bright rims on the sun side
  function cloud(x, y, w, cols, sunP, seed, o1 = 1) {
    const [body, shade, rim] = cols, h = w * .32, pf = [];
    for (let i = 0; i < 7; i++) { const u = i / 6, r = w * (.1 + .05 * hash(i, seed)) * (1 - Math.abs(u - .5) * .5); pf.push([x + (u - .5) * w * .86, y - r * .5, r]); }
    for (let i = 0; i < 4; i++) { const u = (i + .5) / 4, r = w * (.13 + .07 * hash(i, seed + 3)) * (1 - Math.abs(u - .5) * .9); pf.push([x + (u - .5) * w * .6 + (hash(i, seed + 4) - .5) * w * .08, y - h * .45 - r * .35, r]); }
    pf.push([x + (hash(9, seed) - .5) * w * .2, y - h * .8, w * .14]);
    let dx = 0, dy = -1; if (sunP) { const vx = sunP.x - x, vy = sunP.y - y, l = Math.hypot(vx, vy) || 1; dx = vx / l; dy = vy / l; }
    let g = '';
    pf.forEach(([cx, cy, r]) => g += Ci(cx, cy + r * .06, r + 5, '#FFF8EC', 'opacity=".55"'));
    pf.forEach(([cx, cy, r]) => g += Ci(cx, cy + r * .12, r, shade));
    pf.forEach(([cx, cy, r]) => g += Ci(cx + dx * r * .2, cy + dy * r * .2, r * .92, rim));
    pf.forEach(([cx, cy, r]) => g += Ci(cx + dx * r * .02 - dx * r * .04, cy + dy * r * .02 - r * .02, r * .86, body));
    g += E(x, y + h * .02, w * .46, h * .1, shade, 'opacity=".55"');
    return `<g opacity="${clamp(o1).toFixed(2)}">${g}</g>`;
  }
  function clouds(t, o = {}) {
    const { seed = 1, n = 6, y = -560, h = 520, x0 = -200, x1 = 2120, s = 1, drift = 7, op: o0 = 1, sun: sp = null } = o;
    const cols = o.cols || mood(o.mood).cloud, span = x1 - x0 + 900;
    const list = [];
    for (let i = 0; i < n; i++) {
      const d = n > 1 ? i / (n - 1) : 1, w = lerp(300, 900, d) * s * (.8 + .4 * hash(i, seed + 5));
      const cx = x0 - 450 + ((hash(i, seed) * span + t * drift * (.4 + d)) % span), cy = y + h * (1 - d) + (hash(i, seed + 2) - .5) * 80;
      list.push([d, cx, cy, w, i]);
    }
    let g = '';
    list.sort((a, b) => a[0] - b[0]).forEach(([d, cx, cy, w, i]) => {
      const c = d < .5 && o.storm ? [mx(cols[0], o.storm, .5), mx(cols[1], o.storm, .6), cols[2]] : cols;
      g += cloud(cx, cy, w, c, sp, seed * 31 + i, o0 * lerp(.62, 1, d));
    });
    return g;
  }
  function birds(t, o = {}) {
    const { n = 6, x = 960, y = -200, spread = 340, s = 1, col = '#2A2230', dx = 40, seed = 7 } = o;
    let g = '';
    for (let i = 0; i < n; i++) {
      const bx = x + (hash(i, seed) - .5) * spread * 2 + t * dx * (.8 + .4 * hash(i, seed + 1)), by = y + (hash(i, seed + 2) - .5) * spread * .6 + Math.sin(t * 1.3 + i) * 8;
      const k = s * (.6 + .6 * hash(i, seed + 3)), f = Math.sin(t * 9 + i * 1.7);
      g += Pa(`M${f1(bx - 24 * k)} ${f1(by - 12 * k * f)}Q${f1(bx - 10 * k)} ${f1(by - 14 * k * (f * .5 + .6))} ${f1(bx)} ${f1(by)}Q${f1(bx + 10 * k)} ${f1(by - 14 * k * (f * .5 + .6))} ${f1(bx + 24 * k)} ${f1(by - 12 * k * f)}`, 'none', `stroke="${col}" stroke-width="${f1(4.2 * k)}"`);
    }
    return g;
  }
  const BOW = ['#FF4434', '#FF9632', '#FFE046', '#56CC64', '#36A6F0', '#4A64E2', '#9456E2'];
  function rainbow(t, cx, cy, r, o = {}) {
    const p = clamp(o.p ?? 1), w = o.w || 22, o0 = o.op ?? .9;
    if (p <= 0) return '';
    const arc = R => `M${f1(cx - R)} ${f1(cy)}A${f1(R)} ${f1(R)} 0 0 1 ${f1(cx + R)} ${f1(cy)}`;
    const dash = `pathLength="1" stroke-dasharray="${p.toFixed(3)} 2" fill="none"`;
    let g = '';
    // brighter sky inside the bow, a soft glow under the bands, a faint second bow outside
    const rin = r - w * 7;
    const [u, d] = rad([[0, '#FFFFFF', 0], [.78, '#FFFFFF', .0], [.96, '#FFFDF0', .28 * o0 * p], [1, '#FFFFFF', 0]], cx, cy, rin);
    g += d + `<path d="${arc(rin)}Z" fill="${u}"/>`;
    g += `<path d="${arc(r - w * 3.5)}" stroke="#FFFFFF" stroke-width="${w * 9}" ${dash} opacity="${(.12 * o0).toFixed(2)}"/>`;
    BOW.forEach((c, i) => g += `<path d="${arc(r - i * w)}" stroke="${c}" stroke-width="${w + 1.5}" ${dash} opacity="${o0.toFixed(2)}"/>`);
    g += `<path d="${arc(r - w * .2)}" stroke="#FFFFFF" stroke-width="${w * .3}" ${dash} opacity="${(.25 * o0).toFixed(2)}"/>`;
    BOW.slice().reverse().forEach((c, i) => g += `<path d="${arc(r * 1.22 - i * w * .6)}" stroke="${c}" stroke-width="${w * .6}" ${dash} opacity="${(.22 * o0).toFixed(2)}"/>`);
    return g;
  }
  const light = (x, y, r, col = '#FFE9B0', o1 = .5) => glow(x, y, r, col, o1);
  function haze(y0, y1, col, a0 = 0, a1 = .6, x0 = -120, x1 = 2040) {
    const [u, d] = lin([[0, col, a0], [1, col, a1]], 0, y0, 0, y1);
    return d + `<rect x="${x0}" y="${f1(y0)}" width="${x1 - x0}" height="${f1(y1 - y0)}" fill="${u}"/>`;
  }
  function vig(cx, cy, r, o1 = .45, col = '#0A0614') {
    const [u, d] = rad([[0, col, 0], [.55, col, 0], [1, col, o1]], cx, cy, r);
    return d + `<rect x="-120" y="-760" width="2160" height="2600" fill="${u}"/>`;
  }

  // =====================================================================================================
  // TERRAIN
  // =====================================================================================================
  // piecewise-linear control points with noise added: [[x,y],...]
  function profile(ctrl, o = {}) {
    const { seed = 1, rough = 14, step = 12 } = o, out = [];
    for (let i = 1; i < ctrl.length; i++) {
      const a = ctrl[i - 1], b = ctrl[i];
      for (let x = a[0]; x < b[0] || (i === ctrl.length - 1 && x <= b[0]); x += step) {
        const u = (x - a[0]) / ((b[0] - a[0]) || 1), uu = u * u * (3 - 2 * u);
        const r = a[2] ?? rough;
        out.push([x, lerp(a[1], b[1], o.smooth ? uu : u) + (fbm(x / 70, seed) - .5) * r * 2]);
      }
    }
    return out;
  }
  const yAt = (pts, x) => { for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const a = pts[i - 1], b = pts[i], u = (x - a[0]) / ((b[0] - a[0]) || 1); return lerp(a[1], b[1], clamp(u)); } return pts[pts.length - 1][1]; };
  const fill = (pts, bottom = 1800) => poly(pts, false) + `L${f1(pts[pts.length - 1][0])} ${bottom}L${f1(pts[0][0])} ${bottom}Z`;
  const ridgePts = (seed, y, amp, wave, x0 = -140, x1 = 2060, step = 14) => { const out = [], ph = hash(seed, 91) * 6; for (let x = x0; x <= x1; x += step) out.push([x, y + Math.sin(x / wave + ph) * amp + Math.sin(x / (wave * .37) + ph * 2) * amp * .3 + (fbm(x / 40, seed) - .5) * amp * .25]); return out; };

  function range(seed, o = {}) {
    const { y = 520, h = 300, peaks = 5, x0 = -160, x1 = 2080, bottom = 1800, snow = false, sunX = 1500 } = o;
    const M = mood(o.mood), col = o.col || M.far, lit = o.light || mx(col, '#FFFFFF', .28), hz = o.haze || M.haze;
    const P = []; for (let k = 0; k < peaks; k++) P.push([x0 + (k + .5 + (hash(k, seed) - .5) * .6) / peaks * (x1 - x0), h * (.55 + .45 * hash(k, seed + 1)), (x1 - x0) / peaks * (.55 + .4 * hash(k, seed + 2))]);
    const pts = []; for (let x = x0; x <= x1; x += 10) { let v = 0; P.forEach(([px, ph, pw]) => { const d = Math.abs(x - px) / pw; if (d < 1) v = Math.max(v, ph * Math.pow(1 - d, 1.25)); }); pts.push([x, y - v + (fbm(x / 26, seed) - .5) * 22 * (.3 + v / h)]); }
    const id = nid(); let g = `<clipPath id="${id}"><path d="${fill(pts, bottom)}"/></clipPath>` + Pa(fill(pts, bottom), col);
    let fac = '', sn = '';
    P.forEach(([px, ph, pw], k) => {
      const top = yAt(pts, px), side = sunX < px ? -1 : 1;
      fac += `M${f1(px)} ${f1(top)}L${f1(px + side * pw * .7)} ${f1(y + 40)}L${f1(px + side * pw * .12)} ${f1(y + 60)}Z`;
      for (let j = 0; j < 3; j++) { const sx = px + (hash(j, seed + k * 7) - .5) * pw * .5; fac += `M${f1(sx)} ${f1(yAt(pts, sx) + 8)}L${f1(sx + side * pw * .22)} ${f1(y + 30)}L${f1(sx + side * pw * .05)} ${f1(y + 30)}Z`; }
      if (snow && ph > h * .62) { const sh = ph * .26; sn += `M${f1(px - pw * .2)} ${f1(top + sh)}` + [...Array(9)].map((_, j) => { const xx = px - pw * .2 + j / 8 * pw * .4; return `L${f1(xx)} ${f1(Math.min(yAt(pts, xx) + 1, top + sh * (.7 + .5 * hash(j, seed + k))))}`; }).join('') + `L${f1(px + pw * .2)} ${f1(yAt(pts, px + pw * .2))}` + `L${f1(px)} ${f1(top - 2)}Z`; }
    });
    g += `<g clip-path="url(#${id})">` + Pa(fac, lit, 'opacity=".42"') + (sn ? Pa(sn, '#F6F8FC', 'opacity=".92"') : '') + haze(y - h * .4, y + 80, hz, 0, o.hazeOp ?? .7) + haze(y + 80, bottom, hz, o.hazeOp ?? .7, o.hazeOp ?? .7) + '</g>';
    return g;
  }
  function hills(seed, o = {}) {
    const { y = 640, amp = 40, wave = 300, x0 = -140, x1 = 2060, bottom = 1800, terraces = 0, fields = false, trees = 0, hazeOp = 0 } = o;
    const col = o.col || '#5E8E4A', litC = o.light || mx(col, '#FFF2C0', .3), shade = o.shade || mx(col, '#0A1A10', .3);
    const pts = o.pts || ridgePts(seed, y, amp, wave, x0, x1), id = nid();
    const [u, d] = lin([[0, litC], [.25, col], [1, shade]], 0, y - amp, 0, y + 420);
    let g = d + `<clipPath id="${id}"><path d="${fill(pts, bottom)}"/></clipPath>` + Pa(fill(pts, bottom), u);
    let tex = '';
    if (fields) for (let k = 0; k < 26; k++) {
      const fx = x0 + hash(k, seed + 21) * (x1 - x0), fy = yAt(pts, fx) + 20 + hash(k, seed + 22) * 160, fw = 90 + hash(k, seed + 23) * 170, fh = 16 + hash(k, seed + 24) * 26, sk = (hash(k, seed + 25) - .5) * 30;
      tex += Pa(`M${f1(fx)} ${f1(fy)}L${f1(fx + fw)} ${f1(fy + sk * .2)}L${f1(fx + fw + sk)} ${f1(fy + fh)}L${f1(fx + sk)} ${f1(fy + fh)}Z`, [mx(col, '#E8D070', .35), mx(col, '#2A4A20', .2), mx(col, '#C8A060', .3)][k % 3], 'opacity=".55"');
    }
    for (let k = 1; k <= terraces; k++) {
      const off = k * (26 + k * 6);
      tex += Pa(poly(pts.map(([x, yy]) => [x, yy + off + Math.sin(x / 130 + k) * 6]), false), 'none', `stroke="${shade}" stroke-width="3.5" opacity=".38"`) +
        Pa(poly(pts.map(([x, yy]) => [x, yy + off - 4 + Math.sin(x / 130 + k) * 6]), false), 'none', `stroke="${litC}" stroke-width="2.5" opacity=".35"`);
    }
    // grass texture strokes
    for (let k = 0; k < 70; k++) { const gx = x0 + hash(k, seed + 31) * (x1 - x0), gy = yAt(pts, gx) + 12 + hash(k, seed + 32) * 220; tex += Li(gx, gy, gx + 5, gy - 9, k % 2 ? litC : shade, 2.4, 'opacity=".45"'); }
    g += `<g clip-path="url(#${id})">${tex}${hazeOp ? haze(y - amp, y + 160, o.haze || '#E8EEF0', hazeOp, 0) : ''}</g>`;
    for (let k = 0; k < trees; k++) {
      const tx = x0 + 60 + hash(k, seed + 41) * (x1 - x0 - 120), ty = yAt(pts, tx) + 4 + hash(k, seed + 42) * 30;
      g += tree(0, tx, ty, (o.treeS || .34) * (.7 + .6 * hash(k, seed + 43)), { kind: o.treeKind || (k % 3 ? 'round' : 'cypress'), col: o.treeCol || mx(col, '#0A2A14', .35), flat: true });
    }
    return g;
  }
  function ground(t, seed, o = {}) {
    const { y = 760, bottom = 1800, x0 = -140, x1 = 2060, stones = 14, tufts = 34, flowers = [], wet = 0, amp = 10, wave = 240 } = o;
    const col = o.col || '#5E8E4A', col2 = o.col2 || mx(col, '#0A1A10', .3), gc = o.grassCols || [mx(col, '#0A1A10', .35), col, mx(col, '#FFF2B0', .3)];
    const pts = o.pts || ridgePts(seed, y, amp, wave, x0, x1);
    const [u, d] = lin([[0, mx(col, '#FFF2C0', .15)], [.3, col], [1, col2]], 0, y, 0, y + 520);
    let g = d + Pa(fill(pts, bottom), u);
    const items = [];
    for (let k = 0; k < 120; k++) { const gx = x0 + hash(k, seed + 51) * (x1 - x0), gy = yAt(pts, gx) + 6 + Math.pow(hash(k, seed + 52), .8) * 380; items.push([gy, 'dash', gx, k]); }
    for (let k = 0; k < stones; k++) { const gx = x0 + hash(k, seed + 61) * (x1 - x0), gy = yAt(pts, gx) + 14 + hash(k, seed + 62) * 340; items.push([gy, 'stone', gx, k]); }
    for (let k = 0; k < tufts; k++) { const gx = x0 + hash(k, seed + 71) * (x1 - x0), gy = yAt(pts, gx) + 10 + hash(k, seed + 72) * 360; items.push([gy, 'tuft', gx, k]); }
    if (flowers.length) for (let k = 0; k < 26; k++) { const gx = x0 + hash(k, seed + 81) * (x1 - x0), gy = yAt(pts, gx) + 16 + hash(k, seed + 82) * 340; items.push([gy, 'flower', gx, k]); }
    items.sort((a, b) => a[0] - b[0]).forEach(([gy, kind, gx, k]) => {
      const dd = clamp((gy - y) / 400), sz = lerp(.5, 1.1, dd);
      if (kind === 'dash') g += Li(gx, gy, gx + 6 * sz, gy - 12 * sz, k % 2 ? gc[2] : gc[0], 2.6 * sz, 'opacity=".5"');
      else if (kind === 'stone') g += rock(gx, gy, (18 + 30 * hash(k, seed + 63)) * sz, (10 + 14 * hash(k, seed + 64)) * sz, { col: o.stone || '#8A8478', seed: seed + k, wet, edge: false });
      else if (kind === 'tuft') g += tuft(t, gx, gy, sz * .8, { cols: gc, n: 5 });
      else g += flower(t, gx, gy, sz * .55, { col: flowers[k % flowers.length], kind: k % 3 === 0 ? 'poppy' : 'daisy' });
      if (wet && kind === 'dash' && k % 4 === 0) g += Ci(gx + 6 * sz, gy - 12 * sz, 2.4 * sz, '#FFFFFF', op(.5 + .5 * Math.sin(t * 3 + k)));
    });
    return g;
  }
  function rock(x, y, w, h, o = {}) {
    const col = o.col || '#7A746C', litC = o.light || mx(col, '#FFF4DC', .35), dk = o.dark || mx(col, '#100A10', .35), seed = o.seed || 1;
    const pts = []; const n = 9;
    for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI, rr = .78 + .3 * hash(i, seed); pts.push([x + Math.cos(a) * w * rr, y + Math.sin(a) * h * rr * (i === 0 || i === n ? 0 : 1)]); }
    pts[0][1] = y; pts[n][1] = y;
    let g = '';
    if (o.edge !== false) g += Pa(poly(pts), '#FFF8EC', 'stroke="#FFF8EC" stroke-width="7" opacity=".7"');
    g += Pa(poly(pts), col);
    const top = pts.slice(1, Math.ceil(n * .55));
    g += Pa(poly([[x - w * .55, y - h * .1], ...top, [x + w * .1, y - h * .45]]), litC, 'opacity=".75"');
    g += Pa(poly([[x + w * .15, y - h * .55], ...pts.slice(Math.ceil(n * .6), n), [x + w * .9, y], [x + w * .2, y]]), dk, 'opacity=".55"');
    g += Pa(`M${f1(x - w * .2)} ${f1(y - h * .5)}L${f1(x + w * .05)} ${f1(y - h * .2)}L${f1(x - w * .05)} ${f1(y)}`, 'none', `stroke="${dk}" stroke-width="${f1(Math.max(1.5, w * .03))}" opacity=".5"`);
    if (o.moss) g += E(x - w * .25, y - h * .82, w * .32, h * .14, o.moss, 'opacity=".85"');
    if (o.wet) g += Pa(`M${f1(x - w * .5)} ${f1(y - h * .62)}Q${f1(x - w * .2)} ${f1(y - h * .95)} ${f1(x + w * .2)} ${f1(y - h * .85)}`, 'none', `stroke="#FFFFFF" stroke-width="${f1(Math.max(2, w * .05))}" opacity="${(.55 * o.wet).toFixed(2)}"`) + Ci(x - w * .3, y - h * .72, Math.max(2, w * .03), '#FFFFFF', op(.8 * o.wet));
    return g;
  }
  function puddle(t, x, y, w, o = {}) {
    const h = w * (o.flat ?? .16), sky1 = o.sky || '#9CCBE6', sky2 = o.sky2 || '#E8F4F8', rim = o.rim || '#3A3A2A', seed = o.seed || 3;
    const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, rr = 1 + (vn(i * .7, seed) - .5) * .28; pts.push([x + Math.cos(a) * w * rr, y + Math.sin(a) * h * rr]); }
    const id = nid(), [u, d] = lin([[0, sky2], [1, sky1]], 0, y - h, 0, y + h);
    let g = d + Pa(poly(pts.map(([px, py]) => [x + (px - x) * 1.05, y + (py - y) * 1.1 + 1])), rim, 'opacity=".35"') + `<clipPath id="${id}"><path d="${poly(pts)}"/></clipPath>` + Pa(poly(pts), u, 'opacity=".92"');
    let inn = '';
    // the bow seen upside down in the water: soft arcs bending down, fading at the near edge
    if (o.rainbow) BOW.forEach((c, i) => inn += Pa(`M${f1(x - w * 1.2)} ${f1(y - h * 1.1 + i * h * .09)}Q${f1(x - w * .1)} ${f1(y + h * .55 + i * h * .09)} ${f1(x + w * 1.3)} ${f1(y - h * .9 + i * h * .09)}`, 'none', `stroke="${c}" stroke-width="${f1(h * .1)}" opacity="${(.42 * (o.rainbow === true ? 1 : o.rainbow)).toFixed(2)}"`));
    if (o.reflect) inn += o.reflect;
    inn += E(x - w * .25, y - h * .25, w * .32, h * .07, '#FFFFFF', 'opacity=".55"') + E(x + w * .3, y + h * .2, w * .18, h * .05, '#FFFFFF', 'opacity=".4"');
    for (let k = 0; k < 2; k++) { const p = ((t + k * 1.1 + hash(k, seed) * 2) % 2.2) / 2.2, rx = x + (hash(k, seed + 5) - .5) * w, ry = y + (hash(k, seed + 6) - .5) * h; inn += E(rx, ry, 6 + p * w * .25, (6 + p * w * .25) * .25, 'none', `stroke="#FFFFFF" stroke-width="2.5" opacity="${(.7 * (1 - p)).toFixed(2)}"`); }
    g += `<g clip-path="url(#${id})">${inn}</g>`;
    g += Pa(poly(pts.slice(14, 28), false), 'none', `stroke="${rim}" stroke-width="${f1(Math.max(2, h * .06))}" opacity=".45"`);
    return g;
  }
  function tuft(t, x, y, s, o = {}) {
    const cols = o.cols || ['#2E5A26', '#4A8A3A', '#8AC060'], n = o.n || 6, hh = o.h || 1, seed = o.seed ?? Math.floor(x * 7 + y);
    let g = '';
    for (let j = 0; j < n; j++) {
      const u = n > 1 ? j / (n - 1) - .5 : 0, bw = (5 + 3 * hash(j, seed)) * s, L = (38 + 46 * hash(j, seed + 1)) * s * hh * (1 - Math.abs(u) * .5);
      const lean = u * 1.2 + (hash(j, seed + 2) - .5) * .5 + Math.sin(t * 1.4 + x * .01 + j) * .08 * (o.wind ?? 1), bx = x + u * 26 * s;
      const tx = bx + Math.sin(lean) * L, ty = y - Math.cos(lean) * L, cx = bx + Math.sin(lean * .4) * L * .5, cy = y - L * .55;
      const c = cols[(j + (hash(j, seed + 3) > .5 ? 1 : 0)) % cols.length];
      g += Pa(`M${f1(bx - bw)} ${f1(y)}Q${f1(cx - bw * .5)} ${f1(cy)} ${f1(tx)} ${f1(ty)}Q${f1(cx + bw * .6)} ${f1(cy)} ${f1(bx + bw)} ${f1(y)}Z`, c);
    }
    return g;
  }
  function flower(t, x, y, s, o = {}) {
    const col = o.col || '#FFFFFF', kind = o.kind || 'daisy', sw = Math.sin(t * 1.3 + x * .02) * 6 * s, hy = (o.h || 46) * s, fx = x + sw, fy = y - hy;
    let g = Pa(`M${f1(x)} ${f1(y)}Q${f1(x + sw * .3)} ${f1(y - hy * .5)} ${f1(fx)} ${f1(fy)}`, 'none', `stroke="${o.stem || '#3A6A2A'}" stroke-width="${f1(3 * s)}"`) + Er(x + 6 * s, y - hy * .4, 8 * s, 3 * s, -30, o.stem || '#3A6A2A');
    if (kind === 'poppy') { for (let i = 0; i < 4; i++) g += Er(fx + Math.cos(i * 1.57) * 7 * s, fy + Math.sin(i * 1.57) * 6 * s, 10 * s, 8 * s, i * 90, col); g += Ci(fx, fy, 5 * s, '#2A1A1A'); }
    else if (kind === 'bell') { g += Pa(`M${f1(fx - 9 * s)} ${f1(fy)}Q${f1(fx)} ${f1(fy - 18 * s)} ${f1(fx + 9 * s)} ${f1(fy)}L${f1(fx + 11 * s)} ${f1(fy + 8 * s)}L${f1(fx - 11 * s)} ${f1(fy + 8 * s)}Z`, col); }
    else { for (let i = 0; i < 7; i++) { const a = i / 7 * 360; g += Er(fx + Math.cos(a * Math.PI / 180) * 9 * s, fy + Math.sin(a * Math.PI / 180) * 6 * s, 8 * s, 3.6 * s, a, col); } g += Ci(fx, fy, 4.6 * s, o.center || '#FFC83A'); }
    return g;
  }
  function reeds(t, x, y, s, o = {}) {
    const col = o.col || '#5A7A3A', head = o.head || '#6A4A2A';
    let g = '';
    for (let j = 0; j < 6; j++) {
      const u = j / 5 - .5, L = (120 + 90 * hash(j, x)) * s, lean = u * .5 + Math.sin(t * 1.2 + j + x * .01) * .06, bx = x + u * 30 * s, tx = bx + Math.sin(lean) * L, ty = y - Math.cos(lean) * L;
      g += Pa(`M${f1(bx - 3 * s)} ${f1(y)}Q${f1(bx + Math.sin(lean) * L * .3)} ${f1(y - L * .5)} ${f1(tx)} ${f1(ty)}Q${f1(bx + Math.sin(lean) * L * .3 + 4 * s)} ${f1(y - L * .5)} ${f1(bx + 3 * s)} ${f1(y)}Z`, j % 2 ? col : mx(col, '#0A1A0A', .3));
      if (j % 2 === 0) g += Er(bx + Math.sin(lean) * L * .82, y - Math.cos(lean) * L * .82, 6 * s, 20 * s, lean * 57, head);
    }
    return g;
  }
  function tree(t, x, y, s, o = {}) {
    const kind = o.kind || 'round', col = o.col || '#3E7A3A', c2 = o.col2 || mx(col, '#E8F0A0', .3), tr = o.trunk || '#5A3A22', sw = Math.sin(t * 1.1 + x * .01) * 5 * (o.wind ?? 1) * s;
    let g = '';
    if (kind === 'cypress') {
      g += Li(x, y, x, y - 30 * s, tr, 8 * s) + Pa(`M${f1(x)} ${f1(y - 250 * s)}Q${f1(x + 40 * s + sw)} ${f1(y - 130 * s)} ${f1(x + 26 * s)} ${f1(y - 24 * s)}L${f1(x - 26 * s)} ${f1(y - 24 * s)}Q${f1(x - 40 * s + sw)} ${f1(y - 130 * s)} ${f1(x)} ${f1(y - 250 * s)}Z`, col) +
        (o.flat ? '' : Pa(`M${f1(x - 4 * s)} ${f1(y - 230 * s)}Q${f1(x - 30 * s)} ${f1(y - 130 * s)} ${f1(x - 18 * s)} ${f1(y - 40 * s)}`, 'none', `stroke="${c2}" stroke-width="${f1(6 * s)}" opacity=".5"`));
    } else if (kind === 'palm') {
      const tx = x + 40 * s + sw, ty = y - 260 * s;
      g += Pa(`M${f1(x - 10 * s)} ${f1(y)}Q${f1(x + 10 * s)} ${f1(y - 150 * s)} ${f1(tx - 6 * s)} ${f1(ty)}L${f1(tx + 6 * s)} ${f1(ty)}Q${f1(x + 22 * s)} ${f1(y - 150 * s)} ${f1(x + 10 * s)} ${f1(y)}Z`, tr);
      for (let i = 0; i < 6; i++) { const yy = y - i * 40 * s; g += Li(x - 8 * s + i * 5 * s, yy - 20 * s, x + 12 * s + i * 5 * s, yy - 24 * s, mx(tr, '#000000', .3), 2.5 * s, 'opacity=".6"'); }
      for (let i = 0; i < 7; i++) { const a = -Math.PI + i / 6 * Math.PI + Math.sin(t + i) * .04, L = 120 * s, ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * .5 + 40 * s * Math.abs(Math.cos(a)); g += Pa(`M${f1(tx)} ${f1(ty)}Q${f1(tx + Math.cos(a) * L * .5)} ${f1(ty + Math.sin(a) * L * .6 - 30 * s)} ${f1(ex)} ${f1(ey)}Q${f1(tx + Math.cos(a) * L * .45)} ${f1(ty + Math.sin(a) * L * .4 - 6 * s)} ${f1(tx)} ${f1(ty)}Z`, i % 2 ? col : c2); }
    } else if (kind === 'acacia') {
      g += Pa(`M${f1(x - 8 * s)} ${f1(y)}L${f1(x - 4 * s)} ${f1(y - 90 * s)}L${f1(x - 60 * s)} ${f1(y - 150 * s)}M${f1(x - 4 * s)} ${f1(y - 90 * s)}L${f1(x + 50 * s)} ${f1(y - 160 * s)}`, 'none', `stroke="${tr}" stroke-width="${f1(10 * s)}"`);
      g += E(x + sw, y - 170 * s, 150 * s, 32 * s, col) + E(x - 40 * s + sw, y - 186 * s, 80 * s, 22 * s, c2, 'opacity=".7"');
    } else {
      const olive = kind === 'olive', cc = olive ? (o.col || '#7A9A6A') : col, cl = olive ? (o.col2 || '#B4C8A0') : c2;
      g += olive ? Pa(`M${f1(x - 14 * s)} ${f1(y)}Q${f1(x + 10 * s)} ${f1(y - 50 * s)} ${f1(x - 10 * s)} ${f1(y - 90 * s)}Q${f1(x - 20 * s)} ${f1(y - 120 * s)} ${f1(x + 4 * s)} ${f1(y - 140 * s)}L${f1(x + 14 * s)} ${f1(y - 130 * s)}Q${f1(x + 2 * s)} ${f1(y - 100 * s)} ${f1(x + 16 * s)} ${f1(y - 70 * s)}Q${f1(x + 26 * s)} ${f1(y - 40 * s)} ${f1(x + 14 * s)} ${f1(y)}Z`, tr)
        : Pa(`M${f1(x - 12 * s)} ${f1(y)}L${f1(x - 6 * s)} ${f1(y - 130 * s)}L${f1(x + 6 * s)} ${f1(y - 130 * s)}L${f1(x + 14 * s)} ${f1(y)}Z`, tr);
      const B = olive ? [[-60, -150, 56], [0, -176, 64], [60, -150, 54], [-28, -206, 46], [34, -206, 44], [-90, -130, 34], [90, -128, 34]] : [[0, -200, 88], [-66, -168, 58], [66, -172, 62], [-34, -240, 60], [36, -246, 56], [0, -150, 50]];
      B.forEach(([dx, dy, r]) => g += Ci(x + dx * s + sw * (-dy / 250), y + dy * s, r * s * (olive ? .9 : 1), cc));
      if (!o.flat) B.forEach(([dx, dy, r], i) => g += Ci(x + dx * s - r * .25 * s + sw * (-dy / 250), y + dy * s - r * .3 * s, r * s * .5, cl, 'opacity=".55"'));
      if (olive && !o.flat) for (let i = 0; i < 14; i++) g += Er(x + (hash(i, 5) - .5) * 200 * s + sw, y - (130 + hash(i, 6) * 110) * s, 9 * s, 3.5 * s, hash(i, 7) * 180, '#E8F0D8', 'opacity=".6"');
    }
    return g;
  }
  function house(x, y, s, o = {}) {
    const col = o.col || '#D8B488', dk = mx(col, '#3A2410', .4), lt = mx(col, '#FFF4DC', .35), w = (o.w || 150) * s, h = (o.h || 110) * s;
    let g = Pa(poly([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y]]), col);
    g += Pa(poly([[x + w / 2, y], [x + w / 2, y - h], [x + w / 2 + w * .28, y - h + 18 * s], [x + w / 2 + w * .28, y - 8 * s]]), dk, 'opacity=".75"');
    g += Pa(poly([[x - w / 2 - 6 * s, y - h], [x + w / 2 + 4 * s, y - h], [x + w / 2 + w * .28, y - h + 18 * s], [x - w / 2 + w * .26, y - h + 18 * s]]), o.roof || lt);
    for (let i = 0; i < 4; i++) g += Ci(x - w / 2 + (i + .5) * w / 4, y - h - 2 * s, 5 * s, mx(col, '#5A3A1A', .5));
    g += Pa(`M${f1(x - 16 * s)} ${f1(y)}L${f1(x - 16 * s)} ${f1(y - 50 * s)}Q${f1(x)} ${f1(y - 66 * s)} ${f1(x + 16 * s)} ${f1(y - 50 * s)}L${f1(x + 16 * s)} ${f1(y)}Z`, o.door || '#4A2E1A');
    g += `<rect x="${f1(x + w * .22)}" y="${f1(y - h * .72)}" width="${f1(18 * s)}" height="${f1(16 * s)}" fill="#3A2414"/>`;
    return g;
  }

  // =====================================================================================================
  // ENVIRONMENTS
  // =====================================================================================================
  function env(t, kind, o = {}) {
    const seed = o.seed || 11, gy = o.gy ?? 760, hz = o.hz ?? gy - 140;
    const m = o.mood || (kind === 'desert' ? 'golden' : 'day'), M = mood(m), sp = o.sun === false ? null : (o.sun || { x: 1480, y: hz - 520, r: 70 });
    let g = sky(t, { mood: m, hz, sun: sp });
    if (o.rays !== false && sp) g += godRays(t, sp.x, sp.y, { n: 7, op: .14 });
    g += clouds(t, { seed, n: 6, y: hz - 1100, h: 700, mood: m, sun: sp, op: m === 'night' ? .5 : 1 });
    if (o.birds !== false && m !== 'night') g += birds(t, { x: 700, y: hz - 700, n: 5, s: .8, col: mx(M.top, '#000000', .6) });
    if (kind === 'desert') {
      g += range(seed + 1, { y: hz + 20, h: 150, peaks: 4, col: mx(M.far, '#C08A60', .5), mood: m, hazeOp: .55, sunX: sp ? sp.x : 960 });
      // mesas
      [[300, 210, 160], [1500, 260, 120]].forEach(([mxp, mw, mh], k) => { g += Pa(`M${mxp - mw} ${hz + 60}L${mxp - mw * .7} ${hz + 60 - mh}L${mxp + mw * .7} ${hz + 60 - mh}L${mxp + mw} ${hz + 60}Z`, mx('#B0704A', M.haze, .4)) + Pa(`M${mxp - mw * .7} ${hz + 60 - mh}L${mxp - mw * .1} ${hz + 60 - mh}L${mxp - mw * .3} ${hz + 60}L${mxp - mw} ${hz + 60}Z`, mx('#E0A070', M.haze, .3), 'opacity=".6"'); });
      [[hz + 70, '#E0B070', 40, 380], [hz + 150, '#D49A5A', 54, 330], [gy, '#C88848', 30, 260]].forEach(([yy, c, a, w], k) => {
        const pts = ridgePts(seed + 20 + k, yy, a, w); g += hills(seed + 20 + k, { pts, col: c, light: mx(c, '#FFF0C0', .5), shade: mx(c, '#5A2A10', .35) });
        g += Pa(poly(pts.map(([x, y2]) => [x, y2 + 4]), false), 'none', `stroke="${mx(c, '#FFF6D8', .6)}" stroke-width="4" opacity=".6"`);
      });
      g += tree(t, 1560, gy + 20, .8, { kind: 'acacia', col: '#6A7A3A' }) + tree(t, 420, gy + 60, .55, { kind: 'palm', col: '#5A8A3A' });
      for (let k = 0; k < 8; k++) g += rock(100 + hash(k, seed + 3) * 1700, gy + 60 + hash(k, seed + 4) * 260, 20 + 30 * hash(k, seed + 5), 12 + 14 * hash(k, seed + 6), { col: '#9A6A4A', edge: false });
      g += haze(gy - 80, gy + 30, '#FFE8C0', 0, .25);
      return g;
    }
    g += range(seed + 1, { y: hz + 40, h: 320, peaks: 5, mood: m, snow: kind !== 'village', sunX: sp ? sp.x : 960 });
    g += hills(seed + 2, { y: hz + 90, amp: 44, wave: 280, col: mx('#6E9A5A', M.far, .35), trees: 9, terraces: kind === 'village' ? 4 : 0, hazeOp: .45, haze: M.haze });
    if (kind === 'village') {
      const pts = ridgePts(seed + 3, gy - 70, 30, 320);
      g += hills(seed + 3, { pts, col: '#8AA05A', fields: true, terraces: 2 });
      [[620, -10, .8], [780, -30, .9], [940, -6, 1], [1090, -28, .85], [1240, -8, .95], [1380, -24, .8], [860, 40, 1.05], [1160, 46, 1]].forEach(([hxp, dy, s], k) => g += house(hxp, yAt(pts, hxp) + 30 + dy, s * .8, { col: ['#D8B488', '#E2C49A', '#C8A070'][k % 3] }));
      g += tree(t, 520, yAt(pts, 520) + 40, .5, { kind: 'palm', col: '#4A8A3A' }) + tree(t, 1460, yAt(pts, 1460) + 50, .55, { kind: 'olive' }) + tree(t, 700, yAt(pts, 700) + 70, .4, { kind: 'cypress', col: '#2E5A2E' });
      g += ground(t, seed + 4, { y: gy, col: '#B0965A', col2: '#7A6438', stones: 18, tufts: 18, grassCols: ['#6A7A3A', '#8A9A4A', '#C8C070'] });
      g += Pa(`M820 ${gy + 10}Q980 ${gy + 120} 900 ${gy + 400}L1180 ${gy + 400}Q1080 ${gy + 120} 900 ${gy + 10}Z`, '#D8BE8A', 'opacity=".6"');
      return g;
    }
    if (kind === 'river') {
      const pts = ridgePts(seed + 3, gy - 60, 24, 300);
      g += hills(seed + 3, { pts, col: '#6AA04E', trees: 7, treeS: .45 });
      g += ground(t, seed + 4, { y: gy, col: '#5E9A46', stones: 10, tufts: 30, flowers: o.flowers || ['#FFFFFF', '#FFD84A'] });
      const cx = y2 => 1000 + Math.sin(y2 / 160) * 120 + (y2 - gy) * .3, wv = y2 => lerp(20, 380, clamp((y2 - (gy - 40)) / 900));
      const L1 = [], R1 = []; for (let y2 = gy - 40; y2 <= 1800; y2 += 20) { L1.push([cx(y2) - wv(y2), y2]); R1.push([cx(y2) + wv(y2), y2]); }
      const rp = poly([...L1, ...R1.reverse()]), [u, d] = lin([[0, mx(M.hz, '#FFFFFF', .3)], [.3, mx(M.mid, '#3A8AC8', .3)], [1, '#2A6AA0']], 0, gy - 40, 0, 1500);
      g += d + Pa(rp, mx('#5A4A2A', '#3A6A2A', .4), 'transform="translate(0 6) scale(1 1)" opacity=".5"') + Pa(rp, u);
      for (let k = 0; k < 26; k++) { const yy = gy + ((hash(k, seed + 9) * 900 + t * 30) % 900), w2 = wv(yy) * (.2 + .4 * hash(k, seed + 10)); g += Li(cx(yy) - w2 + (hash(k, 3) - .5) * wv(yy), yy, cx(yy) + (hash(k, 3) - .5) * wv(yy), yy, '#FFFFFF', 1.5 + yy / 500, op(.5 * Math.sin(t * 2 + k) ** 2)); }
      [[cx(gy + 200) - wv(gy + 200) - 20, gy + 200, .8], [cx(gy + 420) + wv(gy + 420) + 30, gy + 420, 1.1]].forEach(([rx, ry, s]) => g += reeds(t, rx, ry, s));
      return g;
    }
    // meadow
    const pts = ridgePts(seed + 3, gy - 70, 36, 300);
    g += hills(seed + 3, { pts, col: '#78AE56', fields: true, trees: 6, treeS: .4 });
    g += tree(t, 380, gy + 10, .75, { kind: 'olive' }) + tree(t, 1580, gy - 6, .6, { kind: 'round', col: '#3E7A3A' });
    g += ground(t, seed + 4, { y: gy, col: '#5E9E46', stones: 10, tufts: 34, flowers: o.flowers || ['#FFFFFF', '#FFD84A', '#FF6A6A'] });
    return g;
  }

  // =====================================================================================================
  // FOREGROUND FRAMING
  // =====================================================================================================
  function fore(t, o = {}) {
    const { y = 1200, bottom = 1800, x0 = -100, x1 = 2020, seed = 5, flowers = [], rocks = 2, wet = 0, reeds: rd = 0, density = 1 } = o;
    const cols = o.cols || ['#1E3A1C', '#3A6A2E', '#7AB04E'], edges = o.edges || [x0 + 360, x1 - 360];
    const pts = ridgePts(seed, y, 18, 220, x0, x1);
    const [u, d] = lin([[0, cols[1]], [.5, mx(cols[1], cols[0], .5)], [1, cols[0]]], 0, y, 0, bottom);
    let g = d + Pa(fill(pts, bottom), u) + (typeof o.under === 'function' ? o.under(pts) : o.under || '');
    const items = [], N = Math.round(110 * density);
    for (let k = 0; k < N; k++) { const gx = x0 + hash(k, seed + 1) * (x1 - x0), gy = yAt(pts, gx) + 10 + Math.pow(hash(k, seed + 2), .75) * (bottom - y); items.push([gy, flowers.length && k % 5 === 0 ? 'flower' : rd && k % 9 === 0 ? 'reeds' : 'tuft', gx, k]); }
    // tall framing clumps at the frame edges
    edges.forEach((ex, j) => { for (let k = 0; k < 5; k++) { const gx = ex + (j ? 1 : -1) * (k * 60 - 40) + (hash(k, seed + 9 + j) - .5) * 60, gy = lerp(y + 140, bottom - 60, k / 4 + hash(k, seed + 7) * .1); items.push([gy, 'edge', gx, k + j * 10]); } });
    const rk = (o.rockAt || []).slice(); for (let k = rk.length; k < rocks; k++) rk.push([lerp(edges[0], edges[1], hash(k, seed + 3)), y + 180 + hash(k, seed + 4) * (bottom - y - 300), 90 + 120 * hash(k, seed + 5)]);
    rk.forEach(([rx, ry, rw], k) => items.push([ry, 'rock', rx, k, rw]));
    items.sort((a, b) => a[0] - b[0]).forEach(([gy, kind, gx, k, rw]) => {
      const dd = clamp((gy - y) / (bottom - y)), sz = lerp(1.1, 3.4, dd), side = Math.min(Math.abs(gx - edges[0]), Math.abs(gx - edges[1]));
      const edgeK = clamp(1 - side / 260);
      if (kind === 'rock') { g += rock(gx, gy, rw, rw * .55, { col: o.rock || '#6E6A62', seed: seed + k * 7, wet, moss: o.moss || '#4A7A3A' }); return; }
      if (kind === 'edge') { g += tuft(t, gx, gy, sz * 1.25, { cols, n: 9, h: 2.4 + hash(k, seed) * .8, seed: seed * 13 + k }); return; }
      if (kind === 'reeds') { g += reeds(t, gx, gy, sz * .6, { col: cols[1] }); return; }
      if (kind === 'flower') { g += tuft(t, gx, gy, sz * .6, { cols, n: 4, seed: seed + k }) + flower(t, gx, gy, sz * .9, { col: flowers[k % flowers.length], kind: ['daisy', 'poppy', 'daisy', 'bell'][k % 4], h: 50 + 30 * hash(k, seed) }); return; }
      g += tuft(t, gx, gy, sz, { cols, n: 7, h: 1 + edgeK * 1.2, seed: seed * 7 + k });
      if (wet && k % 3 === 0) { const dx = gx + (hash(k, 4) - .5) * 30 * sz, dy = gy - (30 + 30 * hash(k, 5)) * sz, tw = .5 + .5 * Math.sin(t * 3.4 + k * 1.7); g += glow(dx, dy, 14 * sz, '#FFFFFF', .5 * tw * wet) + Ci(dx, dy, 2.6 * sz, '#FFFFFF', op((.55 + .45 * tw) * wet)); }
    });
    return g + (o.over || '');
  }
  function branch(t, x, y, s, o = {}) {
    const side = o.side === 'right' ? -1 : 1, col = o.col || '#2A3A1E', leaf = o.leaf || '#3E6A2E', len = (o.len || 520) * s, sw = Math.sin(t * .9) * 10 * s;
    const ex = x + side * len, ey = y + 40 * s + sw;
    let g = Pa(`M${f1(x)} ${f1(y - 16 * s)}Q${f1(x + side * len * .5)} ${f1(y - 50 * s)} ${f1(ex)} ${f1(ey)}Q${f1(x + side * len * .5)} ${f1(y - 30 * s)} ${f1(x)} ${f1(y + 16 * s)}Z`, col);
    for (let i = 0; i < 18; i++) {
      const u = .15 + i / 18 * .85, bx = lerp(x, ex, u), by = lerp(y, ey, u) - Math.sin(u * Math.PI) * 30 * s, a = (i % 2 ? -1 : 1) * (30 + 30 * hash(i, 3)) + (side < 0 ? 180 : 0) + Math.sin(t * 1.3 + i) * 4;
      g += Er(bx + Math.cos(a * Math.PI / 180) * 26 * s, by + Math.sin(a * Math.PI / 180) * 26 * s, 30 * s, 11 * s, a, i % 3 ? leaf : mx(leaf, '#C8E0A0', .3));
      if (o.blossom && i % 3 === 0) g += Ci(bx, by - 10 * s, 9 * s, o.blossom) + Ci(bx, by - 10 * s, 3.5 * s, '#FFE36B');
    }
    return g;
  }

  // =====================================================================================================
  // ANIMALS — local coordinates face right, feet at y = 0
  // =====================================================================================================
  const legG = (x, y0, len, w, c, hoof, ang, knee) => {
    let s = `<g transform="rotate(${f1(ang)} ${f1(x)} ${f1(y0)})"><path d="M${f1(x - w / 2)} ${f1(y0)}L${f1(x + w / 2)} ${f1(y0)}L${f1(x + w * .36)} ${f1(y0 + len)}L${f1(x - w * .36)} ${f1(y0 + len)}Z" fill="${c}" stroke="${c}" stroke-width="${f1(w * .3)}" stroke-linejoin="round"/>`;
    if (knee) s += Ci(x, y0 + len * .55, w * .62, c);
    if (hoof) s += `<rect x="${f1(x - w * .48)}" y="${f1(y0 + len - w * .5)}" width="${f1(w * .96)}" height="${f1(w * .58)}" rx="${f1(w * .2)}" fill="${hoof}"/>`;
    return s + '</g>';
  };
  const eye = (x, y, r, blink, ring) => blink ? Pa(`M${f1(x - r)} ${f1(y)}Q${f1(x)} ${f1(y + r * .5)} ${f1(x + r)} ${f1(y)}`, 'none', `stroke="#160F30" stroke-width="${f1(r * .5)}"`)
    : (ring ? Ci(x, y, r * 1.55, ring) : '') + Ci(x, y, r, '#160F30') + Ci(x - r * .32, y - r * .36, r * .36, '#FFFFFF');
  const rotG = (ang, px, py, inner) => `<g transform="rotate(${f1(ang)} ${f1(px)} ${f1(py)})">${inner}</g>`;
  function anim(t, o) {
    const ph0 = o.phase || 0, walk = o.walk || 0, w = walk ? 1 : 0, ph = walk + ph0;
    const sw = k => w * Math.sin(ph + k) * 19;
    const autoG = clamp((Math.sin(t * .42 + ph0 * 1.7) - .05) * 1.8);
    const graze = o.graze === 'auto' ? autoG : (o.graze || 0);
    const blink = ((t * .31 + hash(Math.floor(ph0 * 10), 9)) % 1) < .035;
    const tail = Math.sin(t * 2.4 + ph0) * 10 + (((t * .45 + ph0) % 1) < .14 ? Math.sin(t * 32) * 22 : 0);
    const ear = ((t * .37 + ph0 * .3) % 1) < .05 ? -14 : 0;
    const br = Math.sin(t * 2.2 + ph0) * .02, bob = -w * Math.abs(Math.sin(ph)) * 3;
    const look = o.look === 'up' ? -22 : o.look === 'down' ? 18 : 0;
    const hd = look + Math.sin(t * .8 + ph0) * 3 + (graze > .5 ? Math.sin(t * 9 + ph0) * 2.5 : 0) + w * Math.sin(ph * 2) * 3;
    const head = graze * 52 + hd;
    return { sw, graze, blink, tail, ear, br, bob, head, hd, gz: graze * 78, w, ph };
  }
  const bodyT = (a, cy) => `translate(0 ${f1(a.bob)}) translate(0 ${f1(cy)}) scale(${f1(1 - a.br * .4)} ${f1(1 + a.br)}) translate(0 ${f1(-cy)})`;
  const A = {};
  A.sheep = (t, o, a) => {
    const wool = o.col || '#F7F1E2', w2 = mx(wool, '#9A8A6A', .3), face = o.face2 || '#3A3030', hoof = '#1A1414';
    const far = mx(face, '#000000', .25);
    let g = legG(-34, -48, 48, 12, far, hoof, a.sw(0)) + legG(30, -48, 48, 12, far, hoof, a.sw(Math.PI));
    const P = [[-50, -70, 25], [-24, -84, 27], [6, -88, 27], [34, -80, 25], [52, -64, 22], [-56, -50, 22], [-28, -46, 24], [2, -44, 24], [30, -46, 24], [50, -50, 20], [-10, -66, 26], [22, -64, 26]];
    let b = Ci(-72, -68, 13, w2) + Ci(-74, -70, 11, wool);
    P.forEach(([x, y, r]) => b += Ci(x, y + 5, r, w2));
    P.forEach(([x, y, r]) => b += Ci(x, y, r, wool));
    P.forEach(([x, y, r], i) => { if (y < -60) b += Ci(x - 5, y - 8, r * .5, '#FFFFFF', 'opacity=".7"'); if (i % 2) b += Pa(`M${x - 8} ${y + 4}q8 -10 16 0`, 'none', `stroke="${w2}" stroke-width="3" opacity=".7"`); });
    g += `<g transform="${bodyT(a, -64)}">${b}</g>`;
    g += legG(-42, -46, 46, 13, face, hoof, a.sw(Math.PI)) + legG(38, -46, 46, 13, face, hoof, a.sw(0));
    const px = 50 + a.graze * 8, py = -80 + a.graze * 34;
    let h = Er(-2, -6, 15, 6, -25 + a.ear, far) + Er(22, 8, 25, 16, 30, face) + Ci(8, -9, 14, wool) + Ci(19, -13, 11, wool) + Ci(13, -18, 8, '#FFFFFF', 'opacity=".6"');
    h += Er(2, 4, 17, 6.5, 22 + a.ear, face) + Er(4, 4, 10, 3, 22 + a.ear, '#E8A0A0', 'opacity=".8"');
    h += eye(26, 2, 3.6, a.blink, '#F4EEDC') + Pa('M38 20q4 3 8 0', 'none', 'stroke="#8A7A70" stroke-width="2.5"');
    return g + rotG(a.head, px, py, `<g transform="translate(${f1(px)} ${f1(py)})">${h}</g>`);
  };
  A.goat = (t, o, a) => {
    const c = o.col || '#C88E5C', lt = mx(c, '#FFF2DC', .4), dk = mx(c, '#2A1408', .45), belly = mx(c, '#FFFFFF', .6), hoof = '#2A1E18';
    let g = legG(-40, -60, 60, 10, dk, hoof, a.sw(0)) + legG(34, -60, 60, 10, dk, hoof, a.sw(Math.PI));
    let b = rotG(a.tail * 1.4, -58, -96, Pa('M-56 -94L-70 -124L-48 -102Z', dk));
    b += E(0, -82, 60, 26, c) + Ci(40, -86, 25, c) + Ci(-44, -86, 23, c) + E(2, -66, 42, 9, belly, 'opacity=".85"') + E(-4, -100, 44, 7, lt, 'opacity=".55"');
    b += E(-20, -84, 18, 14, mx(c, '#FFFFFF', .7), 'opacity=".75"');
    g += `<g transform="${bodyT(a, -80)}">${b}</g>`;
    g += legG(-46, -58, 58, 11, c, hoof, a.sw(Math.PI)) + legG(40, -58, 58, 11, c, hoof, a.sw(0));
    const px = 60, py = -130, horn = o.female ? .65 : 1, neck = Pa('M26 -102L48 -138L68 -128L58 -86Z', c);
    let h = Pa(`M0 -12Q-8 ${-12 - 30 * horn} ${-28 * horn} ${-14 - 34 * horn}`, 'none', `stroke="#8A7A62" stroke-width="7"`) + Pa(`M8 -14Q2 ${-14 - 30 * horn} ${-18 * horn} ${-16 - 36 * horn}`, 'none', `stroke="#B4A488" stroke-width="7"`);
    h += Er(18, 4, 24, 12, 38, c) + Er(32, 18, 10, 9, 38, dk, 'opacity=".5"') + Ci(36, 22, 2.4, '#1A1414');
    h += Er(-4, 2, 16, 5.5, 18 + a.ear, lt);
    h += Pa('M26 22L22 42L34 24Z', dk);
    h += a.blink ? eye(13, -3, 4, true) : Ci(13, -3, 5, '#E8C050') + `<rect x="9.5" y="-4.3" width="7" height="2.6" rx="1.2" fill="#160F30"/>` + Ci(11.6, -5, 1.4, '#FFFFFF');
    return g + rotG(a.gz, 40, -96, neck + rotG(a.hd, px, py, `<g transform="translate(${f1(px)} ${f1(py)})">${h}</g>`));
  };
  const bovine = cow => (t, o, a) => {
    const c = o.col || (cow ? '#F4F0E8' : '#9A5E36'), lt = mx(c, '#FFF2DC', .35), dk = mx(c, '#1A0A04', .45), belly = cow ? '#E8E2D8' : mx(c, '#FFE0C0', .3), hoof = '#2A1E18', muz = cow ? '#F0B0A8' : '#E8C8B0';
    const far = cow ? '#C8C0B4' : mx(c, '#000000', .25);
    let g = legG(-66, -74, 74, 20, far, hoof, a.sw(0) * .7) + legG(56, -74, 74, 20, far, hoof, a.sw(Math.PI) * .7);
    const id = nid();
    let b = rotG(a.tail, -92, -150, Pa('M-92 -150Q-112 -112 -104 -78', 'none', `stroke="${c}" stroke-width="7"`) + Er(-104, -72, 8, 14, 10, dk));
    b += `<clipPath id="${id}"><rect x="-96" y="-170" width="192" height="102" rx="46"/></clipPath><rect x="-96" y="-170" width="192" height="102" rx="46" fill="${c}"/>`;
    b += `<g clip-path="url(#${id})">` + (cow ? [[-50, -140, 34, 24], [10, -110, 26, 30], [60, -150, 22, 16], [-80, -96, 22, 20]].map(([x, y, rx, ry]) => E(x, y, rx, ry, '#2E2A2A')).join('') : '') + E(0, -74, 96, 14, dk, 'opacity=".3"') + E(-10, -164, 80, 10, lt, 'opacity=".5"') + '</g>';
    if (!cow && !o.female) b += Ci(56, -158, 26, c) + E(52, -176, 16, 5, lt, 'opacity=".5"');
    if (cow || o.female) b += E(-24, -70, 18, 10, muz);
    b += Pa('M72 -96Q90 -60 66 -70Z', c);
    g += `<g transform="${bodyT(a, -120)}">${b}</g>`;
    g += legG(-76, -72, 72, 21, c, hoof, a.sw(Math.PI) * .7) + legG(64, -72, 72, 21, c, hoof, a.sw(0) * .7);
    const px = 102, py = -138, hornK = cow || o.female ? .6 : 1, neck = Pa('M58 -164L104 -150L112 -100L66 -86Z', c);
    let h = Er(-4, -16, 17, 7, -18 + a.ear, far);
    h += Pa(`M10 -24Q${f1(2 - 4 * hornK)} ${f1(-30 - 14 * hornK)} ${f1(12 + 8 * hornK)} ${f1(-32 - 16 * hornK)}`, 'none', `stroke="#D8CCB0" stroke-width="${f1(8 * hornK + 3)}"`) + Pa(`M22 -24Q${f1(30 + 6 * hornK)} ${f1(-28 - 12 * hornK)} ${f1(36 + 12 * hornK)} ${f1(-26 - 16 * hornK)}`, 'none', `stroke="#F4EAD4" stroke-width="${f1(8 * hornK + 3)}"`);
    h += Er(22, 4, 36, 23, 58, c) + (cow ? Er(14, -14, 10, 16, 50, '#2E2A2A') : Er(14, -14, 9, 14, 50, lt, 'opacity=".6"'));
    h += Er(42, 30, 21, 15, 22, muz) + Ci(46, 32, 2.6, '#5A2A2A') + Ci(36, 34, 2.4, '#5A2A2A');
    h += Er(4, -10, 19, 7.5, 16 + a.ear, c) + Er(6, -10, 11, 3.5, 16 + a.ear, '#E8A8A0', 'opacity=".8"');
    h += eye(20, -2, 4.4, a.blink);
    return g + `<g transform="${bodyT(a, -120)}">` + rotG(a.gz, 70, -130, neck + rotG(a.hd, px, py, `<g transform="translate(${f1(px)} ${f1(py)})">${h}</g>`)) + '</g>';
  };
  A.ox = bovine(false); A.cow = bovine(true);
  A.donkey = (t, o, a) => {
    const c = o.col || '#8F8A92', lt = mx(c, '#FFFFFF', .3), dk = mx(c, '#000000', .3), belly = '#E8E4E0', mane = '#3A3438', hoof = '#2A2428';
    let g = legG(-52, -80, 80, 14, dk, hoof, a.sw(0)) + legG(46, -80, 80, 14, dk, hoof, a.sw(Math.PI));
    let b = rotG(a.tail, -70, -118, Li(-70, -118, -84, -64, c, 5) + Er(-84, -60, 6, 14, 10, mane));
    b += E(0, -110, 76, 35, c) + E(4, -86, 54, 12, belly) + E(-6, -136, 56, 8, lt, 'opacity=".5"');
    b += Li(34, -142, 30, -100, mane, 4, 'opacity=".35"') + Li(-60, -140, 40, -142, mane, 4, 'opacity=".35"');
    g += `<g transform="${bodyT(a, -110)}">${b}</g>`;
    g += legG(-60, -78, 78, 15, c, hoof, a.sw(Math.PI)) + legG(54, -78, 78, 15, c, hoof, a.sw(0));
    const px = 86, py = -170, neck = Pa('M40 -128L70 -180L98 -166L76 -98Z', c) + Pa('M44 -134L74 -186', 'none', `stroke="${mane}" stroke-width="11"`);
    let h = Er(-6, -36, 8, 32, -30 + a.ear, dk) + Er(-6, -62, 6, 8, -30 + a.ear, mane);
    h += Er(22, 16, 36, 17, 54, c) + Er(38, 42, 17, 15, 50, belly) + Ci(44, 46, 2.4, '#3A2A2A');
    h += Er(6, -36, 9, 33, -12 + a.ear, c) + Er(6, -34, 5, 22, -12 + a.ear, belly, 'opacity=".8"') + Er(1, -64, 6, 8, -12 + a.ear, mane);
    h += eye(18, 4, 4.4, a.blink, belly);
    return g + rotG(a.gz, 52, -118, neck + rotG(a.hd, px, py, `<g transform="translate(${f1(px)} ${f1(py)})">${h}</g>`));
  };
  A.camel = (t, o, a) => {
    const c = o.col || '#C99A5E', lt = mx(c, '#FFF2D0', .4), dk = mx(c, '#3A1E08', .4), pad = '#7A5A3A';
    let g = legG(-50, -146, 146, 16, dk, pad, a.sw(0) * .8, true) + legG(54, -146, 146, 16, dk, pad, a.sw(Math.PI) * .8, true);
    let b = rotG(a.tail, -76, -170, Li(-76, -170, -86, -118, dk, 5) + Er(-86, -114, 5, 10, 0, '#4A3420'));
    b += E(0, -166, 80, 34, c) + Pa('M-58 -184Q-44 -266 4 -266Q48 -262 54 -180Z', c) + E(-10, -244, 26, 10, lt, 'opacity=".55"') + E(0, -140, 60, 9, dk, 'opacity=".3"');
    b += Pa('M56 -182Q110 -172 114 -212Q116 -242 132 -256', 'none', `stroke="${c}" stroke-width="34"`) + Pa('M66 -164Q120 -160 124 -206', 'none', `stroke="${dk}" stroke-width="6" opacity=".3"`);
    g += `<g transform="${bodyT(a, -170)}">${b}</g>`;
    g += legG(-58, -144, 144, 17, c, pad, a.sw(Math.PI) * .8, true) + legG(62, -144, 144, 17, c, pad, a.sw(0) * .8, true);
    const px = 132, py = -258;
    let h = Er(-6, -12, 7, 5, -20 + a.ear, dk) + Er(18, 2, 30, 15, 10, c) + Er(44, 10, 12, 9, 10, lt) + Pa('M42 18q6 4 12 0', 'none', `stroke="${dk}" stroke-width="2.4"`) + Ci(50, 4, 2, '#3A2A1A');
    h += eye(12, -3, 3.8, a.blink) + (a.blink ? '' : Pa('M6 -8Q12 -12 18 -8', 'none', `stroke="${dk}" stroke-width="3"`));
    return g + rotG(a.head * .5 + a.w * Math.sin(a.ph) * 5, px, py, `<g transform="translate(${px} ${py})">${h}</g>`);
  };
  A.lion = (t, o, a) => {
    const c = o.col || '#E2A24C', lt = mx(c, '#FFF2D0', .4), dk = mx(c, '#3A1A04', .35), m1 = '#B4581E', m2 = '#8A3E14', muz = '#F6E2C0';
    let g = legG(-54, -66, 66, 20, dk, null, a.sw(0)) + legG(46, -66, 66, 20, dk, null, a.sw(Math.PI)) + E(-54 + a.sw(0) * -.6, -4, 13, 7, dk) + E(46 + a.sw(Math.PI) * -.6, -4, 13, 7, dk);
    let b = rotG(a.tail * 1.5, -74, -98, Pa('M-74 -98Q-118 -96 -126 -132', 'none', `stroke="${c}" stroke-width="8"`) + Ci(-126, -136, 9, m2));
    b += E(0, -92, 76, 30, c) + E(0, -70, 56, 9, lt, 'opacity=".7"') + E(-6, -116, 56, 7, lt, 'opacity=".45"');
    g += `<g transform="${bodyT(a, -90)}">${b}</g>`;
    g += legG(-62, -64, 64, 21, c, null, a.sw(Math.PI)) + legG(54, -64, 64, 21, c, null, a.sw(0)) + E(-58 + a.sw(Math.PI) * -.6, -5, 14, 8, lt) + E(60 + a.sw(0) * -.6, -5, 14, 8, lt);
    const px = 66, py = -112, maneOn = o.mane !== false && !o.female;
    let h = '';
    if (maneOn) { for (let k = 0; k < 14; k++) { const an = k / 14 * Math.PI * 2 + Math.sin(t * 1.3 + k) * .03; h += Er(8 + Math.cos(an) * 36, -4 + Math.sin(an) * 36, 24, 14, an * 57.3, k % 2 ? m1 : m2); } h += Ci(8, -4, 42, m1); }
    h += Ci(-2, -30, 10, c) + Ci(30, -30, 10, c) + Ci(-2, -30, 5, dk) + Ci(30, -30, 5, dk);
    h += Ci(14, -2, 31, c) + Er(20, 14, 19, 13, 0, muz) + Pa('M14 4L26 4L20 12Z', '#4A2A1A') + Pa('M20 12L20 18M20 18Q14 22 10 18M20 18Q26 22 30 18', 'none', 'stroke="#4A2A1A" stroke-width="2.2"');
    h += eye(6, -10, 4.2, a.blink) + eye(30, -10, 4.2, a.blink);
    return g + rotG(a.head * .4, px, py, `<g transform="translate(${px} ${py})">${h}</g>`);
  };
  A.deer = (t, o, a) => {
    const c = o.col || '#B97A40', lt = mx(c, '#FFF2D0', .4), dk = mx(c, '#2A1404', .45), belly = '#F4E6D0', hoof = '#2A1E18';
    let g = legG(-42, -100, 100, 9, dk, hoof, a.sw(0)) + legG(36, -100, 100, 9, dk, hoof, a.sw(Math.PI));
    let b = rotG(a.tail, -58, -124, Er(-62, -122, 7, 12, 30, dk) + Er(-60, -120, 4, 9, 30, belly));
    b += E(0, -116, 60, 24, c) + E(-50, -116, 13, 17, belly) + E(4, -98, 42, 8, belly) + E(-4, -134, 44, 6, lt, 'opacity=".5"');
    if (o.spots) for (let k = 0; k < 9; k++) b += Ci(-34 + k * 8, -126 - (k % 2) * 6, 3, '#FFF6E8');
    g += `<g transform="${bodyT(a, -116)}">${b}</g>`;
    g += legG(-48, -98, 98, 10, c, hoof, a.sw(Math.PI)) + legG(42, -98, 98, 10, c, hoof, a.sw(0));
    const px = 66, py = -168, neck = Pa('M32 -126L56 -174L74 -164L56 -110Z', c);
    let h = '';
    if (o.antlers !== false && !o.female) { const ant = '#E8D8B8'; h += Pa('M0 -14Q-10 -52 6 -84M-4 -42L-20 -58M2 -66L-12 -84M4 -60L16 -74', 'none', `stroke="${mx(ant, '#8A7A5A', .3)}" stroke-width="5"`) + Pa('M10 -14Q4 -52 22 -82M6 -40L-6 -58M16 -64L6 -82M18 -58L32 -70', 'none', `stroke="${ant}" stroke-width="5.5"`); }
    h += Er(-6, -14, 18, 8, -40 + a.ear, dk) + Er(18, 6, 23, 12, 30, c) + Ci(36, 16, 4.6, '#1A1414') + Er(4, -12, 18, 8.5, -28 + a.ear, c) + Er(6, -12, 11, 4, -28 + a.ear, belly, 'opacity=".8"');
    h += eye(14, 0, 4.8, a.blink);
    return g + rotG(a.gz * 1.1, 42, -120, neck + rotG(a.hd, px, py, `<g transform="translate(${f1(px)} ${f1(py)})">${h}</g>`));
  };
  const leafSvg = (x, y) => Pa(`M${x} ${y}L${x + 18} ${y + 8}`, 'none', 'stroke="#5A7A3A" stroke-width="2.5"') + Er(x + 14, y + 10, 10, 4, 30, '#6AA84A') + Er(x + 20, y + 2, 9, 3.6, -20, '#8AC060');
  // a spread wing from the shoulder; f = 1 fully up, -1 down; len = span. Scalloped trailing edge (feather tips).
  const wingP = (f, len) => { const k = len / 66, Y = v => f1(v * f * k), X = v => f1(v * k);
    return `M${X(12)} -3C${X(6)} ${Y(-34)} ${X(-10)} ${Y(-58)} ${X(-30)} ${Y(-68)}L${X(-38)} ${Y(-60)}L${X(-28)} ${Y(-54)}L${X(-36)} ${Y(-46)}L${X(-24)} ${Y(-40)}L${X(-30)} ${Y(-30)}L${X(-16)} ${Y(-26)}L${X(-18)} ${Y(-14)}L${X(-6)} ${Y(-10)}L-6 0Z`; };
  A.dove = (t, o, a) => {
    const c = o.col || '#FFFFFF', sh = mx(c, '#4A5A7A', .45), wg = mx(c, '#B4C2D8', .4);
    if (o.fly) {
      const f = Math.sin(t * 13 + (o.phase || 0));
      let g = Pa(wingP(f * .8, 56), sh) + Pa('M-20 0L-46 -12L-50 -2L-46 10Z', wg, `stroke="${sh}" stroke-width="1.5"`) + E(0, 0, 25, 11, c) + E(-2, 5, 18, 4.5, sh, 'opacity=".5"') + Ci(22, -6, 9.5, c) + Pa('M30 -7L38 -4L30 -2Z', '#E8A87A') + eye(24, -8, 2.2, false);
      if (o.leaf) g += leafSvg(34, -4);
      return g + Pa(wingP(f, 66), wg, `stroke="${sh}" stroke-width="2"`) + Pa(`M4 -4L${f1(-14)} ${f1(-30 * f)}M0 -3L${f1(-24)} ${f1(-44 * f)}`, 'none', `stroke="${sh}" stroke-width="1.5" opacity=".5"`);
    }
    let g = Li(-3, 0, -2, -10, '#E87A8A', 3) + Li(6, 0, 5, -10, '#E87A8A', 3);
    g += Pa('M-18 -20L-44 -14L-42 -26Z', wg) + Er(0, -22, 24, 15, -10, c) + Er(-6, -22, 17, 9, -14, wg) + Pa('M-16 -22l14 -2M-14 -18l14 -1', 'none', `stroke="${sh}" stroke-width="1.5" opacity=".6"`);
    const hy = a.graze * 10;
    g += rotG(a.head * .5, 14, -30, Ci(18, -34 + hy, 10, c) + Pa(`M26 ${-36 + hy}L34 ${-33 + hy}L26 ${-30 + hy}Z`, '#E8A87A') + eye(20, -37 + hy, 2.4, a.blink) + (o.leaf ? leafSvg(30, -33 + hy) : ''));
    return g;
  };
  A.bird = (t, o, a) => {
    const c = o.col || '#E0743A', back = o.col2 || '#6A5A4A';
    if (o.fly) { const f = Math.sin(t * 16 + (o.phase || 0)); return Pa(wingP(f * .8, 28), mx(back, '#000000', .2)) + E(0, 0, 14, 7, back) + E(2, 3, 9, 4, c) + Ci(13, -4, 6, back) + Pa('M18 -5L24 -3L18 -1Z', '#E8B060') + eye(15, -5, 1.6, false) + Pa(wingP(f, 32), back); }
    const hop = Math.max(0, Math.sin(t * 5 + (o.phase || 0))) * 6 * (o.hop ? 1 : 0), peck = a.graze > .5 ? 10 : 0;
    return Li(-2, 0, -2, -8, '#5A3A2A', 2) + Li(3, 0, 3, -8, '#5A3A2A', 2) + `<g transform="translate(0 ${f1(-hop)})">` + Pa('M-10 -14L-26 -10L-24 -18Z', back) + Ci(0, -15, 11, back) + E(3, -12, 8, 7, c) + rotG(peck * 3, 8, -20, Ci(9, -23, 7, back) + Pa('M15 -24L22 -22L15 -20Z', '#E8B060') + eye(11, -25, 1.8, a.blink)) + '</g>';
  };
  const SHADOW = { sheep: 70, goat: 64, ox: 112, cow: 112, donkey: 84, camel: 92, lion: 92, deer: 66, dove: 22, bird: 14 };
  function animal(t, kind, x, y, s, o = {}) {
    const fn = A[kind]; if (!fn) throw new Error('SC.animal: unknown kind ' + kind);
    const face = o.face || (o.flip ? -1 : 1), a = anim(t, o), flt = o.flat ? '' : 'scHt';
    let g = (flt ? FILTERS : '');
    if (!o.fly && o.shadow !== false) { const r = SHADOW[kind] * (1 + .05 * Math.sin(a.ph)), [u, d] = rad([[0, '#080308', .45], [.6, '#080308', .2], [1, '#080308', 0]], 0, 0, r); g += d + `<ellipse cx="0" cy="2" rx="${f1(r)}" ry="${f1(r * .2)}" fill="${u}"/>`; }
    const body = fn(t, o, a);
    g += flt ? `<g filter="url(#${flt})">${body}</g>` : body;
    return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s * face)} ${f1(s)})"${o.op != null ? ` opacity="${clamp(o.op).toFixed(2)}"` : ''}>${g}</g>`;
  }
  // A pair walking together: the partner a little behind (up the slope, smaller) and offset back along the walk.
  function pair(t, kind, x, y, s, o = {}) {
    const face = o.face || 1, gap = o.gap ?? 70, dy = o.dy ?? -18;
    const B = Object.assign({}, o, { female: true, phase: (o.phase || 0) + 1.7, walk: o.walk ? o.walk + 1.9 : 0, col: o.col2 || o.col, antlers: false, mane: false });
    return animal(t, kind, x - face * gap * s, y + dy * s, s * (o.k2 ?? .93), B) + animal(t, kind, x, y, s, o);
  }

  window.SC = {
    MOODS, mood, mx, vn, fbm, lin, rad, poly,
    sky, sun, godRays, clouds, cloud, birds, rainbow, light, haze, vig,
    profile, yAt, fill, ridgePts, range, hills, ground, rock, puddle, tuft, flower, reeds, tree, house,
    env, fore, branch, animal, pair, A, FILTERS,
  };
})();
