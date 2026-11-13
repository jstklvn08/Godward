// Godward people rig (window.PPL): the house's round "chubby" figures (same proportions, colours, faces and halftone
// paper look as style-kit's chubby / E.chubby), rebuilt as a rig so they can act together: arms that reach
// (one straight stubby piece from shoulder to hand, never an elbow) with hands that meet hands, shoulders and children; eyes that look at a target; simple expressions;
// kneeling, sitting and carrying; feet planted with a soft contact shadow; a thinner sticker edge.
// Load after episode-engine.js. Nothing here changes existing pages; a page opts in by calling PPL.
//
//   PPL.fig(o)                  one person, feet at (o.x, o.y), about 215*s tall, facing o.face (1 right, -1 left)
//   const r = PPL.rig(o)        the same as a rig: r.draw(layer), r.hand('near'), r.shoulder('far'), r.head, r.hip, r.neck,
//                               r.back(u), r.chest(u), r.W([lx,ly]) (local -> world)
//   PPL.layers([r,'back'],[q,'back'],[r,'body'],...)   draw several rigs interleaved for depth
//   PPL.holdHands(a, b, o)      two people share one hand point (o.up raises the joined hands)
//   PPL.carry(adult, child, o)  child seated on the carrier's hip, carrier's arms under and round it, child's arm round the neck
//   PPL.hug(a, b, {k})          arms wrap round each other's backs (k 0..1 from open arms to held)
//   PPL.handOn(a, b, where)     the world point of b's 'shoulder' | 'back' | 'head' | 'arm', to use as a's arm target
//
// Options (o): x, y, s, face (or flip), f (woman: long hair and flower), kid (no beard), t (default E.t), phase, talk (head bob + moving mouth)
//   pose:  lean (deg, + forward), kneel 0..1, sit 0..1 (with seat: world y of the seat), hipAt {x,y} (held, no ground),
//          walk (phase in radians; omit/0 when standing), jump (px), tilt (head, deg)
//   arms:  near / far = {x,y} world target for the hand (out of reach: the straight arm points at it) | 'up' | 'open' | 'chest' | 'cover' | null (rest at the side)
//   face:  look = {x,y} world | 'up' | 'down' | null;  expr = 'calm' | 'joy' | 'fear' | 'awe' | 'sad' | 'surprised' |
//          'tender', or [a, b, k] to blend; blinks by itself. A look target behind turns the head round.
//   look:  tunic, tunic2, skin, shade, hair, eye, aura, auraOp, shadow (default on when standing), filter ('pplHt' paper
//          halftone with a thin sticker edge; '' for flat colour), op
// Layers: 'shadow', 'backHair', 'farArm', 'farLeg', 'body', 'head', 'nearArm'; 'back' = shadow+backHair+farArm+farLeg,
//         'front' = nearArm, 'all'.
(function () {
  'use strict';
  if (!window.K || !window.S) throw new Error('people.js: load shared.js and style-kit.js first.');
  const { lerp, clamp, mix } = K;
  const { hash, glow, nid } = S;
  const f2 = v => (+v).toFixed(1);

  // ---------- the paper look: style-kit's halftone, with a thinner sticker edge and a softer shadow ----------
  const dotTile = (() => {
    const T = 11, d = T / 2, c = (x, y) => `<circle cx='${x}' cy='${y}' r='${d}' fill='url(#d)'/>`;
    const s = `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'><defs><radialGradient id='d'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#fff'/></radialGradient></defs><rect width='${T}' height='${T}' fill='#fff'/>${c(d, d)}${c(0, 0)}${c(T, 0)}${c(0, T)}${c(T, T)}</svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(s);
  })();
  const REGION = 'filterUnits="userSpaceOnUse" x="-620" y="-940" width="1240" height="1240" color-interpolation-filters="sRGB"';
  const FILTERS = `<defs><filter id="pplHt" ${REGION}>
     <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="g0"/>
     <feComponentTransfer in="g0" result="g"><feFuncR type="linear" slope="1" intercept=".3"/><feFuncG type="linear" slope="1" intercept=".3"/><feFuncB type="linear" slope="1" intercept=".3"/></feComponentTransfer>
     <feImage href="${dotTile}" x="0" y="0" width="11" height="11" result="t0"/><feTile in="t0" result="tile"/>
     <feComposite in="g" in2="tile" operator="arithmetic" k1="0" k2=".5" k3=".5" k4="0" result="sum"/>
     <feComponentTransfer in="sum" result="bw"><feFuncR type="linear" slope="9" intercept="-4"/><feFuncG type="linear" slope="9" intercept="-4"/><feFuncB type="linear" slope="9" intercept="-4"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
     <feComponentTransfer in="SourceGraphic" result="bright"><feFuncR type="linear" slope="1.28"/><feFuncG type="linear" slope="1.28"/><feFuncB type="linear" slope="1.28"/></feComponentTransfer>
     <feBlend in="bw" in2="bright" mode="multiply" result="m"/><feComposite in="m" in2="SourceAlpha" operator="in" result="ink"/>
     <feMorphology in="SourceAlpha" operator="dilate" radius="3.4" result="fat"/><feGaussianBlur in="fat" stdDeviation=".6" result="fats"/>
     <feFlood flood-color="#FFF8EC" result="wh"/><feComposite in="wh" in2="fats" operator="in" result="white"/>
     <feGaussianBlur in="fat" stdDeviation="5" result="b"/><feOffset in="b" dx="4" dy="7" result="o"/>
     <feFlood flood-color="#000" flood-opacity=".38" result="sc"/><feComposite in="sc" in2="o" operator="in" result="shadow"/>
     <feMerge><feMergeNode in="shadow"/><feMergeNode in="white"/><feMergeNode in="ink"/></feMerge></filter></defs>`;

  const EXPR = {
    calm: { brow: 0, tilt: 0, wide: 0, smile: .5, open: 0, happy: 0 },
    joy: { brow: 4, tilt: -3, wide: 0, smile: 1, open: .9, happy: 1 },
    tender: { brow: 2, tilt: 6, wide: 0, smile: .85, open: 0, happy: .7 },
    fear: { brow: 5, tilt: 16, wide: 1, smile: -.4, open: .5, happy: 0 },
    awe: { brow: 7, tilt: 8, wide: 1, smile: .1, open: .55, happy: 0 },
    sad: { brow: 1, tilt: 18, wide: 0, smile: -.9, open: 0, happy: 0 },
    surprised: { brow: 9, tilt: 0, wide: 1, smile: 0, open: .9, happy: 0 },
  };
  const exprOf = e => {
    if (!e) return EXPR.calm;
    if (typeof e === 'string') return EXPR[e] || EXPR.calm;
    if (Array.isArray(e)) { const a = exprOf(e[0]), b = exprOf(e[1]), k = clamp(e[2]); const o = {}; for (const key in a) o[key] = lerp(a[key], b[key], k); return o; }
    return Object.assign({}, EXPR.calm, e);
  };

  // Arms are one straight, stubby piece from shoulder to hand, like the original round figures: no elbow unless it is
  // needed. REST is the hanging length (shoulder to hand centre); a reach can lengthen a straight arm to REACH at most,
  // never more (a target further away gets a straight arm pointing at it). There is no elbow.
  const REST = 54, REACH = 86;
  const rot = (p, c, deg) => { const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs]; };
  // Two-bone IK (kept for the folded arm and for pages that use it). Limbs never grow.
  function ik(S0, T, a, b, bend, stretch = 1) {
    const dx = T[0] - S0[0], dy = T[1] - S0[1], d0 = Math.hypot(dx, dy) || .001;
    const k = clamp(d0 / (a + b - .6), 1, stretch); a *= k; b *= k;
    const d = clamp(d0, Math.abs(a - b) + 1, a + b - .6), ang = Math.atan2(dy, dx);
    const al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const e1 = [S0[0] + a * Math.cos(ang + al), S0[1] + a * Math.sin(ang + al)], e2 = [S0[0] + a * Math.cos(ang - al), S0[1] + a * Math.sin(ang - al)];
    let e;
    if (bend === 'up') e = e1[1] < e2[1] ? e1 : e2;
    else if (bend === 'fwd') e = e1[0] > e2[0] ? e1 : e2;
    else if (bend === 'out') e = e1[0] < e2[0] ? e1 : e2;
    else e = e1[1] > e2[1] ? e1 : e2;
    return [e, [S0[0] + dx / d0 * d, S0[1] + dy / d0 * d]];
  }
  // The arm toward T: always one straight piece, no elbow. A target closer than the hand's own size gives a short
  // stub (the arm seen end-on, pointing at the viewer); a far target gives an arm of REACH pointing at it.
  function armTo(S0, T) {
    const dx = T[0] - S0[0], dy = T[1] - S0[1], d = Math.hypot(dx, dy) || .001;
    const L = clamp(d, 36, REACH), H = [S0[0] + dx / d * L, S0[1] + dy / d * L];
    return { E: [(S0[0] + H[0]) / 2, (S0[1] + H[1]) / 2], H, bent: false };
  }

  // ---------- the rig ----------
  function rig(o) {
    const t = o.t != null ? o.t : (window.E ? E.t : 0), s = o.s || 1, face = o.face || o.flip || 1;
    const ph = (o.phase || 0) + (o.f ? 1.9 : 0) + (face < 0 ? .7 : 0), ht = Math.floor(t * 12) / 12;
    const br = Math.sin(ht * 2.4 + ph), sway = Math.sin(ht * 1.1 + ph);
    const kneel = clamp(o.kneel || 0), sit = clamp(o.sit || 0), jump = o.jump || 0;
    const walking = !!o.walk;
    const sw = walking ? Math.sin(o.walk) * 15 : 0, bob = walking ? Math.abs(Math.sin(o.walk)) * 11 : 0, stepSq = walking ? (1 - Math.abs(Math.cos(o.walk))) * .05 : 0;
    // drop: how far the upper body sinks (kneeling, sitting)
    let drop = kneel * 24 - bob - jump / s;
    let X = o.x, Y = o.y;
    if (sit > 0 && o.seat != null && !o.hipAt) drop = lerp(drop, (o.seat - Y) / s + 30, sit);
    if (o.hipAt) { drop = 0; X = o.hipAt.x; Y = o.hipAt.y + 30 * s; }
    const lean = (o.lean || 0) + sway * 5;
    const W = p => [X + p[0] * s * face, Y + p[1] * s];
    const Lc = p => [(p.x - X) / (s * face), (p.y - Y) / s];
    const grounded = !o.hipAt && !(o.seat != null && sit > .5 && o.seat < Y - 40 * s);
    const HIP = [0, -26 + drop];
    const bodyRot = lean * .3;
    const U = p => rot([p[0], p[1] + drop], HIP, bodyRot);
    const HC = rot(U([0, -165]), U([0, -90]), lean * .7), headRotBase = bodyRot + lean * .7;

    // legs: capsules from the hip to the foot
    const legs = {};
    const legT = { near: U([17, -21]), far: U([-16, -21]) };
    let bN = [17 + sw, -9 - jump / s], bF = [-16 - sw, -9 - jump / s];
    if (kneel > 0) { bN = [lerp(bN[0], -6, kneel), lerp(bN[1], -9, kneel)]; bF = [lerp(bF[0], 30, kneel), bF[1]]; legT.near = U([lerp(17, 14, kneel), -21]); }
    if (sit > 0) {
      const hang = o.hipAt ? 14 : 0;
      bN = [lerp(bN[0], 36, sit), lerp(bN[1], legT.near[1] + 2 + hang, sit)]; bF = [lerp(bF[0], 28, sit), lerp(bF[1], legT.far[1] - 2 + hang, sit)];
      if (o.hipAt) { const kick = Math.sin(t * 3 + ph) * 4; bN[1] += kick; bF[1] -= kick; }
    }
    legs.near = [legT.near, bN]; legs.far = [legT.far, bF];

    // look and expression
    const ex = exprOf(o.expr);
    let lv = [1, 0], headFace = 1;
    if (o.look && typeof o.look === 'object') {
      const lt = Lc(o.look), dx = lt[0] - HC[0], dy = lt[1] - HC[1];
      if (dx < -30) headFace = -1;
      const n = Math.hypot(dx, dy) || 1; lv = [Math.abs(dx) / n, dy / n];
    } else if (o.look === 'up') lv = [.45, -.9];
    else if (o.look === 'down') lv = [.6, .8];
    const lookTilt = clamp(Math.atan2(lv[1], lv[0]) * 180 / Math.PI * .3, -18, 16);
    const talkK = o.talk ? Math.abs(Math.sin(t * 9 + ph)) : 0;
    const headRot = headRotBase + (o.talk ? Math.sin(t * 4.5 + ph) * 4 : 0) + (o.tilt || 0) + lookTilt * headFace + Math.sin(ht * .9 + ph) * 2.4;

    // arms
    const SH = { near: U([34, -106 - br * 1.2]), far: U([-24, -108 - br * 1.2]) };
    const arms = {};
    ['near', 'far'].forEach(side => {
      const S0 = SH[side], v = o[side], idle = Math.sin(ht * .8 + ph + (side === 'near' ? 0 : 1.3)) * 3;
      let T;
      if (v && typeof v === 'object') T = Lc(v);
      else if (v === 'up') { T = side === 'near' ? [S0[0] + 60 + idle, S0[1] - 66] : [S0[0] - 50 + idle, S0[1] - 64]; }   // raised up and out, clear of the face
      else if (v === 'open') { T = [S0[0] + (side === 'near' ? 66 : 40), S0[1] - 12 + idle]; }
      else if (v === 'chest') { T = [S0[0] + 30, S0[1] + 34]; }
      else if (v === 'cover') { T = [S0[0] + 40, S0[1] + 30]; }
      // at rest: a short straight arm hanging at the side, angled a little out (a swing when walking, a tiny idle sway)
      else if (side === 'near') { T = [S0[0] + 10 + sw * .5 + idle * .4, S0[1] + REST]; }
      else { T = [S0[0] - 10 - sw * .5 - idle * .4, S0[1] + REST]; }
      // keep hands off the person's own face: a target inside the head is moved down below the chin (o.allowFace opts out)
      if (!o.allowFace && v !== 'up' && T && Math.hypot(T[0] - HC[0], T[1] - HC[1]) < 66) T = [T[0] + 10, HC[1] + 72];
      const a = armTo(S0, T);
      arms[side] = { S: S0, E: a.E, H: a.H, bent: a.bent };
    });

    // ---------- drawing ----------
    const pal = { tunic: o.tunic || '#3DE0B8', tunic2: o.tunic2 || '#1787A8', skin: o.skin || '#F5BE8E', shade: o.shade || '#C4835E', hair: o.hair || '#2E1C52', eye: o.eye || '#160F30' };
    const flt = o.filter == null ? 'pplHt' : o.filter;
    const wrap = inner => flt ? `<g filter="url(#${flt})">${inner}</g>` : inner;
    const LY = {};
    LY.shadow = () => {
      let g = flt === 'pplHt' ? FILTERS : '';
      if (o.aura) g += glow(0, -110 + drop, 210, o.aura, o.auraOp ?? .5);
      if (o.shadow !== false && grounded) {
        const k = 1 / (1 + jump / s / 50), rx = (56 + Math.abs(bN[0] - bF[0]) * .4 + kneel * 14) * k, id = nid();
        g += `<radialGradient id="${id}"><stop offset="0" stop-color="#080308" stop-opacity="${(.5 * k).toFixed(2)}"/><stop offset=".55" stop-color="#080308" stop-opacity="${(.26 * k).toFixed(2)}"/><stop offset="1" stop-color="#080308" stop-opacity="0"/></radialGradient>` +
          `<ellipse cx="${f2((bN[0] + bF[0]) / 2)}" cy="3" rx="${f2(rx)}" ry="${f2(rx * .2)}" fill="url(#${id})"/>`;
      }
      return g;
    };
    const headTr = `translate(${f2(HC[0])} ${f2(HC[1])}) rotate(${f2(headRot)}) scale(${headFace} 1) translate(0 165)`;
    LY.backHair = () => o.f ? wrap(`<g transform="${headTr}"><path d="M-58 -168 C-74 -120 -72 -70 -46 -62 C-20 -58 -6 -90 -8 -150Z" fill="${pal.hair}"/></g>`) : '';
    const arm = side => {
      const A = arms[side], c = side === 'near' ? mix(pal.skin, pal.shade, .3) : pal.shade;
      const d = A.bent ? `M${f2(A.S[0])} ${f2(A.S[1])}L${f2(A.E[0])} ${f2(A.E[1])}L${f2(A.H[0])} ${f2(A.H[1])}` : `M${f2(A.S[0])} ${f2(A.S[1])}L${f2(A.H[0])} ${f2(A.H[1])}`;
      return wrap(`<path d="${d}" fill="none" stroke="${c}" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${f2(A.H[0])}" cy="${f2(A.H[1])}" r="13" fill="${c}"/>`);
    };
    LY.farArm = () => o.hideFar ? '' : arm('far');
    // a near arm whose line crosses this person's own face is drawn behind the head (it reaches past it) instead of over it
    const segD = (A, P) => { const vx = A.H[0] - A.S[0], vy = A.H[1] - A.S[1], u = clamp(((P[0] - A.S[0]) * vx + (P[1] - A.S[1]) * vy) / (vx * vx + vy * vy || 1)); return Math.hypot(A.S[0] + vx * u - P[0], A.S[1] + vy * u - P[1]); };
    const faceC = [HC[0] + 22 * headFace, HC[1]], behind = !o.allowFace && segD(arms.near, faceC) < 48;
    LY.nearArm = () => o.hideNear || behind ? '' : arm('near');
    const leg = side => { const [a, b] = legs[side]; return `<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" stroke="${side === 'far' ? mix(pal.shade, '#000000', .12) : pal.shade}" stroke-width="27" stroke-linecap="round"/>`; };
    LY.farLeg = () => wrap(leg('far'));
    LY.body = () => {
      const a = nid(), f = !!o.f, y0 = f ? -132 : -130, h = f ? 114 : 108;
      const tr = `rotate(${f2(bodyRot)} ${HIP[0]} ${HIP[1]}) translate(0 ${f2(drop)}) translate(0 ${f2(-br * 1.2)}) scale(${f2(1 - .015 * br + stepSq)} ${f2(1 + .02 * br - stepSq)}) translate(0 ${f2(br * 1.2)})`;
      return wrap(leg('near') + `<linearGradient id="${a}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.tunic}"/><stop offset="1" stop-color="${pal.tunic2}"/></linearGradient>` +
        `<g transform="${tr}"><rect x="-48" y="${y0}" width="96" height="${h}" rx="42" fill="url(#${a})"/>` +
        `<path d="M-44 ${f ? -46 : -48} Q0 ${f ? -28 : -30} 44 ${f ? -46 : -48}" fill="none" stroke="${pal.tunic2}" stroke-width="7" opacity=".55"/></g>`);
    };
    LY.head = () => (behind && !o.hideNear ? arm('near') : '') + headSvg();
    const headSvg = () => {
      const b = nid(), f = !!o.f, e = pal.eye, fc = o.talk ? Object.assign({}, ex, { open: Math.max(ex.open, .25 + .55 * talkK) }) : ex;
      let g = `<linearGradient id="${b}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.skin}"/><stop offset="1" stop-color="${pal.shade}"/></linearGradient>`;
      g += `<circle cx="0" cy="-165" r="56" fill="url(#${b})"/>`;
      if (f) g += `<path d="M-58 -168 C-66 -252 66 -256 60 -172 C34 -196 -20 -198 -58 -168Z" fill="${pal.hair}"/><circle cx="40" cy="-214" r="11" fill="#FFD36B"/><circle cx="40" cy="-214" r="5" fill="#FF7A5C"/>`;
      else g += `<path d="M-58 -172 C-66 -252 66 -256 60 -174 C28 -194 -24 -194 -58 -172Z" fill="${pal.hair}"/>${o.kid ? '' : `<path d="M-44 -136 C-34 -102 34 -96 56 -142 C40 -128 28 -130 8 -132 C-12 -132 -30 -130 -44 -136Z" fill="${pal.hair}"/>`}`;
      // eyes: dots that look at the target (white rings when wide open, arcs when laughing, a line when blinking)
      const blink = ((t * .29 + hash(Math.floor(ph * 10), 3)) % 1) < .03;
      const lx = lv[0] * 3.6 - .6, ly = lv[1] * 4.2;
      [18, 42].forEach(x => {
        if (blink) g += `<path d="M${x - 6} -165 L${x + 6} -165" stroke="${e}" stroke-width="3.4" stroke-linecap="round"/>`;
        else if (fc.happy > .5) g += `<path d="M${x - 7} -162 Q${x} -173 ${x + 7} -162" fill="none" stroke="${e}" stroke-width="3.6" stroke-linecap="round"/>`;
        else {
          if (fc.wide > .4) g += `<circle cx="${x}" cy="-165" r="${f2(8 + fc.wide)}" fill="#FFFDF4"/>`;
          g += `<circle cx="${f2(x + lx)}" cy="${f2(-165 + ly)}" r="${fc.wide > .4 ? 4.4 : 5.6}" fill="${e}"/>`;
        }
        // brows: the inner end lifts for worry and awe
        if (fc.wide < .4) return;
        const inner = x < 30 ? 1 : -1, by = -180 - fc.brow - fc.wide * 2, lift = fc.tilt * .3;
        g += `<line x1="${x - 7}" y1="${f2(by + (inner < 0 ? -lift : 0))}" x2="${x + 7}" y2="${f2(by + (inner > 0 ? -lift : 0))}" stroke="${e}" stroke-width="3" stroke-linecap="round" opacity=".85"/>`;
      });
      // cheeks and mouth
      if (o.blush === true) g += `<ellipse cx="46" cy="-147" rx="8" ry="5" fill="#FF7A6A" opacity=".3"/>`;   // o.blush:false hides the cheek
      const mx = 30, my = -141, cv = fc.smile * 6;
      if (fc.open > .2) {
        const w = 6 + 3 * fc.open, d = 5 + 9 * fc.open;
        g += fc.smile > .4 ? `<path d="M${mx - w} ${my - 2}Q${mx} ${my - 1} ${mx + w} ${my - 2}Q${mx} ${my + d} ${mx - w} ${my - 2}Z" fill="#5A1A22" stroke="${e}" stroke-width="2"/>`
          : `<ellipse cx="${mx}" cy="${my + 1}" rx="${f2(w * .65)}" ry="${f2(d * .5)}" fill="#5A1A22" stroke="${e}" stroke-width="2"/>`;
      } else g += `<path d="M${mx - 7} ${f2(my - cv * .4)}Q${mx} ${f2(my + cv)} ${mx + 7} ${f2(my - cv * .4)}" fill="none" stroke="${e}" stroke-width="3.4" stroke-linecap="round"/>`;
      return wrap(`<g transform="${headTr}">${g}</g>`);
    };
    const ORDER = ['shadow', 'backHair', 'farArm', 'farLeg', 'body', 'head', 'nearArm'];
    const groups = { all: ORDER, back: ['shadow', 'backHair', 'farArm', 'farLeg'], front: ['nearArm'], noFront: ORDER.slice(0, 6) };
    const tr = `translate(${f2(X)} ${f2(Y)}) scale(${f2(s * face)} ${f2(s)})`, op = o.op != null ? ` opacity="${o.op}"` : '';
    const draw = (layer = 'all') => `<g transform="${tr}"${op}>` + (groups[layer] || [layer]).map(l => LY[l]()).join('') + '</g>';
    return {
      o, s, face, X, Y, draw, W, L: Lc,
      hand: side => W(arms[side].H), shoulder: side => W(SH[side]), elbow: side => W(arms[side].E),
      head: W(HC), headR: 56 * s, hf: headFace, hip: W(HIP), neck: W(U([0, -118])), top: W(U([0, -221])),
      back: (u = .35) => W(U([-46, lerp(-118, -40, u)])), chest: (u = .35) => W(U([46, lerp(-118, -40, u)])),
      lap: () => W(U([40, -34])),
    };
  }

  const fig = o => rig(o).draw('all');
  const layers = (...list) => list.map(([r, l]) => r.draw(l)).join('');
  // Two hands clasped at m (world), drawn over both people.
  const clasp = (m, s, skA, skB) => `<g transform="translate(${f2(m[0])} ${f2(m[1])}) scale(${f2(s)})" filter="url(#pplHt)"><circle cx="-6" cy="0" r="13" fill="${skA}"/><circle cx="6" cy="2" r="13" fill="${skB}"/></g>`;

  // ---------- interactions ----------
  const armToward = (o, x) => Math.sign(x - o.x) === (o.face || o.flip || 1) ? 'near' : 'far';
  function holdHands(a, b, o = {}) {
    const ra = rig(Object.assign({}, a, { near: null, far: null })), rb = rig(Object.assign({}, b, { near: null, far: null }));
    const aa = o.armA || armToward(a, b.x), ab = o.armB || armToward(b, a.x);
    const sa = ra.shoulder(aa), sb = rb.shoulder(ab), sm = Math.min(ra.s, rb.s);
    let m = o.at || [(sa[0] + sb[0]) / 2, o.up ? Math.min(sa[1], sb[1]) - 70 * sm : Math.max(sa[1], sb[1]) + (o.drop ?? 46) * sm];
    const A = Object.assign({}, a, { [aa]: { x: m[0], y: m[1] } }), B = Object.assign({}, b, { [ab]: { x: m[0], y: m[1] } });
    const RA = rig(A), RB = rig(B), ha = RA.hand(aa), hb = RB.hand(ab);
    m = [(ha[0] + hb[0]) / 2, (ha[1] + hb[1]) / 2];
    const first = o.order === 'ba' ? [RB, RA] : [RA, RB];
    return { svg: first[0].draw('all') + first[1].draw('all') + clasp(m, sm, a.skin || '#F5BE8E', b.skin || '#F5BE8E'), m, ra: RA, rb: RB, A, B };
  }
  // A seated child on the carrier's hip. o.out: the child faces the way the carrier faces (looking out).
  function carry(ad, ch, o = {}) {
    const r0 = rig(Object.assign({}, ad, { near: null, far: null })), s = r0.s, f = r0.face;
    const seat = r0.W([o.dx ?? 72, o.dy ?? -24]), cf = o.out ? f : -f;
    const C0 = Object.assign({ s: s * .62, expr: 'calm' }, ch, { face: cf, sit: 1, hipAt: { x: seat[0], y: seat[1] }, x: seat[0], y: seat[1] });
    const armC = o.out ? 'far' : 'near';
    if (!ch[armC]) { const nk = r0.W([o.out ? 6 : 10, -112]); C0[armC] = { x: nk[0], y: nk[1] }; }
    if (!ch.look && !o.out) C0.look = { x: r0.head[0], y: r0.head[1] };
    const rc = rig(C0);
    const under = rc.W([4, -6]), round = o.out ? rc.chest(.45) : rc.back(.45);
    const A = Object.assign({ expr: 'tender', lean: -6 }, ad, { near: ad.near || { x: under[0], y: under[1] }, far: ad.far || { x: round[0], y: round[1] } });
    if (!ad.look) A.look = { x: rc.head[0], y: rc.head[1] };
    const ra = rig(A);
    const childArm = armC === 'near' ? 'nearArm' : 'farArm', other = armC === 'near' ? 'farArm' : 'nearArm';
    // the carrier's arms go over the child, except an arm that would cross the child's face: that one goes behind its head
    const xn = crossesFace(ra, 'near', rc), xf = crossesFace(ra, 'far', rc);
    const svg = ra.draw('shadow') + ra.draw('backHair') + ra.draw('farLeg') + ra.draw('body') + ra.draw('head') +
      rc.draw('backHair') + rc.draw(other) + rc.draw('farLeg') + rc.draw('body') + (xf ? ra.draw('farArm') : '') + (xn ? ra.draw('nearArm') : '') +
      rc.draw('head') + rc.draw(childArm) + (xf ? '' : ra.draw('farArm')) + (xn ? '' : ra.draw('nearArm'));
    return { svg, ra, rc, A, C: C0 };
  }
  // does r's arm (shoulder to hand) pass over q's face?
  function crossesFace(r, side, q) {
    const S0 = r.shoulder(side), H = r.hand(side), P = q.head;
    const vx = H[0] - S0[0], vy = H[1] - S0[1], u = clamp(((P[0] - S0[0]) * vx + (P[1] - S0[1]) * vy) / (vx * vx + vy * vy || 1));
    return Math.hypot(S0[0] + vx * u - P[0], S0[1] + vy * u - P[1]) < q.headR + 6 * r.s;   // the arm (half-width ~10) touches the head
  }
  function hug(a, b, o = {}) {
    const k = o.k == null ? 1 : o.k;
    const ra0 = rig(Object.assign({}, a, { near: null, far: null })), rb0 = rig(Object.assign({}, b, { near: null, far: null }));
    const pa = rb0.back(o.uB ?? .55), pb = ra0.back(o.uA ?? .55);   // round the back below the chin, so no arm crosses a face
    const A = Object.assign({}, a), B = Object.assign({}, b);
    const lp = (p, q) => ({ x: lerp(p[0], q[0], k), y: lerp(p[1], q[1], k) });
    const open = (r) => [r.shoulder('near')[0] + r.face * 74 * r.s, r.shoulder('near')[1] - 14 * r.s];
    const oa = open(ra0), ob = open(rb0);
    if (!a.near) A.near = lp(oa, pa);
    if (!a.far) A.far = lp([oa[0] - ra0.face * 30 * ra0.s, oa[1]], [pa[0], pa[1] + 16 * rb0.s]);
    if (!b.near) B.near = lp(ob, pb);
    if (!b.far) B.far = lp([ob[0] - rb0.face * 30 * rb0.s, ob[1]], [pb[0], pb[1] + 16 * ra0.s]);
    if (!a.look) A.look = { x: rb0.head[0], y: rb0.head[1] };
    if (!b.look) B.look = { x: ra0.head[0], y: ra0.head[1] };
    const ra = rig(A), rb = rig(B);
    // an arm that would cross the other person's face goes round behind their head instead (drawn before that head)
    const xa = crossesFace(ra, 'near', rb), xb = crossesFace(rb, 'near', ra);
    const svg = ra.draw('back') + rb.draw('back') + ra.draw('body') + (xb ? rb.draw('body') + rb.draw('front') : '') + ra.draw('head') +
      (xb ? '' : rb.draw('body')) + (xa ? ra.draw('front') : '') + rb.draw('head') + (xa ? '' : ra.draw('front')) + (xb ? '' : rb.draw('front'));
    return { svg, ra, rb, A, B };
  }
  function handOn(a, b, where = 'shoulder') {
    const rb = rig(Object.assign({}, b));
    if (where === 'head') return { x: rb.top[0], y: rb.top[1] - 4 * rb.s };   // resting on the crown, not over the eyes
    if (where === 'back') { const p = rb.back(.3); return { x: p[0], y: p[1] }; }
    const side = Math.abs(rb.shoulder('near')[0] - a.x) < Math.abs(rb.shoulder('far')[0] - a.x) ? 'near' : 'far', p = rb.shoulder(side);
    return { x: p[0], y: p[1] + (where === 'arm' ? 34 : 16) * rb.s };   // on the shoulder, below the chin line
  }

  window.PPL = { rig, fig, layers, clasp, holdHands, carry, hug, handOn, armToward, crossesFace, ik, EXPR, FILTERS };
})();
