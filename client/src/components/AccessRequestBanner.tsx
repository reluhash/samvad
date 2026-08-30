import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, ShieldX, Clock, KeyRound, ChevronDown, ChevronUp, Ticket, Sparkles, Loader2 } from "lucide-react";

export function AccessRequestBanner() {
  const [message, setMessage] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "request">("code");

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

  const redeemMutation = trpc.access.redeemCode.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Invite code redeemed! Full access granted.");
      setExpanded(false);
      setInviteCode("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!status) return null;

  const { apiAccess, role, request } = status;

  // Admin or Approved
  if (role === "admin" || apiAccess === "approved") {
    return (
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-emerald-400 font-medium">
            {role === "admin" ? "Platform Admin — Full Access" : "Approved User — Phone & Voice AI Active"}
          </span>
        </div>
      </div>
    );
  }

  // Revoked
  if (apiAccess === "revoked") {
    return (
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <ShieldX className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-[11px] text-red-400 font-medium">Access revoked. Contact admin.</span>
        </div>
      </div>
    );
  }

  // Pending
  if (request?.status === "pending") {
    return (
      <div className="mx-4 mb-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-400 font-medium">Access request pending review</span>
        </div>
      </div>
    );
  }

  // Not approved yet: Show redeem invite code / request access drawer
  return (
    <div className="mx-4 mb-3">
      <Card className="border-primary/20 bg-card/60 shadow-sm">
        <CardContent className="p-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Unlock Full Access</span>
            </div>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3">
              <div className="flex border-b border-border/40 pb-1 gap-2 text-[11px]">
                <button
                  onClick={() => setActiveTab("code")}
                  className={cn(
                    "font-medium pb-1 border-b-2 transition-all",
                    activeTab === "code" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  )}
                >
                  Enter Invite Code
                </button>
                <button
                  onClick={() => setActiveTab("request")}
                  className={cn(
                    "font-medium pb-1 border-b-2 transition-all",
                    activeTab === "request" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  )}
                >
                  Request Access
                </button>
              </div>

              {activeTab === "code" ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Have an access code or PIN from your team? Enter it below for instant activation.
                  </p>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="e.g. SAMVAD-VIP-2026"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="text-xs font-mono uppercase h-8 flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => redeemMutation.mutate({ code: inviteCode.trim() })}
                      disabled={redeemMutation.isPending || !inviteCode}
                      className="h-8 text-xs shrink-0 gap-1"
                    >
                      {redeemMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3 h-3" />}
                      Redeem
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Submit a message to request permission to place phone calls and clone voices.
                  </p>
                  <Textarea
                    placeholder="Describe your use case..."
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

