#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
import shutil
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("clone_voice")

def main():
    parser = argparse.ArgumentParser(description="Clone a voice profile using Whisper transcription.")
    parser.add_argument("--audio-path", required=True, help="Path to the uploaded audio sample file.")
    parser.add_argument("--voice-id", required=True, help="Target voice ID (e.g., local_voice_12345).")
    parser.add_argument("--voice-name", required=True, help="User-friendly name of the voice.")
    parser.add_argument("--text", help="Optional pre-transcribed text. If not provided, Whisper will be used.")
    
    args = parser.parse_args()
    
    input_audio = Path(args.audio_path)
    if not input_audio.exists():
        logger.error(f"Input audio file not found: {args.audio_path}")
        sys.exit(1)
        
    # Paths
    project_root = Path(__file__).resolve().parent.parent
    references_dir = project_root / "fish-speech-int4-patch" / "references"
    voice_dir = references_dir / args.voice_id
    
    logger.info(f"Creating voice profile directory: {voice_dir}")
    voice_dir.mkdir(parents=True, exist_ok=True)
    
    target_wav = voice_dir / "sample.wav"
    target_lab = voice_dir / "sample.lab"
    
    # 1. Convert audio to 44.1kHz mono WAV using ffmpeg for maximum compatibility
    logger.info(f"Converting input audio {input_audio} to wav: {target_wav}")
    try:
        # Use ffmpeg to convert to 16-bit PCM WAV at 44100Hz mono
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(input_audio), "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(target_wav)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        logger.info("Audio conversion successful.")
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg conversion failed: {e.stderr.decode('utf-8', errors='ignore')}")
        # Clean up directory on failure
        if voice_dir.exists():
            shutil.rmtree(voice_dir)
        sys.exit(1)
        
    # 2. Transcribe audio if text is not provided
    transcript_text = args.text
    if not transcript_text:
        # Use the remote voice-utilities transcription API (Whisper already loaded on GPU server)
        transcribe_url = os.environ.get("TRANSCRIBE_URL", "http://127.0.0.1:8881/transcribe")
        logger.info(f"No transcript provided. Calling remote transcription API at {transcribe_url}...")
        try:
            import urllib.request
            import json as _json
            # Build multipart form-data request with the WAV file
            boundary = "----VoiceCloneBoundary"
            wav_data = target_wav.read_bytes()
            body = (
                f"--{boundary}\r\n"
                f"Content-Disposition: form-data; name=\"file\"; filename=\"sample.wav\"\r\n"
                f"Content-Type: audio/wav\r\n\r\n"
            ).encode("utf-8") + wav_data + f"\r\n--{boundary}--\r\n".encode("utf-8")
            req = urllib.request.Request(
                transcribe_url,
                data=body,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as response:
                result = _json.loads(response.read().decode("utf-8"))
                transcript_text = result.get("text", "").strip()
            logger.info(f"Remote Transcription: '{transcript_text}'")
        except Exception as e:
            logger.error(f"Remote transcription failed: {e}")
            if voice_dir.exists():
                shutil.rmtree(voice_dir)
            sys.exit(1)
            
    if not transcript_text:
        logger.error("Failed to obtain transcription text.")
        if voice_dir.exists():
            shutil.rmtree(voice_dir)
        sys.exit(1)
        
    # 3. Save transcript to .lab file
    logger.info(f"Saving reference text to {target_lab}")
    try:
        with open(target_lab, "w", encoding="utf-8") as f:
            f.write(transcript_text)
    except Exception as e:
        logger.error(f"Failed to write lab file: {e}")
        if voice_dir.exists():
            shutil.rmtree(voice_dir)
        sys.exit(1)
        
    # 4. Sync the cloned voice folder to the GPU server
    logger.info(f"Syncing voice profile {args.voice_id} to the GPU server...")
    try:
        gpu_ref_parent = "/home/jovyan/fish-speech-int4-patch/references/"
        subprocess.run(
            [
                "scp",
                "-i", "/home/ubuntu/.ssh/id_rsa_e2e",
                "-o", "StrictHostKeyChecking=no",
                "-r",
                str(voice_dir),
                f"bipul@crazycrab:/home/bipul/voice-gpu-backend/gpu-docker/references/{args.voice_id}"
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        logger.info("Successfully synced voice profile to the GPU server.")
    except Exception as e:
        logger.warning(f"Failed to sync voice profile to the GPU server: {e}. Cloned voice may not play unless manually synced.")

    # 5. Trigger dummy API call to pre-compute the .pt file if the Fish Speech API is running
    import urllib.request
    import json
    
    logger.info("Attempting to pre-compute reference embeddings by triggering synthesis...")
    try:
        # Check if Fish Speech API is online
        req_url = "http://127.0.0.1:8880/v1/audio/speech"
        data = {
            "model": "s2-pro",
            "voice": args.voice_id,
            "input": "Warmup"
        }
        req = urllib.request.Request(
            req_url,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        # Timeout quickly since we don't need the actual audio, just need to trigger load_by_id
        with urllib.request.urlopen(req, timeout=15.0) as response:
            logger.info("Successfully triggered Fish Speech to generate and save .pt cache.")
    except Exception as e:
        logger.warning(f"Could not trigger Fish Speech API warmup (might be offline): {e}. Embeddings will be computed on first call.")
        
    logger.info(f"Voice profile {args.voice_id} created successfully!")

if __name__ == "__main__":
    main()
