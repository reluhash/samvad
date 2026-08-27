import asyncio
import os
import logging
import re
import io
import time
import json
import aiohttp
import numpy as np
import torch
import torchaudio.transforms as T
import soundfile as sf
from livekit import agents, rtc
from openai import AsyncOpenAI
from faster_whisper import WhisperModel
from pedalboard import Pedalboard, Compressor, LowShelfFilter, Reverb, HighpassFilter, NoiseGate, PeakFilter
import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("node1-edge")

# 1. Initialize API Clients
VLLM_URL = os.getenv("VLLM_URL", "http://127.0.0.1:8000/v1")
FISH_URL = os.getenv("FISH_URL", "http://127.0.0.1:8880/v1")

vllm_client = AsyncOpenAI(api_key="EMPTY", base_url=VLLM_URL)
fish_client = AsyncOpenAI(api_key="EMPTY", base_url=FISH_URL)

# 2. Initialize Redis connection
REDIS_SOCKET = os.getenv("REDIS_SOCKET_PATH", "/home/reluhash/Desktop/voice-kit/redis-data/redis.sock")
try:
    redis_client = redis.Redis(host="127.0.0.1", port=6379, decode_responses=True)
    redis_client.ping()
    logger.info("Connected to Redis via TCP (127.0.0.1:6379)")
except Exception as e1:
    try:
        redis_client = redis.Redis(unix_socket_path=REDIS_SOCKET, decode_responses=True)
        redis_client.ping()
        logger.info(f"Connected to Redis via Unix socket at {REDIS_SOCKET}")
    except Exception as e2:
        logger.warning(f"Failed to connect to Redis (TCP: {e1}, Socket: {e2}). Interruption will run in-memory.")
        redis_client = None

# Track active LLM and TTS tasks for cancellation/interruption
active_tasks = set()

def cancel_active_tasks():
    if active_tasks:
        logger.info("🛑 Cancelling all active LLM and TTS tasks...")
        for task in list(active_tasks):
            if not task.done():
                task.cancel()
        active_tasks.clear()

async def redis_listener():
    if not redis_client:
        return
    logger.info("Starting Redis subscription listener for cancel signals...")
    pubsub = redis_client.pubsub()
    pubsub.subscribe("agent:cancel")
    while True:
        try:
            # Fetch message in a non-blocking way
            message = pubsub.get_message(ignore_subscribe_messages=True)
            if message and message['data'] == 'interrupt':
                logger.info("🛑 Cancel signal received via Redis!")
                cancel_active_tasks()
            await asyncio.sleep(0.05)
        except Exception as e:
            logger.error(f"Redis listener error: {e}")
            await asyncio.sleep(1.0)

# 3. Initialize STT (Loaded on CPU)
logger.info("Loading Faster-Whisper...")
stt_model = WhisperModel("distil-large-v3", device="cpu", compute_type="int8")

# 4. Load Silero VAD
logger.info("Loading Silero VAD...")
vad_model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad', model='silero_vad', trust_repo=True)
get_speech_timestamps = utils[0]

# 5. Define the Audio Post-Processing Chain (Optimized for Cloned/Local Voices)
board = Pedalboard([
    HighpassFilter(cutoff_frequency_hz=90),
    NoiseGate(threshold_db=-45, ratio=8),
    LowShelfFilter(cutoff_frequency_hz=250, gain_db=-2.0),
    PeakFilter(cutoff_frequency_hz=3200, gain_db=2.5, q=1.0),
    Compressor(threshold_db=-18, ratio=3.0),
    Reverb(room_size=0.08, wet_level=0.03),
])

def get_call_config(room):
    """Retrieve call configuration from the user participant's metadata."""
    for p in room.remote_participants.values():
        if p.identity.startswith("user_"):
            if p.metadata:
                try:
                    config = json.loads(p.metadata)
                    logger.info(f"Found call config: {config}")
                    return config
                except Exception as e:
                    logger.error(f"Failed to parse user metadata: {e}")
    return {}

async def generate_speech_chunk(text: str, chunk_index: int, source: rtc.AudioSource, voice_id: str = "default", speed: float = 1.0):
    """Call Fish Audio or Kokoro to synthesize a sentence and stream to LiveKit."""
    logger.info(f"[{chunk_index}] 🔊 Synthesizing (Voice: {voice_id}, Speed: {speed}): {text}")
    start_t = time.time()
    
    try:
        if voice_id == "kokoro":
            # Call local Kokoro service on port 8881
            async with aiohttp.ClientSession() as session:
                async with session.post("http://127.0.0.1:8881/tts", json={
                    "text": text,
                    "voice": "af_sarah",
                    "speed": speed
                }) as resp:
                    if resp.status != 200:
                        err_msg = await resp.text()
                        raise Exception(f"Kokoro TTS server error: {err_msg}")
                    audio_data = await resp.read()
        else:
            # Map database local voice ID to Fish Speech reference ID
            resolved_voice = voice_id
                
            response = await fish_client.audio.speech.create(
                model="s2-pro",
                voice=resolved_voice, 
                input=f"[calm] {text}"
            )
            audio_data = response.read()
        
        # Decode WAV
        data, samplerate = sf.read(io.BytesIO(audio_data))
        logger.info(f"[{chunk_index}] ✅ Synthesized in {time.time() - start_t:.2f}s (Rate: {samplerate})")
        
        # Resample to 44100Hz if needed
        if samplerate != 44100:
            logger.info(f"Resampling from {samplerate}Hz to 44100Hz...")
            tensor = torch.tensor(data, dtype=torch.float32)
            if len(tensor.shape) == 1:
                tensor = tensor.unsqueeze(0)
            resampler = T.Resample(orig_freq=samplerate, new_freq=44100)
            resampled_tensor = resampler(tensor)
            data = resampled_tensor.squeeze(0).numpy()
            samplerate = 44100
            
        # Apply Pedalboard DSP
        processed_audio = board(data, samplerate)
        
        # Convert float32 to int16 PCM
        int16_audio = (processed_audio * 32767).astype(np.int16)
        
        # Stream to LiveKit
        frame = rtc.AudioFrame(
            data=int16_audio.tobytes(),
            sample_rate=samplerate,
            num_channels=1,
            samples_per_channel=len(int16_audio)
        )
        await source.capture_frame(frame)
        
    except asyncio.CancelledError:
        logger.info(f"[{chunk_index}] 🛑 Synthesis task was cancelled.")
        raise
    except Exception as e:
        logger.error(f"TTS Error: {e}")

async def process_turn(audio_buffer: list, incoming_sample_rate: int, source: rtc.AudioSource, room):
    """
    Transcribes audio with Whisper, sends text to vLLM, chunks output, and calls TTS.
    """
    audio_np = np.concatenate(audio_buffer, axis=0)
    audio_float32 = (audio_np / 32768.0).astype(np.float32)
    
    logger.info(f"Transcribing audio ({len(audio_float32)} samples at {incoming_sample_rate}Hz)...")
    
    # Whisper requires 16kHz audio
    tensor = torch.tensor(audio_float32)
    if incoming_sample_rate != 16000:
        resampler = T.Resample(orig_freq=incoming_sample_rate, new_freq=16000)
        tensor = resampler(tensor)
        
    audio_16k_np = tensor.numpy()
    
    def transcribe():
        segments, info = stt_model.transcribe(audio_16k_np, beam_size=1, language="en")
        text = " ".join([segment.text for segment in segments])
        return text.strip()
        
    user_input = await asyncio.to_thread(transcribe)
    logger.info(f"User: {user_input}")
    
    if not user_input:
        return
        
    # Get configuration from participant metadata
    config = get_call_config(room)
    system_prompt = config.get("systemPrompt") or "You are a helpful, brief, and enthusiastic AI assistant talking on the phone."
    voice_id = config.get("voiceId") or "default"
    voice_speed = config.get("voiceSpeed") or 1.0
    
    logger.info(f"Brain Prompt: {system_prompt}")
    logger.info("🧠 Sending to Gemma-4-12B...")
    try:
        stream = await vllm_client.chat.completions.create(
            model="cyankiwi/gemma-4-12B-it-qat-AWQ-INT4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input}
            ],
            stream=True,
            max_tokens=150
        )
        
        buffer = ""
        chunk_idx = 0
        
        async for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            buffer += token
            
            while True:
                best_idx = -1
                for i, char in enumerate(buffer):
                    is_terminal = char in ['.', '?', '!']
                    is_sub_sentence = char in [',', ':', '—'] or (char == '-' and (i + 1 < len(buffer) and buffer[i+1] == '-'))
                    
                    if is_terminal or is_sub_sentence:
                        offset = 2 if (char == '-' and i + 1 < len(buffer) and buffer[i+1] == '-') else 1
                        if i + offset >= len(buffer) or buffer[i+offset].isspace():
                            if is_terminal:
                                best_idx = i + (offset - 1)
                                break
                            else:
                                # Check 3 words threshold
                                prefix = buffer[:i+1]
                                words = prefix.split()
                                if len(words) >= 3:
                                    best_idx = i + (offset - 1)
                                    break
                
                if best_idx != -1:
                    sentence = buffer[:best_idx+1].strip()
                    if sentence:
                        task = asyncio.create_task(generate_speech_chunk(sentence, chunk_idx, source, voice_id, voice_speed))
                        active_tasks.add(task)
                        task.add_done_callback(active_tasks.discard)
                        chunk_idx += 1
                    buffer = buffer[best_idx+1:]
                else:
                    break
                    
        if buffer.strip():
            task = asyncio.create_task(generate_speech_chunk(buffer.strip(), chunk_idx, source, voice_id, voice_speed))
            active_tasks.add(task)
            task.add_done_callback(active_tasks.discard)
            
    except asyncio.CancelledError:
        logger.info("🧠 LLM stream reader was cancelled.")
        raise
    except Exception as e:
        logger.error(f"LLM Error: {e}")

async def entrypoint(ctx: agents.JobContext):
    logger.info("Initializing Node 1: Edge Orchestrator (Local GPU Mode)")
    await ctx.connect()
    
    # Start Redis listener task
    asyncio.create_task(redis_listener())
    
    # Fish S2 outputs 44100Hz audio
    source = rtc.AudioSource(44100, 1)
    track = rtc.LocalAudioTrack.create_audio_track("agent-mic", source)
    options = rtc.TrackPublishOptions()
    options.source = rtc.TrackSource.SOURCE_MICROPHONE
    await ctx.room.local_participant.publish_track(track, options)

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Subscribed to client audio track (Stream)")
            audio_stream = rtc.AudioStream(track)
            
            async def process_audio_stream():
                audio_buffer = []
                silence_frames = 0
                is_speaking = False
                resampler_vad = None
                
                async for frame in audio_stream:
                    audio_data = np.frombuffer(frame.data, dtype=np.int16)
                    float32_audio = (audio_data / 32768.0).astype(np.float32)
                    tensor = torch.tensor(float32_audio)
                    
                    if resampler_vad is None and frame.sample_rate != 16000:
                        resampler_vad = T.Resample(orig_freq=frame.sample_rate, new_freq=16000)
                        
                    if resampler_vad:
                        tensor_16k = resampler_vad(tensor)
                    else:
                        tensor_16k = tensor
                        
                    if len(tensor_16k) < 512:
                        continue
                        
                    confidence = vad_model(tensor_16k, 16000).item()
                    
                    if confidence > 0.5:
                        if not is_speaking:
                            is_speaking = True
                            logger.info("🎙️ User speech started.")
                            # Publish cancel signal to Redis
                            if redis_client:
                                try:
                                    redis_client.publish("agent:cancel", "interrupt")
                                except Exception as e:
                                    logger.error(f"Failed to publish cancel to Redis: {e}")
                            else:
                                cancel_active_tasks()
                        silence_frames = 0
                        audio_buffer.append(audio_data)
                    elif is_speaking:
                        silence_frames += 1
                        audio_buffer.append(audio_data)
                        
                        # 100 frames = roughly 1 second of silence (depending on frame duration)
                        if silence_frames > 100:
                            is_speaking = False
                            logger.info("🎙️ User speech finished. Processing turn...")
                            task = asyncio.create_task(process_turn(list(audio_buffer), frame.sample_rate, source, ctx.room))
                            active_tasks.add(task)
                            task.add_done_callback(active_tasks.discard)
                            audio_buffer = [] 
                            
            asyncio.create_task(process_audio_stream())

    while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        await asyncio.sleep(1)

if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
