import asyncio
import json
import base64
import time
import sys
import numpy as np
import soundfile as sf
import websockets

async def run_benchmark(wav_path, ws_url="ws://127.0.0.1:9100"):
    print(f"Reading audio file: {wav_path}")
    data, samplerate = sf.read(wav_path)
    
    # Convert to mono if stereo
    if len(data.shape) > 1:
        data = data.mean(axis=1)
        
    # Resample to 16000Hz using linear interpolation
    if samplerate != 16000:
        print(f"Resampling from {samplerate}Hz to 16000Hz...")
        num_samples = int(len(data) * 16000 / samplerate)
        indices = np.linspace(0, len(data) - 1, num_samples)
        data = np.interp(indices, np.arange(len(data)), data)
        samplerate = 16000
        
    # Convert to 16-bit PCM
    pcm_data = (data * 32767.0).astype(np.int16).tobytes()
    pcm_b64 = base64.b64encode(pcm_data).decode('utf-8')
    
    print(f"Connecting to GPU agent at {ws_url}...")
    async with websockets.connect(ws_url) as ws:
        gen_id = int(time.time())
        msg = {
            "type": "audio",
            "gen_id": gen_id,
            "data": pcm_b64,
            "system_prompt": "You are a helpful assistant. Please give a brief response under 10 words.",
            "voice_id": "default"
        }
        
        print("Sending audio to GPU agent...")
        t_start = time.time()
        await ws.send(json.dumps(msg))
        
        t_first_token = None
        t_first_audio = None
        t_done = None
        llm_text = []
        current_chunk = []
        audio_chunks_received = 0
        total_audio_bytes = 0
        
        while True:
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=15.0)
                data_resp = json.loads(response)
                
                msg_type = data_resp.get("type")
                resp_gen_id = data_resp.get("gen_id")
                
                if resp_gen_id != gen_id:
                    continue
                    
                if msg_type == "llm_token":
                    text = data_resp.get("text", "")
                    done = data_resp.get("done", False)
                    if text:
                        if t_first_token is None:
                            t_first_token = time.time()
                            print(f"⏱️ Time to First Token (TTFT): {t_first_token - t_start:.3f}s")
                        llm_text.append(text)
                        current_chunk.append(text)
                        
                        # Check sentence boundary
                        chunk_text = "".join(current_chunk).strip()
                        if chunk_text.endswith(('.', '!', '?')):
                            print(f"📡 Sentence complete: \"{chunk_text}\". Sending tts_request...")
                            tts_msg = {
                                "type": "tts_request",
                                "gen_id": gen_id,
                                "text": chunk_text,
                                "voice_id": "default"
                            }
                            await ws.send(json.dumps(tts_msg))
                            current_chunk = []
                            
                    if done:
                        t_done = time.time()
                        print(f"⏱️ LLM Complete: {t_done - t_start:.3f}s")
                        print(f"🧠 LLM Response: \"{''.join(llm_text).strip()}\"")
                        # If there is any leftover text, send it
                        leftover = "".join(current_chunk).strip()
                        if leftover:
                            print(f"📡 Sending leftover text to TTS: \"{leftover}\"")
                            tts_msg = {
                                "type": "tts_request",
                                "gen_id": gen_id,
                                "text": leftover,
                                "voice_id": "default"
                            }
                            await ws.send(json.dumps(tts_msg))
                            current_chunk = []
                        
                elif msg_type == "audio_chunk":
                    audio_chunks_received += 1
                    chunk_b64 = data_resp.get("data", "")
                    chunk_bytes = base64.b64decode(chunk_b64)
                    total_audio_bytes += len(chunk_bytes)
                    
                    if t_first_audio is None:
                        t_first_audio = time.time()
                        print(f"⏱️ Time to First Audio (TTFA): {t_first_audio - t_start:.3f}s")
                        
            except asyncio.TimeoutError:
                print("Timeout waiting for response from GPU agent.")
                break
            except websockets.exceptions.ConnectionClosed:
                print("Connection closed by GPU agent.")
                break
                
            # Exit conditions
            if t_done is not None and t_first_audio is not None and audio_chunks_received > 5:
                # Wait briefly to get remaining audio
                await asyncio.sleep(1.0)
                break
                
        print("\n--- Benchmark Summary ---")
        if t_first_token:
            print(f"Whisper + LLM TTFT: {t_first_token - t_start:.3f}s")
        if t_first_audio:
            print(f"Total Time-to-First-Audio (TTFA): {t_first_audio - t_start:.3f}s")
        print(f"Audio chunks received: {audio_chunks_received} ({total_audio_bytes / 1024:.1f} KB)")
        print("-------------------------")

if __name__ == "__main__":
    wav = "server-python/final_output.wav"
    if len(sys.argv) > 1:
        wav = sys.argv[1]
    asyncio.run(run_benchmark(wav))
