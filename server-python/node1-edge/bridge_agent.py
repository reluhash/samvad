#!/usr/bin/env python3
"""
bridge_agent.py - LiveKit WebRTC Edge Agent connecting to Speech-to-Speech Realtime Core (crazycrab)
"""

import asyncio
import json
import logging
import base64
import os
import websockets
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit import rtc

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("s2s_bridge_agent")

S2S_CORE_WS = os.getenv("GPU_AGENT_WS", "ws://127.0.0.1:8765/v1/realtime")
DEFAULT_SAMPLE_RATE = 24000  # S2S Unified TTS sample rate (PCM16 mono 24kHz)

async def run_agent(ctx: JobContext):
    logger.info(f"Connecting bridge agent to LiveKit room: {ctx.room.name if ctx.room else 'default'}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    logger.info(f"Connected to participant: {participant.identity}")

    # Extract metadata from participant or room
    metadata = {}
    if participant.metadata:
        try:
            metadata = json.loads(participant.metadata)
        except Exception:
            logger.warning("Failed to parse participant metadata")

    system_prompt = metadata.get("systemPrompt", "You are a helpful, conversational voice assistant. Reply in one short, natural sentence. Match the language of the user.")
    voice_id = metadata.get("voiceId", "Kokoro-en")
    raw_language = metadata.get("language", "auto")
    
    # Map voice ID if needed
    if voice_id == "default" or not voice_id:
        voice_id = "Kokoro-en" if raw_language.startswith("en") else "Aanchal-hi"

    logger.info(f"Agent Config -> Voice: {voice_id}, Language: {raw_language}, System Prompt: {system_prompt[:50]}...")

    # Audio source for LiveKit WebRTC playback (24kHz Mono PCM16)
    source = rtc.AudioSource(DEFAULT_SAMPLE_RATE, 1)
    track = rtc.LocalAudioTrack.create_audio_track("agent-voice", source)
    options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    await ctx.room.local_participant.publish_track(track, options)

    async def publish_livekit_event(event_dict):
        try:
            if ctx.room and ctx.room.local_participant:
                payload = json.dumps(event_dict).encode('utf-8')
                await ctx.room.local_participant.publish_data(payload, reliable=True)
        except Exception as e:
            logger.debug(f"LiveKit publish event error: {e}")

    try:
        logger.info(f"Connecting to S2S Realtime Core at {S2S_CORE_WS}...")
        async with websockets.connect(S2S_CORE_WS, ping_interval=15, ping_timeout=20, max_size=10_000_000) as ws:
            logger.info("Connected to S2S Realtime Core WebSocket successfully!")

            # 1. Send Session Configuration
            session_update = {
                "type": "session.update",
                "session": {
                    "instructions": system_prompt,
                    "voice": voice_id,
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.5,
                        "prefix_padding_ms": 200,
                        "silence_duration_ms": 450
                    }
                }
            }
            await ws.send(json.dumps(session_update))

            # 2. Task to receive events & audio from S2S Core -> LiveKit
            async def receive_from_s2s():
                try:
                    async for raw_msg in ws:
                        msg = json.loads(raw_msg)
                        msg_type = msg.get("type", "")

                        if msg_type == "response.audio.delta":
                            delta_b64 = msg.get("delta")
                            if delta_b64:
                                pcm_bytes = base64.b64decode(delta_b64)
                                if len(pcm_bytes) % 2 != 0:
                                    pcm_bytes += b'\x00'
                                samples = len(pcm_bytes) // 2
                                frame = rtc.AudioFrame(
                                    data=pcm_bytes,
                                    sample_rate=DEFAULT_SAMPLE_RATE,
                                    num_channels=1,
                                    samples_per_channel=samples
                                )
                                await source.capture_frame(frame)

                        elif msg_type == "input_audio_buffer.speech_started":
                            logger.info("⚡ User speech detected (barge-in interrupt)")
                            source.clear()
                            await publish_livekit_event({"type": "vad", "event": "speech_started"})

                        elif msg_type == "input_audio_buffer.speech_stopped":
                            logger.info("🎙️ User speech finished, processing response...")
                            await publish_livekit_event({"type": "vad", "event": "speech_stopped"})

                        elif msg_type == "response.audio_transcript.delta":
                            delta_text = msg.get("delta", "")
                            if delta_text:
                                await publish_livekit_event({
                                    "type": "transcript",
                                    "role": "agent",
                                    "text": delta_text
                                })

                        elif msg_type == "conversation.item.input_audio_transcription.completed":
                            user_text = msg.get("transcript", "")
                            if user_text:
                                logger.info(f"👤 User transcript: '{user_text}'")
                                await publish_livekit_event({
                                    "type": "transcript",
                                    "role": "user",
                                    "text": user_text
                                })

                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error in receive_from_s2s: {e}", exc_info=True)

            rx_task = asyncio.create_task(receive_from_s2s())

            # 3. Stream user microphone audio from LiveKit track -> S2S Core
            async def forward_audio_track(user_track: rtc.Track):
                logger.info(f"Subscribed to user audio track: {user_track.sid}")
                audio_stream = rtc.AudioStream(user_track, sample_rate=DEFAULT_SAMPLE_RATE, num_channels=1)
                try:
                    async for event in audio_stream:
                        frame = event.frame
                        pcm_bytes = frame.data.tobytes()
                        b64_data = base64.b64encode(pcm_bytes).decode("utf-8")
                        await ws.send(json.dumps({
                            "type": "input_audio_buffer.append",
                            "audio": b64_data
                        }))
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error reading audio stream: {e}")

            # Subscribe to remote participant tracks
            @ctx.room.on("track_subscribed")
            def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, remote_p: rtc.RemoteParticipant):
                if track.kind == rtc.TrackKind.KIND_AUDIO:
                    asyncio.create_task(forward_audio_track(track))

            for p in ctx.room.remote_participants.values():
                for pub in p.track_publications.values():
                    if pub.subscribed and pub.track and pub.track.kind == rtc.TrackKind.KIND_AUDIO:
                        asyncio.create_task(forward_audio_track(pub.track))

            await asyncio.Future()  # Keep session alive

    except Exception as e:
        logger.error(f"Bridge agent error: {e}", exc_info=True)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=run_agent))
