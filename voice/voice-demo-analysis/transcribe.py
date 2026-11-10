import json, os, sys
os.environ["HF_HOME"] = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache", "huggingface")
import librosa, numpy as np, torch
from transformers import pipeline

SRC = r"C:\Users\User\AppData\Local\CapCut\Videos\Voice demo.MP3"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "words.json")

y, sr = librosa.load(SRC, sr=16000, mono=True)
pipe = pipeline("automatic-speech-recognition", model="openai/whisper-medium",
                device=0 if torch.cuda.is_available() else -1, dtype=torch.float16)
r = pipe({"raw": y, "sampling_rate": 16000}, chunk_length_s=30, stride_length_s=5,
         batch_size=2, return_timestamps="word",
         generate_kwargs={"task": "transcribe"})
json.dump(r, open(OUT, "w", encoding="utf-8"), indent=0, ensure_ascii=False)
print(r["text"].encode("ascii", "replace").decode())
print(len(r["chunks"]), "words")
print(r["chunks"][:5], r["chunks"][-5:])
