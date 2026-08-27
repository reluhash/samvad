import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

interface SessionOptions {
  voiceId?: string;
  language?: string;
  systemPrompt?: string;
  onTalkingChange?: (talking: boolean) => void;
  onTranscript?: (entry: { role: "user" | "agent"; text: string }) => void;
  onError?: (err: Error) => void;
  onEnded?: () => void;
}

export function useDirectVoiceSession() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAgentTalking, setIsAgentTalking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const isAgentTalkingRef = useRef<boolean>(false);

  const stop = useCallback(() => {
    // 1. Close microphone & audio processor
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    // 2. Close WebSocket
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setIsActive(false);
    setIsConnecting(false);
    setIsAgentTalking(false);
    isAgentTalkingRef.current = false;
    nextPlayTimeRef.current = 0;
  }, []);

  const start = useCallback(async (options: SessionOptions = {}) => {
    stop();
    setIsConnecting(true);

    try {
      // 1. Access user microphone (24kHz Mono)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: 24000,
      });
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      // 2. Connect to direct S2S Realtime WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/v1/realtime`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsActive(true);

        // Send session initialization
        const sessionMsg = {
          type: "session.update",
          session: {
            instructions: options.systemPrompt || "You are a helpful, natural conversational voice assistant.",
            voice: options.voiceId || "Kokoro-en",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 200,
              silence_duration_ms: 450,
            },
          },
        };
        ws.send(JSON.stringify(sessionMsg));

        // 3. Setup Audio Capture & Streaming
        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorNodeRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Convert to Base64 and send
          const bytes = new Uint8Array(pcm16.buffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Audio = btoa(binary);

          ws.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: base64Audio,
            })
          );
        };

        sourceNode.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const type = msg.type || "";

          if (type === "response.audio.delta" && msg.delta) {
            // Play audio chunk
            if (!isAgentTalkingRef.current) {
              isAgentTalkingRef.current = true;
              setIsAgentTalking(true);
              options.onTalkingChange?.(true);
            }

            const binary = atob(msg.delta);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] / 32768.0;
            }

            if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
              const buffer = audioCtxRef.current.createBuffer(1, float32.length, 24000);
              buffer.getChannelData(0).set(float32);

              const bufferSource = audioCtxRef.current.createBufferSource();
              bufferSource.buffer = buffer;
              bufferSource.connect(audioCtxRef.current.destination);

              const now = audioCtxRef.current.currentTime;
              const startTime = Math.max(now, nextPlayTimeRef.current);
              bufferSource.start(startTime);
              nextPlayTimeRef.current = startTime + buffer.duration;
            }
          } else if (type === "input_audio_buffer.speech_started") {
            // Barge-in: user started speaking -> cut off agent audio immediately
            if (audioCtxRef.current) {
              nextPlayTimeRef.current = audioCtxRef.current.currentTime;
            }
            if (isAgentTalkingRef.current) {
              isAgentTalkingRef.current = false;
              setIsAgentTalking(false);
              options.onTalkingChange?.(false);
            }
          } else if (type === "response.audio_transcript.delta" && msg.delta) {
            options.onTranscript?.({ role: "agent", text: msg.delta });
          } else if (type === "conversation.item.input_audio_transcription.completed" && msg.transcript) {
            options.onTranscript?.({ role: "user", text: msg.transcript });
          } else if (type === "response.done") {
            setTimeout(() => {
              if (isAgentTalkingRef.current) {
                isAgentTalkingRef.current = false;
                setIsAgentTalking(false);
                options.onTalkingChange?.(false);
              }
            }, 500);
          }
        } catch (e) {
          console.error("Error processing realtime message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        toast.error("Realtime voice connection error");
        stop();
        options.onError?.(new Error("WebSocket error"));
      };

      ws.onclose = () => {
        stop();
        options.onEnded?.();
      };
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error("Failed to start voice session:", e);
      toast.error(e.message || "Failed to start microphone or voice session");
      stop();
      options.onError?.(e);
    }
  }, [stop]);

  return {
    isActive,
    isConnecting,
    isAgentTalking,
    start,
    stop,
  };
}
