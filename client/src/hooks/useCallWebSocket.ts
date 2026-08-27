import { useEffect, useRef, useState, useCallback } from "react";

export type TranscriptEntry = {
  speaker: "ai" | "human";
  text: string;
  timestamp: number;
};

type WSMessage =
  | { type: "connected"; callId: number }
  | { type: "transcript"; speaker: "ai" | "human"; text: string; timestamp: number };

export function useCallWebSocket(callId: number | null) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!callId || wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/ws/call?callId=${callId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        if (msg.type === "transcript") {
          setTranscript((prev) => [
            ...prev,
            { speaker: msg.speaker, text: msg.text, timestamp: msg.timestamp },
          ]);
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      setConnected(false);
    };
  }, [callId]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (callId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [callId, connect, disconnect]);

  const clearTranscript = useCallback(() => setTranscript([]), []);

  return { transcript, connected, connect, disconnect, clearTranscript };
}
