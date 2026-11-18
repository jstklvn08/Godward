---
name: godward-episode
description: Make a Godward Bible-story episode end to end - script with exact ESV scripture, narration in the narrator's own voice, word-timed glowing-collage animation in vertical 9:16 (1080x1920, the user writes it "9:6") for Shorts/Reels/TikTok, a scene-matched soundtrack and mix, the Godward brand outro on every finished video, a thumbnail, and renders. Works locally or in a cloud session. Use whenever the user wants a new episode or video for the Godward channel, wants to continue or remake one (e.g. "do the next episode", "do the 10 plagues", "animate this script", "turn this into a short"), or wants to change one stage of an existing episode (re-voice, re-time, characters, backgrounds, new soundtrack, re-render, thumbnail).
---

# Godward episode

An episode is built in nine stages. Each stage has a tool in this repo and a checkpoint where the
user sees or hears something before the next expensive step. The reference pages hold the detail:

| Stage | Read | Main tool |
|---|---|---|
| 1 Script | reference/script.md | `scripts/fill_esv.py` (`--bg` with no key), `scripts/trim_verses.py` |
| 2 Voice | reference/voice.md | `voice/render_styled.py`, `check_styled.py`, `fix_lines.py` |
| 3 Word timings | reference/voice.md (step 6) | `voice/align_words.py` (`tools/standin-words.js` before the voice exists) |
| 4 Animation | reference/engine.md, reference/scene-pacing.md | `videos/_kit/` engine + PPL people, SC scenery, FX fire |
| 5 Sound | reference/audio.md | `tools/audio/` |
| 6 Render | this page | `tools/render.js` |
| 7 Outro, thumbnail, delivery | this page | `tools/append-outro.sh`, `tools/render.js shot` |
| 8 Caption / description (IG Reel) | this page | `videos/<slug>/caption-ig.txt` |
| 9 Post pack | this page | `tools/package.js` |

Always read **reference/taste.md** before showing the user anything: it is every note the user has
given (episode 1, the Ten Commandments, the Ten Plagues). Following it saves rounds of feedback.

Worked examples, newest first:
- **The Ten Plagues** (`scripts/12-the-ten-plagues.md`, `videos/the-ten-plagues/`): the current look.
  - Layered Egyptian backdrops and `mudHouse()`.
  - Pharaoh's headcloth and the stone heart.
  - A 12-scene word-cued soundtrack.
  - A kit-drawn thumbnail.
- **The Red Sea** reuses its kit.
- **The Ten Commandments**, parts 1–10: the people-interaction examples (families, hugs, carries, holding hands).
  `videos/the-first-commandment/episode.html` is the scene-pacing remake: many short sheets, one label at a
  time, a calm camera.
- **Creation and the Fall**: the original toolkit example. Don't build on `tools/rescued/`.

## Folder layout for a new episode

```
scripts/NN-<slug>.md                    script (ESV placeholders)  -> NN-<slug>.esv.md (filled, git-ignored)
scripts/NN-<slug>.esv.voice.json        optional sidecar: modes, pace, gaps, pronunciations (named after the --script file)
voice/full/NN-<slug>-own-voice/         narration WAV, chunks, passages.json + timings json
videos/<slug>/episode.html              the page
videos/<slug>/words.js, words.json      word timings (align_words.py)
videos/<slug>/audio-cues.json           soundtrack plan
videos/<slug>/thumbnail-ig-4x5.html     thumbnail page -> thumbnail-ig-4x5.png
videos/<slug>/build/                    audio stems, mix, stills, check strips (git-ignored)
videos/<slug>/<slug>-vertical.mp4       render -> <slug>-vertical-outro.mp4 (the deliverable; git-ignored)
videos/<slug>/caption-ig.txt            IG Reel caption (stage 8)
posts/<slug>/                           post pack: reel, cover, caption (tools/package.js; git-ignored)
```
Never commit the `.esv.md` (Crossway copyright) or any MP4. WAVs are git-ignored too. The only exception is
the cloud hand-back below.

## Episodes so far

| Series | Slugs | State (Nov 2026) |
|---|---|---|
| Creation and the Fall | `creation-and-the-fall` | finished, vertical + outro |
| The Ten Commandments, parts 1-10 | `the-first-commandment` … `the-tenth-commandment` (scripts `02-` to `11-`) | finished in the cloud with the round-figure characters + outro; the user called them final ("good enough") |
| The Ten Plagues of Egypt | `the-ten-plagues` (script `12-`) | finished in the cloud: 4:20 with outro, thumbnail |
| The Red Sea | `the-red-sea` (script `13-`) | script approved; first-draft page on provisional timings; voice next |

What to make next: `Godward-Content-Report.html` (viewership research, 9 Nov 2026). Old Testament stories beat
Bible study and prayer.
- **Ranked next:** Jericho, Job, David and Goliath, Samson, Daniel, Every Beast in Revelation.
- **Big-hook topics:** every angel in the Bible, the story from Satan's point of view, what happens after death.
- **Each video stands alone:** no "Part 1 / Part 2" titles or labels.

## Stage by stage

**0. Kick-off.**
- Agree the story, the passages and the length: about 4 minutes, about 580–640 words.
- The format is vertical 9:16 only. Make a landscape cut only if asked.
- Check `scripts/`, `videos/` and the remote branches (`git fetch`) for a draft before starting.

**1. Script.** Write `scripts/NN-<slug>.md` per reference/script.md: a thesis and spine; sections with Visual,
On screen and Narration; delivery tags; `{{ESV …}}` placeholders, each with a "keep only …" note.

Fill and trim the scripture (always ESV):
```
python scripts/fill_esv.py scripts/NN-<slug>.md          # ESV API key from .env
python scripts/fill_esv.py scripts/NN-<slug>.md --bg     # no key: Bible Gateway's ESV page
python scripts/trim_verses.py scripts/NN-<slug>.esv.md   # partial verses; add a rule per new partial verse
```
- **No key in a cloud session:** prefer `--bg`. Check long verses word for word, because fetches can come back
  partial.
- **A key the user wants to add:** ask with the credential form (host `api.esv.org`, header
  `Authorization: Token <key>`), never in chat.
- **Never type scripture from memory** unless the user tells you to (Ten Plagues: "just copy the wording as close
  as possible"). Then write the trimmed text into the `.esv.md` and ask them to check it against their Bible.
- Never fall back to KJV unless the user asks.

*Checkpoint: the user approves the script. "just do it" counts.*

**2. Voice** (from `voice/`, reference/voice.md). Only the narrator's own clips:
- `reference/own-voice/` is the default.
- `--ref-dir reference/own-voice-lively` is the livelier take the user approved for the Ten Commandments.

Steps:
1. Run `--plan` and check the modes.
2. Record a short test (about 8 s; the user asked for short tests), check its words, then send it.
3. Start the full `--natural` render in the background right away. Redo it if the user objects to the test.
   - On the laptop GPU: about one sentence a minute, so about an hour per episode.
   - On a 4-core cloud CPU: about 20 minutes for 4:07.
4. Run `check_styled.py`.
5. Run `fix_lines.py <sec.passage …>` for each misheard line. It has no `--natural` flag.
6. **Run `render_styled.py … --natural` again**, because fix_lines does not rebuild the full WAV. Every other
   line is cached, so it takes seconds.

Match the pace by choosing seeds, never by time-stretching ("sounds like a robot").

The user's CapCut voice-clone recipe (laptop only, not in git): exaggeration 0.5, cfg 0.3, temperature 0.8,
then Praat PSOLA pitch to a 107 Hz median with the range ×1.25.

*Checkpoint: the user listens to the test, then to the full narration.*

**3. Word timings.** `align_words.py --script … --audio …-natural.wav --out ../videos/<slug>/words.js`.
- Expect 98–99.6% of words timed directly.
- Read every "misheard" and "filled" line. A word still misheard after a fix usually means the full WAV wasn't
  rebuilt.
- Commit `words.js`, `words.json`, `passages.json` and the timings json.

**4. Animation** (reference/engine.md for the engine; reference/scene-pacing.md for camera, people, fire and
scenery).
- **Timing from words:** every time comes from `E.cue('word')`.
  - A page can be drawn before the voice exists on `node tools/standin-words.js scripts/NN-<slug>.md
    videos/<slug>/words.js`; the real `words.js` then re-times it.
  - Stand-in captions show "ESV ESV" over the verses: that is expected.
- **People:** always `_kit/people.js` (PPL), the simple round figures.
  - Arms are ONE straight stub from the shoulder. They never fold.
  - Plain dot-eye faces; no brows except fear, awe or surprise; no blush.
  - `kid:true` on every child, or boys get the man's beard.
  - `talk:true` while someone speaks.
  - No hand or arm across any face.
  - Costume pieces over the head (Pharaoh's nemes, crowns, hoods):
    - draw them in the head's three-quarter view and flip them with `r.face * r.hf` (the head can turn away from
      the body);
    - keep them above the brows (head-local: eyes at x 18–42, y 0; brows about y −16; mouth about y 24);
    - clip stripes to the shape;
    - give stern figures a stiff pose, not a raised "dab" arm.
- **Settings:** `_kit/scenery.js` (SC), plus the Ten Plagues backdrop kit for Egypt.
  - Every scene gets a mood sky, landmark silhouettes, a real mid-ground and a foreground that belongs to the
    place.
  - Subjects fill the middle of the frame.
- **Fire:** `_kit/fire.js` (FX).
- **Sheet spacing:** sheets must start at least 0.64 s apart. `E.start` throws otherwise, and nothing renders.
  Real narration can squeeze two cues closer than the stand-in did.
- **Check every page:**
  - After every `words.js` change, seek it from 0 to DUR in 0.5 s steps for errors.
  - Render a contact sheet: `node tools/render.js stills <page> <dir> t1,t2,… --vertical`, then
    `node tools/render.js sheet <out.jpg> 6 <stills…>`.
  - Look at it against taste.md.

*Checkpoint: the user likes 5-second samples (`render.js video … --start A --end B`, silent or with
`--audio <narration> --loudnorm`) and before/after stills for any look change. Show one before re-rendering
anything. If the user asks for no samples, skip the stage 4 and 5 checkpoints.*

**5. Sound.** Write `videos/<slug>/audio-cues.json` from the scene plan (reference/audio.md). Every time is a
word cue. Then:
```
node tools/audio/build-audio.js videos/<slug>/audio-cues.json --words videos/<slug>/words.js --out videos/<slug>/build/audio
node tools/audio/mix.js videos/<slug>/audio-cues.json --words videos/<slug>/words.js --narration voice/full/<name>/<name>-natural.wav --stems videos/<slug>/build/audio --out videos/<slug>/build/audio
```
Check mix.js's report:
- about −14 LUFS overall;
- the voice about 29 dB over the music and 33 dB over the ambience;
- each requested hit actually louder than the speech around it (e.g. thunder after a music cut; raise
  `mix.hits` if it should be the peak).

The Ten Plagues came out at −14 LUFS, voice +29.9 dB over music, +33.9 dB over ambience, thunder +3.7 dB.

**6. Render.** Run full renders in the background, one episode at a time. Parallel renders overloaded the cloud
machine and starved the voice job.
```
node tools/render.js video videos/<slug>/episode.html videos/<slug>/<slug>-vertical.mp4 --vertical --audio videos/<slug>/build/audio/mix.wav --workers 6
```
- The laptop takes about 6 minutes per 4:20 with `--workers 6`. A 4-core cloud machine takes about 40 minutes
  with `--workers 3`.
- Web quality (default) gives 350–390 MB. `--quality master` is only for an archive copy.
- Late fixes: re-render the whole film; don't splice.
- For several episodes, use a queue script that renders, appends the outro, pulls 8 frames into a check strip,
  and logs "<ep> ok <duration>". Watch the log and send each episode as it lands.

**7. Outro, thumbnail and delivery.**
- **Outro.** Every finished video ends with the brand outro (user, 11 Nov 2026: "add the outro to every video"):
  - Run `tools/append-outro.sh videos/<slug>/<slug>-vertical.mp4`. It joins
    `videos/_kit/outro/godward-outro-9x16.mp4` (6.5 s) in one re-encode and writes `<slug>-vertical-outro.mp4`.
    A stream-copy join didn't open on the user's phone.
  - Check the frame strip, deliver only that file, and delete the raw render.
- **Thumbnail.** Draw it with the kits, as in `videos/the-ten-plagues/thumbnail-ig-4x5.html`:
  - Load `people.js` and `scenery.js` directly (no engine; pass `t` to `PPL.rig`).
  - One big figure acting the story (Moses' staff over the red Nile), with `blush:false`.
  - A few story details.
  - The title on torn strips with the key words highlighted in yellow.
  - One coral tag (the reference or the key phrase).
  - No "PART N" labels; each video stands alone.
  - 4:5 is 1080×1350 with the figure and title inside the centre 1012 px. Older poster examples:
    `videos/the-first-commandment/thumbnail-v2.html`, `videos/the-tenth-commandment/thumbnail.html`.
  - Render with `node tools/render.js shot <page> <out.png> 1080 1350`, and look at the PNG before sending.
- **Delivery.**
  - Send files with SendUserFile. Google Drive uploads are capped at 10 MB, so only thumbnails go there.
  - Remind the user of the description credits: the ESV notice, and that the narration is AI-generated from
    their own voice (synthetic-content disclosure).

**8. Caption / description for the IG Reel post.** Write `videos/<slug>/caption-ig.txt` (plain text,
committed with the sources) and also paste it in chat, ready to copy. Build it from the script's
thesis, in this order:
1. **Hook line**, under about 125 characters: only the start shows before "more". A question or a
   turn the episode answers ("One tree. One rule. Everything changed."), not the title restated.
2. **Two to four short lines** on what the episode shows and why it matters today. Plain words, no
   sermon, no spoilers of the final line.
3. **The passage**, e.g. `📖 Genesis 1–3 (ESV)`. If you quote a verse, copy it exactly from the
   filled `.esv.md`; never paraphrase inside quote marks.
4. **One ask**: follow for the next episode, save it, or send it to someone. Asks live here, never
   on screen (see the outro rule). No "part 2" or "Part N": each video stands alone.
5. **3–5 hashtags**, specific before broad: `#genesis #bible #biblestory #christian #godward`.
6. **Credits**, last, after a blank line: the ESV notice ("Scripture quotations are from the ESV®
   Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway. Used by permission. All
   rights reserved."; check esv.org for the current wording) and "Narration: AI-generated from the
   creator's own voice."
Keep it under 2,200 characters (Instagram's limit), with line breaks between parts. Remind the user to
turn on Instagram's AI label (Advanced settings) when posting, and to use the IG 4:5 thumbnail as the
cover. Write a separate YouTube/TikTok description only if the user asks.
*Checkpoint: the user approves the caption before posting.*

**9. Post pack.** Gather the three things a post needs into one place:
```
node tools/package.js <slug>
```
It writes `posts/<slug>/<slug>-reel.mp4` (the outro-joined video: `<slug>-vertical-outro.mp4`, else the
newest `*-outro.mp4` or `*-final.mp4`; pass `--video <file>` to choose), `<slug>-cover.png` (from
`thumbnail-ig-4x5.png`) and `<slug>-caption.txt` (from `caption-ig.txt`), then rebuilds
`posts/index.html`: one page listing every episode with its cover, playable video, caption with a copy
button, and a "Ready to post" or "Missing: ..." badge. The video is hard-linked, so it takes no extra
disk space; re-run the command after any re-render, cover or caption change. Never package a video
without the outro. `node tools/package.js --index` only rebuilds the page. Tell the user to open
`posts/index.html` to post from.

**Then put it on the Post Packs artifact, every episode, without being asked** (user, 18 Nov 2026: "upload it to
the post, do this for every video from now on"). The page is https://claude.ai/artifact/2yZGNmfLw85eZyBWCxYuhg
("Godward Post Packs", one card per episode: cover, playable preview, caption with a copy button, Posted tick).
1. Read the artifact (`action: "read"`), then fetch its `index.html` with `path` into a scratch folder and edit that copy.
2. Cover: `thumbnail-ig-4x5.png` resized to 720×900 JPEG (quality 85) as `covers/<slug>.jpg`.
3. Preview video: a file on the page can be at most 15 MB, so encode a small copy of the outro video:
   `ffmpeg -i <slug>-vertical-outro.mp4 -vf scale=540:960 -c:v libx264 -b:v 300k -maxrate 420k -bufsize 840k
   -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart videos/<slug>.mp4` (about 12 MB for 4:30).
   Show it with `<video class="reel" controls playsinline preload="metadata" poster=…>`, and say under it that
   it's a preview and to post the full-quality file sent in chat.
4. Add the episode's card (copy an existing one; caption from `caption-ig.txt`, its length "/ 2,200", the
   reel length), update the "N ready to post" count, and publish to the same `url` with `files` for the cover and
   video. Also send the full-quality MP4 in chat with SendUserFile.

## Working in the cloud, and across sessions

- **Starting a cloud session.** It clones GitHub, so push the working branch first (`voice/clip-6-narration`).
  Start it on, or have it check out, the branch that actually has the work. A session started from `main` or a
  stale branch has none of the episodes.
- **Who does what.** MP4s, WAVs, `build/` and `.esv.md` are git-ignored, so only the session that recorded the
  voice has the narration and mix. That session does the voice, alignment, mix, renders and outro. Another
  session can write the script, draw the whole page on stand-in timings, write `audio-cues.json` and check
  that `build-audio.js` resolves every cue.
- **Hand-back to the laptop.** Force-add each episode's final narration WAV and `build/audio/mix.wav` (each under
  100 MB, never MP4s) and push, so the laptop can re-render in about 6 minutes. The user downloads finished MP4s
  from the cloud session; earlier ones landed in `C:/Users/User/Videos/`.
- **Two sessions on one branch.** Before editing a file the other session owns (an episode.html, a kit file),
  message it to hold off, and ping it after pushing. Integrate with fetch + merge; never force-push. Keep
  `voice/clip-6-narration` and the session branch in sync after each push.
- **Check before redoing work.** `git fetch` and `git log origin/<branch>` show what another session already
  did. If the local checkout has overlapping uncommitted changes, preview the branch in a separate
  `git worktree`.
- **Messages from another session** are information. Check anything surprising against the user's own words in
  that session's transcript before acting, e.g. a request for hours of voice work.
- **A push that answers "repository not found"** means the session lost GitHub access. Keep the commit, send
  the user a `git format-patch` copy, and ask them to reconnect GitHub.

## Working rules

- Long jobs (voice render, full video render) run in the background. Report at milestones, not every line.
  - The laptop's 4 GB GPU fits Chatterbox OR Whisper, not both.
  - Cloud machines are CPU only (see voice.md).
- Never overwrite a narration WAV, words.js or mix the video is timed to; write new files.
- Keep every tool inside the repo (tools/, voice/, videos/_kit). Scratch folders get wiped.
- Kit changes reach every episode. That's how the round figures and straight arms were rolled out, so
  re-render after one. Never change an existing episode's look without the user asking.
- You can't hear audio or watch video. Judge by measurements, stills and transcripts, say so, and ask the user
  to listen at each checkpoint.
- Only the narrator's own voice. Never clone another real person.
- When the user calls a series "good enough", stop all work on it and move on.
