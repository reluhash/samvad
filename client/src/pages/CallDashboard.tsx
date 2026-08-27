import { useState, useEffect, useRef, useMemo } from "react";
import { useCallWebSocket } from "@/hooks/useCallWebSocket";
import { useAuth } from "@/_core/hooks/useAuth";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  LayoutDashboard,
  Loader2,
  Sparkles,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  XCircle,
  PhoneCall,
  Calendar,
  User,
  Volume2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Call = {
  id: number;
  toNumber: string;
  callType: string;
  status: string;
  voiceName: string | null;
  tone: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  summary: string | null;
  insights: string | null;
  createdAt: Date;
};

type TranscriptEntry = {
  id: number;
  speaker: "ai" | "human";
  text: string;
  timestamp: number;
};

function CallStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; class: string }> = {
    initiated: { label: "Initiated", class: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
    ringing: { label: "Ringing", class: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
    "in-progress": { label: "Live", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
    completed: { label: "Completed", class: "bg-muted text-muted-foreground border-border" },
    failed: { label: "Failed", class: "bg-destructive/15 text-destructive border-destructive/20" },
    cancelled: { label: "Cancelled", class: "bg-muted text-muted-foreground border-border" },
  };
  const c = config[status] || config.completed;
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", c.class)}>
      {c.label}
    </span>
  );
}

function ActiveCallPanel({ call, onEnd }: { call: Call; onEnd: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const { transcript, connected } = useCallWebSocket(call.id);

  useEffect(() => {
    const start = call.startedAt ? new Date(call.startedAt).getTime() : Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [call.startedAt]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 pulse-ring">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{call.toNumber}</p>
            <p className="text-xs text-muted-foreground">
              {call.voiceName || "AI Voice"} · {call.tone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-sm font-mono font-medium">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(elapsed)}
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div className="flex items-center justify-center gap-1 h-10 py-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="wave-bar w-1 rounded-full bg-emerald-400/60"
            style={{ height: `${10 + Math.sin(i * 0.7) * 8}px` }}
          />
        ))}
      </div>

      {/* Transcript */}
      <div className="max-h-40 overflow-auto space-y-2 rounded-lg bg-background/50 p-3">
        {transcript.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Live transcript will appear here during the call...
          </p>
        ) : (
          transcript.map((entry) => (
            <div
              key={entry.timestamp + entry.speaker}
              className={cn(
                "transcript-entry flex gap-2 text-xs",
                entry.speaker === "ai" ? "flex-row" : "flex-row-reverse"
              )}
            >
              <span className={cn(
                "shrink-0 px-1.5 py-0.5 rounded font-medium",
                entry.speaker === "ai"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              )}>
                {entry.speaker === "ai" ? "AI" : "You"}
              </span>
              <p className="text-muted-foreground">{entry.text}</p>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMuted(!muted)}
          className={cn("gap-2 flex-1", muted && "text-destructive border-destructive/50")}
        >
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {muted ? "Unmute" : "Mute"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onEnd}
          className="gap-2 flex-1"
        >
          <PhoneOff className="w-4 h-4" />
          End Call
        </Button>
      </div>
    </div>
  );
}

function CallDetailDialog({
  callId,
  open,
  onClose,
}: {
  callId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.calls.getDetail.useQuery(
    { callId: callId! },
    { enabled: !!callId && open }
  );

  const syncMutation = trpc.calls.sync.useMutation({
    onSuccess: () => toast.success("Call data synced!"),
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const utils = trpc.useUtils();

  const handleGenerateSummary = async () => {
    if (!callId) return;
    await syncMutation.mutateAsync({ callId });
    utils.calls.getDetail.invalidate({ callId });
  };

  const exportTranscript = () => {
    if (!data) return;
    const text = data.transcripts
      .map((t) => `[${(t.timestamp / 1000).toFixed(1)}s] ${t.speaker === "ai" ? "AI" : "Human"}: ${t.text}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-${callId}-transcript.txt`;
    a.click();
  };

  let insights: { summary?: string; insights?: string[]; sentiment?: string; actionItems?: string[] } | null = null;
  if (data?.call?.insights) {
    try { insights = JSON.parse(data.call.insights); } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            Call Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Call info */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "To", value: data.call.toNumber },
                { label: "Status", value: <CallStatusBadge status={data.call.status} /> },
                { label: "Voice", value: data.call.voiceName || "—" },
                { label: "Tone", value: data.call.tone || "—" },
                { label: "Duration", value: data.call.durationSeconds ? `${data.call.durationSeconds}s` : "—" },
                { label: "Type", value: data.call.callType },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-sm font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {/* Transcript */}
            {data.transcripts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Transcript</h3>
                  <Button size="sm" variant="ghost" onClick={exportTranscript} className="gap-1.5 text-xs h-7">
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </Button>
                </div>
                <div className="max-h-48 overflow-auto space-y-2 rounded-lg border border-border p-3">
                  {data.transcripts.map((t) => (
                    <div key={t.id} className={cn("flex gap-2 text-xs", t.speaker === "ai" ? "flex-row" : "flex-row-reverse")}>
                      <span className={cn(
                        "shrink-0 px-1.5 py-0.5 rounded font-medium",
                        t.speaker === "ai" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {t.speaker === "ai" ? "AI" : "Human"}
                      </span>
                      <p className="text-muted-foreground">{t.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary & Insights */}
            {insights ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Analysis
                </h3>
                {insights.summary && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                    <p className="text-xs text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm text-foreground">{insights.summary}</p>
                  </div>
                )}
                {insights.sentiment && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Sentiment:</span>
                    <Badge variant="secondary" className="text-xs capitalize">{insights.sentiment}</Badge>
                  </div>
                )}
                {insights.insights && insights.insights.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Key Insights</p>
                    {insights.insights.map((insight, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{insight}</span>
                      </div>
                    ))}
                  </div>
                )}
                {insights.actionItems && insights.actionItems.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Action Items</p>
                    {insights.actionItems.map((item, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              data.call.status === "completed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={syncMutation.isPending}
                  className="gap-2 w-full"
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Sync & Analyze Call
                </Button>
              )
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function CallDashboard() {
  const { isAuthenticated } = useAuth();
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: calls = [], isLoading, refetch } = trpc.calls.list.useQuery({ limit: 50 }, {
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  const endCallMutation = trpc.calls.stop.useMutation({
    onSuccess: () => { toast.success("Call ended"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const activeCalls = (calls as Call[]).filter((c) =>
    ["initiated", "ringing", "in-progress"].includes(c.status)
  );
  const completedCalls = (calls as Call[]).filter((c) =>
    !["initiated", "ringing", "in-progress"].includes(c.status)
  );

  const formatDate = (d: Date | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString();
  };

  const formatDuration = (s: number | null) => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <LayoutDashboard className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Sign in to view Call Dashboard</h2>
        <Button onClick={() => (window.location.reload())}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Call Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor active calls and review call history
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="hidden sm:flex gap-4">
              {[
                { label: "Total Calls", value: calls.length },
                { label: "Active", value: activeCalls.length },
                { label: "Completed", value: completedCalls.length },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Active Calls */}
        {activeCalls.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Calls ({activeCalls.length})
            </h2>
            {activeCalls.map((call) => (
              <ActiveCallPanel
                key={call.id}
                call={call}
                onEnd={() => endCallMutation.mutate({ callId: call.id, retellCallId: (call as Call & { retellCallId?: string }).retellCallId ?? "" })}
              />
            ))}
          </div>
        )}

        {/* Call History */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Call History</h2>

          {isLoading ? (
            <div className="flex items-center justify-center h-32 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading calls...
            </div>
          ) : completedCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Phone className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No calls yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Head to Call Studio to initiate your first AI call.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {completedCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-all cursor-pointer group"
                  onClick={() => { setSelectedCallId(call.id); setDetailOpen(true); }}
                >
                  {/* Status icon */}
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                    call.status === "completed" ? "bg-emerald-500/10" : "bg-destructive/10"
                  )}>
                    {call.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{call.toNumber}</p>
                      <CallStatusBadge status={call.status} />
                      {call.insights && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          Analyzed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Volume2 className="w-3 h-3" />
                        {call.voiceName || "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(call.durationSeconds)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(call.createdAt)}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CallDetailDialog
        callId={selectedCallId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
