import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  KeyRound,
  ShieldCheck,
  ShieldX,
  Clock,
  RefreshCw,
  UserPlus,
  Users,
  Copy,
  Trash2,
  Check,
  Plus,
  Mail,
  UserCheck,
  Ticket,
  Loader2,
  MoreVertical,
  ShieldAlert,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function AccessManagement() {
  const [activeTab, setActiveTab] = useState("users");

  // Dialog states
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");

  const [addCodeOpen, setAddCodeOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newMaxUses, setNewMaxUses] = useState(10);
  const [newCodeRole, setNewCodeRole] = useState<"user" | "admin">("user");
  const [newCodeNote, setNewCodeNote] = useState("");

  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);

  // Queries
  const { data: usersList = [], isLoading: loadingUsers, refetch: refetchUsers } = trpc.access.listUsers.useQuery();
  const { data: requests = [], isLoading: loadingRequests, refetch: refetchRequests } = trpc.access.listRequests.useQuery();
  const { data: inviteCodes = [], isLoading: loadingCodes, refetch: refetchCodes } = trpc.access.listInviteCodes.useQuery();

  // Mutations
  const directGrantMutation = trpc.access.directGrant.useMutation({
    onSuccess: () => {
      toast.success(`User ${newEmail} granted approved access!`);
      setAddUserOpen(false);
      setNewEmail("");
      setNewName("");
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateUserMutation = trpc.access.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("User access updated");
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteUserMutation = trpc.access.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User deleted");
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  const createCodeMutation = trpc.access.createInviteCode.useMutation({
    onSuccess: (data) => {
      toast.success(`Invite code "${data.code.code}" created!`);
      setAddCodeOpen(false);
      setNewCode("");
      setNewCodeNote("");
      refetchCodes();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCodeMutation = trpc.access.deleteInviteCode.useMutation({
    onSuccess: () => {
      toast.success("Invite code deleted");
      refetchCodes();
    },
    onError: (e) => toast.error(e.message),
  });

  const approveRequestMutation = trpc.access.approve.useMutation({
    onSuccess: () => {
      toast.success("Request approved");
      refetchRequests();
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeRequestMutation = trpc.access.revoke.useMutation({
    onSuccess: () => {
      toast.success("Request revoked");
      refetchRequests();
      refetchUsers();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCopyCode = (id: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    toast.success(`Copied code "${code}" to clipboard`);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleAddUser = () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    directGrantMutation.mutate({
      email: newEmail.trim(),
      name: newName.trim() || undefined,
      role: newRole,
    });
  };

  const handleCreateCode = () => {
    if (!newCode || newCode.length < 3) {
      toast.error("Code must be at least 3 characters");
      return;
    }
    createCodeMutation.mutate({
      code: newCode.trim(),
      maxUses: newMaxUses,
      role: newCodeRole,
      note: newCodeNote.trim() || undefined,
    });
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <div className="h-full flex flex-col overflow-auto bg-background p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            User Access & Permissions Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grant direct access to specific emails, issue invite codes, and manage user roles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setAddUserOpen(true)}
            className="text-xs gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add User by Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddCodeOpen(true)}
            className="text-xs gap-1.5"
          >
            <Ticket className="w-3.5 h-3.5" />
            Create Invite Code
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="text-xs gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Active Users ({usersList.length})
          </TabsTrigger>
          <TabsTrigger value="codes" className="text-xs gap-1.5">
            <Ticket className="w-3.5 h-3.5" />
            Invite Codes ({inviteCodes.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Access Requests ({pendingRequests.length})
            {pendingRequests.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-1" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: USERS DIRECTORY ─────────────────────────────────────────── */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border-border/60 bg-card/40 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Platform Access</th>
                    <th className="p-3">Joined</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading user directory...
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No registered users found. Click "+ Add User by Email" to whitelist your first user!
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u: any) => (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {(u.name || u.email || "U")[0].toUpperCase()}
                          </div>
                          <span>{u.name || "User"}</span>
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">{u.email || "—"}</td>
                        <td className="p-3">
                          <Badge
                            variant={u.role === "admin" ? "default" : "secondary"}
                            className="text-[10px] capitalize"
                          >
                            {u.role}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={cn(
                              "text-[10px] capitalize",
                              u.apiAccess === "approved"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : u.apiAccess === "revoked"
                                ? "bg-red-500/15 text-red-400 border-red-500/30"
                                : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                            )}
                          >
                            {u.apiAccess || "none"}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-3 text-right space-x-1.5">
                          {u.apiAccess !== "approved" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateUserMutation.mutate({ userId: u.id, role: u.role, apiAccess: "approved" })}
                              className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              Approve
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateUserMutation.mutate({ userId: u.id, role: u.role, apiAccess: "revoked" })}
                              className="h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                            >
                              Revoke
                            </Button>
                          )}
                          {u.role !== "admin" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateUserMutation.mutate({ userId: u.id, role: "admin", apiAccess: "approved" })}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Make Admin
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteUserMutation.mutate({ userId: u.id })}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: INVITE CODES ────────────────────────────────────────────── */}
        <TabsContent value="codes" className="space-y-4">
          <Card className="border-border/60 bg-card/40 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                    <th className="p-3">Invite Code / PIN</th>
                    <th className="p-3">Role Granted</th>
                    <th className="p-3">Usage</th>
                    <th className="p-3">Note / Purpose</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loadingCodes ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading invite codes...
                      </td>
                    </tr>
                  ) : inviteCodes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No active invite codes. Click "+ Create Invite Code" to generate one.
                      </td>
                    </tr>
                  ) : (
                    inviteCodes.map((c: any) => (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-mono font-bold text-foreground flex items-center gap-2">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                            {c.code}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopyCode(c.id, c.code)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            {copiedCodeId === c.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {c.role}
                          </Badge>
                        </td>
                        <td className="p-3 text-foreground font-mono">
                          {c.usesCount} / {c.maxUses}
                        </td>
                        <td className="p-3 text-muted-foreground">{c.note || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteCodeMutation.mutate({ id: c.id })}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: ACCESS REQUESTS QUEUE ──────────────────────────────────── */}
        <TabsContent value="requests" className="space-y-4">
          {loadingRequests ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <Card className="border-border/60 bg-card/40 p-12 text-center text-xs text-muted-foreground">
              <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No incoming access requests pending review.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((r: any) => (
                <Card key={r.id} className="border-border/60 bg-card/40 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{r.userName || "Guest User"}</span>
                        <Badge
                          className={cn(
                            "text-[10px] capitalize",
                            r.status === "approved"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : r.status === "revoked"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-amber-500/15 text-amber-400"
                          )}
                        >
                          {r.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.userEmail || "—"}</p>
                      {r.message && (
                        <p className="text-xs text-foreground/80 mt-2 bg-muted/40 p-2 rounded border border-border/40">
                          "{r.message}"
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Requested {formatDistanceToNow(new Date(r.requestedAt), { addSuffix: true })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.status !== "approved" && (
                        <Button
                          size="sm"
                          onClick={() => approveRequestMutation.mutate({ requestId: r.id })}
                          disabled={approveRequestMutation.isPending}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Approve
                        </Button>
                      )}
                      {r.status !== "revoked" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeRequestMutation.mutate({ requestId: r.id })}
                          disabled={revokeRequestMutation.isPending}
                          className="h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 gap-1"
                        >
                          <ShieldX className="w-3.5 h-3.5" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── DIALOG: ADD USER BY EMAIL ──────────────────────────────────────── */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Direct User Whitelisting
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pre-approve a user by email to immediately grant them platform access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Email Address *</Label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Display Name (Optional)</Label>
              <Input
                type="text"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Platform Role</Label>
              <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Approved User (Web + Phone Calling)</SelectItem>
                  <SelectItem value="admin">Platform Admin (Full Permissions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleAddUser}
              disabled={directGrantMutation.isPending || !newEmail}
              className="text-xs gap-1.5"
            >
              {directGrantMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: CREATE INVITE CODE ────────────────────────────────────── */}
      <Dialog open={addCodeOpen} onOpenChange={setAddCodeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Ticket className="w-4 h-4 text-primary" />
              Generate Invite Code / Access PIN
            </DialogTitle>
            <DialogDescription className="text-xs">
              Users can redeem this code to instantly unlock phone calling and cloning.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Custom Code / Token *</Label>
              <Input
                type="text"
                placeholder="e.g. TEAM-BETA-2026"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="text-xs font-mono h-9 uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Max Redemptions</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(parseInt(e.target.value) || 1)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Role Granted</Label>
                <Select value={newCodeRole} onValueChange={(v: any) => setNewCodeRole(v)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Approved User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description Note (Optional)</Label>
              <Input
                type="text"
                placeholder="For marketing team testing..."
                value={newCodeNote}
                onChange={(e) => setNewCodeNote(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleCreateCode}
              disabled={createCodeMutation.isPending || !newCode}
              className="text-xs gap-1.5"
            >
              {createCodeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

