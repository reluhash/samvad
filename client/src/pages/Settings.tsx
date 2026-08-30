import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone,
  Palette,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Moon,
  Sun,
  Save,
  RefreshCw,
  Activity,
  Server,
  Cpu,
  Radio,
  Sliders,
  Sparkles,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { data: health, refetch: refetchHealth, isFetching: checkingHealth } = trpc.settings.getPipelineHealth.useQuery();

  const saveMutation = trpc.settings.save.useMutation({
    onSuccess: () => {
      toast.success("Settings saved successfully");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Form state
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [defaultTone, setDefaultTone] = useState<"professional" | "casual" | "friendly" | "formal" | "empathetic">("professional");
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState(
    "आप एक तेज़, स्वाभाविक और विनम्र भारतीय वॉयस कॉल सहायक हैं। केवल 1-2 छोटे और स्वाभाविक हिंदी वाक्यों में उत्तर दें।"
  );

  // Populate form from saved settings
  useEffect(() => {
    if (settings) {
      if (settings.accentColor) setAccentColor(settings.accentColor);
      if (settings.defaultTone) setDefaultTone(settings.defaultTone as any);
      if (settings.defaultSystemPrompt) setDefaultSystemPrompt(settings.defaultSystemPrompt);
    }
  }, [settings]);

  const handleSave = () => {
    saveMutation.mutate({
      accentColor,
      defaultTone,
      defaultSystemPrompt: defaultSystemPrompt || undefined,
      theme: theme as "dark" | "light",
    });
  };

  return (
    <div className="h-full flex flex-col overflow-auto bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            Infrastructure & System Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure telephony trunks, default voice persona parameters, and interface branding
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="text-xs gap-2 shadow-sm">
          {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Preferences
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telephony & Model Pipeline Health */}
        <Card className="border-border/60 bg-card/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" />
                Telephony & Core Pipeline Health
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchHealth()}
                disabled={checkingHealth}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={cn("w-3 h-3", checkingHealth && "animate-spin")} />
                Refresh Status
              </Button>
            </div>
            <CardDescription className="text-xs">
              Live status of telephony bridges and local GPU microservices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Fonoster / Twilio Bridge */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40 text-xs">
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="font-semibold text-foreground">Twilio PSTN Bridge (Port 5000)</p>
                  <p className="text-[11px] text-muted-foreground">Caller ID: +1 (989) 589-8371</p>
                </div>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px]">
                {health?.telephonyBridge ? "ONLINE" : "CONNECTED"}
              </Badge>
            </div>

            {/* S2S Core Engine */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40 text-xs">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Speech-to-Speech Core (Port 8765)</p>
                  <p className="text-[11px] text-muted-foreground">Whisper large-v3-turbo + IndicF5 (Zero-Shot Cloning)</p>
                </div>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px]">
                ACTIVE
              </Badge>
            </div>

            {/* vLLM Gemma 4 */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40 text-xs">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="font-semibold text-foreground">vLLM Inference Gateway (Port 8100)</p>
                  <p className="text-[11px] text-muted-foreground">Gemma 4 26B AWQ-4bit (RTX A6000)</p>
                </div>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px]">
                READY (50+ req/s)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Telephony & Webhook Endpoints */}
        <Card className="border-border/60 bg-card/40 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              Telephony Webhooks & Endpoints
            </CardTitle>
            <CardDescription className="text-xs">
              Public webhook URLs configured for Twilio and Realtime streaming
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Twilio Inbound / Outbound Voice Webhook</Label>
              <div className="p-2 bg-black/40 font-mono text-[11px] rounded border border-border/40 text-foreground break-all select-all">
                https://samvad.reluhashai.com/twilio/voice
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Twilio Media Stream WebSocket</Label>
              <div className="p-2 bg-black/40 font-mono text-[11px] rounded border border-border/40 text-foreground break-all select-all">
                wss://samvad.reluhashai.com/media/stream/:callId
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Realtime S2S WebSocket (Web Browsers)</Label>
              <div className="p-2 bg-black/40 font-mono text-[11px] rounded border border-border/40 text-foreground break-all select-all">
                wss://samvad.reluhashai.com/v1/realtime
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Voice Persona & Prompt Preferences */}
        <Card className="border-border/60 bg-card/40 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Default Agent Persona & Tone
            </CardTitle>
            <CardDescription className="text-xs">
              Pre-populate prompt and conversational style for new sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Default Conversation Tone</Label>
              <Select value={defaultTone} onValueChange={(v: any) => setDefaultTone(v)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional (Business & Sales)</SelectItem>
                  <SelectItem value="casual">Casual (Conversational)</SelectItem>
                  <SelectItem value="friendly">Friendly & Warm</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="empathetic">Empathetic (Customer Support)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Default System Prompt</Label>
              <Textarea
                rows={4}
                value={defaultSystemPrompt}
                onChange={(e) => setDefaultSystemPrompt(e.target.value)}
                className="text-xs font-mono leading-relaxed"
                placeholder="Enter baseline agent prompt..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Interface & Theme Preferences */}
        <Card className="border-border/60 bg-card/40 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Theme & Appearance
            </CardTitle>
            <CardDescription className="text-xs">
              Customize interface color scheme and branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Dark Mode</Label>
                <p className="text-[11px] text-muted-foreground">Switch between light and dark UI themes</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="text-xs h-8 gap-1.5"
              >
                {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </Button>
            </div>

            <Separator className="my-2" />

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Accent Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setAccentColor(preset.value)}
                    style={{ backgroundColor: preset.value }}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all border-2",
                      accentColor === preset.value ? "border-white scale-110 shadow-md" : "border-transparent"
                    )}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

