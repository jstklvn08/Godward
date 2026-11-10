# Godward episode engine: authoring guide

The engine (`videos/_kit/episode-engine.js`, `window.E`) holds the machinery built for *Creation and the Fall*: the paper wall, the vertical camera, verse cards, captions, character life, focus beats, grain and fades. An episode page supplies only its drawings and a configuration object. Every time in the page comes from the spoken words, so a new narration re-times the whole episode.

Start from `videos/_template/` (three short sheets, timed to the first 37 s of the Creation narration). Every place an author changes is marked `// EPISODE:`.

## 1. Page contract

The renderer (`tools/render.js`) depends on these:

| Item | Meaning |
|---|---|
| `window.DUR` | Length in seconds. The engine sets it to the last word's end plus `tail` (default 1.6 s). |
| `window.seek(t)` | Draws the frame at time `t`, synchronously. Set by `E.start`. |
| `?render=1` | Stops the page's own playback loop (the renderer always adds it). |
| `?v=1` | Vertical 1080x1920 cut (viewBox `0 0 1080 1920`). Without it: landscape 1920x1080. |

One page makes both cuts. Do not write a separate vertical page.

Render commands:

```
node tools/render.js stills videos/<ep>/episode.html <outdir> 2,10,20,30 [--vertical]
node tools/render.js video  videos/<ep>/episode.html <out.mp4> [--vertical] [--start S --end E] --audio <mix.wav> --workers 4
node tools/render.js sheet  <out.jpg> <cols> <img1> <img2> ...      (contact sheet of stills)
```

`node tools/render.js` with no arguments prints the full help. Any script error in the page aborts the render with `Page error: ...`.

## 2. Episode folder

```
videos/_kit/shared.js            window.K: prog, ease, lerp, mix, rng, G R C E L P T svg helpers (do not edit)
videos/_kit/style-kit.js         window.S: piece, label, strip, tape, mark, arrow, highlight, chubby, paperDefs... (do not edit)
videos/_kit/episode-engine.js    window.E: the engine
videos/<episode>/episode.html    drawings + E.start({...})
videos/<episode>/words.js        const WORDS=[[word,start,end],...]  (generated, never typed by hand)
```

Script order in the page: `../_kit/shared.js`, `../_kit/style-kit.js`, `words.js`, `../_kit/episode-engine.js`, then the episode script.

The originals in `videos/creation-and-the-fall/` (`shared.js`, `style-kit.js`) stay where they are because the first episode loads them. The `_kit` copies are byte-identical. If you change a kit, change only the `_kit` copy and check that `_template` still renders.

Name clash: `K.E` is the ellipse helper and `window.E` is the engine. In pages, write `const Ell=K.E;` and draw ellipses with `Ell(...)`.

## 3. Timing from words

`words.js` holds `const WORDS=[["In",0,0.34],["the",0.34,0.44],...]`: one entry per spoken token, `[text, start, end]` in seconds, taken from a word-level transcript of the **final** voice-over (the same file you mux with `--audio`).

| Function | Returns |
|---|---|
| `E.cue(word, n=1)` | Start of the nth time `word` is spoken. |
| `E.end(word, n=1)` | End of the nth time. |
| `E.after(word, n=1, offset=0)` | `end(word, n) + offset`. |
| `E.before(word, n=1, offset=0)` | `cue(word, n) - offset`. |
| `E.span(word, n=1)` | `[start, end]`. |
| `E.words(list?)` | Sets or returns the word list (normally read from `WORDS` automatically). |

- Matching ignores case and punctuation (`'beginning,'` equals `beginning`). Curly apostrophes count as straight ones.
- `word` can be a phrase: `cue('On the fifth')` is the start of "On", `end('the heavens and the earth')` is the end of "earth". Use phrases to pick out repeated words without counting.
- A missing word throws at once, with a hint: `E.cue("formles", 1): "formles" is never spoken in WORDS. Similar words: formless.` Asking for a fourth "darkness" when there are two throws `"darkness" is spoken only 2 time(s).`
- Put all timings in one `AT={...}` object at the top of the page. They are worked out at load, so a typo stops the page before anything draws.
- Never type a raw second (like `12.45`) for a story beat. Offsets such as `AT.spoke-.6` are fine.

## 4. Engine API

### Running
| | |
|---|---|
| `E.start(cfg)` | Checks the configuration, builds captions, sets the viewBox, smoke-tests every sheet (start, middle, end), then installs `window.DUR` and `window.seek`. Call once, at the end of the page. |
| `E.frame(t)` | Returns the SVG markup for time `t` (what `seek` draws). |
| `E.sheetIndex(t)` | Index of the sheet on screen at `t`. |
| `E.camAt(i, t)` | Vertical camera `{x,y,z}` for sheet `i` at time `t` (before the clamp). |
| `E.DUR`, `E.t` | Episode length; time of the frame being drawn. |

### Orientation and constants
`E.VERT` (true in the vertical cut), `E.W`/`E.H` (frame size), `E.hv(landscapeValue, verticalValue)`, `E.INK` #141416, `E.YEL` #FFE100, `E.CORAL` #FF5A48, `E.PAPER` #F5F0E2, `E.STN` 2100, `E.PAN` .32, `E.SL` .38, `E.BANDY` 1010, `E.VTOP` 170, `E.CAP_Y` 1300.

### Drawing
| | |
|---|---|
| `E.verse(t, at, x, y, lines, ref, o)` | Verse card (section 7). |
| `E.verseEnd(at, lines)` | When that card leaves. |
| `E.wrapVerse(lines, size, maxW, hl)` | Re-wraps lines to a width, keeping the highlighted phrase on one line. |
| `E.fade(t, b, inner)` | Fades `inner` out over 0.35 s from time `b`. Verse cards inside it also leave the vertical top band by `b`. |
| `E.char(name, x, y, s, o)` | A cast member with life and TALK gestures (section 8). |
| `E.chubby(x, y, s, o)` | The same for a figure not in the cast. `o.who` links it to TALK windows. |
| `E.talking(name, t?)` | True while `name` has an open TALK window. |
| `E.shot(a, b, x, y, z)` | Two camera keys that hold one framing from `a` to `b` (section 6). |
| `E.ridge(seed, base, amp, wave, x0, x1, bottom)` | style-kit's paper ridge. In the vertical cut the default bottom moves from 1200 to 1780, so ground fills the tall frame. |
| `E.stars(t, k, maxY)` | Twinkling star field (fixed seed). |
| `E.fireflies(t, x0, y0, w, h, colour, n, k)` | Drifting glow motes. |
| `E.held(t, fps=12)` | Time held to a frame rate, for stop-motion movement. |
| `E.grad(id, a, b)` / `E.vgrad(a, b, c?)` | Gradient helpers (`vgrad` returns `[fill, defs]`). |
| `E.focusFx(t)` | Current focus offset `{dx, dy, rot, z}`. |

Use style-kit (`S.piece`, `S.label`, `S.mark`, `S.scribble`, `S.arrow`, `S.highlight`, `S.glow`, `S.strip`, `S.tape`, `S.snake`, `S.sword`, `S.wing`) and shared (`K.prog`, `K.ease`, `K.lerp`, `K.mix`, `K.sc`, `K.G/R/C/L/P/T`) as before.

### `E.start` configuration

```js
E.start({
  sheets:[ {name, at, draw, bg, cam, fore, vdraw, vIn, stars}, ... ],   // required
  cast:{ name:{f, tunic, tunic2, skin, shade, hair, aura, auraOp, ...} },
  talk:[[start, end, castName], ...],
  focus:[[time, strength], ...],
  flashes:[[time, seconds, colour], ...],
  hud:t=>'',              // optional markup in frame coordinates, drawn above the scene
  tail:1.6,               // DUR = last word end + tail
  dur:null,               // force a length instead
  fadeOut:.9,             // fade to black ending 0.1 s before DUR (0 = none)
  fadeIn:0,               // fade up from black at the start
  captions:true,          // false hides burned-in captions
  focusLandscape:true,    // false = focus beats only in the vertical cut (as in the first episode)
  words:null,             // a word list, if not using WORDS
});
```

`E.start` refuses configurations that would go wrong quietly: sheets out of order or closer than 0.64 s, a camera key outside its sheet's time or not `[t,x,y,z]`, keys out of order, a TALK window naming someone not in the cast, a `fore` without three grass colours, a sheet with no `draw`. It then draws each sheet three times, so a bad sheet fails at load with its name and the time (`days 1-4 at 20.98 s: ...`).

## 5. Writing a sheet

A sheet is one piece of torn paper on the wall, 1920x1080 in its own coordinates.

```js
function garden(t, lt){          // t = episode time, lt = time since this sheet began
  let g = `<path d="${E.ridge(90,690,30,220)}" fill="#0F4F86"/>`;
  g += E.char('adam', 330, 935, 1.15);
  g += E.verse(t, AT.placed, 70, 70, ['He placed him in a garden in Eden,'], 'GENESIS 2:8', {size:40});
  return g;
}
// in E.start: {name:'garden', at:AT.placed-.1, draw:garden, bg:['#0A1248','#0E5A7A'], cam:[...], fore:{...}}
```

- Return markup only. The engine draws the paper (cream torn edge, `bg` gradient, clip) around it and closes the group. Do not draw your own sheet edge.
- `at` is when the sheet takes over; the first sheet starts at 0. Put it just before the first word that belongs to it (`cue('On the first')-.1`).
- Keep important things inside x 60..1860, y 40..980 in landscape. The caption line is at y≈1046.
- Things that should leave: wrap them in `E.fade(t, time, ...)`. Things that appear: `S.piece(t, at, cx, cy, inner, id)` (slap-on and wobble). Give every piece on a sheet its own `id`.
- `E.hv(a, b)` places something differently in the vertical cut, where the camera is closer and the edges are tighter.
- `vdraw(t, lt)` (optional) replaces the camera view of this sheet in the vertical cut with a drawing made directly for the 1080x1920 frame. The first episode did this for its opening, the six-day gallery and the curses. Landscape still uses `draw`.
- `stars:false` removes the faint stars the engine paints on the paper above the sheet in the vertical cut. Use it for daylight sheets.

## 6. Transitions and the vertical camera

**Landscape:** sheets hang on a wall 2100 px apart. At each sheet's `at` the wall pans with an eased move lasting ±0.32 s. There is nothing to configure.

**Vertical:** each sheet is filmed by a camera. The old sheet scrolls up and the next rises from below over ±0.38 s (`vIn:'scroll'`, the default). `vIn:'cut'` makes a hard cut, which hides well under a flash.

`cam` keys are `[time, x, y, zoom]` in the sheet's 1920x1080 coordinates. The point `(x, y)` lands at frame position (540, 1010). The camera eases from each key to the next across the whole gap. **To hold a framing you need two keys**, so use `E.shot(from, to, x, y, z)`:

```js
cam:[E.shot(0, AT.formless-.8, 960,560,.84),           // wide, until just before "formless"
     E.shot(AT.formless-.2, AT.darkness-.8, 1250,560,1.15), // 0.6 s move, then hold
     E.shot(AT.darkness-.2, AT.spoke-1.2, 620,560,1.15)]
```

Rules (the engine enforces the first two):
- **Zoom 0.845 or less is a deliberate wide shot.** Any other zoom is raised to at least 1.12. Between those the frame would look like a mistake.
- **The camera stays inside the paper.** x and y are clamped so the wall never shows. The vertical paper runs from y -700 to 1800. Asking for x 1900 gives you the right-most legal framing, not the wall.
- At zoom z the frame shows 1080/z by 1920/z sheet pixels: 1.12 shows 964 px wide, 1.45 shows 745, 0.84 shows 1286.
- Plan moves of 0.4–0.8 s. Arrive just before the word, not on it.
- Frame one subject per shot. Space subjects at least ~160 px apart on the sheet, so a close-up of one never shows a sliver of the next.
- No `cam` means one wide shot at (960, 560, 0.84).

## 7. Vertical safe areas

Frame 1080x1920:

| Zone | Rule |
|---|---|
| y 0–150 | No text. Platform UI (status bar, search, channel name) sits here. |
| y 170 down | Verse cards stack from here, centred, at most 980 px wide. |
| y ≈1300 | Captions (about 68% of the height). Keep faces, hands and labels out of y 1220–1340. |
| right 140 px (x > 940), y 800–1650 | Shorts, Reels and TikTok buttons. No labels, faces or key action there. |
| bottom ~250 px | The platform puts description text over it. Use it for ground and foreground only. |
| top and bottom bands | Never empty or flat. The paper extends to y -700 (faint stars), `E.ridge` ground reaches 1780, and `fore` adds grass, stones and glowing flowers from sheet y 1000 to 1780. |

`fore:{grass:[c1,c2,c3], flowers:[...]}` or `fore:t=>({...})` (for colour changes during a sheet). Leave `fore` out where there should be no land, such as the deep before Day 3.

Labels inside a sheet scale with the camera. In a 0.84 wide shot a size-28 label shows at about 23 px, so draw it larger in the vertical cut: `{size:E.hv(28,40)}`.

## 8. Captions

These are built automatically from `WORDS`, so do not draw your own.

- **Landscape:** cues of up to 34 characters, centred at y≈1046, Segoe UI 800, size 40, white with a dark outline. Words already spoken turn yellow (#FFE100). A cue breaks at sentence ends, at pauses over 0.7 s, and at commas once it is over 18 characters.
- **Vertical:** bursts of 1–3 words (at most 15 characters), upper case, Segoe UI weight 900, size 78, centred at y 1300. The current word is #FFE100 and the rest white, with a #06061A outline 14 wide. Each word pops in with `ease.back` as it is spoken. A burst breaks at any punctuation and at pauses over 0.45 s.
- Caption text is the transcript. Fix spelling in `words.js` (keep the times), not in the page.

## 9. Verse cards

`E.verse(t, at, x, y, lines, ref, o)` draws a torn cream strip with Georgia text, tape and a black reference label.

- `lines`: the **exact scripture text** from one translation, split into lines for landscape. `ref`: `'GENESIS 1:1'`.
- `o`: `size` (46), `hl` (a phrase to highlight, which must appear in one line exactly), `hlAt`/`hlDur` (time the highlighter sweep to the spoken phrase: `const [a,b]=E.span('the heavens and the earth')` then `hlAt:a, hlDur:b-a`), `seed` (paper shape), `id` (wobble), `end` (override the exit time).
- **Exit:** the engine finds the card's last 1–3 words in `WORDS` (spoken within 2 s before to 25 s after `at`) and removes the card 1.3 s after they end, sliding out over 0.5 s. If they are never spoken it estimates from the word count. The last words on the card should therefore be words the narrator actually says.
- **Landscape:** drawn where you place it. Keep it clear of characters and the caption line.
- **Vertical:** it ignores `x, y`. Cards stack centred from y 170, re-wrapped to 880 px at size 44–54, with the reference below. Two cards at once stack, so avoid more than two.
- A card wrapped in `E.fade(t, b, ...)` also leaves the vertical stack at `b`.

## 10. Characters

`cast` entries are style-kit `chubby` options: `f` (long hair and flower, used for women), `tunic`, `tunic2`, `skin`, `shade`, `hair`, `eye`, `aura`, `auraOp`, `filter` (default `'htSoft'` halftone sticker). `E.char(name, x, y, scale, o)` puts the feet at `(x, y)`, about 215·scale tall. Use `o.flip:-1` to face left, plus `o.reach`, `o.lean`, `o.walk`.

The engine adds life on 12 fps held time: breathing (squash ±3%), weight shift, head tilt and a small idle hand drift. Figures move out of step when they differ in `f` or `flip`. For two similar figures, give one `phase:1.3` (in its cast entry or in `o`).

`talk:[[start, end, 'name'], ...]` opens gesture windows. Inside one the figure reaches and gestures rhythmically; outside it the figure stays calm. Time each window to that person's spoken line (`[E.cue('Did God'), E.end('say'), 'eve']`). Do not leave a window open for a whole sheet.

## 11. Focus beats

`focus:[[time, strength], ...]`. Each beat gives a punch-in of up to 7%·strength, eased in over 0.18 s, and a hash-driven shake that decays over 1.4 s. The rest of the time the frame is steady. Strength 0.5 is a nudge, 0.8 normal, 1.2 a major beat ("Then God spoke", "she ate").

Use roughly one beat per 10–20 s, on the words that carry the story. Put beats on the word start (`E.cue('spoke')`).

## 12. Flashes, fades, grain

- `flashes:[[time, seconds, colour]]`: a full-frame flash that eases away (default #FFFBEC, 0.95 s). Use it to cover a `vIn:'cut'`.
- Fade to black over `fadeOut` seconds before the end. Set `fadeIn` for a fade up at the start.
- Grain, paper texture, blots and vignette come from style-kit and are drawn over every frame. Grain is re-seeded 12 times a second. In the vertical cut the engine resizes style-kit's 1920x1080 filter regions and overlays to 1080x1920, so never resize them in the page.

## 13. Look

- Palette: ink #141416, highlighter #FFE100, coral #FF5A48 (marks, arrows, warning labels), paper #F5F0E2, verse paper #F6EFDC. Scenes are dark, saturated paper gradients with glows.
- Fonts: Georgia for scripture, Segoe UI for captions, Segoe UI Black for labels (`S.label`, upper case).
- Pieces slap on (`S.piece`), marks draw on (`S.mark`, `S.arrow`, `S.scribble`), and motion is held to 8–12 fps where it should feel hand-made.

## 14. Content rules

- **God is never shown as a person.** Show light, wind, breath, a voice, or words only. No face, figure, hand or silhouette.
- **Follow the text's order.** Nothing appears before the text puts it there: no sun, moon or stars before Day 4, no plants before Day 3, no people before Day 6. Light on Day 1 has no visible source.
- **Exact scripture** on verse cards, with the right reference, in one translation throughout. Narration paraphrase goes in captions, not on cards. Labels that sum up a passage say so ("GENESIS 2:21–22" under the label).
- **Characters are modestly clothed** in tunics, including before the fall. Show "naked and without shame" with words and light, not by undressing anyone.
- **No brand logos,** real products, modern text, or recognisable real people.
- Keep evil figures (the serpent) small and readable, not frightening, and not the centre of the frame for long.

## 15. Common mistakes (all happened in the first episode)

1. **Labels covering words.** Labels were placed on top of verse cards, captions and faces. Keep labels away from the card area, the caption line (landscape y>1000, vertical y 1220–1340) and characters' heads. Check stills at every label's entry time.
2. **The serpent too big, and moving back and forth.** A huge, constantly sliding serpent pulled every eye. Keep animals and the serpent near character scale. Move them once, with purpose, and then let them settle.
3. **Framing too tight.** Zooms between 0.85 and 1.12 and close-ups that cut off heads. Use 0.84 for wide shots, 1.12–1.6 for close-ups, and frame whole figures.
4. **Text hidden.** Verse cards or labels sat under the platform's UI (top 150 px, right-hand buttons) or were cut off at the frame edge after the camera moved. Use `E.hv` for vertical positions and fade labels out (`E.fade`) before the camera leaves them half-visible.
5. **Empty bands.** Flat colour above or below the scene in the tall frame. Use `E.ridge`, `fore`, and the sheet's extended paper. Never draw a scene that stops at y 1080 without ground continuing below it.
6. **Shake everywhere.** Constant camera wobble is tiring and cheapens the big moments. Shake only on `focus` beats. Pieces already wobble slightly by themselves.
7. **Camera drifting instead of holding.** Single keys make the camera ease slowly across the whole gap. Use `E.shot(from, to, ...)` to hold.
8. **Hand-typed times.** Seconds typed in by hand drift when the voice-over is re-recorded. Every beat should be `E.cue/E.end` on a spoken word.
9. **The wall showing** between or beside sheets in the vertical cut. The engine clamps the camera, but drawings must stay on the paper (x -34..1954).
10. **Verse cards that never leave or leave too soon,** because their last words differ from what is spoken. End the card on spoken words, or pass `o.end`.

## 16. Checklist before a full render

1. `node tools/render.js stills <page> <dir> <a few times per sheet>` with and without `--vertical`, then `sheet` to see them together. Look at every verse entry, every label entry, every transition, and the last second.
2. A 10–15 s clip with `--audio <final mix>` to check sync on the opening and on one busy passage.
3. Full render: `--workers 6` on this laptop. Web quality is the default.
