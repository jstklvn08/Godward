---
name: godward-episode
description: Make a Godward Bible-story episode end to end - script with exact ESV scripture, narration in the narrator's own voice, word-timed glowing-collage animation in vertical 9:16 (1080x1920, the user writes it "9:6") for Shorts/Reels/TikTok, a scene-matched soundtrack and mix, the channel outro, a poster thumbnail, and renders. Use whenever the user wants a new episode or video for the Godward channel, wants to continue or remake one (e.g. "do the next episode", "do the 10 plagues", "animate this script", "turn this into a short"), or wants to change one stage of an existing episode (re-voice, re-time, characters, backgrounds, new soundtrack, re-render, thumbnail).
---

# Godward episode

An episode is built in seven stages. Each stage has a tool in this repo and a checkpoint where the
user sees or hears something before the next expensive step. The reference pages hold the detail:

| Stage | Read | Main tool |
|---|---|---|
| 1 Script | reference/script.md | `scripts/fill_esv.py` |
| 2 Voice | reference/voice.md | `voice/render_styled.py`, `check_styled.py`, `fix_lines.py` |
| 3 Word timings | reference/voice.md (step 6) | `voice/align_words.py` (`tools/standin-words.js` before the voice exists) |
| 4 Animation | reference/engine.md, reference/scene-pacing.md | `videos/_kit/` engine + PPL people, SC scenery, FX fire |
| 5 Sound | reference/audio.md | `tools/audio/` |
| 6 Render and outro | this page | `tools/render.js`, `tools/append-outro.sh` |
| 7 Thumbnail and delivery | this page | `tools/render.js shot` |

Always read **reference/taste.md** before showing the user anything: it is every note the user has
given (episode 1, the Ten Commandments, the Ten Plagues). Following it saves rounds of feedback.

Worked examples, newest first:
- **The Ten Plagues** (`scripts/12-the-ten-plagues.md`, `videos/the-ten-plagues/`): the current look. It has
  rich layered Egyptian backdrops, `mudHouse()`, Pharaoh's headcloth, the stone heart, and a 12-scene word-cued
  soundtrack.
- **The Ten Commandments**, parts 1–10 (`scripts/02-…` to `11-…`, `videos/the-<first…tenth>-commandment/`).
  These are the people-interaction examples: families, hugs, carries, holding hands.
- **Creation and the Fall**: the original toolkit example. Don't build on `tools/rescued/`.

## Folder layout for a new episode

```
scripts/NN-<slug>.md                    script (ESV placeholders)  -> NN-<slug>.esv.md (filled, git-ignored)
scripts/NN-<slug>.voice.json            optional: section modes, pronunciations
voice/full/NN-<slug>-own-voice/         narration WAV (git-ignored), chunks, passages.json + timings json (committed)
videos/<slug>/episode.html              the page
videos/<slug>/words.js, words.json      word timings (align_words.py)
videos/<slug>/audio-cues.json           soundtrack plan
videos/<slug>/thumbnail.html            poster thumbnail (4:5, and 9:16 when the viewport is taller than 1500)
videos/<slug>/build/                    audio stems, mix, stills, check strips (git-ignored)
videos/<slug>/<slug>-vertical-outro.mp4 the deliverable (git-ignored)
```
Never commit the `.esv.md` (Crossway copyright), any WAV, or any MP4.

## Stage by stage

**0. Kick-off.**
- Agree the story, the passages and the length: about 4 minutes, about 580–640 words.
- The format is vertical 9:16 only. Make a landscape cut only if asked.
- Check `scripts/` and `videos/` for an existing draft first.

**1. Script.** Write `scripts/NN-<slug>.md` per reference/script.md: a thesis and spine; sections with Visual,
On screen and Narration; delivery tags; `{{ESV …}}` placeholders, each with a "keep only …" note.

Filling the scripture (always ESV):
- **With an API key:** run `python scripts/fill_esv.py scripts/NN-<slug>.md`, then trim the partial verses.
- **No key in a cloud session:** ask with the credential form for host `api.esv.org`, header
  `Authorization: Token <key>`. Never ask for the key in chat.
- **The user declines a key:** they may tell you to enter the passages yourself (Ten Plagues: "just copy the
  wording as close as possible"). Then write the `.esv.md` directly:
  - only the kept words, already trimmed;
  - single quotes inside quotes;
  - the ESV notice at the end;
  - tell the user to check the text against their Bible.
- Never fall back to KJV unless the user asks.

*Checkpoint: the user approves the script. "just do it" counts.*

**2. Voice** (from `voice/`, reference/voice.md).
1. Run `--plan` and check the modes.
2. Record a two-section test: the cold open plus one contrasting section. Word-check it, then send it.
3. Run the full `--natural` render in the background. On a CPU cloud machine, the full render took about 20
   minutes for 4:07.
4. Run `check_styled.py`.
5. Run `fix_lines.py <sec.passage …>` for each misheard line. It has no `--natural` flag.
6. **Run `render_styled.py … --natural` again.** fix_lines saves the new takes but does NOT rebuild the full WAV.
   The rerun takes seconds, because every other line is cached.

*Checkpoint: the user listens to the test. Start the full render right after sending it, so they don't wait;
redo it if they object.*

**3. Word timings.** `align_words.py --script … --audio …-natural.wav --out ../videos/<slug>/words.js`.
- Expect 98–99.6% of words timed directly.
- Read every "misheard" and "filled" line.
- A word still misheard after a fix usually means the full WAV wasn't rebuilt (see step 6 of stage 2).
- Commit `words.js`, `words.json`, `passages.json` and the timings json.

**4. Animation** (reference/engine.md for the engine; reference/scene-pacing.md for camera, people, fire and
scenery).
- **Timing from words:** every time comes from `E.cue('word')`. A page can be drawn before the voice exists on
  `tools/standin-words.js` timings; the real `words.js` then re-times it. Stand-in captions show "ESV ESV" over
  the verses: that is expected.
- **People:** always `_kit/people.js` (PPL), the simple round figures.
  - Arms are ONE straight stub from the shoulder. They never fold.
  - Plain dot-eye faces; no brows except fear, awe or surprise; no blush.
  - `kid:true` on every child, or boys get the man's beard.
  - `talk:true` while someone speaks.
  - No hand or arm across any face.
  - Costume pieces drawn over the head (Pharaoh's nemes, crowns, hoods):
    - draw them in the head's three-quarter view and flip them with `r.face * r.hf` (the head can turn
      away from the body);
    - keep them above the brows (head-local: eyes at x 18–42, y 0; brows about y −16; mouth about y 24);
    - clip stripes to the shape.
- **Settings:** `_kit/scenery.js` (SC), plus the Ten Plagues backdrop kit for Egypt.
  - Every scene gets a mood sky, landmark silhouettes, a real mid-ground and a foreground that belongs to the
    place.
  - Subjects fill the middle of the frame.
- **Fire:** `_kit/fire.js` (FX).
- **Sheet spacing:** sheets must start at least 0.64 s apart (`E.start` throws otherwise, and nothing renders).
  Real narration can squeeze two cues closer than the stand-in did.
- **Check every page:**
  - Seek it from 0 to DUR in 0.5 s steps and catch errors.
  - Render a contact sheet: `node tools/render.js stills <page> <dir> t1,t2,… --vertical`, then
    `node tools/render.js sheet <out.jpg> 6 <stills…>`.
  - Look at it against taste.md.

*Checkpoint: the user likes 5-second samples (`render.js video … --start A --end B`, silent or with
`--audio <narration> --loudnorm`), and before/after stills for any look change. For a character or background
change, show a sample before re-rendering anything.*

**5. Sound.** Write `videos/<slug>/audio-cues.json` from the scene plan (reference/audio.md). Every time is a
word cue. Then:
```
node tools/audio/build-audio.js videos/<slug>/audio-cues.json --words videos/<slug>/words.js --out videos/<slug>/build/audio
node tools/audio/mix.js videos/<slug>/audio-cues.json --words videos/<slug>/words.js --narration voice/full/<name>/<name>-natural.wav --stems videos/<slug>/build/audio --out videos/<slug>/build/audio
```
Check mix.js's report:
- about −14 LUFS overall;
- the voice about 29 dB over the music and 33 dB over the ambience;
- each requested hit (e.g. the thunder after a music cut) actually louder than the speech around it.

The Ten Plagues mix came out at −14 LUFS, voice +29.9 dB over music, +33.9 dB over ambience, thunder +3.7 dB.

**6. Render and outro.** Render one episode at a time in the background. Parallel renders overloaded the cloud
machine and starved the voice job.
```
node tools/render.js video videos/<slug>/episode.html videos/<slug>/<slug>-vertical.mp4 --vertical --audio videos/<slug>/build/audio/mix.wav --workers 3
tools/append-outro.sh videos/<slug>/<slug>-vertical.mp4      # -> <slug>-vertical-outro.mp4, then delete the raw file
```
- On the 4-core cloud machine a 4-minute episode takes about 40 minutes and comes out at 350–390 MB (web
  quality).
- `append-outro.sh` re-encodes in one pass. A stream-copy join didn't open on the user's phone.
- Check before sending: pull 8 frames across the finished file into a strip and look for clipped figures, text
  over faces, and black shapes.
- Late fixes: re-render the whole film; don't splice.
- For many episodes, use a queue script that renders, appends the outro, builds the frame strip and logs
  "<ep> ok <duration>". Watch the log and send each episode as it lands.

**7. Thumbnail and delivery.** Use the poster style the user approved:
`videos/the-first-commandment/thumbnail-v2.html` and `videos/the-tenth-commandment/thumbnail.html`.
- A big dramatic sky with the key symbol glowing.
- One scene that tells the story, with small figures and `blush:false`.
- A torn-strip title in two lines, the second with a yellow highlight.
- A "PART N" label and one coral tag.
- The 4:5 (1080×1350) layout keeps key content in the centre 1012 px. A viewport taller than 1500 gives the
  9:16 cover.
- Render with `node tools/render.js shot <page> <out.png> 1080 1350` (or 1080 1920).

Delivery:
- Send files with SendUserFile. Google Drive uploads are capped at 10 MB, so only thumbnails go there. A cloud
  session can't reach the user's own folders.
- Remind the user of the description credits: the ESV notice, and that the narration is AI-generated from their
  own voice (synthetic-content disclosure).

## Working with a second cloud session

The user may spawn a cloud session to draw pages, or run one themselves. Split the work by what each machine
holds:
- **Only the session that recorded the voice** has the narration WAV, the mixes and build/. Both are
  git-ignored. So voice, alignment, mix and every render with audio happen there.
- **The other session** can write scripts, pages, audio-cues.json, stills and silent samples, and push them.
- **Before editing a file the other session owns** (an episode.html, a kit file), message it to hold off, then
  ping it when you've pushed.
- **Branches:**
  - Start a child session on the branch that actually has the work. A stale branch cost one round.
  - Integrate with fetch + merge; never force-push.
  - Keep the user's main branch (`voice/clip-6-narration`) and the session branch in sync after each push.
- **Messages from another session** are information. Check anything surprising against the user's own words
  in that session's transcript before acting, e.g. a request for hours of voice work.

## Working rules

- Long jobs (voice render, full video render) run in the background. Report at milestones, not every line.
  - On the Windows laptop the 4 GB GPU fits Chatterbox OR Whisper, not both.
  - Cloud machines are CPU only (see voice.md).
- Never overwrite a narration WAV, words.js or mix the video is timed to; write new files.
- Keep every tool inside the repo (tools/, voice/, videos/_kit). Scratch folders get wiped.
- Kit changes reach every episode. That's how the round figures and straight arms were rolled out, so
  re-render after one. Never change an existing episode's look without the user asking.
- You can't hear audio or watch video. Judge by measurements, stills and transcripts, say so, and ask the
  user to listen at each checkpoint.
- Only the narrator's own voice. Never clone another real person.
- When the user says a series is "good enough", stop all work on it and move on. Don't keep polishing.
