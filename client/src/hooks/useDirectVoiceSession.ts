import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

export interface VoiceSessionOptions {
  targetVoice?: string;
  language?: string;
  systemPrompt?: string;
  onTranscript?: (data: { role: "user" | "agent"; text: string }) => void;
  onTalkingChange?: (talking: boolean) => void;
  onError?: (err: Error) => void;
  onEnded?: () => void;
}

export interface DirectTranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
}

export function useDirectVoiceSession() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAgentTalking, setIsAgentTalking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<DirectTranscriptEntry[]>([]);
  const [callSeconds, setCallSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const isAgentTalkingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setCallSeconds(0);
    timerRef.current = setInterval(() => {
      setCallSeconds((s) => s + 1);
    }, 1000);
  }, [stopTimer]);

  const stop = useCallback(() => {
    stopTimer();
    // 1. Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // 2. Stop audio playback sources
    scheduledSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch (_) {}
    });
    scheduledSourcesRef.current = [];
    nextPlayTimeRef.current = 0;

    // 3. Close microphone & audio processor
    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch (_) {}
      processorNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    setIsActive(false);
    setIsConnecting(false);
    setIsAgentTalking(false);
    setIsUserSpeaking(false);
    isAgentTalkingRef.current = false;
  }, [stopTimer]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const start = useCallback(
    async (options: VoiceSessionOptions = {}) => {
      try {
        stop();
        setIsConnecting(true);
        setTranscripts([]);
        setCallSeconds(0);

        // 1. Access user microphone (16kHz Native Whisper Rate)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        nextPlayTimeRef.current = audioCtx.currentTime;

        let targetVoice = options.targetVoice || "Aanchal-hi";
        if (targetVoice === "default") {
          targetVoice = options.language?.startsWith("hi") ? "Aanchal-hi" : "af_heart";
        }

        // 2. Connect to S2S Realtime WebSocket
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/v1/realtime`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnecting(false);
          setIsActive(true);
          startTimer();

          const isHindi = targetVoice.includes("-hi") || options.language?.startsWith("hi");
          const defaultInstructions = isHindi
            ? "आप एक बेहद मददगार, दोस्ताना और संवादात्मक AI वॉइस असिस्टेंट हैं। हमेशा शुद्ध, स्वाभाविक और संक्षिप्त हिंदी में 1-2 वाक्यों में बात करें। कभी भी टूल कॉल, सर्च फ़ंक्शन या तकनीकी कोड न लिखें।"
            : "You are a helpful, friendly, and conversational AI voice assistant. Always reply directly in natural, concise spoken English (1-2 sentences). Never output tool calls, function calls, search syntax, or code.";

          const finalInstructions = options.systemPrompt
            ? `${options.systemPrompt} (Always reply conversationally in 1-2 sentences. Never output tool calls, function calls, or code.)`
            : defaultInstructions;

          // Send session initialization
          const sessionMsg = {
            type: "session.update",
            session: {
              type: "realtime" as const,
              instructions: finalInstructions,
              voice: targetVoice,
              audio: {
                output: {
                  voice: targetVoice,
                },
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 600,
              },
              input_audio_transcription: {
                model: "whisper-1",
              },
            },
          };
          ws.send(JSON.stringify(sessionMsg));

          // 3. Setup Audio Capture & Streaming (16kHz mono PCM16)
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

          // Route audio through a mute gain node to prevent mic loopback / acoustic echo
          const muteGain = audioCtx.createGain();
          muteGain.gain.value = 0;
          sourceNode.connect(processor);
          processor.connect(muteGain);
          muteGain.connect(audioCtx.destination);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const type = msg.type || "";

            const isAudioDelta = (type === "response.audio.delta" || type === "response.output_audio.delta") && msg.delta;
            const isTranscriptDelta = (type === "response.audio_transcript.delta" || type === "response.output_audio_transcript.delta" || type === "response.text.delta") && msg.delta;

            if (isAudioDelta) {
              if (!isAgentTalkingRef.current) {
                isAgentTalkingRef.current = true;
                setIsAgentTalking(true);
                setIsUserSpeaking(false);
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
                const buffer = audioCtxRef.current.createBuffer(1, float32.length, 16000);
                buffer.getChannelData(0).set(float32);

                const bufferSource = audioCtxRef.current.createBufferSource();
                bufferSource.buffer = buffer;
                bufferSource.connect(audioCtxRef.current.destination);

                scheduledSourcesRef.current.push(bufferSource);
                bufferSource.onended = () => {
                  const idx = scheduledSourcesRef.current.indexOf(bufferSource);
                  if (idx !== -1) scheduledSourcesRef.current.splice(idx, 1);
                };

                const now = audioCtxRef.current.currentTime;
                const startTime = Math.max(now, nextPlayTimeRef.current);
                bufferSource.start(startTime);
                nextPlayTimeRef.current = startTime + buffer.duration;
              }
            } else if (isTranscriptDelta) {
              setTranscripts((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "agent") {
                  return [...prev.slice(0, -1), { ...last, text: last.text + msg.delta }];
                }
                return [...prev, { id: `msg_${Date.now()}`, role: "agent", text: msg.delta }];
              });
              options.onTranscript?.({ role: "agent", text: msg.delta });
            } else if (type === "input_audio_buffer.speech_started") {
              // Instant barge-in: stop all scheduled playback
              setIsUserSpeaking(true);
              scheduledSourcesRef.current.forEach((src) => {
                try { src.stop(); } catch (_) {}
              });
              scheduledSourcesRef.current = [];
              if (audioCtxRef.current) {
                nextPlayTimeRef.current = audioCtxRef.current.currentTime;
              }
              if (isAgentTalkingRef.current) {
                isAgentTalkingRef.current = false;
                setIsAgentTalking(false);
                options.onTalkingChange?.(false);
              }
            } else if (type === "input_audio_buffer.speech_stopped") {
              setIsUserSpeaking(false);
            } else if ((type === "conversation.item.input_audio_transcription.completed" || type === "conversation.item.input_audio_transcription.delta") && (msg.transcript || msg.delta)) {
              const text = msg.transcript || msg.delta;
              setTranscripts((prev) => [...prev, { id: `msg_${Date.now()}`, role: "user", text }]);
              options.onTranscript?.({ role: "user", text });
            } else if (type === "response.done" || type === "response.output_audio.done") {
              setTimeout(() => {
                if (isAgentTalkingRef.current) {
                  isAgentTalkingRef.current = false;
                  setIsAgentTalking(false);
                  options.onTalkingChange?.(false);
                }
              }, 400);
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
    },
    [stop, startTimer]
  );

  return {
    isActive,
    isConnected: isActive,
    isConnecting,
    isAgentTalking,
    isAgentSpeaking: isAgentTalking,
    isUserSpeaking,
    transcripts,
    callSeconds,
    start,
    connect: start,
    stop,
    disconnect: stop,
  };
}

