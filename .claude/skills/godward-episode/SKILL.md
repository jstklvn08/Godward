---
name: godward-episode
description: Make a Godward Bible-story episode end to end, the way "Creation and the Fall" was made - script with exact ESV scripture, narration in the narrator's own voice, word-timed glowing-collage animation in vertical 9:16 (1080x1920, the user writes it "9:6") for Shorts/Reels/TikTok, a scene-matched soundtrack and mix, thumbnails, and renders. Use whenever the user wants a new episode or video for the Godward channel, wants to continue or remake one (e.g. "do the next episode", "make the Ten Commandments video", "animate this script", "turn this into a short"), or wants to change one stage of an existing episode (re-voice, re-time, new soundtrack, re-render, thumbnail).
---

# Godward episode

An episode is built in seven stages. Each stage has a tool in this repo and a checkpoint where the
user sees or hears something before the next expensive step. The reference pages hold the detail:

| Stage | Read | Main tool |
|---|---|---|
| 1 Script | reference/script.md | `scripts/fill_esv.py` |
| 2 Voice | reference/voice.md | `voice/render_styled.py`, `fix_lines.py`, `check_styled.py` |
| 3 Word timings | reference/voice.md (step 6) | `voice/align_words.py` |
| 4 Animation | reference/engine.md | `videos/_kit/episode-engine.js`, `videos/_template/` |
| 5 Sound | reference/audio.md | `tools/audio/` |
| 6 Render | this page | `tools/render.js` |
| 7 Thumbnail and delivery | this page | `tools/render.js shot` |

Always read **reference/taste.md** before showing the user anything: it is every note the user
gave on episode 1, and following it saves rounds of feedback.

The first episode is the worked example: `scripts/creation-and-the-fall-genesis-1-3-script.md`,
`voice/full/genesis-1-3-own-voice/`, `videos/creation-and-the-fall/episode-creation-and-the-fall.html`
(the finished page; its vertical render is `episode-creation-and-the-fall-vertical.mp4`), and
`videos/creation-and-the-fall/audio-cues.json`. Older one-off tools it was made with are kept in
`tools/rescued/` for reference only; don't build on them.

## Folder layout for a new episode

```
scripts/NN-<slug>.md            script (ESV placeholders)      -> NN-<slug>.esv.md (filled, git-ignored)
scripts/NN-<slug>.voice.json    optional: section modes, pronunciations
voice/full/NN-<slug>/           narration renders, chunks, passages.json
videos/<slug>/episode.html      the page (copied from videos/_template/)
videos/<slug>/words.js          word timings (align_words.py)
videos/<slug>/audio-cues.json   soundtrack plan
videos/<slug>/build/            audio stems, mix, stills, samples (git-ignored)
videos/<slug>/<slug>-vertical.mp4, thumbnail-ig-4x5.png
```

## Stage by stage

**0. Kick-off.** Agree the story, the Bible passages, target length (episode 1: 4:21, 639 words)
The format is vertical 9:16 only (1080×1920; the user calls it "9:6"). Make a landscape cut only
if the user asks for one. Check what already exists: `scripts/` and `videos/`
may already hold a draft (the Ten Commandments has two scripts and a 30 s cold open).

**1. Script.** Write `scripts/NN-<slug>.md` per reference/script.md: thesis and spine, sections
with Visual / On screen / Narration, delivery tags and pause markers, `{{ESV ...}}` placeholders.
Fill scripture with `python scripts/fill_esv.py scripts/NN-<slug>.md`. Scripture is always ESV
(key in `.env`; see reference/script.md). No working key: stop and ask, don't fall back to KJV.
*Checkpoint: the user approves the script.*

**2. Voice.** From `voice/`: `--plan`, then a two-section test (send it), then the full natural
render in the background, then `check_styled.py` and `fix_lines.py` for any wrong words.
*Checkpoint: the user listens to the test, then to the full narration.*

**3. Word timings.** `align_words.py ... --out ..\videos\<slug>\words.js`. Read its report: listen
to (or check) any "filled" stretch.

**4. Animation.** Copy `videos/_template/` to `videos/<slug>/`, replace the `// EPISODE:` parts:
cast, palettes, one sheet per story beat, cameras, focus beats, talk windows. Every time comes
from `E.cue('word')`, never typed seconds, so re-voicing re-times everything. Draw in the house
style (paper sheets, glowing round characters, torn verse strips, coral marker, grain); reuse
`window.S` (style-kit) pieces before inventing new ones.
- After each sheet: `node tools/render.js stills videos/<slug>/episode.html videos/<slug>/build/stills <times> --vertical`,
  then `node tools/render.js sheet <out.jpg> 4 <stills...>` and look at
  the contact sheet. Check it against taste.md: no empty bands, nothing clipped, labels clear of
  words and characters, framing on the subject, captions readable.
- Long episodes: sheets are independent functions, so several can be drawn in parallel by
  subagents (each gets engine.md, taste.md, its script section and its sheet's time range), then
  merged and checked together.
*Checkpoint: send a 30-60 s vertical sample with narration (`render.js video ... --vertical --start A --end B --audio <narration> --loudnorm`)
before the rest is drawn, and again after big changes.*

**5. Sound.** Write `videos/<slug>/audio-cues.json` from the scene plan (reference/audio.md has the
scene-by-scene template; `videos/creation-and-the-fall/audio-cues.json` is episode 1's). Use word
cues (`{"word":"spoke","offset":-0.5}`) for every time, so re-voicing re-times the sound. Then:
```
node tools/audio/build-audio.js videos/<slug>/audio-cues.json --words videos/<slug>/words.js --out videos/<slug>/build/audio
node tools/audio/mix.js videos/<slug>/audio-cues.json --words videos/<slug>/words.js --narration voice/full/<name>/<name>-natural.wav --stems videos/<slug>/build/audio --out videos/<slug>/build/audio
node tools/audio/measure.js windows videos/<slug>/build/audio/mix.wav 3-5 10-11
```
Check mix-report.json: about −14 LUFS, voice about 29 dB over music and 33 dB over ambience,
moments the user asked for (e.g. thunder) actually louder than the speech around them; in
episode 1 the thunder ended up only about 4–5 dB over speech, so raise `mix.hits` volume if the
user wants it to be the peak. *Checkpoint: send a 30-45 s preview of the mix (the opening and one
busy scene).*

**6. Render.** Full renders run in the background (about 6 minutes per 4:20 with 6 workers):
```
node tools/render.js video videos/<slug>/episode.html videos/<slug>/<slug>-vertical.mp4 --vertical --audio videos/<slug>/build/mix.wav --workers 6
```
Vertical only. The page still draws a landscape cut (it is how the engine works), but don't render or
check it unless the user asks; then drop `--vertical` and write `<slug>.mp4`.
`--quality web` (default) gives about 11 Mb/s instead of episode 1's 40 Mb/s (about 360 MB instead
of 1.3 GB for 4:20) and is what the platforms re-encode to anyway; use `--quality master` only for
an archive copy. Late fixes: re-render the whole film (6 minutes) rather than splicing segments,
which re-encodes and loses quality. Spot-check a few frames of the result before sending it.

**7. Thumbnail and delivery.** Build `thumbnail-ig-4x5.html` (1080×1350, key content in the centre
1012 px) like `videos/creation-and-the-fall/thumbnail-ig-4x5.html` (a 1280×720 YouTube one only if a
landscape cut was asked for);
render with `node tools/render.js shot <page.html> <out.png> 1080 1350` (the page sets
`window.ready=true` when drawn). Deliver with SendUserFile. Remind the user of the description
credits: ESV notice, and that the narration is AI-generated from their own voice (YouTube's
synthetic-content disclosure). Offer to commit the sources (not the MP4s or stems).
Newer thumbnails draw the episode's own cast and setting with the kits (`people.js`, `scenery.js`):
`videos/the-ten-plagues/thumbnail-ig-4x5.html` loads them directly (no engine; pass `t` to `PPL.rig`) and shows
one big figure acting the story (Moses' staff over the red Nile), the title on torn strips with the key words
highlighted, a coral reference tag, and a few story details (frogs, a Passover doorframe). Keep the main figure
and title inside the centre 1012 px; check the PNG before sending.

## Working rules

- Long jobs (voice render, full video render) run in the background; report progress at
  milestones, not every line. The 4 GB GPU runs one model at a time.
- Never overwrite a narration WAV, words.js or mix the video is timed to; write new files.
- Keep every tool inside the repo (tools/, voice/, videos/_kit). Scratch folders get wiped; the
  first episode nearly lost its renderer and mix that way.
- Don't edit `videos/_kit/shared.js` or `style-kit.js` in ways that change existing episodes; add
  new helpers to the engine or the episode page.
- You cannot hear audio or watch video: judge by measurements, stills and transcripts, say so,
  and ask the user to listen at each checkpoint.
- Only the narrator's own voice. Never clone another real person.
- Split work across sessions (Nov 2026, the Ten Plagues): a cloud session without the ESV key, voice model or
  narration WAVs can still write the script, draw the whole page on stand-in timings
  (`node tools/standin-words.js scripts/NN-<slug>.md videos/<slug>/words.js`), write `audio-cues.json` and check that
  `build-audio.js` resolves every cue. The session with the audio fills the ESV, records, aligns, pushes `words.js`, and
  does the mix, renders and outro. After the real `words.js` lands, seek the whole page (0..DUR in 0.5 s steps) for
  sheet-order errors before anyone renders, and re-check every scene's stills.
- Pharaoh (and any royal or god figure) uses a headcloth that follows the head's facing (`r.hf` from people.js),
  sits above the brows and never covers the eyes; give him a stern pose, not a raised "dab" arm. Show a hard heart
  as a cracked stone heart, not a grey disc.
