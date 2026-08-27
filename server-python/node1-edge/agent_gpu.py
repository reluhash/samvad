import asyncio
import json
import logging
import base64
import numpy as np
import websockets
from faster_whisper import WhisperModel
from openai import AsyncOpenAI
import soundfile as sf
import io
import time
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent_gpu")

VLLM_URL = os.getenv("VLLM_URL", "http://127.0.0.1:8100/v1")
FISH_URL = os.getenv("FISH_URL", "http://127.0.0.1:8880/v1")
MODEL_NAME = "cyankiwi/gemma-4-12B-it-qat-AWQ-INT4"
TTS_MODEL = "s2-pro"
SAMPLE_RATE = 16000

# Global state
class PipelineState:
    def __init__(self):
        self.generation_id = 0
        self.held_text = ""
        self.stt_queue = asyncio.Queue()
        self.llm_queue = asyncio.Queue()
        self.tts_queue = asyncio.Queue()
        self.ws_send_queue = asyncio.Queue()
        self.current_llm_task = None
        self.current_tts_task = None
        self.vllm_client = AsyncOpenAI(api_key="EMPTY", base_url=VLLM_URL)
        self.fish_client = AsyncOpenAI(api_key="EMPTY", base_url=FISH_URL)
        self.failed_voices = set()
        logger.info("Loading Whisper model on GPU 1...")
        self.whisper = WhisperModel("distil-large-v3", device="cuda", device_index=0, compute_type="float16")
        logger.info("Whisper model loaded.")

state = PipelineState()

async def transcribe_worker():
    while True:
        task = await state.stt_queue.get()
        gen_id, audio_data, system_prompt, voice_id = task
        if gen_id != state.generation_id:
            state.stt_queue.task_done()
            continue

        if audio_data is None:
            if state.held_text and gen_id == state.generation_id:
                logger.info(f"[Gen {gen_id}] Flushing held text: '{state.held_text}'")
                full_text = state.held_text
                state.held_text = ""
                await state.llm_queue.put((gen_id, full_text, system_prompt, voice_id))
            state.stt_queue.task_done()
            continue

        logger.info(f"[Gen {gen_id}] STT started")
        t0 = time.time()
        
        # Save audio to memory for transcription
        audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        
        segments, _ = state.whisper.transcribe(audio_np, vad_filter=False, beam_size=1)
        text = " ".join([segment.text for segment in segments]).strip()
        t1 = time.time()
        
        if text and gen_id == state.generation_id:
            logger.info(f"[Gen {gen_id}] STT complete: '{text}' ({t1-t0:.2f}s)")
            
            if not text.endswith(('.', '?', '!')):
                state.held_text = (state.held_text + " " + text).strip() if state.held_text else text
                logger.info(f"[Gen {gen_id}] Text does not end with punctuation. Holding: '{state.held_text}'")
            else:
                full_text = (state.held_text + " " + text).strip() if state.held_text else text
                state.held_text = ""
                await state.llm_queue.put((gen_id, full_text, system_prompt, voice_id))
        
        state.stt_queue.task_done()

async def llm_worker():
    while True:
        task = await state.llm_queue.get()
        gen_id, text, system_prompt, voice_id = task
        if gen_id != state.generation_id:
            state.llm_queue.task_done()
            continue

        async def _do_llm():
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ]
            
            logger.info(f"[Gen {gen_id}] LLM started. Messages: {messages}")
            t0 = time.time()
            
            try:
                response = await state.vllm_client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    stream=True,
                    max_tokens=256,
                    temperature=0.7
                )
                
                first_token_time = None
                tokens_generated = 0
                async for chunk in response:
                    if gen_id != state.generation_id:
                        logger.warning(f"[Gen {gen_id}] Gen ID mismatch: {state.generation_id}. Breaking.")
                        break
                        
                    if not chunk.choices:
                        logger.info(f"[Gen {gen_id}] Empty choices in chunk: {chunk}")
                        continue
                    delta = chunk.choices[0].delta
                    content = delta.content
                    if content:
                        tokens_generated += 1
                        if first_token_time is None:
                            first_token_time = time.time()
                            logger.info(f"[Gen {gen_id}] LLM first token ({first_token_time-t0:.2f}s)")
                            
                        msg = {
                            "type": "llm_token",
                            "gen_id": gen_id,
                            "text": content,
                            "done": False
                        }
                        await state.ws_send_queue.put(json.dumps(msg))
                
                if gen_id == state.generation_id:
                    msg = {
                        "type": "llm_token",
                        "gen_id": gen_id,
                        "text": "",
                        "done": True
                    }
                    await state.ws_send_queue.put(json.dumps(msg))
                    
                    
            except asyncio.CancelledError:
                logger.info(f"[Gen {gen_id}] LLM task cancelled.")
                raise
            except Exception as e:
                logger.error(f"LLM Error: {e}")

        subtask = asyncio.create_task(_do_llm())
        state.current_llm_task = subtask
        try:
            await subtask
        except asyncio.CancelledError:
            pass
        finally:
            if state.current_llm_task == subtask:
                state.current_llm_task = None
            
        state.llm_queue.task_done()

async def tts_worker():
    import aiohttp
    import struct
    
    # Create a persistent session for connection pooling
    connector = aiohttp.TCPConnector(limit=10)
    async with aiohttp.ClientSession(connector=connector) as session:
        while True:
            task = await state.tts_queue.get()
            gen_id, text, voice_id = task
            if gen_id != state.generation_id:
                state.tts_queue.task_done()
                continue

            if voice_id in state.failed_voices:
                voice_id = "default"

            async def _do_tts():
                logger.info(f"[Gen {gen_id}] TTS started for: '{text}'")
                t0 = time.time()
                
                try:
                    payload = {
                        "model": TTS_MODEL,
                        "input": text,
                        "voice": voice_id if voice_id else "default",
                        "response_format": "wav",
                        "stream": True
                    }
                    
                    async def stream_audio(payload_dict):
                        async with session.post(f"{FISH_URL}/audio/speech", json=payload_dict) as resp:
                            if resp.status != 200:
                                logger.error(f"TTS Stream Error {resp.status}: {await resp.text()}")
                                return False
                            
                            first_chunk = True
                            sample_rate = 44100
                            byte_buffer = bytearray()
                            chunks_sent = 0
                            async for chunk, _ in resp.content.iter_chunks():
                                if gen_id != state.generation_id:
                                    break
                                if not chunk:
                                    continue
                                
                                byte_buffer.extend(chunk)
                                
                                if first_chunk:
                                    data_idx = byte_buffer.find(b"data")
                                    if data_idx != -1 and len(byte_buffer) >= data_idx + 8:
                                        sample_rate = 44100  # Hardcode to avoid OOM with corrupted headers
                                        byte_buffer = bytearray(byte_buffer[data_idx + 8:])
                                        first_chunk = False
                                    elif len(byte_buffer) > 200:
                                        # Fallback if no 'data' chunk found quickly
                                        sample_rate = 44100
                                        byte_buffer = bytearray(byte_buffer[44:])
                                        first_chunk = False
                                    else:
                                        # Wait for more bytes
                                        continue
                                
                                # Ensure we send multiples of 2 bytes
                                to_send_len = (len(byte_buffer) // 2) * 2
                                if to_send_len > 0:
                                    pcm_chunk = bytes(byte_buffer[:to_send_len])
                                    byte_buffer = byte_buffer[to_send_len:]
                                    
                                    msg = {
                                        "type": "audio_chunk",
                                        "gen_id": gen_id,
                                        "sample_rate": sample_rate,
                                        "data": base64.b64encode(pcm_chunk).decode('utf-8')
                                    }
                                    await state.ws_send_queue.put(json.dumps(msg))
                                    chunks_sent += 1
                            
                            if len(byte_buffer) > 0 and gen_id == state.generation_id:
                                # Pad with zero if length is odd
                                if len(byte_buffer) % 2 != 0:
                                    byte_buffer.append(0)
                                msg = {
                                    "type": "audio_chunk",
                                    "gen_id": gen_id,
                                    "sample_rate": sample_rate,
                                    "data": base64.b64encode(bytes(byte_buffer)).decode('utf-8')
                                }
                                await state.ws_send_queue.put(json.dumps(msg))
                                chunks_sent += 1
                            logger.info(f"[Gen {gen_id}] stream_audio finished. Sent {chunks_sent} chunks.")
                            return True

                    success = await stream_audio(payload)
                    if not success and voice_id and voice_id != "default":
                        logger.warning(f"Voice '{voice_id}' failed. Retrying stream with default voice.")
                        state.failed_voices.add(voice_id)
                        payload["voice"] = "default"
                        await stream_audio(payload)
                        
                    t1 = time.time()
                    logger.info(f"[Gen {gen_id}] TTS streaming finished ({t1-t0:.2f}s)")
                except asyncio.CancelledError:
                    logger.info(f"[Gen {gen_id}] TTS task cancelled.")
                    raise
                except Exception as e:
                    logger.error(f"TTS Worker Error: {e}")

            subtask = asyncio.create_task(_do_tts())
            state.current_tts_task = subtask
            try:
                await subtask
            except asyncio.CancelledError:
                pass
            finally:
                if state.current_tts_task == subtask:
                    state.current_tts_task = None
                
            state.tts_queue.task_done()

from aiohttp import web

async def handle_transcribe(request):
    try:
        # Read multipart reader
        reader = await request.multipart()
        field = await reader.next()
        if field is None or field.name != "file":
            return web.json_response({"error": "No file field"}, status=400)
            
        # Read file bytes
        file_bytes = await field.read()
        
        # Transcribe using Whisper
        audio_file = io.BytesIO(file_bytes)
        data, samplerate = sf.read(audio_file)
        
        # If stereo, convert to mono
        if len(data.shape) > 1:
            data = data.mean(axis=1)
            
        # Resample to 16000Hz using numpy interpolation if needed
        if samplerate != 16000:
            num_samples = int(len(data) * 16000 / samplerate)
            indices = np.linspace(0, len(data) - 1, num_samples)
            data = np.interp(indices, np.arange(len(data)), data)
            
        # Whisper transcribes float32 arrays
        segments, _ = state.whisper.transcribe(data.astype(np.float32), vad_filter=False, beam_size=1)
        text = " ".join([segment.text for segment in segments]).strip()
        
        logger.info(f"HTTP Transcribe successful: '{text}'")
        return web.json_response({"text": text})
    except Exception as e:
        logger.error(f"HTTP Transcribe failed: {e}")
        return web.json_response({"error": str(e)}, status=500)

async def handle_client(websocket, path=None):
    logger.info("Bridge agent connected")
    
    async def ws_sender():
        while True:
            msg = await state.ws_send_queue.get()
            if msg is None: break
            await websocket.send(msg)
            state.ws_send_queue.task_done()
            
    # Start workers for this connection
    tasks = [
        asyncio.create_task(transcribe_worker()),
        asyncio.create_task(llm_worker()),
        asyncio.create_task(tts_worker()),
        asyncio.create_task(ws_sender())
    ]
    
    try:
        async for message in websocket:
            data = json.loads(message)
            
            if data["type"] == "interrupt" or data["type"] == "audio":
                gen_id = data.get("gen_id")
                
                # Check if it's a new generation to handle cancellation
                if gen_id and gen_id != state.generation_id:
                    state.generation_id = gen_id
                    
                if data["type"] == "interrupt":
                    state.generation_id += 1
                    if data.get("clear_held_text", False):
                        state.held_text = ""
                
                # Instantly cancel running LLM and TTS tasks for the previous turn
                if state.current_llm_task and not state.current_llm_task.done():
                    state.current_llm_task.cancel()
                if state.current_tts_task and not state.current_tts_task.done():
                    state.current_tts_task.cancel()
                    
                # Clear all queues to abort pending work
                for q in [state.stt_queue, state.llm_queue, state.tts_queue, state.ws_send_queue]:
                    while not q.empty():
                        try:
                            q.get_nowait()
                            q.task_done()
                        except asyncio.QueueEmpty:
                            break
                            
                logger.info(f"Gen ID {state.generation_id}: Cancelled previous tasks and cleared queues.")

                if data["type"] == "audio":
                    audio_b64 = data["data"]
                    system_prompt = data.get("system_prompt", "You are a helpful conversational voice assistant. Do not use markdown, asterisks, or any descriptive action text. Only output spoken words.")
                    voice_id = data.get("voice_id", "default")
                    
                    audio_bytes = base64.b64decode(audio_b64)
                    await state.stt_queue.put((state.generation_id, audio_bytes, system_prompt, voice_id))
                
            elif data["type"] == "tts_request":
                gen_id = data["gen_id"]
                text = data["text"]
                voice_id = data.get("voice_id", "default")
                await state.tts_queue.put((gen_id, text, voice_id))
            elif data["type"] == "flush":
                gen_id = data.get("gen_id")
                system_prompt = data.get("system_prompt", "You are a helpful conversational voice assistant. Do not use markdown, asterisks, or any descriptive action text. Only output spoken words.")
                voice_id = data.get("voice_id", "default")
                await state.stt_queue.put((gen_id, None, system_prompt, voice_id))
                    
    except websockets.exceptions.ConnectionClosed:
        logger.info("Bridge agent disconnected")
    finally:
        for t in tasks:
            t.cancel()

async def main():
    logger.info("Starting GPU Agent WebSocket server on :9100")
    ws_server = await websockets.serve(handle_client, "0.0.0.0", 9100)
    
    # Start HTTP server on 8881 with a 32MB max upload limit
    app = web.Application(client_max_size=32 * 1024 * 1024)
    app.router.add_post("/transcribe", handle_transcribe)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8881)
    logger.info("Starting GPU Agent HTTP transcribe server on :8881")
    await site.start()
    
    # Run forever
    try:
        await asyncio.Future()
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
