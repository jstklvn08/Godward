"""Build README.md's table and pitch comparison from measurements.json, watermark.json and the render logs.

    ../../.venv-kokoro/bin/python make_readme.py
"""
import json
from itertools import combinations
from math import log2

from common import HERE, NARRATION, VOICES, stem

m = json.loads((HERE / "measurements.json").read_text())
wm = json.loads((HERE / "watermark.json").read_text())
klog = json.loads((HERE / "kokoro-render-log.json").read_text())
clog = json.loads((HERE / "chatterbox-render-log.json").read_text())
rows = {r["file"]: r for r in m["files"]}
meta = {v: (n, g, a, gr) for n, g, v, a, gr in VOICES}

lines = ["| File | Gender | Accent | Kokoro grade | Duration (s) | Median pitch (Hz) | Speaking rate (wpm) | Peak (dBFS) | Non-silent | Word check |",
         "|---|---|---|---|---|---|---|---|---|---|"]
for folder in ("kokoro", "chatterbox-cloned", "references"):
    for n, g, v, a, gr in VOICES:
        f = f"{folder}/{v}.wav" if folder == "references" else f"{folder}/{stem(n, g, v)}.wav"
        r = rows[f]
        rate = "n/a (reference text)" if folder == "references" else r["words_per_minute"]
        check = "not transcribed" if folder == "references" else ("OK" if not r["word_issues"] else "FLAG: " + "; ".join(r["word_issues"]))
        lines.append(f"| `{f}` | {g} | {a} | {gr} | {r['seconds']} | {r['median_pitch_hz']} | {rate} | {r['peak_dbfs']} | {'yes' if r['non_silent'] else 'NO'} | {check} |")
table = "\n".join(lines)

pitch = ["| Voice | Kokoro (Hz) | Chatterbox (Hz) | Closest other voice, Kokoro | Closest other voice, Chatterbox |", "|---|---|---|---|---|"]
for folder_pair in [None]:
    pass
def hz(folder, v):
    n, g, *_ = meta[v]
    return rows[f"{folder}/{stem(n, g, v)}.wav"]["median_pitch_hz"]
def closest(folder, v):
    best = min((abs(12 * log2(hz(folder, v) / hz(folder, o))), o) for o in meta if o != v)
    return f"{best[1]} ({best[0]:.2f} st)"
for n, g, v, a, gr in VOICES:
    pitch.append(f"| {v} | {hz('kokoro', v)} | {hz('chatterbox-cloned', v)} | {closest('kokoro', v)} | {closest('chatterbox-cloned', v)} |")
pitch = "\n".join(pitch)

ktime = sum(x["generation_seconds"] for x in klog.values()); kaud = sum(x["audio_seconds"] for x in klog.values())
ctime = sum(x["generation_seconds"] for x in clog.values()); caud = sum(x["audio_seconds"] for x in clog.values())
wm_k = sorted({v for k, v in wm.items() if k.startswith("kokoro/")}); wm_c = sorted({v for k, v in wm.items() if k.startswith("chatterbox")})

text = (HERE / "README.template.md").read_text().format(
    narration=NARRATION, table=table, pitch=pitch,
    ktime=round(ktime, 1), kaud=round(kaud, 1), krtf=round(ktime / kaud, 2),
    ctime=round(ctime / 60, 1), caud=round(caud, 1), crtf=round(ctime / caud, 2),
    wm_k=wm_k, wm_c=wm_c)
(HERE / "README.md").write_text(text)
print("README.md written")
