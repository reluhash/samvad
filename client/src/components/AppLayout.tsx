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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AccessRequestBanner } from "@/components/AccessRequestBanner";

const BASE_NAV_ITEMS = [
  { path: "/", label: "Home", icon: Sparkles, adminOnly: false },
  { path: "/voices", label: "Voice Library", icon: Mic, adminOnly: false },
  { path: "/studio", label: "Call Studio", icon: Phone, adminOnly: false },
  { path: "/calls", label: "Call History", icon: LayoutDashboard, adminOnly: false },
  { path: "/settings", label: "Settings", icon: Settings, adminOnly: true },
  { path: "/access-management", label: "Access Management", icon: KeyRound, adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, isAuthenticated, logout, refetch, loading } = useAuth() as any;
  const { theme, toggleTheme } = useTheme();
  useAccentColor();

  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated && location !== "/") {
      setShowLogin(true);
    }
  }, [loading, isAuthenticated, location]);

  const isAdmin = user?.role === "admin";
  const NAV_ITEMS = BASE_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  async function handleLocalLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
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
        setLoginError(data.error ?? "Invalid credentials");
      }
    } catch {
      setLoginError("Network error — please try again");
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Local Login Modal ── */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 w-full max-w-sm space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/20">
                <AudioWaveform className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Samwad Reluhash AI</h2>
                <p className="text-xs text-muted-foreground">Sign in to continue</p>
              </div>
            </div>
            <form onSubmit={handleLocalLogin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="admin@samwad.local"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="••••••••"
                  required
                />
              </div>
              {loginError && (
                <p className="text-xs text-destructive">{loginError}</p>
              )}
              <Button type="submit" className="w-full" disabled={loggingIn}>
                {loggingIn ? "Signing in…" : "Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setShowLogin(false);
                  setLoginError("");
                  if (!isAuthenticated && location !== "/") {
                    navigate("/");
                  }
                }}
              >
                Cancel
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="flex flex-col w-16 md:w-60 bg-sidebar border-r border-sidebar-border shrink-0 transition-all duration-300">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 shrink-0">
            <AudioWaveform className="w-4 h-4 text-primary" />
          </div>
          <span className="hidden md:block text-sm font-semibold text-sidebar-foreground tracking-tight">
            Samwad Reluhash AI
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = path === "/" ? location === "/" : location.startsWith(path);
            return (
              <Tooltip key={path} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(path)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive
                        ? "bg-primary/15 text-primary border-r-2 border-primary"
                        : "text-sidebar-foreground/70"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden md:block">{label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="md:hidden">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Access request banner for non-admin users */}
        {isAuthenticated && !isAdmin && <AccessRequestBanner />}

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          {/* Theme toggle */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent px-3"
              >
                {theme === "dark" ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
                <span className="hidden md:block text-sm">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:hidden">
              Toggle Theme
            </TooltipContent>
          </Tooltip>

          {/* User section */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col flex-1 min-w-0">
                <span className="text-xs font-medium text-sidebar-foreground truncate">{user?.name || "User"}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email || ""}</span>
              </div>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => logout()}
                    className="w-7 h-7 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLogin(true)}
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent px-3"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span className="hidden md:block text-sm">Sign In</span>
            </Button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
