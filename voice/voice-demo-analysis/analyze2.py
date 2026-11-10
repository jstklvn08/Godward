import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "pylib"))
import numpy as np, soundfile as sf, librosa, parselmouth

SRC = r"C:\Users\User\AppData\Local\CapCut\Videos\Voice demo.MP3"
y, sr = sf.read(SRC, dtype="float32", always_2d=True); y = y.mean(axis=1)
snd = parselmouth.Sound(y.astype(np.float64), sampling_frequency=sr)
inten = snd.to_intensity(time_step=0.005, minimum_pitch=75); it = inten.xs(); iv = inten.values[0]
pitch = snd.to_pitch_ac(time_step=0.005, pitch_floor=50, pitch_ceiling=400); pt = pitch.xs(); pf = pitch.selected_array["frequency"]
voiced = pf > 0
st = lambda f, ref: 12 * np.log2(f / ref)
SPEECH0 = 8.34
m = it > SPEECH0
print("intensity histogram over speech (dB, Praat scale; speech p90 ~75):")
h, e = np.histogram(iv[m], bins=[0, 20, 30, 40, 45, 50, 55, 60, 65, 70, 75, 85])
print({f"{int(a)}-{int(b)}": int(c) for a, b, c in zip(e[:-1], e[1:], h)})
print("lowest 1% intensity in speech span:", round(float(np.percentile(iv[m], 1)), 1), "min:", round(float(iv[m].min()), 1))

# micro-pauses: local dips >= 15 dB below the 1 s rolling median, lasting >= 50 ms
med = np.array([np.median(iv[max(0, i - 100): i + 100]) for i in range(len(iv))])
dip = (iv < med - 15) & m
runs, s = [], None
for i, d in enumerate(dip):
    if d and s is None: s = i
    if not d and s is not None:
        if (i - s) * 0.005 >= 0.05: runs.append((round(it[s], 2), round((i - s) * 0.005, 3), round(float(iv[s:i].min()), 1)))
        s = None
print(f"micro-pauses >=50ms: {len(runs)}")
lens = [r[1] for r in runs]
if lens: print("  length median", np.median(lens), "p90", np.percentile(lens, 90), "max", max(lens))
print("  floor level in dips (median min dB):", np.median([r[2] for r in runs]) if runs else None)

# breaths: in dips, broadband noisy energy 25-45 dB below speech, unvoiced, 150-600 ms
br = [r for r in runs if r[1] >= 0.15 and 35 <= r[2]]
print("dips >=150ms that are not near-silent (possible breaths/music):", br[:20])

# vocal fry: voiced frames under 85 Hz
f0 = pf[voiced & (pt > SPEECH0)]
print("fraction of voiced frames < 85 Hz:", round(float((f0 < 85).mean()), 3), " < 75 Hz:", round(float((f0 < 75).mean()), 3), " > 200 Hz:", round(float((f0 > 200).mean()), 3))

# octave-jump sanity: frames where f0 doubles/halves vs neighbours
d = np.abs(np.diff(st(pf[voiced], 100)))
print("frame-to-frame jumps > 7 st (likely tracking errors or fry):", int((d > 7).sum()), "of", len(d))

# phrases (split at , . ? ! ;), with whisper word times; start fixed to real speech onset
W = [{"w": c["text"].strip(), "s": c["timestamp"][0], "e": c["timestamp"][1]} for c in json.load(open(os.path.join(HERE, "words.json"), encoding="utf-8"))["chunks"]]
W[0]["s"], W[0]["e"] = SPEECH0, SPEECH0 + 0.2
W[1]["s"] = max(W[1]["s"], SPEECH0 + 0.2)
if W[1]["e"] - W[1]["s"] > 1.5: W[1]["e"] = W[1]["s"] + 0.35
phr, cur = [], []
for w in W:
    cur.append(w)
    if re.search(r"[,.?!;]$", w["w"]): phr.append(cur); cur = []
if cur: phr.append(cur)
gmed = np.median(f0)
print(f"\nglobal median f0 {gmed:.0f} Hz\n#  start   dur  wps   f0med(st vs global) peak  end-contour(last 25% vs phrase med)  fry%  dB   | text")
rows = []
for i, p in enumerate(phr, 1):
    a, b = p[0]["s"], p[-1]["e"]
    mm = (pt >= a) & (pt <= b) & voiced
    f = pf[mm]
    db = iv[(it >= a) & (it <= b)]
    if len(f) < 6: continue
    tail = f[-max(2, len(f) // 4):]
    row = dict(n=i, a=round(a, 2), dur=round(b - a, 2), wps=round(len(p) / (b - a), 2),
               med=round(float(np.median(f))), rel=round(float(st(np.median(f), gmed)), 1),
               peak=round(float(np.percentile(f, 95))), end=round(float(st(np.median(tail), np.median(f))), 1),
               fry=round(100 * float((f < 85).mean())), db=round(float(np.percentile(db, 90)), 1),
               text=" ".join(w["w"] for w in p), last=p[-1]["w"])
    rows.append(row)
    print(f'{i:>2} {row["a"]:>6} {row["dur"]:>5} {row["wps"]:>4}  {row["med"]:>4} ({row["rel"]:+5})   {row["peak"]:>4}   {row["end"]:+6}                         {row["fry"]:>3}  {row["db"]}  | {row["text"]}')

ends = {"comma": [r["end"] for r in rows if r["last"].endswith(",")], "period": [r["end"] for r in rows if re.search(r"[.?!]$", r["last"])]}
print("\nend contour at commas  (st):", ends["comma"], "median", np.median(ends["comma"]) if ends["comma"] else None)
print("end contour at periods (st):", ends["period"], "median", np.median(ends["period"]) if ends["period"] else None)

# word-level stress list: words whose peak f0 is >= 4 st above their phrase median or loudness top
print("\nstrongly stressed words (peak f0 >= +4 st over phrase median):")
out = []
for p in phr:
    a, b = p[0]["s"], p[-1]["e"]
    f = pf[(pt >= a) & (pt <= b) & voiced]
    if len(f) < 6: continue
    pm = np.median(f)
    for w in p:
        wf = pf[(pt >= w["s"]) & (pt <= w["e"]) & voiced]
        if len(wf) >= 3:
            pk = np.percentile(wf, 90)
            if st(pk, pm) >= 4: out.append((w["w"], round(float(st(pk, pm)), 1), round(w["s"], 1)))
print(out)
json.dump({"phrases": rows, "stressed": out, "micro_pauses": runs}, open(os.path.join(HERE, "analysis2.json"), "w"), indent=1, default=float)
