import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldX,
  Clock,
  Users,
  KeyRound,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type AccessRequest = {
  id: number;
  userId: number;
  status: "pending" | "approved" | "revoked";
  message: string | null;
  adminNote: string | null;
  requestedAt: Date | string;
  reviewedAt: Date | string | null;
  userName: string | null;
  userEmail: string | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">Approved</Badge>;
  if (status === "revoked") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">Revoked</Badge>;
  return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">Pending</Badge>;
}

function RequestCard({ req, onRefetch }: { req: AccessRequest; onRefetch: () => void }) {
  const [adminNote, setAdminNote] = useState(req.adminNote ?? "");
  const [showNote, setShowNote] = useState(false);

  const approveMutation = trpc.access.approve.useMutation({
    onSuccess: () => { toast.success("Access approved."); onRefetch(); },
    onError: (e) => toast.error(e.message),
  });
  const revokeMutation = trpc.access.revoke.useMutation({
    onSuccess: () => { toast.success("Access revoked."); onRefetch(); },
    onError: (e) => toast.error(e.message),
  });

  const initials = req.userName
    ? req.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (req.userEmail?.[0]?.toUpperCase() ?? "U");

  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarFallback className="text-xs bg-primary/20 text-primary">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground">{req.userName ?? "Unknown User"}</span>
              <StatusBadge status={req.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{req.userEmail ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Requested {formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true })}
              {req.reviewedAt && ` · Reviewed ${formatDistanceToNow(new Date(req.reviewedAt), { addSuffix: true })}`}
            </p>

            {req.message && (
              <div className="mt-2 px-3 py-2 rounded-md bg-muted/30 border border-border/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">User message</span>
                </div>
                <p className="text-xs text-foreground/80">{req.message}</p>
              </div>
            )}

            {req.adminNote && !showNote && (
              <p className="text-xs text-muted-foreground mt-1 italic">Note: {req.adminNote}</p>
            )}

            {/* Admin note input */}
            {showNote && (
              <div className="mt-2">
                <Textarea
                  placeholder="Add a note to the user (optional)..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {req.status !== "approved" && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => approveMutation.mutate({ requestId: req.id, adminNote: adminNote || undefined })}
                  disabled={approveMutation.isPending}
                >
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Approve
                </Button>
              )}
              {req.status !== "revoked" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => revokeMutation.mutate({ requestId: req.id, adminNote: adminNote || undefined })}
                  disabled={revokeMutation.isPending}
                >
                  <ShieldX className="w-3 h-3 mr-1" />
                  Revoke
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setShowNote(!showNote)}
              >
                {showNote ? "Hide Note" : "Add Note"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AccessManagement() {
  const { data: requests, isLoading, refetch } = trpc.access.listRequests.useQuery();

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const approved = requests?.filter((r) => r.status === "approved") ?? [];
  const revoked = requests?.filter((r) => r.status === "revoked") ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" />
            API Access Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Approve or revoke guest access to your Retell API key
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{pending.length}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Pending
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{approved.length}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Approved
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{revoked.length}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <ShieldX className="w-3 h-3" /> Revoked
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading requests...</div>
      )}

      {!isLoading && (!requests || requests.length === 0) && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="py-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No access requests yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              When users request access to your API key, they will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending section */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending Requests ({pending.length})
          </h2>
          {pending.map((req) => (
            <RequestCard key={req.id} req={req as AccessRequest} onRefetch={refetch} />
          ))}
        </div>
      )}

      {/* Approved section */}
      {approved.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Approved Users ({approved.length})
          </h2>
          {approved.map((req) => (
            <RequestCard key={req.id} req={req as AccessRequest} onRefetch={refetch} />
          ))}
        </div>
      )}

      {/* Revoked section */}
      {revoked.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <ShieldX className="w-4 h-4" /> Revoked Access ({revoked.length})
          </h2>
          {revoked.map((req) => (
            <RequestCard key={req.id} req={req as AccessRequest} onRefetch={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
