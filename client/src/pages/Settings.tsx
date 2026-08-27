import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Key,
  Phone,
  Palette,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Moon,
  Sun,
  Save,
  RefreshCw,
  Shield,
  MessageSquare,
} from "lucide-react";

const ACCENT_PRESETS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Emerald", value: "#10b981" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Pink", value: "#ec4899" },
];

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  const { data: settings, isLoading, refetch } = trpc.settings.get.useQuery();
  const { data: rawSettings } = trpc.settings.getForApi.useQuery();

  const saveMutation = trpc.settings.save.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
      refetch();
      setRetellApiKeyDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const testRetellMutation = trpc.settings.testRetell.useMutation({
    onSuccess: (data) => toast.success(data.message),
    onError: (e) => toast.error(e.message),
  });

  // Form state
  const [retellApiKey, setRetellApiKey] = useState("");
  const [retellPhoneNumber, setRetellPhoneNumber] = useState("");
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [defaultTone, setDefaultTone] = useState<"professional" | "casual" | "friendly" | "formal" | "empathetic">("professional");
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // Track dirty state for Test button
  const [retellApiKeyDirty, setRetellApiKeyDirty] = useState(false);

  // Populate form from saved settings
  useEffect(() => {
    if (rawSettings) {
      setRetellPhoneNumber(rawSettings.retellPhoneNumber ?? "");
      setAccentColor(rawSettings.accentColor ?? "#6366f1");
      setDefaultTone(rawSettings.defaultTone ?? "professional");
      setDefaultSystemPrompt(rawSettings.defaultSystemPrompt ?? "");
    }
  }, [rawSettings]);

  const hasRetellKey = !!(rawSettings?.retellApiKey);
  const canTestRetell = hasRetellKey && !retellApiKeyDirty;

  const handleSave = () => {
    const payload: Parameters<typeof saveMutation.mutate>[0] = {
      retellPhoneNumber: retellPhoneNumber || undefined,
      accentColor,
      defaultTone,
      defaultSystemPrompt: defaultSystemPrompt || undefined,
      theme: theme as "dark" | "light",
    };
    if (retellApiKey && retellApiKey.trim()) {
      payload.retellApiKey = retellApiKey.trim();
    }
    saveMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure your Retell AI credentials and platform preferences
            </p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Security notice */}
          <div className="flex gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
            <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Your credentials are secure.</span>{" "}
              API keys are stored encrypted and never shared. All calls are made server-side using your own Retell AI account.
            </div>
          </div>

          {/* ─── Retell AI Credentials ─────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Retell AI
                    {hasRetellKey && !retellApiKeyDirty && (
                      <Badge className="text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/20 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Your Retell AI account handles voice synthesis, cloning, and phone calls.{" "}
                    <a
                      href="https://beta.retellai.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Open Dashboard <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* API Key */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Key className="h-3 w-3" /> API Key
                </Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder={hasRetellKey ? "••••••••" + (settings?.retellApiKey?.slice(-4) ?? "****") : "key_xxxxxxxxxxxxxxxx"}
                    value={retellApiKey}
                    onChange={(e) => {
                      setRetellApiKey(e.target.value);
                      setRetellApiKeyDirty(true);
                    }}
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  Found under Settings → API Keys in your Retell dashboard.
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> Outbound Phone Number
                </Label>
                <Input
                  type="tel"
                  placeholder="+14157774444"
                  value={retellPhoneNumber}
                  onChange={(e) => setRetellPhoneNumber(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground/60">
                  A Retell-purchased number in E.164 format. Required for outbound phone calls.{" "}
                  <a
                    href="https://beta.retellai.com/phone-numbers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Buy a number <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testRetellMutation.mutate()}
                  disabled={!canTestRetell || testRetellMutation.isPending}
                  className="gap-2 h-8 text-xs"
                >
                  {testRetellMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Test Connection
                </Button>
                {!canTestRetell && (
                  <p className="text-xs text-muted-foreground/60">
                    {!hasRetellKey ? "Add and save your API key first." : "Save settings to re-test."}
                  </p>
                )}
                {testRetellMutation.isSuccess && canTestRetell && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                {testRetellMutation.isError && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" /> {testRetellMutation.error.message}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── Conversation Defaults ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm">Conversation Defaults</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Default settings pre-filled in the Call Studio for new calls.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Default Tone */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Default Tone</Label>
                <div className="flex flex-wrap gap-2">
                  {(["professional", "casual", "friendly", "formal", "empathetic"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setDefaultTone(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all border ${
                        defaultTone === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background/50 text-muted-foreground border-border/50 hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default System Prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Default System Prompt</Label>
                <textarea
                  rows={4}
                  placeholder="Enter a default system prompt that will be pre-filled in the Call Studio..."
                  value={defaultSystemPrompt}
                  onChange={(e) => setDefaultSystemPrompt(e.target.value)}
                  className="w-full rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* ─── Appearance ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Palette className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm">Appearance</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Customize the look and feel of the platform.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Theme */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Theme</Label>
                  <p className="text-xs text-muted-foreground">Switch between dark and light mode.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={() => toggleTheme?.()}
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Accent Color */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Accent Color</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setAccentColor(preset.value)}
                      className="relative w-7 h-7 rounded-full transition-all hover:scale-110 focus:outline-none"
                      style={{
                        backgroundColor: preset.value,
                        boxShadow:
                          accentColor === preset.value
                            ? `0 0 0 2px var(--background), 0 0 0 4px ${preset.value}`
                            : undefined,
                      }}
                      title={preset.label}
                    >
                      {accentColor === preset.value && (
                        <CheckCircle2 className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 ml-1">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-7 h-7 rounded-full cursor-pointer border border-border/50 bg-transparent p-0.5"
                      title="Custom color"
                    />
                    <span className="text-xs font-mono text-muted-foreground">{accentColor}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
