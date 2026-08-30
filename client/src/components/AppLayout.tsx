import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useAccentColor } from "@/hooks/useAccentColor";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Mic,
  Phone,
  LayoutDashboard,
  Settings,
  Sun,
  Moon,
  LogOut,
  LogIn,
  AudioWaveform,
  Sparkles,
  KeyRound,
  Ticket,
  User,
  Shield,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AccessRequestBanner } from "@/components/AccessRequestBanner";

const BASE_NAV_ITEMS = [
  { path: "/", label: "Home", icon: Sparkles, adminOnly: false },
  { path: "/voices", label: "Voice Library", icon: Mic, adminOnly: false },
  { path: "/studio", label: "Call Studio", icon: Phone, adminOnly: false },
  { path: "/calls", label: "Call History", icon: LayoutDashboard, adminOnly: false },
  { path: "/settings", label: "Settings", icon: Settings, adminOnly: false },
  { path: "/access-management", label: "Access Management", icon: KeyRound, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, logout, refetch, loading } = useAuth() as any;
  const { theme, toggleTheme } = useTheme();
  useAccentColor();

  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState<"user" | "admin">("user");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated && location !== "/") {
      setShowLogin(true);
    }
  }, [loading, isAuthenticated, location]);

  const isAdmin = user?.role === "admin";
  const NAV_ITEMS = BASE_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");

    try {
      if (loginMode === "admin") {
        const res = await fetch("/api/auth/local-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        });
        if (res.ok) {
          setShowLogin(false);
          if (typeof refetch === "function") refetch();
          window.location.reload();
        } else {
          const data = await res.json().catch(() => ({}));
          setLoginError(data.error ?? "Invalid admin credentials");
        }
      } else {
        const res = await fetch("/api/auth/user-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, inviteCode }),
          credentials: "include",
        });
        if (res.ok) {
          setShowLogin(false);
          if (typeof refetch === "function") refetch();
          window.location.reload();
        } else {
          const data = await res.json().catch(() => ({}));
          setLoginError(data.error ?? "Login failed");
        }
      }
    } catch {
      setLoginError("Network error — please try again");
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Login Modal ── */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 w-full max-w-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20">
                <AudioWaveform className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Samvad Reluhash AI</h2>
                <p className="text-xs text-muted-foreground">Conversational Voice Platform</p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-muted/60 p-1 rounded-lg border border-border/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setLoginMode("user"); setLoginError(""); }}
                className={cn(
                  "flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5",
                  loginMode === "user" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <User className="w-3.5 h-3.5" />
                User Sign In
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode("admin"); setLoginError(""); }}
                className={cn(
                  "flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5",
                  loginMode === "admin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={loginMode === "admin" ? "admin@voiceforge.local" : "you@company.com"}
                  required
                  autoFocus
                />
              </div>

              {loginMode === "user" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Your Name (Optional)</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="e.g. John"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Invite Code / Access PIN (Optional)</label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-xs font-mono uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="e.g. SAMVAD-VIP-2026"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Admin Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              {loginError && (
                <p className="text-xs text-destructive font-medium">{loginError}</p>
              )}

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                {loginMode === "admin" ? "Sign In as Admin" : "Continue to Platform"}
              </button>

              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="w-full py-1.5 text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel / Explore Demo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className="w-64 border-r border-border bg-card/50 flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shadow-sm">
              <AudioWaveform className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-foreground tracking-tight">Samvad AI</span>
              <p className="text-[10px] text-muted-foreground">Low-Latency Voice Engine</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Access Banner */}
        <AccessRequestBanner />

        {/* Footer / User Profile */}
        <div className="p-3 border-t border-border flex items-center justify-between bg-card/20">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-bold">
                  {(user?.name || user?.email || "U")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{user?.name || "User"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email || ""}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => logout()}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">Guest Mode</span>
              <Button
                size="sm"
                onClick={() => setShowLogin(true)}
                className="h-7 text-xs gap-1"
              >
                <LogIn className="w-3 h-3" />
                Sign In
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 overflow-hidden flex flex-col bg-background">
        {children}
      </main>
    </div>
  );
}

