# Narration in the narrator's own voice

All commands run from `voice/` with `.venv\Scripts\python.exe` (Python 3.14 venv with Chatterbox,
torch CUDA, pyloudnorm, praat-parselmouth, transformers). Models are cached in `voice/.cache`.

## The voice

- Reference clips: `voice/reference/capcut-vo/{grave,talk,story}.wav`, cut from the narrator's own
  CapCut voice-over `C:\Users\User\AppData\Local\CapCut\Videos\VO .MP3` by `voice/make_vo_refs.py`
  (story = the "Between 1979 and 1995" opener, talk = "Gen Z didn't break the deal...",
  grave = "Which brings us to... You substitute."). The narrator approved this voice on
  2026-11-11 ("Sounds like me") after short A/B tests made with `voice/render_vo_sample.py`.
  Chatterbox copies the delivery of the clip it is given, so each mode sounds different.
- Raw Chatterbox lands about 2.5 semitones above the narrator (124 Hz vs 107 Hz) with a narrower
  range, so `render_styled.py` moves the joined narration to a 107 Hz median and widens the range
  x1.25 with Praat PSOLA ("Change gender", formants kept). Measured after: 109 Hz, 14.0 semitones.
- Never time-stretch the voice. A test stretched to the original's line lengths sounded "like a
  robot talking". Pace comes from picking the best of three seeds.
- The old clips in `reference/own-voice/` (from voice-demo.mp3) were sent to the Recycle Bin on
  2026-11-11; episode 1's narration was made with them.
- Only use the narrator's own voice or voices they have rights to. Never clone a pastor, YouTuber or
  any other real person from the internet. A second clean clip of the same narrator exists at
  `voice/reference/my-voice/clean.wav` (from their TikTok, via make_clean_ref.py).
- Every Chatterbox output carries an inaudible Perth watermark. Chatterbox is unmaintained since
  August 2026; it still works.

## Steps

Always add `--lively` to the render commands below (the user chose it on 2026-11-11 after an 8 s
A/B: "Yes, use lively"). It merges talk/story sentences into passages of up to 160 characters so
the model carries momentum across a thought (grave and pivot lines stay on their own), renders 5
takes per passage and keeps the in-range take whose pitch moves most, and keeps the model's breaths
and phrasing pauses (up to 0.35 s) inside a passage. It costs about 5 takes per passage, so a
full render takes longer; test samples should stay short (about 8 s is enough for the user).

1. Plan (no rendering): `render_styled.py --script ..\scripts\<name>.esv.md --plan`
   Check each sentence's mode and pause. Fix tags in the script, not in code.
2. Test two contrasting sections: `render_styled.py --script ... --sections 1 7 --natural`
   Send the user `full/<name>/test-sections-1-7-natural.wav` and wait for a yes.
3. Full render: `render_styled.py --script ... --natural`. Cached passages are reused, so the test
   sections cost nothing again. Run it in the background; on the RTX 2050 it takes about 40–60 s
   per sentence including retries (about an hour for 60 sentences). Report progress at milestones,
   not every sentence.
4. Word check: `check_styled.py full/<name>/<name>-natural.wav --name <name>`
   compares a Whisper transcript with the script. A long "missing" stretch can be the recogniser
   skipping a chunk; transcribe the affected sections one at a time before believing it.
5. Fix wrong words: `fix_lines.py --name <name> --seeds 4-29 8.2 9.2`
   (section.passage numbers from passages.json or --plan). It only replaces a take whose transcript
   matches the script; very short lines may need 20+ seeds. It has no `--natural` flag, and it does NOT rebuild the
   full WAV: rerun step 3 (seconds, all cached) before checking or aligning again, or the old takes are still in it.
6. Word timings for the video: `align_words.py --script ... --audio full/<name>/<name>-natural.wav --out ..\videos\<slug>\words.js`
   Expect about 98% of words timed directly; it lists every misheard or filled stretch.

## What the settings mean

| Mode | exaggeration / cfg / temp | pace window (words/s) | natural stretch | gap after |
|---|---|---|---|---|
| grave | 0.50 / 0.30 / 0.8 | 1.9–2.9 | none | 0.65 s |
| talk | 0.50 / 0.30 / 0.8 | 2.7–3.9 | none | 0.42 s |
| story | 0.50 / 0.30 / 0.8 | 2.4–3.6 | none | 0.45 s |
| pivot | 0.50 / 0.30 / 0.8 | 2.0–4.2 | none, +0.15 s before | 0.5 s |

All modes use the approved capcut-vo setting; the reference clip carries the delivery. Each
sentence is tried with seeds 1–3 until its pace fits; misses are FLAGGED in the output and
passages.json. Judge pace by line length against the narrator, not words/s alone: spelled-out
numbers inflate the word count.

The natural edit (the user chose it: "make spacing, pauses and read a little slower, make it more
human" → "Good, keep it"): commas keep a real breath (≤0.35 s), sentence gaps vary ±0.08 s,
sections are 1.1 s apart, silence is filled with faint room tone, and the master is set to
−14 LUFS, −1 dBFS peak. The old own-voice master also darkened the sound (−4 dB above 4 kHz,
+2 dB at 150 Hz); capcut-vo gets no EQ, since the clone is already slightly darker than the
narrator. Episode 1 (own-voice) came out at 147 words a minute, 4:21.

## Gotchas

- The 4 GB GPU fits Chatterbox OR Whisper, not both; don't run alignment during a voice render.
  Generation falls back to CPU on out-of-memory (slow).
- Editing a mode's settings changes its cache key and re-renders every sentence in that mode.
- Never overwrite a WAV the video is timed to. Each render writes new files; the first episode's
  narration was lost when a Downloads file was overwritten.
- Changing script wording after the video is timed: re-render voice, re-run align_words.py, and the
  page re-times itself (all animation uses cue()). Re-check stills around the changed lines.

## CPU-only machines (cloud sessions)

- Chatterbox runs on CPU at about 13 s per take (4 cores); the Ten Plagues (4:07, 60 lines) took about 20 minutes,
  the two-section test about 8.
  Pip installs: `chatterbox-tts`, `setuptools<81` (perth needs pkg_resources), `pyloudnorm praat-parselmouth librosa`.
- Whisper steps (check_styled, fix_lines, align_words) use `voice/asr_fast.py` (faster-whisper, int8) when it is
  installed and there is no CUDA GPU: about 3 minutes for a full check instead of over an hour with transformers.
  Set GODWARD_ASR=transformers to force the old path.
- A "filled" stretch in align_words' report is often only the recogniser skipping a window edge: transcribe that
  passage's chunk on its own (asr_fast.text) before re-rendering it.
- fix_lines accepts numerals and joined words ("40" = "forty", "anymore" = "any more").
- A `> [grave] “...”` line that is one whole quotation keeps its tag for every sentence in it.
