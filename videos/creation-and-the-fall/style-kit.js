// Helpers for clips 4-6: paper collage, halftone, grain, markers, chubby glowing characters, flames.
// Everything stays a pure function of time, like shared.js.
(function () {
  const { G, R, C, E, L, P, T, prog, ease, lerp, rng } = K;

  const ctx = document.createElement('canvas').getContext('2d');
  const tw = (s, size, font = 'Georgia', weight = 400, style = 'normal') => {
    ctx.font = `${style} ${weight} ${size}px "${font}"`;
    return ctx.measureText(s).width;
  };
  const hash = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  let uid = 0;
  const nid = () => 'u' + (uid++);

  // Stop-motion wobble around a point, held for 1/fps of a second.
  const jit = (t, id, cx, cy, amp = 3, fps = 8) => {
    const f = Math.floor(t * fps);
    const dx = (hash(f, id) - .5) * 2 * amp, dy = (hash(f, id + 9) - .5) * 2 * amp, r = (hash(f, id + 17) - .5) * amp * .5;
    return `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${r.toFixed(2)} ${cx} ${cy})`;
  };
  // A piece that slaps onto the page in a few held frames, then wobbles.
  const piece = (t, a, cx, cy, inner, id = 1, amp = 2.4) => {
    if (t < a) return '';
    const p = prog(t, a, a + .17), s = p >= 1 ? 1 : 1.22 - Math.floor(p * 3) * .07;
    return `<g transform="${jit(t, id, cx, cy, amp)} translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})">${inner}</g>`;
  };

  const glow = (x, y, r, c, o = 1) => {
    const id = nid();
    return `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset=".45" stop-color="${c}" stop-opacity="${o * .36}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})"/>`;
  };
  const vgrad = (stops) => {
    const id = nid();
    return [id, `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`];
  };

  // Ragged rectangle outline for torn paper.
  const torn = (x, y, w, h, seed, ax = 10, ay = 4, step = 16) => {
    const r = rng(seed * 4813 + 17), j = a => (r() - .5) * 2 * a, pts = [];
    for (let i = 0; i <= w; i += step) pts.push([x + i, y + j(ay)]);
    for (let i = step; i < h; i += step) pts.push([x + w + j(ax), y + i]);
    for (let i = w; i >= 0; i -= step) pts.push([x + i, y + h + j(ay)]);
    for (let i = h - step; i > 0; i -= step) pts.push([x + j(ax), y + i]);
    return 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
  };
  // Paper-cut landscape layer: a noisy ridge across the frame, filled to the bottom.
  const ridge = (seed, base, amp, wave, x0 = -120, x1 = 2040, bottom = 1200) => {
    const r = rng(seed * 2311 + 5), ph = r() * 6, pts = [];
    for (let x = x0; x <= x1; x += 13) pts.push([x, base + Math.sin(x / wave + ph) * amp + Math.sin(x / (wave * .37) + ph * 2) * amp * .3 + (r() - .5) * 5]);
    return 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + `L${x1} ${bottom}L${x0} ${bottom}Z`;
  };
  const strip = (x, y, w, h, seed, fill = '#F4ECD8', o = {}) => {
    const { ax = 12, ay = 4, shadow = true, edge = '#FFFFFF' } = o;
    return (shadow ? `<path d="${torn(x + 6, y + 8, w, h, seed, ax, ay)}" fill="#000" opacity=".42" filter="url(#sd)"/>` : '') +
      `<path d="${torn(x - 5, y - 5, w + 10, h + 10, seed + 3, ax, ay + 2)}" fill="${edge}"/>` +
      `<path d="${torn(x, y, w, h, seed, ax, ay)}" fill="${fill}"/>`;
  };
  const tape = (cx, cy, w, rot, c = '#EFE0A8') => {
    const h = 44;
    let d = `M${-w / 2} ${-h / 2}H${w / 2}`;
    for (let i = 0; i < 6; i++) d += `L${w / 2 + (i % 2 ? 0 : 7)} ${-h / 2 + (i + 1) * h / 6}`;
    d += `H${-w / 2}`;
    for (let i = 5; i >= 0; i--) d += `L${-w / 2 - (i % 2 ? 0 : 7)} ${-h / 2 + i * h / 6}`;
    return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><path d="${d}Z" fill="${c}" opacity=".78"/></g>`;
  };
  // Black label box with bold white sans. Returns the markup; width comes from labelW.
  const LF = 'Segoe UI Black';
  const labelW = (s, size) => tw(s, size, LF, 900) + size * 1.1;
  const label = (x, y, s, o = {}) => {
    const { size = 30, bg = '#101014', fill = '#fff', rot = 0, anchor = 'start' } = o;
    const w = labelW(s, size), h = size * 1.62, x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    return `<g transform="rotate(${rot} ${x} ${y})">${R(x0, y, w.toFixed(1), h, 2, bg)}${T(x0 + size * .55, y + size * 1.18, s, { size, fill, font: LF, weight: 900 })}</g>`;
  };
  const mark = (d, p, c = '#E5352B', w = 8, extra = {}) => p <= 0 ? '' : P(d, 'none', Object.assign({ stroke: c, 'stroke-width': w, pathLength: 1, 'stroke-dasharray': `${Math.min(p, 1).toFixed(4)} 1.3` }, extra));
  const scribble = (cx, cy, rx, ry, seed) => {
    const r = rng(seed * 991 + 3), n = 46, a0 = -2.4;
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = a0 + i / n * Math.PI * 2 * 1.13, k = 1 + (i / n) * .09 + (r() - .5) * .022;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rx * k).toFixed(1) + ' ' + (cy + Math.sin(a) * ry * k).toFixed(1);
    }
    return d;
  };
  const arrow = (x1, y1, cx, cy, x2, y2, p, c = '#E5352B', w = 8) => {
    if (p <= 0) return '';
    let out = mark(`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`, p / .85, c, w);
    if (p > .85) {
      const a = Math.atan2(y2 - cy, x2 - cx), s = 38 * prog(p, .85, 1);
      out += P(`M${x2 - Math.cos(a - .5) * s} ${y2 - Math.sin(a - .5) * s} L${x2} ${y2} L${x2 - Math.cos(a + .5) * s} ${y2 - Math.sin(a + .5) * s}`, 'none', { stroke: c, 'stroke-width': w });
    }
    return out;
  };
  // Highlighter stroke sweeping left to right behind/over real text.
  const highlight = (x, y, w, h, p, c = '#FFE100', o = {}) => {
    if (p <= 0) return '';
    const W = w * p, sl = 7;
    return `<path d="M${x - 6} ${y + 3} L${x + W} ${y} L${x + W + sl} ${y + h * .5} L${x + W - 2} ${y + h} L${x - 3} ${y + h + 3} L${x - 9} ${y + h * .55}Z" fill="${c}" style="mix-blend-mode:${o.blend || 'multiply'}" opacity="${o.op || .96}"/>`;
  };

  // True halftone: luminance is thresholded against a tiled dot screen, then multiplied onto the colour.
  const dotTile = (() => {
    const T = 11, d = T / 2;
    const c = (x, y) => `<circle cx='${x}' cy='${y}' r='${d}' fill='url(#d)'/>`;
    const s = `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'><defs><radialGradient id='d'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#fff'/></radialGradient></defs><rect width='${T}' height='${T}' fill='#fff'/>${c(d, d)}${c(0, 0)}${c(T, 0)}${c(0, T)}${c(T, T)}</svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(s);
  })();
  const REGION = 'filterUnits="userSpaceOnUse" x="-620" y="-940" width="1240" height="1240" color-interpolation-filters="sRGB"';
  const stickerNodes = (input, r = 7) =>
    `<feMorphology in="SourceAlpha" operator="dilate" radius="${r}" result="fat"/>
     <feGaussianBlur in="fat" stdDeviation=".7" result="fats"/>
     <feFlood flood-color="#fff" result="wh"/><feComposite in="wh" in2="fats" operator="in" result="white"/>
     <feGaussianBlur in="fat" stdDeviation="8" result="b"/><feOffset in="b" dx="7" dy="11" result="o"/>
     <feFlood flood-color="#000" flood-opacity=".5" result="sc"/><feComposite in="sc" in2="o" operator="in" result="shadow"/>
     <feMerge><feMergeNode in="shadow"/><feMergeNode in="white"/><feMergeNode in="${input}"/></feMerge>`;
  const halftone = (id, lift, r = 7) => `<filter id="${id}" ${REGION}>
     <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="g0"/>
     <feComponentTransfer in="g0" result="g"><feFuncR type="linear" slope="1" intercept="${lift}"/><feFuncG type="linear" slope="1" intercept="${lift}"/><feFuncB type="linear" slope="1" intercept="${lift}"/></feComponentTransfer>
     <feImage href="${dotTile}" x="0" y="0" width="11" height="11" result="t0"/>
     <feTile in="t0" result="tile"/>
     <feComposite in="g" in2="tile" operator="arithmetic" k1="0" k2=".5" k3=".5" k4="0" result="sum"/>
     <feComponentTransfer in="sum" result="bw"><feFuncR type="linear" slope="9" intercept="-4"/><feFuncG type="linear" slope="9" intercept="-4"/><feFuncB type="linear" slope="9" intercept="-4"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
     <feComponentTransfer in="SourceGraphic" result="bright"><feFuncR type="linear" slope="1.28"/><feFuncG type="linear" slope="1.28"/><feFuncB type="linear" slope="1.28"/></feComponentTransfer>
     <feBlend in="bw" in2="bright" mode="multiply" result="m"/>
     <feComposite in="m" in2="SourceAlpha" operator="in" result="ink"/>
     ${stickerNodes('ink', r)}</filter>`;

  const paperDefs = t => `<defs>
    <filter id="sd" x="-20%" y="-30%" width="140%" height="170%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="tex" filterUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".62 .48" numOctaves="4" seed="11"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .9 .9 .9 0 -.98"/>
    </filter>
    <filter id="texL" filterUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".05 .62" numOctaves="4" seed="23"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.2 1.2 0 0 -1.12"/>
    </filter>
    <filter id="blot" filterUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".006 .009" numOctaves="3" seed="4"/>
      <feColorMatrix values="0 0 0 0 .35  0 0 0 0 .24  0 0 0 0 .12  1.5 0 0 0 -.62"/>
    </filter>
    <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="1920" height="1080" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".88" numOctaves="2" seed="${Math.floor(t * 12) * 3 + 2}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncR type="linear" slope="2.6" intercept="-.8"/><feFuncG type="linear" slope="2.6" intercept="-.8"/><feFuncB type="linear" slope="2.6" intercept="-.8"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
    </filter>
    ${halftone('ht', .02)}
    ${halftone('htSoft', .3, 6)}
    <filter id="sticker" ${REGION}>${stickerNodes('SourceGraphic', 6)}</filter>
  </defs>`;
  const paperOver = (o = {}) => {
    const { tex = .55, grain = .3, blot = .22, texL = 0 } = o;
    return `<rect width="1920" height="1080" filter="url(#blot)" opacity="${blot}" style="mix-blend-mode:multiply"/>` +
      `<rect width="1920" height="1080" filter="url(#tex)" opacity="${tex}" style="mix-blend-mode:multiply"/>` +
      (texL ? `<rect width="1920" height="1080" filter="url(#texL)" opacity="${texL}" style="mix-blend-mode:screen"/>` : '') +
      `<rect width="1920" height="1080" filter="url(#grain)" opacity="${grain}" style="mix-blend-mode:overlay"/>`;
  };
  const vignette = (o = .6) => {
    const id = nid();
    return `<radialGradient id="${id}" cx="50%" cy="48%" r="72%"><stop offset=".52" stop-color="#02021A" stop-opacity="0"/><stop offset="1" stop-color="#02021A" stop-opacity="${o}"/></radialGradient><rect width="1920" height="1080" fill="url(#${id})"/>`;
  };

  // Round, simple glowing figure. Feet at y=0, about 215 tall, facing right before flipping.
  const chubby = (x, y, s, o = {}) => {
    const { f = false, walk = 0, flip = 1, reach = 0, lean = 0, skin = '#F5BE8E', shade = '#C4835E', tunic = '#3DE0B8', tunic2 = '#1787A8', hair = '#2E1C52', eye = '#160F30', aura = null, auraOp = .5, filter = '' } = o;
    const sw = Math.sin(walk) * 15, bob = Math.abs(Math.sin(walk)) * 5;
    const a = nid(), b = nid();
    let g = `<linearGradient id="${a}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tunic}"/><stop offset="1" stop-color="${tunic2}"/></linearGradient>` +
      `<linearGradient id="${b}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${skin}"/><stop offset="1" stop-color="${shade}"/></linearGradient>`;
    g += R(-30 - sw, -34, 27, 38, 13, shade) + R(4 + sw, -34, 27, 38, 13, shade);
    if (f) g += P('M-58 -168 C-74 -120 -72 -70 -46 -62 C-20 -58 -6 -90 -8 -150Z', hair);
    g += L(-38, -104, -46 - sw * .5, -52, shade, 21);
    g += R(-48, f ? -132 : -130, 96, f ? 114 : 108, 42, `url(#${a})`);
    g += P(`M-44 ${f ? -46 : -48} Q0 ${f ? -28 : -30} 44 ${f ? -46 : -48}`, 'none', { stroke: tunic2, 'stroke-width': 7, opacity: .55 });
    const hx = lerp(52 + sw * .5, 116, reach), hy = lerp(-54, -172, reach);
    g += `<g transform="rotate(${lean} 0 -90)">` + C(0, -165, 56, `url(#${b})`);
    if (f) g += P('M-58 -168 C-66 -252 66 -256 60 -172 C34 -196 -20 -198 -58 -168Z', hair) + C(40, -214, 11, '#FFD36B') + C(40, -214, 5, '#FF7A5C');
    else g += P('M-58 -172 C-66 -252 66 -256 60 -174 C28 -194 -24 -194 -58 -172Z', hair) + P('M-44 -136 C-34 -102 34 -96 56 -142 C40 -128 28 -130 8 -132 C-12 -132 -30 -130 -44 -136Z', hair);
    g += C(18, -165, 5.6, eye) + C(42, -165, 5.6, eye);
    if (f) g += P('M23 -141 Q30 -135 37 -141', 'none', { stroke: eye, 'stroke-width': 3.6 });
    g += `</g>` + L(38, -104, hx, hy, skin, 21) + C(hx, hy, 13, skin);
    g = filter ? `<g filter="url(#${filter})">${g}</g>` : g;
    const halo = aura ? glow(0, -110, 210, aura, auraOp) : '';
    return `<g transform="translate(${x} ${y - bob}) scale(${s * flip} ${s})">${halo}${g}</g>`;
  };

  const pathCache = {};
  const pathInfo = d => {
    if (!pathCache[d]) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d);
      pathCache[d] = { el, len: el.getTotalLength() };
    }
    return pathCache[d];
  };
  // Point and heading at a fraction along a path.
  const along = (d, p) => {
    const { el, len } = pathInfo(d), a = el.getPointAtLength(len * p), b = el.getPointAtLength(Math.max(0, len * p - 3));
    return { x: a.x, y: a.y, ang: Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI, len };
  };

  // Blade upward from the origin, flames licking off it.
  const sword = (t, H, o = {}) => {
    const { outer = '#FF4A1C', mid = '#FFB32E', core = '#FFF3C4', blade = '#FFFDF0', hilt = '#E0A93F', n = 13 } = o;
    let g = '';
    [[outer, 1], [mid, .64], [core, .34]].forEach(([c, k], l) => {
      for (let i = 0; i < n; i++) {
        const y = -H * .98 + i / (n - 1) * H * .94, sway = Math.sin(t * 12 + i * 1.7 + l) * 20 * k;
        const w = (50 + 10 * Math.sin(t * 9 + i)) * k, len = (150 + 34 * Math.sin(t * 11 + i * 2.1)) * k;
        g += P(`M${-w} ${y} Q${-w * 1.3 + sway} ${y - len * .5} ${sway * 1.5} ${y - len} Q${w * 1.3 + sway} ${y - len * .5} ${w} ${y} Q0 ${y + w * .8} ${-w} ${y}Z`, c, { opacity: .95 });
      }
    });
    g += P(`M-12 6 L-12 ${-H + 34} L0 ${-H} L12 ${-H + 34} L12 6Z`, blade) + R(-66, 2, 132, 20, 10, hilt) + R(-11, 20, 22, 84, 9, '#7A5230') + C(0, 112, 16, hilt);
    return g;
  };
  // A fan of feathers of light reaching toward +x. Mirror it for the other side.
  const wing = (o, c, k = 1) => [0, 1, 2, 3, 4].map(i => `<g transform="rotate(${-46 + i * 23})"><path d="M0 ${-16 * k} Q${150 * k} ${-72 * k} ${(340 - i * 18) * k} ${-8 * k} Q${172 * k} ${36 * k} 0 ${16 * k}Z" fill="${c}" opacity="${(o * (.86 - i * .11)).toFixed(3)}"/></g>`).join('');

  // A tapered serpent built from overlapping discs, so the tail narrows and the head leads.
  const snake = (d, p, t, o = {}) => {
    if (p <= 0) return '';
    const { w = 19, edge = '#5A0F66', body = '#E04BD8', hi = '#FFD4FA', spot = '#FFE05C', eye = '#180A2C', tongue = '#FFE05C', head = 1.25, N = 220 } = o;
    let a = '', b = '', c = '', s = '';
    for (let i = 0; i <= N; i++) {
      const q = i / N * p, pt = along(d, Math.max(.001, q)), rr = w * (.2 + .8 * Math.min(1, i / (N * .4)));
      a += C(pt.x.toFixed(1), pt.y.toFixed(1), (rr + 6).toFixed(1), edge);
      b += C(pt.x.toFixed(1), pt.y.toFixed(1), rr.toFixed(1), body);
      if (i % 3 === 0) c += C(pt.x.toFixed(1), (pt.y - rr * .34).toFixed(1), (rr * .24).toFixed(1), hi, { opacity: .8 });
      if (i % 16 === 8 && i > N * .2) s += C(pt.x.toFixed(1), pt.y.toFixed(1), (rr * .42).toFixed(1), spot);
    }
    const h = along(d, Math.max(.01, p)), tg = 28 + Math.sin(t * 14) * 7, H = head;
    const hd = `<g transform="translate(${h.x} ${h.y}) rotate(${h.ang}) scale(${H})">` + E(4, 0, 40, 27, edge) + E(4, 0, 34, 21, body) + C(16, -11, 6, eye) + C(16, 11, 6, eye) +
      P(`M34 0 L${34 + tg} 0 l15 -9 M${34 + tg} 0 l15 9`, 'none', { stroke: tongue, 'stroke-width': 4.5 }) + '</g>';
    return a + b + c + s + hd;
  };

  window.S = { snake, tw, hash, nid, jit, piece, glow, vgrad, torn, ridge, strip, tape, label, labelW, mark, scribble, arrow, highlight, paperDefs, paperOver, vignette, chubby, along, sword, wing };
})();
