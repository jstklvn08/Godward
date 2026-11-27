# Creation and the Fall: narration

Each clip runs 10 seconds, so each script is 22-26 spoken words. All three follow the same arc: Creation, Eden, temptation, exile. `render_all.py` reads the blockquoted line under each heading, so edit the text here and re-render.

Scene timings come from `mount(...)` in each `videos/creation-and-the-fall/*.html`.

Scripture is quoted from the English Standard Version (ESV). It appears here as references, written `{{ESV Genesis 1:1}}`, not as typed-out text. Before rendering:

1. Run `python ../scripts/fill_esv.py narration.md` with `ESV_API_KEY` set. This writes `narration.esv.md` with the ESV wording filled in.
2. In `narration.esv.md`, trim each verse to the part listed under "Trim to" for that clip.
3. Run `render_all.py`. It reads `narration.esv.md` whenever `narration.md` contains ESV references.

Each placeholder brings in a whole verse, so word counts and timings below are for the trimmed text. Check them again after trimming. Everything not in a placeholder is paraphrase and is not presented as scripture.

## 1-cartoon-infographic

Preset: `brisk`. 24 words.

> In six days, God made everything. He planted a garden in Eden, and gave one warning. A serpent questioned it. Doubt, choice, shame, exile.

| Time | On screen | Narration |
|---|---|---|
| 0.0-2.5 s | Days 1-6 grid | In six days, God made everything. |
| 2.5-5.0 s | Garden of Eden, two trees | He planted a garden in Eden, and gave one warning. |
| 5.0-7.5 s | "The Test": God said vs the serpent said | A serpent questioned it. |
| 7.5-10.0 s | Doubt, Choice, Shame, Exile | Doubt, choice, shame, exile. |

Quoted scripture: none. "In six days" follows Exodus 20:11.

## 2-doodle-storytime

Preset: `warm`. About 26 words after trimming.

> {{ESV Genesis 1:3}} Everything was very good. Then a very trustworthy snake said, {{ESV Genesis 3:4}} Crunch. But the story was not over.

| Time | On screen | Narration |
|---|---|---|
| 0.0-2.2 s | Darkness, then "Let there be light!" | Genesis 1:3, trimmed |
| 2.2-5.0 s | "Everything was VERY good." | Everything was very good. |
| 5.0-7.6 s | Snake's line from Genesis 3:4 | Then a very trustworthy snake said, Genesis 3:4, trimmed |
| 7.6-10.0 s | CRUNCH, then sent out of the garden | Crunch. But the story was not over. |

Trim to: Genesis 1:3, God's words only (the command for light). Genesis 3:4, the serpent's words only.

"Very trustworthy snake" echoes the joke drawn on screen in this clip. The clip's on-screen text still uses KJV wording; update it to match the trimmed ESV text.

## 3-flat-vector

Preset: `calm`. About 25 words after trimming.

> {{ESV Genesis 1:1}} A garden in Eden. One fruit, taken. Then {{ESV Genesis 3:24}}

| Time | On screen | Narration |
|---|---|---|
| 0.0-2.4 s | Stars and Earth forming | Genesis 1:1 |
| 2.4-5.0 s | The garden | A garden in Eden. |
| 5.0-7.5 s | Serpent, Eve takes the fruit | One fruit, taken. |
| 7.5-10.0 s | Gate, flaming sword, walking away | Then Genesis 3:24, trimmed |

Trim to: Genesis 1:1, the whole verse. Genesis 3:24, the words about the flaming sword turning every way.

## 6-vox-kurzgesagt-mix

Preset: `restrained`. About 28 words after trimming.

> {{ESV Genesis 1:1}} A garden. Its location, unknown. {{ESV Genesis 3:6}} And then, a flaming sword.

| Time | On screen | Narration |
|---|---|---|
| 0.0-2.45 s | Light, planet forming, "the heaven" and "the earth" labels | Genesis 1:1 |
| 2.45-5.0 s | Annotated map, "Eden's location is unknown" | A garden. Its location, unknown. |
| 5.0-7.55 s | Serpent, Eve takes the fruit | Genesis 3:6, trimmed |
| 7.55-10.0 s | Gate, flaming sword, walking away | And then, a flaming sword. |

Trim to: Genesis 1:1, the whole verse. Genesis 3:6, the clause where she takes the fruit and eats.

The clip's on-screen labels still use KJV wording ("the heaven"); the ESV reads "the heavens". Update the labels to match.
