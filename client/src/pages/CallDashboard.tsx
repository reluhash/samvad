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
  Trash2,
  Mic,
  Clock,
  Loader2,
  Sparkles,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  PhoneCall,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Call = {
  id: number;
  toNumber: string | null;
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
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const { transcript = [], connected } = useCallWebSocket(call.id);

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

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const safeTranscript = Array.isArray(transcript) ? transcript : [];

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping absolute inset-0" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <span>{call.toNumber || "Web Browser Call"}</span>
                <Badge variant="outline" className="text-xs capitalize font-normal">
                  {call.callType}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Voice: {call.voiceName || "Default"} • Started {new Date(call.startedAt ?? call.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-emerald-400">
              {formatElapsed(elapsed)}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={onEnd}
              className="gap-1.5 text-xs h-8"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              End Call
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-background/60 rounded-lg p-3 max-h-48 overflow-auto space-y-2 text-xs">
          {safeTranscript.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Connecting to audio stream...</p>
          ) : (
            safeTranscript.map((t: any, i: number) => (
              <div key={i} className={cn("flex gap-2", t.role === "ai" ? "text-emerald-400" : "text-foreground")}>
                <span className="font-bold shrink-0">{t.role === "ai" ? "AI:" : "User:"}</span>
                <span>{t.text}</span>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CallDashboard() {
  const { user } = useAuth();
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: callsList = [], isLoading, refetch } = trpc.calls.list.useQuery({ limit: 50 });
  const { data: callDetail, isLoading: loadingDetail } = trpc.calls.getDetail.useQuery(
    { callId: selectedCallId! },
    { enabled: !!selectedCallId }
  );

  const deleteCallMutation = trpc.calls.delete.useMutation({
    onSuccess: () => {
      toast.success("Call record deleted");
      refetch();
      setDetailOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const clearHistoryMutation = trpc.calls.clearHistory.useMutation({
    onSuccess: () => {
      toast.success("Call history cleared");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const endCallMutation = trpc.calls.stop.useMutation({
    onSuccess: () => {
      toast.success("Call ended");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const activeCalls = callsList.filter((c: any) => c.status === "in-progress" || c.status === "ringing" || c.status === "initiated");
  const completedCalls = callsList.filter((c: any) => c.status !== "in-progress" && c.status !== "ringing" && c.status !== "initiated");

  const formatDuration = (s: number | null) => {
    if (!s) return "--";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const formatDate = (d: any) => {
    return new Date(d).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-full flex flex-col overflow-auto bg-background p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Call Dashboard & Logs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time telemetry, session transcripts, and historical call archives
          </p>
        </div>
        <div className="flex items-center gap-2">
          {completedCalls.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearHistoryMutation.mutate()}
              disabled={clearHistoryMutation.isPending}
              className="text-xs text-destructive hover:bg-destructive/10 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </Button>
          )}
        </div>
      </div>

      {/* Active Calls Section */}
      {activeCalls.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Active Calls ({activeCalls.length})
          </h2>
          {activeCalls.map((call: any) => (
            <ActiveCallPanel
              key={call.id}
              call={call}
              onEnd={() => endCallMutation.mutate({ callId: call.id })}
            />
          ))}
        </div>
      )}

      {/* Call History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Historical Calls</h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading calls...
          </div>
        ) : completedCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Phone className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No calls recorded yet</p>
            <p className="text-xs mt-1">Start a web or phone call from Call Studio to see call history.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {completedCalls.map((call: any) => (
              <div
                key={call.id}
                onClick={() => {
                  setSelectedCallId(call.id);
                  setDetailOpen(true);
                }}
                className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/40 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <PhoneCall className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {call.toNumber || "Web Session"}
                      </span>
                      <CallStatusBadge status={call.status} />
                      <Badge variant="outline" className="text-xs capitalize font-normal">
                        {call.callType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Voice: {call.voiceName || "Default"} • {formatDate(call.createdAt)}
                      {call.durationSeconds ? ` • ${formatDuration(call.durationSeconds)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCallMutation.mutate({ id: call.id });
                    }}
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call Details Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-primary" />
              Call Details & Telemetry
            </DialogTitle>
          </DialogHeader>

          {loadingDetail || !callDetail ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4 overflow-auto py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block">Destination</span>
                  <span className="font-semibold text-foreground">{callDetail.call.toNumber || "Web Session"}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block">Status</span>
                  <span className="font-semibold capitalize text-foreground">{callDetail.call.status}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block">Voice</span>
                  <span className="font-semibold text-foreground">{callDetail.call.voiceName || "Default"}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-muted-foreground block">Duration</span>
                  <span className="font-semibold text-foreground">{formatDuration(callDetail.call.durationSeconds)}</span>
                </div>
              </div>

              {/* Transcripts */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Full Conversation Transcript ({callDetail.transcripts.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-auto rounded-lg border border-border/40 p-3 bg-muted/20 text-xs">
                  {callDetail.transcripts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No transcripts recorded for this session.</p>
                  ) : (
                    callDetail.transcripts.map((t: any) => (
                      <div key={t.id} className={cn("flex gap-2", t.speaker === "ai" ? "text-emerald-400" : "text-purple-300")}>
                        <span className="font-bold shrink-0">{t.speaker === "ai" ? "AI:" : "User:"}</span>
                        <span>{t.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

