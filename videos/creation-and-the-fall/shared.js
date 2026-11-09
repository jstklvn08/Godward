// Small deterministic animation kit: every frame is a pure function of time.
(function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const ease = {
    out: p => 1 - Math.pow(1 - p, 3),
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    back: p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
  };
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, p) => {
    const A = hex(a), B = hex(b);
    return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(p)))).join(',') + ')';
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const attrs = o => Object.entries(o || {}).map(([k, v]) => `${k}="${v}"`).join(' ');

  const G = (tr, inner, op = 1) => `<g transform="${tr}" opacity="${op}">${inner}</g>`;
  const R = (x, y, w, h, r, fill, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${attrs(o)}/>`;
  const C = (x, y, r, fill, o) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${attrs(o)}/>`;
  const E = (x, y, rx, ry, fill, o) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${attrs(o)}/>`;
  const L = (x1, y1, x2, y2, stroke, w, o) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${attrs(o)}/>`;
  const P = (d, fill, o) => `<path d="${d}" fill="${fill}" stroke-linecap="round" stroke-linejoin="round" ${attrs(o)}/>`;
  const T = (x, y, s, o = {}) => {
    const { size = 40, fill = '#000', font = 'Segoe UI', weight = 400, anchor = 'start', style = 'normal', ls = 0, lh = 1.25, op = 1, extra = '' } = o;
    const lines = Array.isArray(s) ? s : [s];
    const spans = lines.map((l, i) => `<tspan x="${x}" dy="${i ? size * lh : 0}">${esc(l)}</tspan>`).join('');
    return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}" font-weight="${weight}" font-style="${style}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}" ${extra}>${spans}</text>`;
  };
  const pop = (t, a, d = 0.35) => ease.back(prog(t, a, a + d));
  const sc = (x, y, s) => `translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`;
  // Seeded random so stars and particles never change between frames.
  const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  // Scenes draw oldest to newest; each new scene fades in over the last one.
  const scenes = (t, list, fade = 0.3) => {
    let out = '';
    list.forEach(([a, fn], i) => {
      const next = list[i + 1] ? list[i + 1][0] : Infinity;
      if (t >= a && t <= next + fade) out += G('', fn(t, t - a), i === 0 ? 1 : ease.out(prog(t, a, a + fade)));
    });
    return out;
  };

  window.K = { W: 1920, H: 1080, D: 10, clamp, lerp, prog, ease, mix, G, R, C, E, L, P, T, pop, sc, rng, scenes };

  window.mount = frame => {
    const svg = document.querySelector('svg');
    const seek = t => { svg.innerHTML = frame(Math.min(t, 9.999)); };
    window.seek = seek;
    seek(0);
    if (!location.search.includes('render')) {
      const start = performance.now();
      const loop = now => { seek(((now - start) / 1000) % 10); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  };
})();
