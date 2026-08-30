import { useState, useRef, useEffect } from "react";
import { useDirectVoiceSession } from "@/hooks/useDirectVoiceSession";
import { usePhoneCallSession } from "@/hooks/usePhoneCallSession";
import { useAuth } from "@/_core/hooks/useAuth";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Phone,
  Mic,
  Loader2,
  Sparkles,
  Settings2,
  Volume2,
  Zap,
  MessageSquare,
  ChevronRight,
  PhoneCall,
  Video,
  Info,
  Globe,
  PhoneOff,
  Radio,
  Headphones,
  Activity,
  User,
  Bot,
  BookOpen,
  Send,
  Copy,
  Check,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { INDIAN_LANGUAGES, GLOBAL_LANGUAGES, LANGUAGE_MAP } from "@shared/languages";

// ─── Preset Configurations ───────────────────────────────────────────────────

interface PresetItem {
  id: string;
  category: "hindi" | "english" | "regional";
  label: string;
  badge: string;
  language: string;
  voice: string;
  tone: "professional" | "casual" | "friendly" | "formal" | "empathetic";
  prompt: string;
}

const PRESETS: PresetItem[] = [
  // ── Hindi Defaults ──
  {
    id: "hi-sales",
    category: "hindi",
    label: "🇮🇳 Hindi Sales & Outreach",
    badge: "Aanchal · hi-IN",
    language: "hi-IN",
    voice: "Aanchal-hi",
    tone: "professional",
    prompt: "आप एक पेशेवर और विनम्र सेल्स एग्जीक्यूटिव हैं। ग्राहक को उत्पाद के मुख्य फायदे बताएं और उन्हें डेमो बुक करने के लिए प्रेरित करें। केवल 1-2 छोटे और स्वाभाविक हिंदी वाक्यों में उत्तर दें।",
  },
  {
    id: "hi-support",
    category: "hindi",
    label: "🇮🇳 Hindi Customer Support",
    badge: "Rohit · hi-IN",
    language: "hi-IN",
    voice: "Rohit-hi",
    tone: "empathetic",
    prompt: "आप एक सहायक और समझदार कस्टमर केयर एजेंट हैं। ग्राहक की समस्या ध्यान से सुनें और विनम्रता से सरल समाधान प्रदान करें। केवल 1-2 छोटे वाक्यों में बोलें।",
  },
  {
    id: "hi-story",
    category: "hindi",
    label: "📖 Hindi Storyteller (5-Min Mode)",
    badge: "Ananya · hi-IN",
    language: "hi-IN",
    voice: "ananya",
    tone: "casual",
    prompt: "आप एक रचनात्मक और भावुक कहानीकार हैं। बच्चों और बड़ों के लिए रोचक, सस्पेंस और प्रेरणा से भरी हिंदी कहानी सुनाएं। विस्तृत, सजीव और मनमोहक अंदाज़ में बोलें।",
  },
  {
    id: "hi-hinglish",
    category: "hindi",
    label: "🇮🇳 Hinglish Casual Agent",
    badge: "Aanchal · Hinglish",
    language: "hi-IN-hinglish",
    voice: "Aanchal-hi",
    tone: "friendly",
    prompt: "Aap ek friendly voice agent hain. Customer se natural Hinglish mein baat karein aur unki problem solve karein. Keep responses short and conversational.",
  },

  // ── English Defaults ──
  {
    id: "en-sales",
    category: "english",
    label: "✨ English Sales & Growth",
    badge: "Bella · US English",
    language: "en-US",
    voice: "af_bella",
    tone: "professional",
    prompt: "You are a dynamic product specialist and sales executive. Highlight key value propositions and encourage the customer to schedule a live demo. Respond in 1-2 punchy, conversational sentences.",
  },
  {
    id: "en-support",
    category: "english",
    label: "✨ English Tech Support",
    badge: "Adam · US English",
    language: "en-US",
    voice: "am_adam",
    tone: "empathetic",
    prompt: "You are an expert technical support engineer. Listen patiently to customer issues and provide clear, step-by-step troubleshooting assistance in 1-2 natural spoken sentences.",
  },
  {
    id: "en-formal",
    category: "english",
    label: "🇬🇧 British Formal Concierge",
    badge: "Emma · UK English",
    language: "en-GB",
    voice: "bf_emma",
    tone: "formal",
    prompt: "You are a courteous British concierge voice assistant. Deliver polite, articulate, and precise responses to customer inquiries.",
  },
  {
    id: "en-indic",
    category: "english",
    label: "🇮🇳 Indian English Assistant",
    badge: "Aarav · Indian English",
    language: "en-IN",
    voice: "default_indic",
    tone: "formal",
    prompt: "You are a professional Indian English speaking voice assistant. Be polite, clear, and direct in your responses. Keep answers concise.",
  },

  // ── Regional Indic Defaults ──
  {
    id: "ta-support",
    category: "regional",
    label: "🇮🇳 Tamil Customer Support",
    badge: "Aarav · Tamil",
    language: "ta-IN",
    voice: "default_indic",
    tone: "empathetic",
    prompt: "நீங்கள் ஒரு உதவிகரமான வாடிக்கையாளர் சேவை முகவர். தமிழில் பேசி வாடிக்கையாளரின் பிரச்சனைகளை தீர்க்கவும்.",
  },
  {
    id: "te-support",
    category: "regional",
    label: "🇮🇳 Telugu Support",
    badge: "Aarav · Telugu",
    language: "te-IN",
    voice: "default_indic",
    tone: "friendly",
    prompt: "మీరు సహాయక కస్టమర్ కేర్ ఎగ్జిక్యూటివ్. కస్టమర్ సమస్యలను విని తెలుగులో స్పష్టమైన పరిష్కారం అందించండి.",
  },
];

const COUNTRY_CODES = [
  { code: "+91", flag: "🇮🇳", label: "India (+91)" },
  { code: "+1", flag: "🇺🇸", label: "US / Canada (+1)" },
  { code: "+44", flag: "🇬🇧", label: "UK (+44)" },
  { code: "+61", flag: "🇦🇺", label: "Australia (+61)" },
  { code: "+971", flag: "🇦🇪", label: "UAE (+971)" },
  { code: "+65", flag: "🇸🇬", label: "Singapore (+65)" },
  { code: "+49", flag: "🇩🇪", label: "Germany (+49)" },
];

// ─── Slider Field ─────────────────────────────────────────────────────────────

function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format = (v: number) => v.toFixed(2),
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CallStudio() {
  const { user } = useAuth();

  // Top-Level Mode: 'web' | 'phone'
  const [studioMode, setStudioMode] = useState<"web" | "phone">("web");

  // Language Category Filter for Presets
  const [langCategory, setLangCategory] = useState<"all" | "hindi" | "english" | "regional">("hindi");

  // Phone Call States
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Active Call Configuration
  const [selectedVoice, setSelectedVoice] = useState("Aanchal-hi");
  const [selectedLanguage, setSelectedLanguage] = useState("hi-IN");
  const [tone, setTone] = useState<"professional" | "casual" | "friendly" | "formal" | "empathetic">("professional");
  const [systemPrompt, setSystemPrompt] = useState(
    "आप एक तेज़, स्वाभाविक और विनम्र भारतीय वॉयस कॉल सहायक हैं। केवल शुद्ध, सरल और बोलचाल की हिंदी में 1-2 छोटे वाक्यों में उत्तर दें। कभी भी मार्कडाउन, तारे (*), हैश (#), या बुलेट पॉइंट्स का प्रयोग न करें।"
  );
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceTemperature, setVoiceTemperature] = useState(1.0);
  const [responsiveness, setResponsiveness] = useState(0.9);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState(0.9);

  // Script Generator States (powered by local vLLM Gemma 4)
  const [scriptTopic, setScriptTopic] = useState("");
  const [scriptLanguage, setScriptLanguage] = useState("Hindi");
  const [scriptTurns, setScriptTurns] = useState(4);
  const [generatedScriptText, setGeneratedScriptText] = useState("");
  const [generatedScript, setGeneratedScript] = useState<Array<{ speaker: string; text: string }>>([]);

  // Queries
  const { data: rawPremadeVoices } = trpc.voices.listPremade.useQuery();
  const { data: rawSavedVoices } = trpc.voices.listSaved.useQuery();
  const { data: myAccess } = trpc.access.myStatus.useQuery();

  const premadeVoices = Array.isArray(rawPremadeVoices) ? rawPremadeVoices : [];
  const savedVoices = Array.isArray(rawSavedVoices) ? rawSavedVoices : [];

  // Web Call Hook
  const webCall = useDirectVoiceSession();

  // Phone Call Hook (Twilio PSTN Bridge)
  const phoneCall = usePhoneCallSession();

  const webTranscripts = Array.isArray(webCall?.transcripts) ? webCall.transcripts : [];
  const phoneTranscripts = Array.isArray(phoneCall?.transcripts) ? phoneCall.transcripts : [];

  // Local vLLM Script generator mutation
  const generateScriptMutation = trpc.llm.generateScript.useMutation({
    onSuccess: (data) => {
      setGeneratedScriptText(data.script);
      const lines = data.script.split("\n").filter(Boolean);
      const parsed = lines
        .map((l: string) => {
          const parts = l.split(/:(.*)/s);
          if (parts.length >= 2) {
            return { speaker: parts[0].replace(/[*_#]/g, "").trim(), text: parts[1].replace(/[*_#]/g, "").trim() };
          }
          return null;
        })
        .filter(Boolean) as Array<{ speaker: string; text: string }>;

      setGeneratedScript(parsed);
      toast.success("Script generated by local vLLM (Gemma 4)!");
    },
    onError: (e) => toast.error(`vLLM Error: ${e.message}`),
  });

  // Apply Preset Handler
  const handleApplyPreset = (p: PresetItem) => {
    setSelectedVoice(p.voice);
    setSelectedLanguage(p.language);
    setTone(p.tone);
    setSystemPrompt(p.prompt);
    toast.success(`Applied preset "${p.label}" (${p.voice})`);
  };

  // Switch Language Mode (Hindi vs English)
  const handleSwitchLanguageMode = (mode: "hindi" | "english") => {
    if (mode === "hindi") {
      setLangCategory("hindi");
      setSelectedVoice("Aanchal-hi");
      setSelectedLanguage("hi-IN");
      setSystemPrompt(
        "आप एक तेज़, स्वाभाविक और विनम्र भारतीय वॉयस कॉल सहायक हैं। केवल शुद्ध, सरल और बोलचाल की हिंदी में 1-2 छोटे वाक्यों में उत्तर दें।"
      );
      toast.success("Switched to Hindi Mode (Aanchal · hi-IN)");
    } else {
      setLangCategory("english");
      setSelectedVoice("af_bella");
      setSelectedLanguage("en-US");
      setSystemPrompt(
        "You are a friendly, conversational, and direct voice assistant. Answer in 1-2 concise spoken sentences. Never use markdown formatting."
      );
      toast.success("Switched to English Mode (Bella · en-US)");
    }
  };

  // Handle Web Call Start/Stop
  const handleToggleWebCall = async () => {
    if (webCall.isConnected) {
      webCall.disconnect();
    } else {
      await webCall.connect({
        targetVoice: selectedVoice,
        systemPrompt,
      });
    }
  };

  // Handle Phone Call Start
  const handleStartPhoneCall = async () => {
    const isApproved = user?.role === "admin" || myAccess?.apiAccess === "approved";
    if (!isApproved) {
      toast.error("Phone calling requires approved access. Please enter an invite code or request access in the sidebar.");
      return;
    }

    const cleanNumber = (phoneNumber || "").replace(/[^0-9]/g, "");
    if (!cleanNumber || cleanNumber.length < 7) {
      toast.error("Please enter a valid mobile number");
      return;
    }
    const fullNumber = `${countryCode}${cleanNumber}`;
    await phoneCall.startCall({
      toNumber: fullNumber,
      voiceId: selectedVoice,
      systemPrompt,
    });
  };

  const isPhoneActive = ["INITIATING", "RINGING", "CONNECTED", "USER_SPEAKING", "AGENT_SPEAKING"].includes(phoneCall.status);

  const formatDuration = (sec: number = 0) => {
    const safeSec = Math.max(0, sec || 0);
    const mins = String(Math.floor(safeSec / 60)).padStart(2, "0");
    const s = String(safeSec % 60).padStart(2, "0");
    return `${mins}:${s}`;
  };

  const filteredPresets = PRESETS.filter(
    (p) => langCategory === "all" || p.category === langCategory
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* ─── Top Header & Mode Selector ─────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0 bg-card/40 backdrop-blur">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary animate-pulse" />
              Samvad Call Studio
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Conversational AI engine with zero-shot Indic & Global voice synthesis
            </p>
          </div>

          {/* Quick Language Toggle */}
          <div className="hidden sm:flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/40 text-xs">
            <button
              onClick={() => handleSwitchLanguageMode("hindi")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1",
                selectedLanguage.startsWith("hi")
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              🇮🇳 Hindi Default
            </button>
            <button
              onClick={() => handleSwitchLanguageMode("english")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1",
                selectedLanguage.startsWith("en")
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              🌐 English Default
            </button>
          </div>
        </div>

        {/* Dual Mode Switcher: Web vs Phone */}
        <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/50">
          <button
            onClick={() => setStudioMode("web")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all",
              studioMode === "web"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            Web Call (Mic)
          </button>
          <button
            onClick={() => setStudioMode("phone")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all",
              studioMode === "phone"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Phone className="w-3.5 h-3.5" />
            Phone Call (Twilio PSTN)
            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded text-[10px]">LIVE</span>
          </button>
        </div>
      </div>

      {/* ─── Main Content Grid ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Call Controls & Live Monitor (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col border-r border-border overflow-auto p-6 space-y-6">
          {studioMode === "phone" ? (
            /* ─── PHONE CALL MODE ───────────────────────────────────────────── */
            <div className="space-y-6">
              {/* Dialer Card */}
              <Card className="border-primary/20 bg-card/60 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-primary" />
                      Direct Outbound Phone Dialer
                    </span>
                    <Badge variant="outline" className="text-xs text-muted-foreground font-mono">
                      Caller ID: +1 (989) 589-8371
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Select value={countryCode} onValueChange={setCountryCode}>
                      <SelectTrigger className="w-[140px] text-xs h-10 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="text-xs">
                            {c.flag} {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="tel"
                      placeholder="98765 43210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={isPhoneActive}
                      className="text-sm h-10 font-mono tracking-wider flex-1"
                    />
                    {isPhoneActive ? (
                      <Button
                        onClick={phoneCall.endCall}
                        variant="destructive"
                        className="h-10 px-5 gap-2 font-semibold text-xs shadow-lg animate-pulse"
                      >
                        <PhoneOff className="w-4 h-4" />
                        End Call
                      </Button>
                    ) : (
                      <Button
                        onClick={handleStartPhoneCall}
                        className="h-10 px-5 gap-2 font-semibold text-xs shadow-md bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <PhoneCall className="w-4 h-4" />
                        Call Now
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Twilio immediately dials this phone number and bridges real-time audio with Voice: <span className="font-semibold text-primary">{selectedVoice}</span> ({selectedLanguage}).
                  </p>
                </CardContent>
              </Card>

              {/* Phone Call Monitor Card */}
              <Card className="border-border/60 bg-card/40 flex-1 flex flex-col">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5",
                          phoneCall.status === "CONNECTED"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : phoneCall.status === "USER_SPEAKING"
                            ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                            : phoneCall.status === "AGENT_SPEAKING"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : phoneCall.status === "RINGING"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse"
                            : phoneCall.status === "INITIATING"
                            ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            isPhoneActive ? "bg-emerald-400 animate-ping" : "bg-muted-foreground"
                          )}
                        />
                        {phoneCall.status === "USER_SPEAKING"
                          ? "CALLER SPEAKING"
                          : phoneCall.status === "AGENT_SPEAKING"
                          ? "AGENT SPEAKING"
                          : phoneCall.status}
                      </div>

                      <span className="text-xs font-mono text-muted-foreground">
                        ⏱️ {formatDuration(phoneCall.callSeconds)}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        ⚡ {phoneCall.rttMs}ms RTT
                      </span>
                    </div>

                    {/* Listen In Toggle */}
                    <div className="flex items-center gap-2">
                      <Headphones className="w-3.5 h-3.5 text-muted-foreground" />
                      <Label htmlFor="listen-in" className="text-xs text-muted-foreground cursor-pointer">
                        Listen In (Browser)
                      </Label>
                      <Switch
                        id="listen-in"
                        checked={phoneCall.listenIn}
                        onCheckedChange={phoneCall.setListenIn}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Waveform Visualizer Canvas */}
                  <div className="w-full bg-black/40 rounded-lg p-2 border border-border/40 overflow-hidden relative">
                    <canvas
                      ref={phoneCall.canvasRef as any}
                      width={600}
                      height={60}
                      className="w-full h-[60px] block"
                    />
                    {phoneCall.interrupted && (
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 animate-pulse">
                        ⚡ Caller Interrupted (Barge-In)
                      </div>
                    )}
                  </div>

                  {/* Realtime Transcripts List */}
                  <div className="space-y-2 max-h-[320px] min-h-[180px] overflow-auto rounded-lg border border-border/30 p-3 bg-muted/20">
                    {phoneTranscripts.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground/60 text-xs">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Waiting for connection...</p>
                        <p className="text-[11px] mt-1">Live transcripts will stream here in real time as the conversation happens.</p>
                      </div>
                    ) : (
                      phoneTranscripts.map((t) => (
                        <div
                          key={t.id}
                          className={cn(
                            "flex gap-2.5 text-xs",
                            t.role === "agent" ? "flex-row" : "flex-row-reverse"
                          )}
                        >
                          <div
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px]",
                              t.role === "agent" ? "bg-emerald-500/20 text-emerald-400" : "bg-purple-500/20 text-purple-400"
                            )}
                          >
                            {t.role === "agent" ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                          </div>
                          <div
                            className={cn(
                              "max-w-[80%] rounded-lg p-2.5 leading-relaxed text-xs",
                              t.role === "agent"
                                ? "bg-muted/80 text-foreground border border-border/40"
                                : "bg-purple-500/15 text-purple-200 border border-purple-500/30"
                            )}
                          >
                            <p>{t.text}</p>
                            <span className="text-[9px] text-muted-foreground mt-1 block">
                              {new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* ─── WEB CALL MODE ─────────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center flex-1 space-y-6">
              {/* Visual Orb */}
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    "w-44 h-44 rounded-full transition-all duration-700 flex items-center justify-center shadow-2xl relative",
                    webCall.isConnected
                      ? webCall.isUserSpeaking
                        ? "bg-purple-500/20 border-2 border-purple-400 shadow-purple-500/30 scale-105"
                        : webCall.isAgentSpeaking
                        ? "bg-emerald-500/20 border-2 border-emerald-400 shadow-emerald-500/30 scale-105"
                        : "bg-primary/20 border-2 border-primary shadow-primary/30"
                      : "bg-muted/30 border border-border"
                  )}
                >
                  <div
                    className={cn(
                      "w-24 h-24 rounded-full transition-all duration-300 flex items-center justify-center",
                      webCall.isConnected
                        ? webCall.isUserSpeaking
                          ? "bg-purple-500 text-white animate-pulse"
                          : webCall.isAgentSpeaking
                          ? "bg-emerald-500 text-white animate-pulse"
                          : "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Mic className="w-10 h-10" />
                  </div>
                </div>
              </div>

              {/* Status & Telemetry */}
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold">
                  {webCall.isConnected
                    ? webCall.isUserSpeaking
                      ? "Listening to you..."
                      : webCall.isAgentSpeaking
                      ? "AI is speaking..."
                      : "Connected & ready"
                    : `Ready with ${selectedVoice} (${selectedLanguage})`}
                </p>
                {webCall.isConnected && (
                  <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground font-mono">
                    <span>⏱️ {formatDuration(webCall.callSeconds)}</span>
                    <span>⚡ 120ms RTT</span>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <Button
                size="lg"
                onClick={handleToggleWebCall}
                disabled={webCall.isConnecting}
                className={cn(
                  "h-12 px-8 font-semibold gap-2 shadow-lg transition-all",
                  webCall.isConnected
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {webCall.isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : webCall.isConnected ? (
                  <>
                    <PhoneOff className="w-4 h-4" />
                    End Web Session
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-4 h-4" />
                    Start Web Conversation
                  </>
                )}
              </Button>

              {/* Web Call Transcripts Preview */}
              {webTranscripts.length > 0 && (
                <div className="w-full space-y-2 max-h-48 overflow-auto rounded-lg border border-border p-3 bg-muted/20 text-xs">
                  {webTranscripts.slice(-6).map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex gap-2 text-xs",
                        t.role === "agent" ? "text-emerald-400" : "text-purple-300"
                      )}
                    >
                      <span className="font-semibold">{t.role === "agent" ? "AI:" : "You:"}</span>
                      <span>{t.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Configuration Sidebar & Presets (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col overflow-auto p-6 space-y-6 bg-card/20">
          <Tabs defaultValue="presets" className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="presets" className="text-xs">Presets</TabsTrigger>
              <TabsTrigger value="voice" className="text-xs">Voice & Lang</TabsTrigger>
              <TabsTrigger value="script" className="text-xs">AI Script (vLLM)</TabsTrigger>
            </TabsList>

            {/* ─── TAB 1: PRESETS ────────────────────────────────────────────── */}
            <TabsContent value="presets" className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[
                  { key: "hindi", label: "🇮🇳 Hindi Defaults" },
                  { key: "english", label: "🌐 English Defaults" },
                  { key: "regional", label: "🗺️ Indic Regional" },
                  { key: "all", label: "✨ All" },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setLangCategory(cat.key as any)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border",
                      langCategory === cat.key
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Presets List */}
              <div className="grid grid-cols-1 gap-2.5">
                {filteredPresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p)}
                    className={cn(
                      "p-3 rounded-lg border text-left space-y-1.5 transition-all group",
                      selectedVoice === p.voice && selectedLanguage === p.language
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/60 bg-card/50 hover:bg-card hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary">
                        {p.label}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {p.badge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {p.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </TabsContent>

            {/* ─── TAB 2: VOICE & LANGUAGE ───────────────────────────────────── */}
            <TabsContent value="voice" className="space-y-4">
              <div className="space-y-3.5">
                {/* Voice Persona Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Voice Persona</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Indic Voices */}
                      <SelectItem value="Aanchal-hi">🇮🇳 Aanchal (Hindi Female - Expressive & Natural)</SelectItem>
                      <SelectItem value="Rohit-hi">🇮🇳 Rohit (Hindi Male - Clear & Balanced)</SelectItem>
                      <SelectItem value="ananya">🇮🇳 Ananya (Indic Multilingual Female)</SelectItem>
                      <SelectItem value="default_indic">🇮🇳 Aarav (Indic Multilingual Male)</SelectItem>
                      <SelectItem value="Chhavi-hi">🇮🇳 Chhavi (Hindi Female - Warm)</SelectItem>
                      <SelectItem value="Divya-hi">🇮🇳 Divya (Hindi Female - Professional)</SelectItem>
                      <SelectItem value="Amol-hi">🇮🇳 Amol (Hindi Male - Energetic)</SelectItem>

                      {/* Custom Cloned */}
                      {savedVoices
                        .filter((v) => v && v.category === "cloned")
                        .map((v) => (
                          <SelectItem key={v.id} value={v.voiceId || v.retellVoiceId || String(v.id)}>
                            🎙️ {v.name} (Custom Cloned)
                          </SelectItem>
                        ))}

                      {/* English Voices */}
                      <SelectItem value="af_bella">✨ Bella (English US Female - Cheerful & Crisp)</SelectItem>
                      <SelectItem value="am_adam">✨ Adam (English US Male - Deep & Confident)</SelectItem>
                      <SelectItem value="af_heart">✨ Heart (English US Female - Warm)</SelectItem>
                      <SelectItem value="bf_emma">🇬🇧 Emma (English UK Female - Articulate)</SelectItem>
                      <SelectItem value="bm_george">🇬🇧 George (English UK Male - Authoritative)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Language Mode Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Language Mode</Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIAN_LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code} className="text-xs">
                          {l.flag} {l.label} ({l.nativeLabel})
                        </SelectItem>
                      ))}
                      {GLOBAL_LANGUAGES.slice(0, 5).map((l) => (
                        <SelectItem key={l.code} value={l.code} className="text-xs">
                          {l.flag} {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Agent System Prompt */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Agent System Prompt</Label>
                  <Textarea
                    rows={5}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="text-xs font-mono leading-relaxed"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    This prompt guides Gemma 4 LLM on each conversational turn.
                  </p>
                </div>

                {/* Speech Sliders */}
                <Card className="border-border/60 bg-card/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                      <Settings2 className="w-3.5 h-3.5 text-primary" />
                      Speech Tuning
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SliderField
                      label="Voice Speed"
                      value={voiceSpeed}
                      onChange={setVoiceSpeed}
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      format={(v) => `${v.toFixed(2)}x`}
                    />
                    <SliderField
                      label="Voice Temperature"
                      value={voiceTemperature}
                      onChange={setVoiceTemperature}
                      min={0.1}
                      max={1.5}
                      step={0.05}
                      format={(v) => v.toFixed(2)}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ─── TAB 3: AI SCRIPT GENERATOR (vLLM GEMMA 4) ──────────────────── */}
            <TabsContent value="script" className="space-y-4">
              <Card className="border-border/60 bg-card/40">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      AI Script Generator
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      ⚡ Local vLLM (Gemma 4 AWQ)
                    </Badge>
                  </div>
                  <CardDescription className="text-[11px]">
                    Generate realistic multi-turn voice scripts with zero OpenAI API keys.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <Label className="text-xs">Scenario / Topic</Label>
                    <Input
                      placeholder="e.g. 'EdTech sales call selling coding courses'"
                      value={scriptTopic}
                      onChange={(e) => setScriptTopic(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Language</Label>
                      <Select value={scriptLanguage} onValueChange={setScriptLanguage}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Hindi">🇮🇳 Hindi</SelectItem>
                          <SelectItem value="Hinglish">🇮🇳 Hinglish</SelectItem>
                          <SelectItem value="English">🌐 English</SelectItem>
                          <SelectItem value="Tamil">🇮🇳 Tamil</SelectItem>
                          <SelectItem value="Telugu">🇮🇳 Telugu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Turns</Label>
                      <Select value={String(scriptTurns)} onValueChange={(v) => setScriptTurns(parseInt(v))}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 Turns (Short)</SelectItem>
                          <SelectItem value="4">4 Turns (Standard)</SelectItem>
                          <SelectItem value="6">6 Turns (Detailed)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() =>
                      generateScriptMutation.mutate({
                        scenario: scriptTopic,
                        language: scriptLanguage,
                        turns: scriptTurns,
                        tone,
                      })
                    }
                    disabled={generateScriptMutation.isPending || !scriptTopic}
                    className="w-full h-8 text-xs gap-1.5 shadow-sm"
                  >
                    {generateScriptMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    Generate Dialogue Script
                  </Button>

                  {/* Generated Script Display */}
                  {generatedScript.length > 0 && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground">Generated Dialogue</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSystemPrompt(
                              `You are an AI voice assistant. Follow this conversational style and context:\n${generatedScriptText}`
                            );
                            toast.success("Applied script context to Agent Prompt!");
                          }}
                          className="h-6 text-[10px] gap-1 text-primary hover:text-primary"
                        >
                          <Send className="w-3 h-3" />
                          Apply to Agent Prompt
                        </Button>
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-auto text-xs bg-muted/40 p-2.5 rounded-lg border border-border/40">
                        {generatedScript.map((line, idx) => (
                          <div key={idx} className="leading-relaxed">
                            <span className="font-bold text-primary">{line.speaker}: </span>
                            <span className="text-foreground/90">{line.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

