# Writing an episode script

The script is the single source for narration, on-screen text and scene plans. Put it at
`scripts/NN-<slug>.md`. Good models: `scripts/ten-commandments-1-no-other-gods.md` (full format with
thesis, spine and ESV placeholders) and `scripts/creation-and-the-fall-genesis-1-3-script.md` (the
script the first finished episode actually used: short, plain, 11 sections, 639 words, 4:21).

## Shape

```markdown
# <Title>: full script

<One paragraph: story, Bible chapters, working title.>

**Runtime:** about N minutes (≈W words at 140–150 words a minute plus pauses).
**Look:** glowing-collage style (videos/creation-and-the-fall), same as episode 1.
**Voice:** the narrator's own voice, natural edit.
**Translation:** ESV via scripts/fill_esv.py.

## Thesis and spine
**Thesis:** one sentence.
**Misconception it overturns:** named in the cold open, paid off later.
**Spine:** X, THEREFORE Y. BUT Z, THEREFORE ... (every beat is caused by the one before).
**Re-hooks:** m:ss ("line"), ... roughly every 60–90 s.

---

## 0. Cold open: <title> (0:00–0:30)

**Visual:** what is on screen, in the house style (see taste.md). One idea per sheet.
**On screen:** labels and {{ESV Book c:v}} (keep only "...") · BOOK C:V ESV
**Narration:**
> [grave] In the beginning, God created the heavens and the earth. [pause]
> [story] On the first day, there was light.

**Transition:** how the camera leaves the sheet.
```

## Rules the tools rely on

- Sections are `## N. Title`; numbers are unique and ascending. Every `> ` line in a section is
  narration; nothing else is spoken.
- Delivery tags at the start of a sentence: `[grave]` (heavy lines, scripture, judgment, death),
  `[talk]` (commentary: "Christians have long read this as..."), `[story]` (default), `[pivot]`
  (short turning points: "But God wasn't finished.", "Then came the serpent."). A tag applies to
  that one sentence. Untagged sentences use the section default (`"section_mode"` in the sidecar)
  or `story`.
- Pause markers `[beat]` 0.3 s, `[pause]` 0.8 s, `[hold]` 1.5 s go after a sentence. Use them
  before a turn and after a quote; don't sprinkle them everywhere (the natural edit already adds
  ~0.45 s between sentences and 1.1 s between sections).
- Pronunciation: add `{"say": {"Hiddekel": "Hid-deh-kel"}}` to `scripts/<name>.voice.json`. Never
  change the script's wording to fix pronunciation.
- Very short sentences (one to three words) are the most likely to come out garbled from the
  voice model ("She ate some." took 20 seeds). Keep them, but expect to fix them with fix_lines.py.

## Scripture

- Never type scripture from memory. Write `{{ESV Genesis 3:19}}` with a note of which part to keep,
  then `set ESV_API_KEY=...` and run `python scripts/fill_esv.py scripts/<name>.md` to get
  `<name>.esv.md` (git-ignored, Crossway copyright). Render voice and on-screen text from the filled
  copy. The user's ESV key is set as a Windows environment variable; never ask them to paste it.
- If there is no key, KJV is the fallback (public domain); say which translation the video uses.
- Paraphrase is never set in quotation marks or shown as a verse card. Interpretive claims are
  attributed ("Christians have long read this as the first hint of a Savior").
- Credit the ESV in the end card and the video description (see fill_esv.py for the notice).
- Check every quoted reference once more after filling: the verse card text must match the voice.

## Writing for the ear

- Sentences of about 20 words or fewer; one idea each.
- 140–150 words a minute in the finished edit. Budget: words = minutes × 145.
- Hook in the first 5–15 s: a question or a striking image, then the promise of the episode.
- Contrast pairs and callbacks ("dust ... to dust") are worth more than adjectives.
- End on a thought or a pointer to the next episode, not a summary.
- Doctrine: stay with the text. God is never shown as a person (light, wind, fire, words).
  Where Christians disagree, say "many readers" or "Christians have long read", not "this means".

## Checkpoint

Send the script to the user before any voice work. Recording is the expensive step; wording
changes after it cost a re-render of every changed sentence.
