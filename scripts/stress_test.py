#!/usr/bin/env python3
import os
import sys
import time
import asyncio
import aiohttp
import subprocess
import psutil
import logging
import argparse
from openai import AsyncOpenAI

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("stress_test")

# API clients setup
VLLM_URL = os.getenv("VLLM_URL", "http://127.0.0.1:8000/v1")
FISH_URL = os.getenv("FISH_URL", "http://127.0.0.1:8880/v1")

vllm_client = AsyncOpenAI(api_key="EMPTY", base_url=VLLM_URL)
fish_client = AsyncOpenAI(api_key="EMPTY", base_url=FISH_URL)

def get_vram_usage():
    """Query nvidia-smi for VRAM usage (in MB)."""
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True
        )
        return int(res.stdout.decode().strip())
    except Exception:
        return None

def get_ram_usage():
    """Query current process and system RAM usage (in MB)."""
    process = psutil.Process(os.getpid())
    process_mem = process.memory_info().rss / (1024 * 1024)
    system_mem = psutil.virtual_memory().percent
    return process_mem, system_mem

async def test_llm_turn(prompt: str, turn_idx: int):
    """Test vLLM generation and measure time to first token and total time."""
    logger.info(f"[Turn {turn_idx}] 🧠 Sending prompt to LLM: '{prompt[:40]}...'")
    start_time = time.time()
    first_token_time = None
    total_tokens = 0
    
    try:
        stream = await vllm_client.chat.completions.create(
            model="cyankiwi/gemma-4-12B-it-qat-AWQ-INT4",
            messages=[
                {"role": "system", "content": "You are a helpful customer support agent. Keep your answers under 30 words."},
                {"role": "user", "content": prompt}
            ],
            stream=True,
            max_tokens=100
        )
        
        async for chunk in stream:
            if first_token_time is None:
                first_token_time = time.time() - start_time
            content = chunk.choices[0].delta.content or ""
            total_tokens += len(content.split())
            
        total_time = time.time() - start_time
        logger.info(f"[Turn {turn_idx}] LLM: First token in {first_token_time:.3f}s, Total time: {total_time:.3f}s ({total_tokens} tokens)")
        return first_token_time, total_time
    except Exception as e:
        logger.error(f"[Turn {turn_idx}] LLM error: {e}")
        return None, None

async def test_tts_turn(text: str, voice_id: str, turn_idx: int):
    """Test Fish Speech synthesis and measure response time."""
    logger.info(f"[Turn {turn_idx}] 🔊 Sending text to TTS (Voice: {voice_id}): '{text[:40]}...'")
    start_time = time.time()
    
    try:
        response = await fish_client.audio.speech.create(
            model="s2-pro",
            voice=voice_id,
            input=f"[calm] {text}"
        )
        audio_data = response.read()
        total_time = time.time() - start_time
        audio_len = len(audio_data) / 1024  # in KB
        logger.info(f"[Turn {turn_idx}] TTS: Synthesized {audio_len:.1f} KB in {total_time:.3f}s")
        return total_time, audio_len
    except Exception as e:
        logger.error(f"[Turn {turn_idx}] TTS error: {e}")
        return None, None

async def run_stress_test(turns=5, concurrent_requests=1, voice_id="default"):
    logger.info("=" * 60)
    logger.info(f"Starting VoiceForge Stress Test ({turns} turns, {concurrent_requests} concurrent requests)")
    logger.info("=" * 60)
    
    test_prompts = [
        "Hello! Can you help me set up an appointment for tomorrow at 3 PM?",
        "What are your business hours, and do you offer weekend support?",
        "I am having trouble logging in to my account. It says my password is invalid.",
        "Can I get a refund on my purchase from last week? The invoice number is 98765.",
        "Thank you so much! That was very helpful. Have a wonderful day!"
    ]
    
    # Pad prompts if turns > len(test_prompts)
    while len(test_prompts) < turns:
        test_prompts.extend(test_prompts)
    test_prompts = test_prompts[:turns]
    
    initial_vram = get_vram_usage()
    p_mem, sys_mem = get_ram_usage()
    logger.info(f"Initial Metrics - RAM: {p_mem:.1f}MB (Sys: {sys_mem}%), VRAM: {initial_vram}MB")
    
    llm_latencies = []
    tts_latencies = []
    
    for idx, prompt in enumerate(test_prompts):
        logger.info("-" * 40)
        
        # Run turns
        if concurrent_requests == 1:
            # Sequential Turn
            llm_ft, llm_tot = await test_llm_turn(prompt, idx + 1)
            if llm_tot:
                llm_latencies.append(llm_tot)
                
            tts_tot, tts_sz = await test_tts_turn("This is a synthesized test sentence to verify voice cloning stability.", voice_id, idx + 1)
            if tts_tot:
                tts_latencies.append(tts_tot)
        else:
            # Concurrent Turns
            tasks = []
            for c in range(concurrent_requests):
                tasks.append(test_llm_turn(f"{prompt} (Request {c+1})", idx * concurrent_requests + c + 1))
                tasks.append(test_tts_turn("This is a concurrent stress test turn.", voice_id, idx * concurrent_requests + c + 1))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for res in results:
                if isinstance(res, tuple) and len(res) == 2:
                    if res[1] is not None:  # LLM total time
                        llm_latencies.append(res[1])
                elif isinstance(res, tuple) and len(res) == 2:
                    if res[0] is not None:  # TTS total time
                        tts_latencies.append(res[0])
                        
        # Track memory after each turn
        vram = get_vram_usage()
        p_mem, sys_mem = get_ram_usage()
        logger.info(f"Metrics [Turn {idx + 1}] - RAM: {p_mem:.1f}MB (Sys: {sys_mem}%), VRAM: {vram}MB")
        await asyncio.sleep(1.0) # cool down between turns
        
    logger.info("=" * 60)
    logger.info("Stress Test Completed!")
    if llm_latencies:
        logger.info(f"LLM Avg Latency: {sum(llm_latencies)/len(llm_latencies):.3f}s")
    if tts_latencies:
        logger.info(f"TTS Avg Latency: {sum(tts_latencies)/len(tts_latencies):.3f}s")
    final_vram = get_vram_usage()
    if initial_vram and final_vram:
        logger.info(f"VRAM Leak: {final_vram - initial_vram}MB (Initial: {initial_vram}MB, Final: {final_vram}MB)")
    logger.info("=" * 60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run VoiceForge Multi-turn Stress Tests")
    parser.add_argument("--turns", type=int, default=5, help="Number of turns to simulate")
    parser.add_argument("--concurrent", type=int, default=1, help="Number of concurrent requests")
    parser.add_argument("--voice", type=str, default="default", help="Voice ID to use for synthesis")
    
    args = parser.parse_args()
    
    asyncio.run(run_stress_test(turns=args.turns, concurrent_requests=args.concurrent, voice_id=args.voice))
