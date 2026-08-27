import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, ShieldX, Clock, KeyRound, ChevronDown, ChevronUp } from "lucide-react";

export function AccessRequestBanner() {
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: status, refetch } = trpc.access.myStatus.useQuery();
  const requestMutation = trpc.access.request.useMutation({
    onSuccess: (data) => {
      if (data.alreadyApproved) {
        toast.info("You already have approved access.");
      } else if (data.alreadyPending) {
        toast.info("Your request is already pending review.");
      } else {
        toast.success("Access request submitted! The admin will review it shortly.");
      }
      setExpanded(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!status) return null;

  const { apiAccess, request } = status;

  // Approved — show a subtle green badge, no banner needed
  if (apiAccess === "approved") {
    return (
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-400 font-medium">API access granted — using admin key</span>
        </div>
      </div>
    );
  }

  // Revoked
  if (apiAccess === "revoked") {
    return (
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <ShieldX className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-400 font-medium">Access revoked. Contact admin.</span>
        </div>
      </div>
    );
  }

  // Pending
  if (request?.status === "pending") {
    return (
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-400 font-medium">Access request pending review</span>
        </div>
      </div>
    );
  }

  // No request yet — show request button
  return (
    <div className="mx-4 mb-3">
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Request API Access</span>
            </div>
            {expanded ? (
              <ChevronUp className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            )}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Request access to use the admin's Retell API key for making calls.
              </p>
              <Textarea
                placeholder="Optional: explain your use case..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="text-xs resize-none"
                maxLength={500}
              />
              <Button
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => requestMutation.mutate({ message: message || undefined })}
                disabled={requestMutation.isPending}
              >
                {requestMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
