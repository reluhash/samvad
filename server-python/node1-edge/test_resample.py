import torch
import torchaudio.transforms as T
import numpy as np
import time

try:
    print("Testing 1D tensor resample...", flush=True)
    # Simulate a chunk of 44100Hz audio (e.g. 0.5 seconds)
    chunk_size = 44100 // 2
    audio_np = np.random.randn(chunk_size).astype(np.float32)
    tensor = torch.tensor(audio_np)
    print(f"Tensor shape: {tensor.shape}", flush=True)

    t0 = time.time()
    resampler = T.Resample(orig_freq=44100, new_freq=16000)
    with torch.no_grad():
        out = resampler(tensor)
    
    t1 = time.time()
    print(f"Resampled shape: {out.shape}, took {t1-t0:.4f}s", flush=True)

except Exception as e:
    print(f"Error: {e}")
