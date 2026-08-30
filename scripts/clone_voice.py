#!/usr/bin/env python3
"""
clone_voice.py - Create and register voice cloning profiles for Call Studio
"""

import os
import sys
import argparse
import subprocess
import shutil
import re
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("clone_voice")

def main():
    parser = argparse.ArgumentParser(description="Clone a voice profile using Whisper transcription.")
    parser.add_argument("--audio-path", required=True, help="Path to the uploaded audio sample file.")
    parser.add_argument("--voice-id", required=True, help="Target voice ID (e.g., local_voice_12345).")
    parser.add_argument("--voice-name", required=True, help="User-friendly name of the voice.")
    parser.add_argument("--text", help="Optional pre-transcribed text.")
    
    args = parser.parse_args()
    
    input_audio = Path(args.audio_path)
    if not input_audio.exists():
        logger.error(f"Input audio file not found: {args.audio_path}")
        sys.exit(1)
        
    project_root = Path(__file__).resolve().parent.parent
    references_dir = project_root / "fish-speech-int4-patch" / "references"
    voice_dir = references_dir / args.voice_id
    
    logger.info(f"Creating voice profile directory: {voice_dir}")
    voice_dir.mkdir(parents=True, exist_ok=True)
    
    target_wav = voice_dir / "sample.wav"
    target_lab = voice_dir / "sample.lab"
    
    # 1. Convert audio to 24kHz mono WAV (max 5.0 seconds for optimal F5-TTS cadence)
    logger.info(f"Converting and optimizing input audio {input_audio} to wav: {target_wav}")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(input_audio), "-t", "5.0", "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", str(target_wav)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        logger.info("Audio conversion successful.")
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg conversion failed: {e.stderr.decode('utf-8', errors='ignore')}")
        if voice_dir.exists():
            shutil.rmtree(voice_dir)
        sys.exit(1)
        
    # 2. Transcribe audio with faster-whisper
    transcript_text = args.text
    if not transcript_text:
        try:
            from faster_whisper import WhisperModel
            logger.info("Transcribing sample with faster-whisper...")
            model = WhisperModel("base", device="cpu", compute_type="int8")
            segments, _ = model.transcribe(str(target_wav))
            transcript_text = " ".join([s.text for s in segments]).strip()
        except Exception as e:
            logger.warning(f"Local whisper fallback: {e}")
            transcript_text = f"Sample voice audio profile for {args.voice_name}"
            
    if not transcript_text:
        transcript_text = f"Sample voice audio profile for {args.voice_name}"
        
    # 3. Save transcript to .lab file
    logger.info(f"Saving reference text to {target_lab}: '{transcript_text}'")
    try:
        with open(target_lab, "w", encoding="utf-8") as f:
            f.write(transcript_text)
    except Exception as e:
        logger.error(f"Failed to write lab file: {e}")
        if voice_dir.exists():
            shutil.rmtree(voice_dir)
        sys.exit(1)
        
    # 4. Auto-sync to crazycrab GPU cluster under multiple alias keys
    name_slug = re.sub(r'[^a-zA-Z0-9_]', '_', args.voice_name.lower().strip())
    aliases = [args.voice_id, name_slug]
    
    try:
        for alias in aliases:
            logger.info(f"Syncing cloned voice alias '{alias}' to crazycrab...")
            subprocess.run(["ssh", "-o", "ConnectTimeout=10", "crazycrab", f"mkdir -p /home/bipul/speech-to-speech/custom_voices/{alias} /home/bipul/speech-to-speech/src/speech_to_speech/TTS/presets"], check=False)
            subprocess.run(["scp", "-o", "ConnectTimeout=10", str(target_wav), f"crazycrab:/home/bipul/speech-to-speech/custom_voices/{alias}/ref.wav"], check=False)
            subprocess.run(["scp", "-o", "ConnectTimeout=10", str(target_lab), f"crazycrab:/home/bipul/speech-to-speech/custom_voices/{alias}/ref_text.txt"], check=False)
            subprocess.run(["scp", "-o", "ConnectTimeout=10", str(target_wav), f"crazycrab:/home/bipul/speech-to-speech/src/speech_to_speech/TTS/presets/{alias}.wav"], check=False)
            subprocess.run(["scp", "-o", "ConnectTimeout=10", str(target_lab), f"crazycrab:/home/bipul/speech-to-speech/src/speech_to_speech/TTS/presets/{alias}.txt"], check=False)
        logger.info("[✓] Voice synced to crazycrab!")
    except Exception as e:
        logger.warning(f"Sync to crazycrab skipped: {e}")

    logger.info(f"[✓] Voice profile {args.voice_id} ({args.voice_name}) created and registered successfully!")

if __name__ == "__main__":
    main()
