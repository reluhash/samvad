import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type PhoneCallStatus =
  | "IDLE"
  | "INITIATING"
  | "RINGING"
  | "CONNECTED"
  | "USER_SPEAKING"
  | "AGENT_SPEAKING"
  | "TERMINATED"
  | "FAILED";

export interface PhoneTranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export interface UsePhoneCallSessionReturn {
  status: PhoneCallStatus;
  callId: string | null;
  transcripts: PhoneTranscriptEntry[];
  callSeconds: number;
  rttMs: number;
  isSpeaking: boolean;
  currentSpeaker: "user" | "agent" | null;
  interrupted: boolean;
  listenIn: boolean;
  setListenIn: (val: boolean) => void;
  startCall: (params: { toNumber: string; voiceId: string; systemPrompt: string }) => Promise<boolean>;
  endCall: () => Promise<void>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function usePhoneCallSession(): UsePhoneCallSessionReturn {
  const [status, setStatus] = useState<PhoneCallStatus>("IDLE");
  const [callId, setCallId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<PhoneTranscriptEntry[]>([]);
  const [callSeconds, setCallSeconds] = useState(0);
  const [rttMs, setRttMs] = useState(120);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<"user" | "agent" | null>(null);
  const [interrupted, setInterrupted] = useState(false);
  const [listenIn, setListenIn] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wavePhaseRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingAudioRef = useRef(false);

  // Stop duration timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start duration timer
  const startTimer = useCallback(() => {
    stopTimer();
    setCallSeconds(0);
    timerRef.current = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
  }, [stopTimer]);

  // Audio queue playback for in-browser listen-in
  const playNextAudio = useCallback(() => {
    if (!listenIn || audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingAudioRef.current = false;
      return;
    }
    isPlayingAudioRef.current = true;
    const buffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      playNextAudio();
    };
    source.start();
  }, [listenIn]);

  const queuePcmAudio = useCallback((base64Delta: string) => {
    if (!listenIn) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const raw = window.atob(base64Delta);
      const len = raw.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = raw.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }
      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);
      audioQueueRef.current.push(audioBuffer);
      if (!isPlayingAudioRef.current) {
        playNextAudio();
      }
    } catch (e) {
      console.error("[Audio Listen-In Error]:", e);
    }
  }, [listenIn, playNextAudio]);

  // Waveform canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const bars = 36;
      const barWidth = width / bars - 2;
      wavePhaseRef.current += 0.08;

      for (let i = 0; i < bars; i++) {
        let barHeight = 4;
        if (isSpeaking) {
          const freq = (i / bars) * Math.PI * 4;
          const amp = Math.sin(freq + wavePhaseRef.current) * 0.5 + 0.5;
          barHeight = Math.max(6, amp * (height * 0.75));
        }

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        ctx.fillStyle =
          currentSpeaker === "user"
            ? "rgba(168, 85, 247, 0.85)" // Purple for caller
            : currentSpeaker === "agent"
            ? "rgba(16, 185, 129, 0.85)" // Emerald for agent
            : "rgba(255, 255, 255, 0.15)";

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpeaking, currentSpeaker]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopTimer]);

  // WebSocket event handler
  const connectEventsSocket = useCallback((activeCallId: string) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/calls/${activeCallId}/events`;

    console.log(`[Telephony] Connecting to event stream at ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const type = msg.type;

        if (type === "call.status") {
          const s = (msg.status || "").toUpperCase() as PhoneCallStatus;
          setStatus(s);
          if (msg.rttMs) setRttMs(msg.rttMs);

          if (s === "CONNECTED") {
            startTimer();
            setIsSpeaking(false);
            setCurrentSpeaker(null);
          } else if (s === "USER_SPEAKING") {
            setIsSpeaking(true);
            setCurrentSpeaker("user");
          } else if (s === "AGENT_SPEAKING") {
            setIsSpeaking(true);
            setCurrentSpeaker("agent");
          } else if (s === "TERMINATED" || s === "FAILED") {
            stopTimer();
            setIsSpeaking(false);
            setCurrentSpeaker(null);
          }
        } else if (type === "call.snapshot") {
          if (msg.status) setStatus(msg.status.toUpperCase() as PhoneCallStatus);
          if (msg.transcripts && Array.isArray(msg.transcripts)) {
            setTranscripts(
              msg.transcripts.map((t: any) => ({
                id: t.id || `msg_${Math.random()}`,
                role: t.role,
                text: t.text,
                timestamp: t.timestamp || Date.now(),
              }))
            );
          }
        } else if (type === "transcript.user" && msg.entry) {
          setTranscripts((prev) => [
            ...prev,
            {
              id: msg.entry.id || `msg_${Date.now()}`,
              role: "user",
              text: msg.entry.text,
              timestamp: msg.entry.timestamp || Date.now(),
            },
          ]);
        } else if (type === "transcript.agent" && msg.entry) {
          setTranscripts((prev) => [
            ...prev,
            {
              id: msg.entry.id || `msg_${Date.now()}`,
              role: "agent",
              text: msg.entry.text,
              timestamp: msg.entry.timestamp || Date.now(),
            },
          ]);
        } else if (type === "call.interruption") {
          setInterrupted(true);
          setTimeout(() => setInterrupted(false), 800);
          audioQueueRef.current = [];
        } else if (type === "audio.delta" && msg.delta) {
          queuePcmAudio(msg.delta);
        }
      } catch (e) {
        console.error("[Telephony WS Parse Error]:", e);
      }
    };

    ws.onclose = () => {
      console.log(`[Telephony] Event stream closed for ${activeCallId}`);
    };

    ws.onerror = (err) => {
      console.error("[Telephony WS Error]:", err);
    };
  }, [startTimer, stopTimer, queuePcmAudio]);

  // Start outbound phone call
  const startCall = useCallback(
    async ({ toNumber, voiceId, systemPrompt }: { toNumber: string; voiceId: string; systemPrompt: string }) => {
      try {
        setStatus("INITIATING");
        setTranscripts([]);
        setCallSeconds(0);
        setIsSpeaking(false);
        setCurrentSpeaker(null);

        const res = await fetch("/api/v1/calls/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toNumber,
            voice_id: voiceId,
            system_prompt: systemPrompt,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status} dispatch error`);
        }

        const data = await res.json();
        if (!data.callId) {
          throw new Error("No callId returned from server");
        }

        setCallId(data.callId);
        setStatus("RINGING");
        toast.success(`Outbound call dispatched to ${toNumber}`);
        connectEventsSocket(data.callId);
        return true;
      } catch (err: any) {
        console.error("[Dispatch Error]:", err);
        setStatus("FAILED");
        toast.error(err.message || "Failed to initiate outbound call");
        return false;
      }
    },
    [connectEventsSocket]
  );

  // Terminate active call
  const endCall = useCallback(async () => {
    if (!callId) {
      setStatus("IDLE");
      return;
    }
    try {
      await fetch(`/api/v1/calls/${callId}/terminate`, { method: "POST" });
      setStatus("TERMINATED");
      stopTimer();
      setIsSpeaking(false);
      setCurrentSpeaker(null);
      toast.info("Call ended");
    } catch (e) {
      console.error("[Terminate Error]:", e);
    }
  }, [callId, stopTimer]);

  return {
    status,
    callId,
    transcripts,
    callSeconds,
    rttMs,
    isSpeaking,
    currentSpeaker,
    interrupted,
    listenIn,
    setListenIn,
    startCall,
    endCall,
    canvasRef,
  };
}

