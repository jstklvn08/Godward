# Soundtrack: score, scene sounds, thunder and the final mix

Every sound in a Godward episode is synthesised by `tools/audio/` from one JSON cue file per episode,
`videos/<episode>/audio-cues.json`. Nothing is sampled, and the same cue file always gives the same stems.
The reference is `videos/creation-and-the-fall/audio-cues.json`, which recreates episode 1 (see "Creation
reference numbers" below).

```
node tools/audio/build-audio.js videos/<ep>/audio-cues.json --out videos/<ep>/audio [--words videos/<ep>/words.js]
node tools/audio/mix.js        videos/<ep>/audio-cues.json --narration <final voice.wav> --out videos/<ep>/audio [--words ...]
node tools/render.js video videos/<ep>/episode.html <out.mp4> --audio videos/<ep>/audio/mix.wav ...
```

- `build-audio.js` writes `score.wav`, `ambience.wav`, `sfx.wav` (one per entry of `stems`) and `hit-<name>.wav` (one per
  entry of `mix.hits`, such as the thunder). The stems render in parallel; episode 1 takes about 12 s.
  `--only score,hits` rebuilds only those stems. Before rendering, it checks every time in the `mix` section.
- `mix.js` writes `premix.wav`, then `mix.wav` (two-pass loudnorm: −14 LUFS, −1 dBTP, 48 kHz stereo 16-bit). It also writes
  `solo-voice.wav`, `solo-<bus>.wav` and `solo-hit-<name>.wav` (each part as it sits in the premix), `mix-graph.txt` (the ffmpeg
  filtergraph) and `mix-report.json`. Episode 1 takes about 35 s.
- `node tools/audio/measure.js compare a.wav b.wav [--until s]` gives the loudness of both files and the average difference
  of their 1 s level curves. `node tools/audio/measure.js windows f.wav 3-5 10-11` gives the RMS level in each window.
- ffmpeg comes from `ffmpeg-static` in `tools/node_modules`.

Re-voicing: if the times are word cues, run `align_words.py` again for the new voice, pass the new `words.js` with `--words`,
then run both commands again. The sound moves with the words. A word that is no longer spoken stops the build with a
list of similar words.

## 1. Plan the soundtrack (before writing JSON)

Plan one row per scene. Use the scene cuts from the episode page (`AT`/cut times) and the script. Fill **Screen** first,
because the scene sounds must match what is on screen.

| Scene (cue) | Screen | Music (instruments, mood, motif) | Scene sounds | One-shots / moments | Mix moves |
|---|---|---|---|---|---|
| opening (0) | void, heavens, deep | choir + high bells, loud; minor as darkness falls | wind, sparkle, ocean, rumble | — | choir swell +8 dB at 1.4–7.5 s |
| "Then God spoke" | light breaks | **silence** | — | thunder at "Then" −0.04 s | music muted from "Then" −0.76 s until 1.1 s after "spoke" |
| six days (12.45) | days 1–6 | pad cycle; one layer per day: glassy pad, harp, plucks, celesta, flute (motif), heartbeat drum | sparkle / waves / land and water / flame and twinkles / bubbles, whale, gulls / animals and steps | chime + sparkle per day | — |
| … | | | | | |

Creation's full plan (12 scenes) is in the `scenes` list of its cue file. Copy that shape.

### Instrument palette (what each one is for)

| Mood | Score | Scene sounds |
|---|---|---|
| Holy, God speaking, a promise | `choir` (major), `bell` high, `pad` bright | `shimmer` |
| Wonder, creation | `pluck` arpeggios (harp), `bell` celesta, `flute` | sounds of the thing being made |
| Warmth, people, love | `pad` warm chords, `piano` motif | `crickets` at night, `bird` by day |
| Life, heartbeat | `heartbeat`, `drum` | animal calls with `step`/`hoof` |
| Temptation, threat | minor `pad`, `glide` lows, `tick` that speeds up | `hiss`, cold `wind` (fc 380–450), `rustle` |
| Shock, sin | `tremolo` then silence, sparse detuned `piano`, `reversed` | cold wind, leaves |
| Judgment | low `pad` drones (D1–A2), `drum` hits (lv 2, f0 48) | `scrape` (digging), `sand`, `hiss` |
| Mercy, hope | `flute` motif, `choir` swell, `bell` | `rustle` (cloth), gentle `bird` |
| Leaving, exile | walking `drum` (every 1 s), minor motif, unresolved (sus) last chord | `wind`, `step` panned away, `flame` |

The Eden motif (D A F♯ E, `EDEN`; minor `EDENm` D A F E) recurs and changes with the story. Give each new story a
four-note motif of its own in `motifs`.

## 2. Cue-file reference

```jsonc
{
  "episode": "slug",
  "words": "words.js",              // default words file, relative to this cue file (overridden by --words)
  "duration": 261.5,                // stem length in seconds, or a time value, e.g. {"word":"tree","edge":"end","offset":1.2}
  "marks":  { "day1": 12.56, "spoke": {"word": "Then God spoke"} },   // named times; may be word cues
  "motifs": { "EDEN": [62, 69, 66, 64] },                              // MIDI notes (60 = middle C, 62 = D)
  "scenes": [ {"name": "opening", "start": 0, "screen": "...", "music": "...", "sound": "..."} ],  // plan + time refs
  "stems":  { "score": {...}, "ambience": {...}, "sfx": {...} },     // each becomes <name>.wav
  "mix":    { ... }
}
```

### Time values (anywhere a time is asked for: `at`, `to`, `repeat.from/to`, envelope `from/to`, hit `at`, checks)

| Form | Meaning |
|---|---|
| `12.45` / `"1:05.5"` | seconds / minutes:seconds |
| `"day5"`, `"day5+0.3"`, `"spoke-0.04"` | a mark or a scene name, with an optional offset |
| `{"word": "spoke", "n": 1, "offset": -0.7, "edge": "start"}` | the nth time the word is spoken (`n` default 1, `n: -1` = the last), `edge: "end"` = when it ends |
| `{"word": "Then God spoke"}` | a phrase: the consecutive words (picks out a repeated word without counting) |
| `{"mark": "day2", "offset": 0.3}`, `{"scene": "garden", "edge": "end"}` | the object forms |

Word matching ignores case and punctuation, like `E.cue` in the engine. A word file can be `words.json` (`[[word,start,end],...]`)
or the engine's `words.js` (`const WORDS=[...]`). Tokens with spaces, such as `"She ate"`, are split into separate words.
An unknown word, mark or scene, or an `n` greater than the number of times the word is spoken, stops the build with an error.

### Stem section

```jsonc
"score": {
  "seed": 4242,                                   // every event gets its own seed: hash(stem seed + event JSON)
  "reverb": {"room": 0.87, "damp": 0.32, "wet": 0.38},   // optional Freeverb-style hall (the score uses it)
  "autoLevel": {"window": 0.1, "smooth": 15, "min": 0.35, "max": 4},  // optional: keeps the bed at an even level
  "fade": {"end": 260.9, "len": 1.5},             // optional fade-out (and "in": seconds)
  "peak": 0.9,                                    // normalise the stem's peak (default 0.9)
  "events": [ ... ]
}
```

The per-event seed means adding or removing one event never changes the random choices of the others, and moving an
event in time (for example after re-voicing) keeps its sound. Entries without `inst` (`{"scene": "garden", "comment": "..."}`)
are section headers and are skipped. `"off": true` mutes an event.

### Events

| Key | Meaning |
|---|---|
| `inst` | sound name (catalogue below) |
| `at` | start time; or a list `[t1, t2, ...]`; list entries may be `{"t": time, ...params}` to override per hit |
| `to` / `len` | end time / length for sounds that last (pad, choir, wind, ocean ...) |
| `repeat` | `{"from", "to", "every", "jitter", "shift"}`: start every `every` s (`[a, b]` = ramps from a to b, e.g. ticking that speeds up), plus up to `jitter` s random extra spacing, plus up to `shift` s random start offset |
| `prob` | chance that each repeat plays (0–1) |
| `hold` | for lasting sounds in a repeat: each lasts `hold` s, clipped at `repeat.to` (`"holdClip": false` = not clipped) |
| `note` / `notes` | MIDI pitch / chord. `notes` on a single-note instrument (pluck, bell, piano, flute, chime) plays a strum: `strum` s apart, pan +`strumPan` per note |
| `seq` | pitches (or chords) taken in turn per repeat; `"pick": "random"` picks at random |
| `chords` + `arp` | chord per repeat; with `chordEvery` (s, counted from `chordFrom` or `repeat.from`) the chord changes on that clock; `arp: true` steps through the chord's notes |
| `octaves` | added per repeat in turn, e.g. `[0,0,0,0,12,12,12,12]` |
| `transpose` | semitones added to every pitch |
| `motif` + `step` | a motif name or note list played one note every `step` s from `at` |
| any other key | passed to the sound: `lv`, `pan`, `bright`, `dec`... A value may be `{"rand": [a, b]}` (random per repeat), `{"ramp": [a, b]}` (linear across the repeat span), `{"alt": [a, b]}`; `"pan": "random"`; `"pan": [a, b]` alternates |

### Sound catalogue (`tools/audio/sounds.js`; params and defaults)

Score:
- `pad` {to, notes, lv 1, bright .5, a 1.6 attack, r 2.2 release}: soft detuned saws. Use bright .2–.35 for dark drones, .5–.6 for warm, .9 for glassy light.
- `choir` {to, notes, lv 1, att 2.5, rel 3}: 'ah' voices with vibrato. Angelic choir.
- `bell` {note, lv, pan, dec 2.4} (celesta at dec 1.6, bubbles at dec .3) · `chime` {note, lv}: a longer one-shot bell.
- `pluck` {note, lv, pan, len 2.2, bright .5}: harp/kalimba/pizzicato (Karplus-Strong).
- `piano` {note, lv, pan, dec 3, detune 0} · `flute` {note, len .8, lv, pan}.
- `drum` {lv, f0 70, pan} · `heartbeat` {lv, f0 62}: beat + echo 0.22 s later.
- `chirp` {lv, pan}: score birds (already 65–70% quieter than the first version; do not raise).
- `noiseBed` {to, fc, lv, q, mod, pan}: breathing filtered noise (darkness at fc 90, dust at 180, unease at 420, bright air at 2600).
- `glide` {len 2.6, from, toNote, lv, pan}: sliding low tone · `tick` {lv, pan} · `tremolo` {to, notes, lv}: growing suspense · `reversed` {len, notes, lv}: swell that stops dead.

Scene sounds:
- Water: `ocean` {to, lv, pan, period 6.5, fc 500}, `lap` (shore), `stream`, `drip`, `splash` {len .6}, `bubbles` {to, rate 8}.
- Air and earth: `wind` {to, lv, fc 500, pan} (fc 220–380 cold/dark, 600–700 warm = **God's presence**), `rumble` {to}, `sand` {to}, `breath` {len 2.6}.
- Fire and light: `flame` {to, lv, pan} (sun, flaming sword), `shimmer` {to, lv} (stars, light, fireflies).
- Creatures: `bird`, `gull`, `flap` {n 4}, `whale`, `crickets` {to}, `roar` (lion), `trumpet` (elephant), `moo`, `whinny`, `screech`, `bleat`, `hiss` {len} (serpent).
- People: `step` {lv, pan, soft 1}, `hoof`, `rustle` {to} (leaves, bushes, cloth), `scrape` (digging).

One-shots (sfx and hits):
- `whoosh` {len .8, up true} (camera move; 0.4 s before each cut), `swish` {len} (highlight, mark, arrow), `paperTap` (a piece lands; keep soft),
  `sparkle` {len 1.6} (a moment of light), `swell` {len 3, note} (an arrival, a realisation), `thump`, `click` (the bite), `rip` (the world tears),
  `fire` {len 5.5}, `dust` {len 4}, `thunder` {len 6} (crack, sub boom, rolling rumble; seed 777 = episode 1's thunder exactly).

To add a sound, write `fn(track, t0, params)` in `sounds.js` using `track.put(sampleIndex, value, pan)`, `track.span(t0, len)`,
`track.rnd()`, and register it in `REG` (`pitch: 'note' | 'notes'`, `span: true` if it lasts until `to`).

### Mix section

```jsonc
"mix": {
  "voice": {"volume": 1.25},                       // mono narration -> both channels, x1.25; also the sidechain key
  "buses": [
    {"name": "music", "stem": "score.wav", "volume": 1.6,
     "duck": {"threshold": 0.02, "ratio": 4, "attack": 30, "release": 500, "makeup": 1},     // sidechaincompress on the voice
     "envelope": [
       {"from": 1.4, "to": 7.5, "db": 8.3, "in": 1.3, "out": 2.5},                          // +dB, ramps in/out (dB adds up)
       {"from": {"word": "Then God spoke", "offset": -0.76},
        "to": {"word": "Then God spoke", "edge": "end", "offset": 1.11}, "mute": true, "in": 0.6, "out": 1.4}  // cut
     ]},
    {"name": "sfx", "stem": "sfx.wav", "volume": 0.2},
    {"name": "ambience", "stem": "ambience.wav",
     "compressor": {"threshold": 0.05, "ratio": 3.5, "attack": 10, "release": 300, "makeup": 2.8},  // acompressor (evens it out)
     "duck": {"threshold": 0.02, "ratio": 6, "attack": 20, "release": 600, "makeup": 1.5}}
  ],
  "hits": [ {"name": "thunder", "sound": "thunder", "seed": 777, "len": 6, "at": {"word": "Then God spoke", "offset": -0.04},
             "compressor": {"threshold": 0.02, "ratio": 12, "attack": 0.5, "release": 400, "makeup": 10}, "volume": 2.5} ],
  "limiter":  {"limit": 0.89, "attack": 1, "release": 60},
  "loudnorm": {"I": -14, "TP": -1.0, "LRA": 18},
  "tail": 0,                                         // seconds of extra mix after the voice ends (default 0: mix = voice length)
  "checks": [ {"label": "thunder", "from": "spoke-0.04", "to": "spoke+0.96"},
              {"label": "music cut", "from": 9.95, "to": 10.0, "solo": "music"} ]
}
```

Order of processing on a bus: `volume` → `eq` (optional list of raw ffmpeg filters, e.g. `"highpass=f=80"`) → `compressor`
→ `duck` → `envelope`. Hits: `compressor` → `volume` → placed at `at`. Everything is summed (`amix normalize=0`) and passes
through the limiter. `mix.js` then applies loudnorm in two passes. Ffmpeg option names pass through unchanged.

## 3. Level targets

| What | Target | Episode 1 measured |
|---|---|---|
| mix.wav | −14 LUFS integrated, ≤ −1 dBTP, 48 kHz stereo | −14.0 LUFS, −1.3 dBTP, LRA 3.4 |
| Voice over music (median of speaking windows) | 28–30 dB, music never inaudible | 29.0 dB (p10 17, p90 36) |
| Voice over ambience | 30–35 dB | 34.1 dB |
| Voice over sfx | ≥ 28 dB | 30.7 dB |
| Ducking in dialogue-dense scenes | music 22–25 dB below the voice median in the "check" windows | east of Eden −22.9 dB, after the bite −25.9 dB |
| Opening choir swell | music ≈ 8 dB over its plain bed at 3–5 s, so only ~8 dB under the voice | −7.6 dB vs voice (−24.4 dBFS at mix scale) |
| Music cut before "God spoke" | silence (< −90 dBFS) | −184 dBFS |
| Thunder | the strongest non-voice moment: momentary ≥ +3 LU over speech median, 0.5–1 s RMS ≈ +4–5 dB over the voice median | +3 LU momentary, +4.7 dB RMS |

## 4. Taste rules (from the user's episode 1 feedback; defaults already follow them)

- Narration always clearly on top. The music bed is still audible, about 30 dB under the voice, and never disappears
  except in a deliberate silence.
- Scene sounds match what is on screen: water for the ocean, animal calls when animals appear, flame crackle for the sun,
  birdsong in the garden, wind or rumble in darkness. If it is not on screen, it is not heard.
- Open with an angelic choir and bells, and make them loud (swell peaking at about 3 s).
- Cut the music just before a "God spoke" moment and hit a loud thunder.
- No rattly or squeaky effects. Marker squeaks became soft `swish`es, and paper slaps became a soft `paperTap` (sfx bus at 0.2).
- Chirps stay quiet (they were 65–70% too loud). Do not raise `chirp` lv above about 1.2.
- Duck the bed 22–25 dB under the voice in dialogue-dense scenes.
- God never gets footsteps. Use a warm `wind` (fc ~700, panned) for His presence.
- Silence is part of the story: the bite, and the cut before "God spoke". Put silences in the plan table.

## 5. Checking a mix by measurement (you cannot listen)

Never describe how a mix sounds. Report the numbers that `mix.js` prints (also in `mix-report.json`):

1. `mix.wav` duration (= narration + `tail`), integrated LUFS (−14 ± 0.5), true peak (≤ −1).
2. `voice over <bus>`: the median and spread of the voice-to-bus difference over speaking windows. If the music is more than 33 dB
   under the voice, it is effectively gone. If it is less than 20 dB under, it fights the voice.
3. The `checks`: RMS in each window (solo or mix, both reported at the final mix scale) relative to the voice median, and for mix windows, momentary loudness relative
   to the speech median. Add a check for every planned moment: the opening swell, every music cut (expect < −90 dBFS on the
   music solo), every hit, every silence, and one dialogue-dense scene per bus.
4. `loudest 0.5 s`: if it is not the voice and not a planned hit, something is too loud.
5. When changing an existing mix, `measure.js compare old/mix.wav new/mix.wav` gives the average 1 s level difference. Episode 1
   rebuilt from the cue file differs from the published mix by 0.2 dB on average over 0–150 s.
6. Then send the user a short clip (the opening 0–20 s plus one busy scene) to listen to.

## 6. Creation reference numbers (verification of the tools, Nov 2026)

The cue file was rebuilt and mixed with the later narration `genesis-1-3-own-voice-natural.wav`. The original narration is
lost. The later one matches it until section 8 and is about 1 s longer after that. Results compared with the published
`tools/rescued/vertical-session/audio/mix.wav`:

- Stems compared with the rescued stems: score −24.1 vs −24.1 LUFS (1 s curve difference 0.8 dB), ambience −21.4 vs −21.7
  (1.8 dB; random detail differs), sfx −18.8 vs −17.9, thunder sample-identical (seed 777).
- Mix: −14.0 vs −14.1 LUFS, LRA 3.4 vs 3.4, true peak −1.3 vs −1.3. The 1 s level curve differs by 0.2 dB on average over
  0–150 s and by 3.5 dB over 150–261 s, where the test narration is about 1 s later, so the ducking moves with it.
- Voice over music: 29.0 dB here, 28.9 dB in the original (0–150 s). Voice over ambience: 33.5 dB in both (0–150 s).
- Windows (mix dBFS, original / rebuilt): 3–5 s −19.3 / −19.5, thunder 10.02–10.52 s −11.8 / −11.6, music solo 9.95–12 s
  silent in both. Momentary: thunder −10.7 / −10.6 LUFS, against a speech median of −14.4 / −14.3. The loudest momentary
  point in both mixes is the voice at 149.4 s ("like God"), not the thunder.
- The opening envelope and ambience make-up were fitted to the published mix's solo stems (`musiconly.wav`, `ambonly.wav`).
  The published envelope peaks at about +8.3 dB (rising 1.4–2.7 s, easing out 5–7.5 s). The music returns from silence at
  12.15 s and reaches full level at 13.55 s. There was no +10 dB lift through 13–16 s.
