import sys, json, wave, numpy as np, torch
from transformers import pipeline
path, out = sys.argv[1], sys.argv[2]
with wave.open(path) as w:
    sr = w.getframerate(); a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
dev = 0 if torch.cuda.is_available() else -1
print('cuda', torch.cuda.is_available(), 'sr', sr, flush=True)
asr = pipeline('automatic-speech-recognition', model='openai/whisper-small.en', device=dev, chunk_length_s=30, torch_dtype=torch.float16 if dev==0 else torch.float32)
r = asr({'raw': a, 'sampling_rate': sr}, return_timestamps='word', batch_size=1, generate_kwargs={'num_beams':1})
json.dump(r, open(out, 'w'), indent=1, default=float)
print(r['text'])
