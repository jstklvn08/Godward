import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "pylib"))
import numpy as np, soundfile as sf, librosa, parselmouth, pyloudnorm
from parselmouth.praat import call

SRC = r"C:\Users\User\AppData\Local\CapCut\Videos\Voice demo.MP3"
stereo, sr = sf.read(SRC, dtype="float32", always_2d=True)
mono = stereo.mean(axis=1)
dur = len(mono) / sr
out = {}

# ---------- whole-file facts ----------
L, R = stereo[:, 0], stereo[:, 1]
out["file"] = {
    "duration_s": round(dur, 2), "sample_rate": sr,
    "stereo_LR_correlation": round(float(np.corrcoef(L, R)[0, 1]), 4),
    "peak_dbfs": round(20 * np.log10(np.abs(stereo).max()), 2),
    "integrated_LUFS": round(pyloudnorm.Meter(sr).integrated_loudness(stereo), 2),
}
S = np.abs(librosa.stft(mono, n_fft=4096, hop_length=1024)) ** 2
freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
spec = S.mean(axis=1); cum = np.cumsum(spec) / spec.sum()
out["file"]["bandwidth_hz_99pct"] = int(freqs[np.searchsorted(cum, 0.99)])
out["file"]["bandwidth_hz_999pct"] = int(freqs[np.searchsorted(cum, 0.999)])
hi = spec[freqs > 16000].sum() / spec.sum()
out["file"]["energy_above_16k_ratio"] = float(f"{hi:.2e}")

snd = parselmouth.Sound(mono.astype(np.float64), sampling_frequency=sr)

# ---------- intensity-based speech / silence map ----------
inten = snd.to_intensity(time_step=0.01, minimum_pitch=75)
it = inten.xs(); iv = inten.values[0]
speech_level = np.percentile(iv, 90)
silent = iv < speech_level - 25
pauses = []
start = None
for t, s in zip(it, silent):
    if s and start is None: start = t
    if not s and start is not None:
        if t - start >= 0.12: pauses.append((round(start, 2), round(t, 2)))
        start = None
if start is not None: pauses.append((round(start, 2), round(it[-1], 2)))

# noise floor & what fills the pauses
gap_vals = np.concatenate([iv[(it >= a) & (it <= b)] for a, b in pauses if b - a > 0.2]) if pauses else np.array([])
out["file"]["speech_level_db_p90"] = round(float(speech_level), 1)
out["file"]["pause_floor_db_median"] = round(float(np.median(gap_vals)), 1) if len(gap_vals) else None
out["file"]["pause_floor_db_min"] = round(float(gap_vals.min()), 1) if len(gap_vals) else None

# ---------- pitch, voice quality ----------
pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=60, pitch_ceiling=400)
pt = pitch.xs(); pf = pitch.selected_array["frequency"]
voiced = pf > 0
def st(f, ref=100.0): return 12 * np.log2(f / ref)
f0 = pf[voiced]
out["pitch_overall"] = {
    "median_hz": round(float(np.median(f0)), 1),
    "mean_hz": round(float(f0.mean()), 1),
    "p5_hz": round(float(np.percentile(f0, 5)), 1), "p95_hz": round(float(np.percentile(f0, 95)), 1),
    "range_p5_p95_semitones": round(float(st(np.percentile(f0, 95)) - st(np.percentile(f0, 5))), 2),
    "sd_semitones": round(float(np.std(st(f0))), 2),
    "voiced_fraction_of_speech": round(float(voiced.sum() / max(1, (~silent[:len(pf)] if len(silent) >= len(pf) else ~silent).sum())), 2),
}
pp = call(snd, "To PointProcess (periodic, cc)", 60, 400)
out["voice_quality"] = {
    "jitter_local_pct": round(100 * call(pp, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3), 2),
    "shimmer_local_pct": round(100 * call([snd, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6), 2),
    "hnr_db_mean": round(call(snd.to_harmonicity_cc(time_step=0.01, minimum_pitch=60), "Get mean", 0, 0), 1),
}
form = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=5000)
fv = {k: [] for k in (1, 2, 3, 4)}
for t, f in zip(pt, pf):
    if f > 0:
        for k in fv:
            v = form.get_value_at_time(k, t)
            if v == v: fv[k].append(v)
out["formants_median_hz"] = {f"F{k}": round(float(np.median(v)), 0) for k, v in fv.items()}
F = [np.median(fv[k]) for k in (1, 2, 3, 4)]
disp = (F[3] - F[0]) / 3
out["formants_median_hz"]["dispersion_hz"] = round(float(disp), 0)
out["formants_median_hz"]["vocal_tract_length_cm_est"] = round(35000 / (2 * disp), 1)

# spectral balance (brightness / breathiness) on voiced frames
cent = librosa.feature.spectral_centroid(y=mono, sr=sr, hop_length=441)[0]
ct = librosa.frames_to_time(np.arange(len(cent)), sr=sr, hop_length=441)
vmask = np.interp(ct, pt, voiced.astype(float)) > 0.5
Sv = np.abs(librosa.stft(mono, n_fft=2048, hop_length=441)) ** 2
fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
Svv = Sv[:, vmask[: Sv.shape[1]]].mean(axis=1)
band = lambda a, b: Svv[(fr >= a) & (fr < b)].sum()
out["spectral_balance"] = {
    "centroid_voiced_hz": round(float(np.median(cent[vmask])), 0),
    "alpha_ratio_db_(1-5k vs 0-1k)": round(float(10 * np.log10(band(1000, 5000) / band(50, 1000))), 1),
    "low_0-300_vs_300-3k_db": round(float(10 * np.log10(band(50, 300) / band(300, 3000))), 1),
    "presence_3-6k_vs_300-3k_db": round(float(10 * np.log10(band(3000, 6000) / band(300, 3000))), 1),
    "air_6-12k_vs_300-3k_db": round(float(10 * np.log10(band(6000, 12000) / band(300, 3000))), 1),
    "sibilance_5-9k_vs_300-3k_db": round(float(10 * np.log10(band(5000, 9000) / band(300, 3000))), 1),
}

# ---------- words & sentences ----------
words = json.load(open(os.path.join(HERE, "words.json"), encoding="utf-8"))["chunks"]
W = [{"w": c["text"].strip(), "s": c["timestamp"][0], "e": c["timestamp"][1] or c["timestamp"][0] + 0.3} for c in words]
# fix whisper's stretched timestamps: clamp a word end to the first pause that starts after its start
for w in W:
    for a, b in pauses:
        if w["s"] < a < w["e"] and w["e"] - w["s"] > 1.2:
            w["e"] = a; break

def syllables(word):
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word: return 0
    n = len(re.findall(r"[aeiouy]+", word))
    if word.endswith("e") and not word.endswith(("le", "ee")) and n > 1: n -= 1
    return max(1, n)

def f0_in(a, b):
    m = (pt >= a) & (pt <= b) & voiced
    return pf[m]
def db_in(a, b):
    m = (it >= a) & (it <= b)
    return iv[m]

sents, cur = [], []
for w in W:
    cur.append(w)
    if re.search(r"[.?!]$", w["w"]): sents.append(cur); cur = []
if cur: sents.append(cur)

global_med = np.median(f0)
rows = []
for i, s in enumerate(sents, 1):
    a, b = s[0]["s"], s[-1]["e"]
    text = " ".join(w["w"] for w in s)
    nw = len(s); ns = sum(syllables(w["w"]) for w in s)
    inner_pause = sum(max(0, min(b, pe) - max(a, ps)) for ps, pe in pauses)
    f = f0_in(a, b); d = db_in(a, b); d = d[d > speech_level - 25]
    n = len(f); head = f[: max(1, n // 5)]; tail = f[-max(1, n // 5):]
    # per-word emphasis
    ws = []
    for w in s:
        wf = f0_in(w["s"], w["e"]); wd = db_in(w["s"], w["e"])
        ws.append((w["w"], float(np.max(wf)) if len(wf) else np.nan, float(np.max(wd)) if len(wd) else np.nan, (w["e"] - w["s"]) / max(1, syllables(w["w"]))))
    arr = np.array([[x[1], x[2], x[3]] for x in ws], dtype=float)
    z = np.nan_to_num((arr - np.nanmean(arr, 0)) / (np.nanstd(arr, 0) + 1e-9))
    score = z[:, 0] * 1.0 + z[:, 1] * 1.0 + z[:, 2] * 0.6
    top = [ws[j][0] for j in np.argsort(-score)[:3]]
    pause_after = next((round(pe - ps, 2) for ps, pe in pauses if abs(ps - b) < 0.35 or (b - 0.1 <= ps <= b + 0.5)), 0.0)
    rows.append({
        "n": i, "start": round(a, 2), "end": round(b, 2), "text": text,
        "words": nw, "wpm_gross": round(60 * nw / (b - a), 0),
        "syll_per_s_net": round(ns / max(0.1, (b - a) - inner_pause), 2),
        "internal_pause_s": round(inner_pause, 2),
        "f0_median": round(float(np.median(f)), 0) if n else None,
        "f0_vs_global_st": round(float(st(np.median(f), global_med)), 2) if n else None,
        "f0_range_st_p10_p90": round(float(st(np.percentile(f, 90)) - st(np.percentile(f, 10))), 1) if n > 5 else None,
        "start_vs_end_st": round(float(st(np.median(tail), np.median(head))), 1) if n > 5 else None,
        "loudness_db_mean": round(float(d.mean()), 1) if len(d) else None,
        "pause_after_s": pause_after,
        "emphasis_top3": top,
    })
out["sentences"] = rows

# pause statistics, attached to punctuation
pl = []
for ps, pe in pauses:
    prev = [w for w in W if w["e"] <= ps + 0.15]
    pw = prev[-1]["w"] if prev else "(start)"
    kind = "period" if re.search(r"[.?!]$", pw) else "comma" if re.search(r"[,;:]$", pw) else "none"
    pl.append({"at": ps, "len": round(pe - ps, 2), "after_word": pw, "punct": kind})
out["pauses"] = pl
summ = {}
for k in ("period", "comma", "none"):
    v = [p["len"] for p in pl if p["punct"] == k and p["after_word"] != "(start)"]
    if v: summ[k] = {"count": len(v), "median_s": round(float(np.median(v)), 2), "min": min(v), "max": max(v)}
out["pause_summary"] = summ

# overall pace
speech_time = dur - sum(pe - ps for ps, pe in pauses)
nw = len(W); ns = sum(syllables(w["w"]) for w in W)
first, last = W[0]["s"], W[-1]["e"]
out["pace"] = {"words": nw, "syllables_est": ns, "speech_span_s": round(last - first, 2),
               "wpm_gross_incl_pauses": round(60 * nw / (last - first), 0),
               "syll_per_s_articulation": round(ns / speech_time, 2),
               "pause_fraction": round(1 - speech_time / dur, 2)}

# what's in the first 9 seconds
seg = [(round(a, 1), round(b, 1)) for a, b in pauses if a < 9.5]
v9 = voiced[pt < 9]
out["opening_0_9s"] = {"pauses": seg, "voiced_fraction": round(float(v9.mean()), 2),
                      "intensity_db_by_second": [round(float(np.median(iv[(it >= k) & (it < k + 1)])), 1) for k in range(9)]}

# pitch contour by second (for the change map)
out["f0_by_2s"] = [(k, round(float(np.median(pf[(pt >= k) & (pt < k + 2) & voiced])), 0) if ((pt >= k) & (pt < k + 2) & voiced).any() else None,
                    round(float(np.median(iv[(it >= k) & (it < k + 2)])), 1)) for k in range(0, int(dur), 2)]

json.dump(out, open(os.path.join(HERE, "analysis.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False, default=float)
print(json.dumps({k: out[k] for k in ("file", "pitch_overall", "voice_quality", "formants_median_hz", "spectral_balance", "pace", "pause_summary", "opening_0_9s")}, indent=1, default=float))
for r in rows:
    print(f'{r["n"]:>2} {r["start"]:>5}-{r["end"]:<5} {r["wpm_gross"]:>4.0f}wpm {r["syll_per_s_net"]:>4}sps f0 {r["f0_median"]} ({r["f0_vs_global_st"]:+}st) rng {r["f0_range_st_p10_p90"]} slope {r["start_vs_end_st"]} dB {r["loudness_db_mean"]} pause {r["pause_after_s"]} | {r["emphasis_top3"]}')
    print("     ", r["text"])
print("PAUSES:", [(p["at"], p["len"], p["after_word"]) for p in pl])
print("F0/2s:", out["f0_by_2s"])
