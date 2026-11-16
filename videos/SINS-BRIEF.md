# Brief: build one "7 Deadly Sins" episode page in the Godward engine

You are building ONE episode page for the Godward channel, in this repo (/home/user/godward, branch claude/seven-deadly-sins).
The user chose to rebuild the series "The 7 Deadly Sins and What the Bible Says About Each" in the house engine so it
looks like The Ten Plagues. Work only inside your episode folder `videos/the-seven-deadly-sins-<slug>/`.

## Read first (in this order)
1. `.claude/skills/godward-episode/SKILL.md` (stage 4 Animation), `reference/taste.md`, `reference/engine.md`,
   `reference/scene-pacing.md`. These are the rules. Follow them: one slow camera move or a hold per sheet
   (gentleZoom:true), cuts for pace, a new setting every ~4-7 s, PPL round figures acting the line, one label at a time
   (TAGS in hud), verse cards in hud, faces out of frame y 1220-1340, never empty bands, God never a figure.
2. The template: `videos/the-seven-deadly-sins-pride/episode.html` (the approved sample: head block, Ten Plagues kit
   copied in, Babylon pieces, sheets, TAGS/hud, sheet list, E.start). Copy its structure. Reuse the copied kit
   (mudHouse, eSky, palms, foreWall/foreSteps/foreBarley/forePapyrus, motes, palace, jar...) and SC/PPL/FX.
3. Your episode's scene plan: the Remotion version in `/home/user/ads/studio/remotion/src/godward/sins/<file>.tsx`.
   Each sheet there is one beat with its cue words and what is drawn (people, props, tags, quote cards). Use it as the
   storyboard: keep its beats and its literal pictures (every phrase shown), redraw them with PPL/SC/kit.
   The script: `/home/user/ads/community/godward/video/seven-deadly-sins/<dir>/script.md` and `vo/lines.json`.
4. Your `words.js` is already in your folder. Every time in the page comes from `E.cue/E.end/E.after` on spoken words
   (a missing word throws at load, which is good). Never type raw seconds.

## Content rules (series)
- ESV quotes on verse cards must be EXACTLY the quote cards' text in the Remotion file (already checked verbatim).
  Use `verse()` in hud like the Ten Plagues VERSES list, with `hl` the highlighted phrase and the ref ending "ESV".
  Only show a card for text the narrator reads (quote marks in lines.json); retold lines get no card.
- God is never shown as a person: light, a voice, words of light. Jesus is not drawn either (light, footprints, a cross of light).
- Modesty: nothing sensual. Violence told, not shown (a fallen staff or spear, a shadow, never a body).
- No "Part N" labels. The frame-0 hook: the first sheet's first frames must already read (a TAG with the hook text from
  `SinsRoot.tsx` `hook:` in /home/user/ads/studio/remotion/src/godward/sins/SinsRoot.tsx is good, at [0, end of first line]).
- End: an endCard in hud like the Ten Plagues (series title + episode title + Crossway ESV notice), no "NEXT" line
  unless obvious; tail 7, fadeOut 1.2.

## Checking (required before you report)
- Load check: `cd /home/user/godward && CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tools/render.js stills videos/the-seven-deadly-sins-<slug>/episode.html /tmp/claude-0/gw/<slug>-a 2 --vertical`
  must succeed (E.start smoke-tests every sheet; sheets >= 0.64 s apart).
- Contact sheets: stills at the middle of every sheet (and every verse/label entry), `--vertical`, in batches of <= 12,
  then `node tools/render.js sheet <out.jpg> 6 <stills...>` and LOOK at them. Fix: faces in the caption band, things cut
  at the frame edge, empty bands, labels over faces/cards, figures floating, wrong scale. Repeat until clean.
- Seek the whole page from 0 to DUR in 0.5 s steps for errors (a stills run over every 0.5 s is too slow: use a small
  puppeteer loop like render.js does, or stills every ~3 s plus E.start's own smoke test).

## Do NOT
- Do not render full videos or long samples (the coordinator renders one at a time; the CPU is shared with a voice job).
- Do not commit, push, or edit anything outside your episode folder (no kit edits; copy what you need into your page).
- Do not kill or pause any process (a Chatterbox voice job is running; leave it alone).
- Keep stills runs modest (one at a time in your session).

## Report back (short)
Sheet count, any rule you could not meet, the path of your final contact sheet(s), and anything the coordinator must
know (e.g. words you cued that may change when the real narration replaces stand-in timings).
