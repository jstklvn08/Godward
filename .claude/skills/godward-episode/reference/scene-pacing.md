# Scene pacing guide: giving a Godward episode more scenes and real camera work

Source of truth: `videos/the-first-commandment/episode.html`. The act-1 block (`burning` to `voice`) and the
`VERSES` / `TAGS` / `hud` / `E.start` block are the worked example. Engine: `videos/_kit/episode-engine.js`
(do not edit). Rules: `.claude/skills/godward-episode/reference/taste.md` and `reference/engine.md`.

## The user's complaint and the targets
"Why does the scene almost look the same, change scene more often." The old cut was about 10 sheets for 4 minutes,
each one a static wide shot (`cam: wide`) held 20-30 s, carried by stacked labels.
- A visibly different picture at least every 4-7 s, from cuts and acting (not from camera zooms; see Camera).
- A new setting (new sheet: new palette, new place) about every 5-15 s. Act 1 of ep. 1 runs 16 sheets in 75 s.
- At most ONE short label on screen at a time. Verse cards stay. Let pictures and acting carry the meaning.
- People act the line (walk, haul, reach, flinch, jump, tremble) on the spoken word, instead of a tag summarising it.
- An opening image that belongs to this story (ep. 1: ten lines burning into stone on a storm-lit summit), not a
  generic shot.

## Workflow
1. Print sentences with times (one command):
   `node -e "const fs=require('fs');eval(fs.readFileSync('videos/<ep>/words.js','utf8')+';global.W=WORDS');let l='',s=0;W.forEach(w=>{if(!l)s=w[1];l+=w[0]+' ';if(/[.?!]$/.test(w[0])){console.log(s.toFixed(2)+' '+l);l='';}})"`
2. Write a beat sheet: one row per sentence or half sentence -> setting, who acts what, which shot.
   Group 1-3 sentences per sheet. Give every sheet its own `bg` palette (night indigo, brick red, sea blue,
   dawn gold, desert ochre, ember black...). Neighbouring sheets should never share a palette.
3. Add the cue words to `AT` (phrases avoid counting: `cue("It's not",1)`, `cue('And then',1)`). A missing or
   mistyped word throws at load, so every typo shows up on the first stills run.
4. Draw the sheets, set `cam`, render stills every ~3 s, look, fix, repeat.
5. Keep `audio-cues.json` marks working: its marks point at words (e.g. "To understand", "through the middle",
   "three months"); new sheets may start anywhere, but do not remove a word a mark names.

## Camera patterns (vertical)
User feedback after the remake: "in the first few sec of the vid, there is too much motion, zoom in and out". The
opening sheet bounced 1.45x -> wide -> 1.4x -> wide in 6 s, and most sheets did a quick 0.4-0.6 s zoom on every
phrase, plus 25 focus shakes. The rules now:
- **At most ONE camera move per sheet**: a slow push-in or slow pan lasting at least ~2-3 s (the whole sheet is
  fine), otherwise a still hold. A slow pull-back to reveal is allowed as that one move. Never in-and-out.
- **Zoom change within a sheet <= ~1.3x.** To reach a very different framing, CUT (a new sheet, `vIn:'cut'`) instead
  of zooming. Visual pace comes from cuts, new settings and characters acting, not from the camera.
- **Focus beats (punch-in + shake): 2-3 per episode**, on the biggest moments (ep. 1: the sea closing on
  "Egyptians", "God speaks", the calf rising), and only while the camera holds still.
- Set `gentleZoom:true` in `E.start`: zooms between .845 and 1.12 are then used as written (the paper-edge clamps
  still keep the wall out), so a push can start wide: `.84 -> 1.08`.
- `cam` keys are `[t, x, y, zoom]` in sheet coordinates; (x, y) lands at frame (540, 1010). Two plain keys = one move
  eased over the whole gap (the camera holds the first key before it and the last key after it).
  ```js
  cam:[[0,960,600,.84],[AT.itsNot-.2,740,510,1.08]]              // opening: wide summit, slow push toward line I over 6 s
  cam:[[AT.itsNot,795,585,1.3],[AT.itsThis-.2,1260,610,1.36]]    // slow pan from the card to the thief
  cam:[[AT.notNation,900,720,1.1],[AT.walked-.2,1240,615,.85]]   // slow pull-back to reveal the line of slaves
  cam:[shot(AT.sun,AT.river,960,800-170/1.25,1.25)]              // montage beat (< 2.5 s): still hold, let the acting move
  cam:[[AT.calf+1.4,960,690,.95],[AT.twist-.3,990,700,1.06]]     // hold still through the focus beat, then push
  ```
- To put a subject at frame height F: `camY = subjectY + (1010 - F) / z`. Feet at F <= 1190 keep figures above the
  caption band (1220-1340); faces at 1380-1480 collide with the label line (1430).
- The frame shows sheet x `cx +- 540/z`. Before choosing a push's end zoom, list the figures' x and check each is
  fully inside or fully outside at BOTH ends of the move. Crowds wider than the frame need z <= ~.9.
- Legal y range at zoom z: `-640+1010/z .. 1720-910/z` (wide .84: 562-637; 1.0: 370-810; 1.2: 202-962).
- Count moves with `E.camAt(E.sheetIndex(t), t)` sampled every 0.05 s (puppeteer from `tools/node_modules`): each
  sheet should show 0 or 1 move, >= 2 s long, max/min zoom <= 1.3. Ep. 1 went from 74 moves (25 focus beats) to 44
  (3 focus beats), with 54 sheets unchanged.

## Frame-space overlays: verse cards and the one label
Cards and labels drawn inside a sheet move with the camera and get cropped by zooms. Draw them from `cfg.hud`
instead (frame coordinates). A card that spans several sheets then stays put across the cuts and is never
queued twice during a scroll (both sheets draw during a transition).
```js
const VERSES=[[at,x,y,lines,ref,opts], ...];            // x,y only matter in landscape
const TAGS=[[from,to,'TEXT',{bg,rot,size}], ...];        // keep the windows non-overlapping
const ftag=(t,[a,b,s,o],k)=>{if(t<a||t>b+.4)return '';const size=o.size||hv(40,46),x=hv(960,540),y=o.y||hv(90,1430);
  return E.fade(t,b,piece(t,a,x,y+size*.8,label(x,y,s,{size,anchor:'middle',bg:o.bg||'#101014',rot:o.rot||0}),40+k,1.3));};
const hud=t=>{let g='';VERSES.forEach(v=>g+=verse(t,v[0],v[1],v[2],v[3],v[4],v[5]));TAGS.forEach((x,k)=>g+=ftag(t,x,k));return g;};
E.start({hud, sheets:[...], ...});
```
Vertical label line: y 1430 (below the 1220-1340 caption band, left of the button column). Verse cards occupy
frame y 170 to ~450-700 depending on length: keep the subject below that while a card is up.

## Acting with the cast helpers
`E.chubby(x,y,s,o)` (feet at x,y, ~215*s tall). A small wrapper gives every crowd member a palette:
```js
const folk=(i,x,y,s,o={})=>{const [a,b]=TUN[i%5],[sk,sh]=SKIN[i%3];
  return E.chubby(x,y,s,Object.assign({f:i%2===1,tunic:a,tunic2:b,skin:sk,shade:sh,hair:HAIR[i%3],phase:i*.7,filter:'htSoft'},o));};
```
- Walk: `walk:t*7+i` while moving, 0 when stopped; move x with `lerp(x0,x1,prog(t,a,b))`.
- Haul / carry: `lean:18, reach:.95` and draw the load at `(x-12, y-262*s)`.
- Reach for something on a word: `reach:lerp(.1,.8,prog(t,AT.word-.3,AT.word))`. Hand is at
  `(x + lerp(52,116,reach)*s*flip, y + lerp(-54,-172,reach)*s)`.
- Flinch / look back: `lean:-12*startle, reach:.15+.45*startle`, flip toward the event.
- Joy: bob `y - abs(sin(E.held(t,10)*7+i))*40`, `reach:1`.
- Tremble: x jitter `(hash(Math.floor(t*14),i)-.5)*12` and a flickering `auraOp`.
- Threats as shadows (the taskmaster): a skewed dark silhouette sliding over the ground, never a scary figure.
- God never as a person: fire coming down, rings of light going out from the fire for "God speaks", wind, words.

## Pitfalls hit while doing ep. 1
- Wide shots of small subjects leave the top and bottom of the tall frame empty: scale the hero object up for
  vertical (`hv(1,1.32)`), and fill the bands (storm clouds, lava cracks, cobbles, a camp at the mountain's foot,
  `fore` grass with `flowers`).
- Content off to one side: check where the camera can legally go (clamps above) and centre the action there.
- People's heads in the caption band during a push-in: lower the cam y a little (subject moves up).
- `mountain()` with a big steep factor looks like a pyramid; draw a jagged polygon for a named mountain.
- Big `flames()` read as a row of spikes; layer 2-3 flame bands of different widths over a dark base.
- A sheet's `at` must be >= 0.64 s after the previous one; cam keys must lie within the sheet's time.
- Stills during a transition show two half sheets: sample 0.5 s away from cuts when judging a composition.
- `ls v-t00{00,01}*` style globs miss files: build the still list from the times
  (`printf '%s/v-t%07.2f.jpg' $O $x`).

## Checking
```
CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tools/render.js stills videos/<ep>/episode.html videos/<ep>/build/stills-v2 <t1,t2,...> --vertical
node tools/render.js sheet <out.jpg> 6 <stills...>     # max ~12 per call, then Read the sheet
node tools/render.js video videos/<ep>/episode.html $PWD/videos/<ep>/build/sample-v2.mp4 --vertical --start 0 --end 60 --audio videos/<ep>/build/audio/mix.wav --workers 4
```
Look at: every cut, every label entry, every verse entry, every push-in (heads/labels inside the frame, not in
the caption band), and the top/bottom bands of every wide shot.

## Acts 2-6 of ep. 1 (75 s to the end): what the second half taught
Result: 38 new sheets for 178 s (one setting every ~4.7 s); the camera was later calmed to one slow move per sheet (see Camera). Nothing
held over 6 s except the end card. Sheets live in `episode.html` after the `ACTS 2-4` banner.

### Framing helper (use it for every close shot)
```js
const aim=(a,b,x,y,F,z)=>shot(a,b,x,y+(1010-F)/z,z);   // put sheet point (x,y) at frame height F
aim(t0,t1, 960,800, 1170, 1.4)                          // feet at y 800 land at frame 1170: above the captions
```
- Feet line F 1150-1190 keeps a standing figure clear of the caption band; heads then sit ~F-300*z.
- The frame shows sheet x `cx ± 540/z`. Before choosing `cx`, list every figure's x and check each is either fully
  inside (`x ± 60*s` inside the range) or fully outside. Moving a figure 60-100 px or the camera 40 px fixes most cuts.
  This was the most common defect (8 shots in the first draft).
- A shot on something high (a summit, an idol) with people far below: either keep them fully in frame BELOW the
  captions (heads >= 1350, e.g. `aim(..,960,40,790,1.12)` with the crowd 750 px lower) or fully out of frame.
  Faces at frame 1380-1480 also collide with the label line (y 1430): never put a label up while faces are there.
- Wide shots (`W0`): feet at sheet y <= 800 (frame 1178). The legal wide x is 613-1307, so a wide shot sees x 317-1603:
  keep set pieces and people inside x ~360-1560.
- Walkers that cross the frame edge read as "cut". Fade them out (opacity) before they reach the edge, and hide any
  side crowd until the shot that needs them (e.g. the crowd walks in when the calf rises, not during the earrings close-up).
- Without `gentleZoom:true` the zoom between .845 and 1.12 is raised to 1.12; with it, push slowly from wide
  (.84 -> 1.08). Never jump between a `W0` and an `aim` inside one sheet: cut to a new sheet instead.

### Montage beats (four words in four seconds: "The sun. The river. The harvest. The king.")
One sheet per word with `vIn:'cut'` (a scroll transition is 0.76 s, longer than the beat). Each sheet is a still
hold (`shot(...)`); the cuts and the acting carry the rhythm. Sheets may be as little as 0.68 s apart.

### Acting tricks that worked
- Earn/lose: a man stacks bricks to reach a light, the tower topples on the end of the sentence.
- "Not here": X marks slam onto idols on pedestals timed to the two words, the camera pans between pairs; the idols
  topple on "Not any more".
- "Dividing your heart": strings from the chest to four idols, heart drawn in four clipped quarters that drift apart.
- "Before my face": the word on a strip lifts and turns into `presence()` (soft oval of light); a person walks in and
  stands before it. God is only ever `presence()`, fire, rings of light, or "words of light" (glowing strokes).
- "Inside out": scale X of a stone card through 0; the back face shows a heart.
- "Become like them": interpolate a figure's tunic, skin and hair colours to gold with `mix()` and fade the aura.
- Day counter: a TAGS entry can take `t=>text` (`dayN`) so the one label can tick DAY 1..40.

### Pitfalls
- `K.ease` has `out`, `inOut`, `back` only (no `in`); write `p*p` for ease-in.
- `AT.room=cue('no one else in the room')` is the START of the phrase; the word itself is ~1.6 s later. Check which
  word a cue lands on before timing an action to it (print the words with times, see Workflow).
- Moving the end card into `hud` (frame coordinates) makes it independent of the last sheet's camera; the old sheet
  positions convert as frame y = the vertical value of `Y(l, f)` (`f`), sizes = the vertical value of `SZ(l, f)`.
- Count shots with a quick puppeteer script that samples `E.camAt(E.sheetIndex(t), t)` every 0.05 s and splits on
  changes (holds >= 0.3 s); `tools/node_modules/puppeteer-core` is where the renderer's puppeteer lives.

## People that interact, and fire that burns: `_kit/people.js` (PPL) and `_kit/fire.js` (FX)
User feedback on ep. 1: the people were stickers pasted side by side (hands floating over a child, a "carried" child
dangling by the head, identical faces, nobody looking at anyone, figures overlapping) and Sinai's fire was a row of
birthday-candle cut-outs above the peak with no smoke. Then: "the humans don't have to look that lifelike - keep the
same art style, but make them interact more lifelike". Two opt-in kits fix this; existing pages are unchanged.
Load them after the engine: `<script src="../_kit/people.js"></script><script src="../_kit/fire.js"></script>`.

### PPL: the round figures as a rig
Same shapes, colours, dot eyes and halftone paper as `E.chubby` (feet at x,y, ~215*s tall), with a thinner sticker
edge (own `pplHt` filter, dilate 3.4 instead of 6-7) and a soft contact shadow under the feet. New abilities:
- arms are ONE straight stub from the shoulder, like the original round figures (user: "u dont have to put extra joints
  unless nessesarry"). Rest length 54, a reach lengthens it to 86 at most, and it never folds. `near`/`far` = `{x,y}`
  world target for the hand, or `'up' | 'open' | 'chest' | 'cover'` (the stub angles inward) | null (rest: hanging
  straight, slightly out). Near arm draws in front of the body, far behind; an arm that would cross a face goes behind
  the head. `PPL.ik` is kept for pages that call it.
- `kid:true` (no beard; use it on every child), `talk:true` (head bob and moving mouth), `blush:true` to opt into
  cheeks (off by default). Brows show only for fear, awe and surprise. The rig exposes `r.hf`, the head's facing (-1
  when the head turns away from the body), for anything drawn over the head (Pharaoh's nemes in the Ten Plagues).
- `look:{x,y}` moves the pupils toward a point and tilts the head; a target behind turns the head round. `'up'`/`'down'`.
- `expr`: `calm joy tender fear awe sad surprised`, or `[a,b,k]` to blend over a beat (`['awe','joy',prog(t,a,b)]`).
  Wide eyes get white rings, joy gets laughing arcs, brows lift at the inner end for worry/awe; blinks by itself.
- poses: `kneel` 0..1 (drops 24 units, one leg folded back), `sit` with `seat` (world y of a log), `hipAt` (held, legs
  dangle), `jump` (px; the shadow shrinks), `walk` (phase), `lean`, `tilt`.
- rigs: `const r=PPL.rig(o)`; `r.draw('back'|'body'|'head'|'front'|'all')` to interleave figures for depth;
  `r.hand('near')`, `r.shoulder()`, `r.head`, `r.neck`, `r.back(u)`, `r.chest(u)`, `r.W([lx,ly])` for contact points.
- interactions: `PPL.holdHands(a,b,{up})` (shared hand point + clasp on top), `PPL.carry(adult,child,{out})` (child on the
  hip, carrier's near arm under the seat and far arm round it, child's arm round the neck), `PPL.hug(a,b,{k})`,
  `PPL.handOn(a,b,'shoulder'|'back'|'head'|'arm')` (returns the point; draw a's front arm after b), and in the page
  `chain(list,up)` for a line of dancers holding hands.
- In ep. 1 `folk(i,x,y,s,o)` builds options with `person(i,x,y,s,o)` (= `pplOpts`) and draws with PPL; the old
  `reach` still puts the hand where the old figure's hand was, so props held at that point stay in the hand.
Rules that came out of the stills:
- Space round figures ~110*s apart side by side (bodies are 96 wide); children at s .6-.7 next to adults at 1.0.
- Keep reaches short: rest a hand on a head or shoulder rather than stretching across a gap (the user flagged a
  long rubber arm). Move the people closer instead.
- Faces must not merge: in a hug or lift, offset heads so each face reads (child lifted above the father's
  shoulder, mother's head beside his, not behind it).
- Give each person a look target (the fire, the sea, the child, each other). A crowd that stares ahead looks pasted.
- Interactions to reuse: family under the fire (hand on shoulder + hand in hand + child pointing), mother kneeling
  and pulling her child in (fear), wife holding husband's arm while he shields his eyes, father kneeling then lifting
  the running child, mother lifting a child out of the water onto her hip, worshippers kneeling with hands flat on
  the ground, a line of dancers lifting joined hands, a tired family sitting on a log.

### FX: fire on a mountain, kiln smoke, quake
- `const pts=FX.peak(seed,cx,top,{halfW,rough,bottom,crag})` gives a jagged named-mountain outline (not a pyramid).
- `FX.summitFire(t,pts,intensity,quake,{fill,H,cap,rows,smoke,smokeH,drift,light,embers,wrap,sky,rocks,seed})`
  draws the mountain (if `fill`), flames that cling to the ridge within `cap` px of the summit plus `rows` (default 4)
  of flames rising from the upper face (the summit itself burns, denser in the middle), a hot glow on the rock, the
  slopes lit and fading with distance, a billowing kiln-smoke column (lit orange from below, darker and wider as it
  rises, drifting with `drift`), smoke wraps on the shoulders, embers, and a sky/cloud-underside glow.
  Flames: noise-driven flicker, grouped masses with tall leaders, white-yellow core at the base to red tips, licks
  tearing off and fading upward.
- `quake`: a number (0..1) or windows `[[a,b],...]` from `cue()` (ep. 1: `[[AT.trembled-.05,AT.peopleStand+.3]]`):
  the mountain jitters, glowing fissures open and rocks bounce down the slopes. `FX.quakeAmp/FX.shake` for other layers.
- `FX.flames(t,points,{H,sp})` is the same fire along any polyline (fire pits); intensity ramps (`fd` for "descended
  in fire") grow it from nothing.
- Pitfalls: a wide gentle peak makes the fire a burning hedge (keep halfW ~700-1000); smoke made of soft radial blobs
  reads as fog, so puffs are soft-edged paper discs; keep wraps off the centre and low opacity so the dark mountain
  silhouette stays readable under the smoke; small far fires: `rows:2`, `rocks:false`.
- Ep. 1 uses FX on: smoke and fire (descent), kiln (quake), the line (far summit), out of the fire (God speaks), the
  camp listens (Exodus 20:2), who he is, the first command, not here, a feast to the LORD, plus fire pits.

## User notes from the episode 1 review (Nov 2026) — apply to every episode
- Camera: at most ONE slow move per shot (push-in or pan, >= 2-3 s) or a still hold; never bounce in and out.
  Set `gentleZoom:true` in E.start and keep zoom changes within a sheet <= ~1.3x; reach a different framing by a CUT.
  Focus punch/shake only on 2-3 big moments per episode. The opening is one slow push-in, no pull-backs.
- People: the round house figures (PPL), NOT tall realistic ones. Make them interact: hands meet, children carried on
  the hip with an arm round them, hugs, hands on shoulders, eyes on each other or on the subject, feet on the ground.
  Arms never stretch (PPL clamps). Props held in front of the body with the hand on them (a walking stick stands
  in front, drawn over the body and under the gripping hand). Keep the same eye style for people in one scene.
  No figure walking through another.
- Fire on mountains: FX.summitFire — the whole summit burns, kiln smoke from the fire, firelight on the slopes,
  mountain stays a clear silhouette.
- One label at a time; verse cards and labels in frame space (hud); end card in hud; then tools/append-outro.sh.

## Scenery kit: `_kit/scenery.js` (SC) — rich settings and big animals
User feedback (Nov 2026): "why does every video look so boring with small animals and background, make it more
interesting". Causes: people ~20% of the frame on a thin ground line mid-frame; flat gradient sky + one or two smooth
ridges; the same glowing-flower grass (`fore`) below the captions in every scene; animals as small white stickers.
Load after the engine (opt-in, nothing else changes): `<script src="../_kit/scenery.js"></script>`. Prototypes:
ep. 6 `floodS`, ep. 7 `rainbowArk`; full API in the file header.
- Sky and light: `SC.sky(t,{mood:'dawn|day|golden|dusk|night|clearing',hz})`, `SC.sun`, `SC.godRays`, `SC.clouds`
  (layered, lit from the sun, `storm` remnants), `SC.birds`, `SC.rainbow` (7 bands, glow, faint second bow, draw-on `p`),
  `SC.light` (warm rim glow behind subjects), `SC.haze`, `SC.vig`.
- Terrain far -> near: `SC.range` (peaks, lit faces, snow, haze), `SC.hills` (terraces, fields, trees), `SC.ground`
  (blades, stones, tufts, flowers, wet glints), `SC.profile/yAt/fill` for a named ridge or ledge, `SC.rock`, `SC.puddle`
  (sky + upside-down rainbow reflection, ripples), `SC.tree` (round/olive/cypress/palm/acacia), `SC.tuft`, `SC.flower`,
  `SC.reeds`, `SC.house`. Whole backgrounds: `SC.env(t,'meadow'|'river'|'desert'|'village',{mood,gy})`.
- Foreground framing: `SC.fore(t,{y,edges:[xl,xr],cols,flowers,rockAt,wet,reeds,under,over})` — big blades and tall
  clumps at the frame edges (set `edges` to the visible sheet x at the shot's zoom), rocks, flowers, dew. Use it
  INSTEAD of the sheet's `fore:` grass (drop `fore` from the sheet). `under` = puddles, `over` = lambs/birds in the grass.
- Animals: `SC.animal(t,kind,x,y,s,o)` / `SC.pair(...)` (male + female behind), kinds sheep goat ox cow donkey camel lion
  deer dove bird; feet at x,y, s=1 matches a PPL person at s=1. `walk:t*5`, `graze:'auto'`, `look`, `fly`, `leaf`
  (dove with olive leaf), `flat` for tiny far ones. They breathe, blink, flick tails, twitch ears, bob while grazing.
Rules:
- Subjects big: the main characters 35-45% of the frame height in the held framing (PPL s ~2.4-2.9 at zoom 1.1-1.2,
  feet at frame ~1190). Two big adults need ~375 sheet px between centres (heads are ~325 wide at s 2.9) and their
  faces must not touch: put the woman (back hair) on the side away from the man's face, or a little behind and smaller.
- Gestures with big figures: reach forward at shoulder height (an up-pointing near arm crosses the face).
- Layered depth in every scene: sky -> sun/rays/clouds -> hazy range -> textured hills -> near ground -> subjects ->
  foreground framing -> light. Things farther away are higher and smaller (perspective scale by ground y).
- The lower frame (below the captions) is a place, not filler: puddles, a rock with birds, a grazing pair, flowers,
  each scene different. Keep faces out of 1220-1340 and the label line 1430.
- Recognisable animals, big enough to read, in pairs; a procession on a path whose scale grows toward the camera.
- Objects rest on things: the ark's keel sits on a ledge (`SC.profile` with a flat tilted segment, tilt from the two
  ends, rocks/tufts over the keel line, ramp foot on the ground). Never floating.
- Cost: every animal/person carries a halftone filter; ~15 animals + 8 people per sheet rendered fine.

## Settings that are not bland: the Ten Plagues backdrop kit (Nov 2026)
User notes: "houses look bland, refine it", then "background looks bland fix it". The worked example is
`videos/the-ten-plagues/episode.html`, the "backdrop kit" and `mudHouse()` blocks; copy them into a new episode, or
move them into `_kit` if a third episode needs them.
- `eSky(t,kind,{hz,sun,moon,seed})`: banded gradient sky per mood, with paper strata, stars, a haloed moon, layered
  clouds and horizon haze. Give each story beat its own colour (the plagues: blood, plague green-gold, storm, locust
  ochre, dark, night, dawn, gold).
- Landmark silhouettes: `pyramid`, `obelisk`, `pylon` (temple gate with flags and sun disc), `palms`, `sailboat`.
- Mid-ground: `field`, `granary`, `stall`, `pen`. The palace gets a frieze, hieroglyph bands, statues in niches and
  braziers with embers.
- A foreground that belongs to the place, instead of the same `SC.fore` grass and rock every time:
  `forePapyrus` (river), `foreSteps` (palace: steps, column bases, tiled floor, rug), `foreBarley` (fields; `bare`
  for after the locusts), `foreWall` (village: mud-brick wall, jars, lamp, cobbled lane).
- `motes(t,kind,...)`: dust, ash, ember, green, spark particles matching the scene.
- `mudHouse(t,x,y,s,o)`: brick courses, parapet and beam ends, `storey`, `ladder`, awning, lattice window, lamplight
  spill, jars and basket, laundry, `smoke`; `egypt` (whitewashed, blue trim), `night`, `dim`; `mark` paints the lintel
  and both posts red, with drips, hyssop and a bowl. Put a back row of smaller houses behind three big ones so the
  village fills the middle third.
- Pitfall: `K.mix` returns `rgb(...)`, so `mix(mix(a,b),c)` is invalid and renders BLACK (the black roofs). Chain
  colours with `SC.mx` (hex in, hex out), or only ever pass hex to `mix`.
- `tools/standin-words.js <script.md> <words.js>` makes stand-in word timings from a script, so a page can be drawn
  and checked before the narration exists; `align_words.py` output replaces it.
