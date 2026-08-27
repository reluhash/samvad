import { useState, useRef, useEffect } from "react";
import { useDirectVoiceSession } from "@/hooks/useDirectVoiceSession";
import { useAuth } from "@/_core/hooks/useAuth";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { INDIAN_LANGUAGES, GLOBAL_LANGUAGES, LANGUAGE_MAP, MULTILINGUAL_ONLY_CODES } from "@shared/languages";

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_PRESETS = [
  { label: "Hindi Sales", language: "hi-IN", tone: "professional" as const, prompt: "आप एक पेशेवर सेल्स एजेंट हैं। उत्पाद के फायदे बताएं और ग्राहक को डेमो बुक करने के लिए प्रेरित करें।" },
  { label: "Hindi Support", language: "hi-IN", tone: "empathetic" as const, prompt: "आप एक सहायक कस्टमर केयर एजेंट हैं। ग्राहक की समस्या ध्यान से सुनें और समाधान प्रदान करें।" },
  { label: "Hinglish Casual", language: "hi-IN-hinglish", tone: "friendly" as const, prompt: "Aap ek friendly agent hain. Customer se natural Hinglish mein baat karein aur unki problem solve karein." },
  { label: "English (India)", language: "en-IN", tone: "formal" as const, prompt: "You are a professional Indian English speaking agent. Be polite, clear, and culturally aware in your responses." },
  { label: "Tamil Support", language: "ta-IN", tone: "empathetic" as const, prompt: "நீங்கள் ஒரு உதவிகரமான வாடிக்கையாளர் சேவை முகவர். தமிழில் பேசி வாடிக்கையாளரின் பிரச்சனைகளை தீர்க்கவும்." },
  { label: "Telugu Sales", language: "te-IN", tone: "professional" as const, prompt: "మీరు ఒక నిపుణమైన సేల్స్ ఏజెంట్. తెలుగుల౏ మాట్లాడి ఉత్పత్తి యొక్క ప్రయోజనాలను వివరించండి." },
];

const TONES = [
  { value: "professional", label: "Professional", desc: "Formal and business-oriented" },
  { value: "casual", label: "Casual", desc: "Relaxed and conversational" },
  { value: "friendly", label: "Friendly", desc: "Warm and approachable" },
  { value: "formal", label: "Formal", desc: "Structured and precise" },
  { value: "empathetic", label: "Empathetic", desc: "Understanding and supportive" },
] as const;

const CALL_TYPES = [
  { value: "web", label: "Web Call", icon: Globe, placeholder: "" },
  { value: "phone", label: "Phone Number", icon: Phone, placeholder: "+1 (555) 000-0000" },
  { value: "meet", label: "Google Meet", icon: Video, placeholder: "https://meet.google.com/..." },
  { value: "zoom", label: "Zoom", icon: Video, placeholder: "https://zoom.us/j/..." },
  { value: "teams", label: "Teams", icon: Video, placeholder: "https://teams.microsoft.com/..." },
] as const;

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
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
          {format(value)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

// ─── Web Call Overlay ─────────────────────────────────────────────────────────

function WebCallOverlay({
  status,
  agentTalking,
  onStop,
}: {
  status: "connecting" | "active" | "ended";
  agentTalking: boolean;
  onStop: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl border border-border bg-card shadow-2xl max-w-sm w-full mx-4">
        {status === "connecting" && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Connecting...</p>
              <p className="text-sm text-muted-foreground mt-1">Setting up your web call</p>
            </div>
          </>
        )}
        {status === "active" && (
          <>
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
              agentTalking
                ? "bg-primary/20 ring-4 ring-primary/30 ring-offset-2 ring-offset-card"
                : "bg-muted"
            )}>
              {agentTalking ? (
                <Radio className="w-8 h-8 text-primary animate-pulse" />
              ) : (
                <Mic className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                {agentTalking ? "AI is speaking..." : "Listening..."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {agentTalking
                  ? "Speak to interrupt the AI at any time"
                  : "Your turn — speak now"}
              </p>
            </div>
            <Button
              variant="destructive"
              className="gap-2 w-full"
              onClick={onStop}
            >
              <PhoneOff className="w-4 h-4" />
              End Call
            </Button>
          </>
        )}
        {status === "ended" && (
          <>
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <PhoneOff className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Call Ended</p>
              <p className="text-sm text-muted-foreground mt-1">Redirecting to call history...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CallStudio() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Web call state
  
    const directVoice = useDirectVoiceSession();
  const [webCallStatus, setWebCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [liveKitToken, setLiveKitToken] = useState("");
  const [agentTalking, setAgentTalking] = useState(false);
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  const activeCallIdRef = useRef<number | null>(null);

  // Call target
  const [callType, setCallType] = useState<"web" | "phone" | "meet" | "zoom" | "teams">("web");
  const [toNumber, setToNumber] = useState("");
  const [meetingDialIn, setMeetingDialIn] = useState("");
  const [meetingPin, setMeetingPin] = useState("");
  const isWebCall = callType === "web";
  const isMeetingType = callType !== "phone" && callType !== "web";

  // Voice selection
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [selectedVoiceName, setSelectedVoiceName] = useState("");

  // Conversation params
  const [tone, setTone] = useState<"professional" | "casual" | "friendly" | "formal" | "empathetic">("professional");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [personality, setPersonality] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [responsiveness, setResponsiveness] = useState(0.9);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState(0.9);
  const [voiceTemperature, setVoiceTemperature] = useState(1.0);

  // LLM
  const [promptUseCase, setPromptUseCase] = useState("");
  const [scriptTopic, setScriptTopic] = useState("");
  const [generatedScript, setGeneratedScript] = useState<{ speaker: string; text: string }[]>([]);

  // Data
  const { data: savedVoices = [] } = trpc.voices.listSaved.useQuery(undefined, { enabled: isAuthenticated });

  // Clean up web call on unmount
  

  const stopMutation = trpc.calls.stop.useMutation();

  const stopWebCall = (userInitiated = true) => {
    directVoice.stop();
    const callId = activeCallIdRef.current;
    if (callId) {
      stopMutation.mutate({ callId });
    }
    setLiveKitToken("");
    setAgentTalking(false);
    setActiveCallId(null);
    activeCallIdRef.current = null;

    if (userInitiated) {
      setWebCallStatus("ended");
      setTimeout(() => {
        setWebCallStatus("idle");
        navigate("/calls");
      }, 1500);
    } else {
      // Connection dropped — stay on Call Studio, show error
      setWebCallStatus("idle");
      toast.error("Call disconnected. Check your connection and try again.");
    }
  };

  const initiateMutation = trpc.calls.initiate.useMutation({
    onSuccess: async (data) => {
      if (data.callType === "web" && data.accessToken) {
        setActiveCallId(data.callId);
        activeCallIdRef.current = data.callId;
        setWebCallStatus("connecting");
        setLiveKitToken(data.accessToken);
        toast.success("Web call connecting...");
      } else {
        toast.success("Call initiated successfully!");
        navigate("/calls");
      }
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const suggestPromptMutation = trpc.llm.suggestPrompt.useMutation({
    onSuccess: (data: { prompt: string }) => {
      setSystemPrompt(data.prompt);
      toast.success("System prompt generated!");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const generateScriptMutation = trpc.llm.generateScript.useMutation({
    onSuccess: (data: { script: string }) => {
      // Parse the raw script text into speaker/text pairs
      const lines = data.script.split("\n").filter(Boolean);
      const parsed = lines.map((line) => {
        const match = line.match(/^(AI|Human|User|Caller):\s*(.+)$/i);
        if (match) return { speaker: match[1] === "AI" ? "AI" : "Human", text: match[2] };
        return { speaker: "AI", text: line };
      });
      setGeneratedScript(parsed);
      toast.success("Conversation script generated!");
    },
    onError: (e) => toast.error(e.message),
  });

  // Voice list from saved library
  const allVoices = (savedVoices as Array<{ id: number; retellVoiceId: string; name: string; category: string }>).map(
    (v) => ({ rowId: v.id, id: v.retellVoiceId, name: v.name, badge: v.category })
  );

  const callTypeConfig = CALL_TYPES.find((t) => t.value === callType)!;

  const handleMeetingLinkChange = (value: string) => {
    setToNumber(value);
    if (value.includes("meet.google.com")) setCallType("meet");
    else if (value.includes("zoom.us") || value.includes("zoom.com")) setCallType("zoom");
    else if (value.includes("teams.microsoft.com") || value.includes("teams.live.com")) setCallType("teams");
  };

  const handleInitiateCall = () => {
    if (isWebCall) {
      setWebCallStatus("connecting");
      directVoice.start({
        voiceId: selectedVoiceId || "Kokoro-en",
        language,
        systemPrompt: systemPrompt || "You are a helpful, conversational voice assistant.",
        onTalkingChange: (talking) => setAgentTalking(talking),
        onError: () => stopWebCall(false),
        onEnded: () => stopWebCall(true),
      }).then(() => {
        setWebCallStatus("active");
        toast.success("Web call connected!");
      }).catch((e) => {
        toast.error(e.message || "Failed to connect");
        stopWebCall(false);
      });
      return;
    }
    if (isMeetingType) {
      if (!meetingDialIn.trim()) { toast.error("Please enter the meeting dial-in phone number"); return; }
      if (!meetingPin.trim()) { toast.error("Please enter the meeting PIN"); return; }
    } else if (!isWebCall) {
      if (!toNumber.trim()) { toast.error("Please enter a phone number"); return; }
    }
    if (!selectedVoiceId) { toast.error("Please select a voice from your library"); return; }

    const effectiveNumber = isMeetingType ? meetingDialIn : toNumber;

    initiateMutation.mutate({
      toNumber: effectiveNumber,
      callType,
      meetingPin: isMeetingType ? meetingPin : undefined,
      meetingLink: isMeetingType ? toNumber : undefined,
      voiceId: selectedVoiceId,
      voiceName: selectedVoiceName,
      tone,
      language,
      systemPrompt: systemPrompt || undefined,
      personality: personality || undefined,
      voiceSpeed,
      responsiveness,
      interruptionSensitivity,
      voiceTemperature,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <Phone className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Sign in to access Call Studio</h2>
        <Button onClick={() => (window.location.reload())}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto">
      
      {webCallStatus !== "idle" && (
        <WebCallOverlay
          status={webCallStatus}
          agentTalking={agentTalking}
          onStop={() => stopWebCall(true)}
        />
      )}

      {/* Header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-foreground">Call Studio</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure and initiate AI-powered voice calls via Retell AI
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ─── Left column: Call target + Voice + Initiate ─────────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Call Target */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-primary" />
                  Call Target
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {CALL_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setCallType(value)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                        callType === value
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>

                {isWebCall ? (
                  <div className="flex gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                    <Globe className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Web call runs directly in your browser — no phone number needed. Microphone access required.</span>
                  </div>
                ) : isMeetingType ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Meeting Link (optional)</Label>
                      <Input
                        placeholder={callTypeConfig.placeholder}
                        value={toNumber}
                        onChange={(e) => handleMeetingLinkChange(e.target.value)}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground/60">Paste a Meet/Zoom/Teams link — type auto-detected.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Dial-in Phone Number <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="+1 (xxx) xxx-xxxx"
                        value={meetingDialIn}
                        onChange={(e) => setMeetingDialIn(e.target.value)}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground/60">The phone number listed in your meeting invite.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Meeting PIN <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="123456789"
                        value={meetingPin}
                        onChange={(e) => setMeetingPin(e.target.value.replace(/[^0-9*#]/g, ""))}
                        className="text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground/60">Digits only — entered automatically after connecting.</p>
                    </div>
                    <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Find the dial-in number and PIN in your meeting invite under <strong>Join by phone</strong>.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Phone Number</Label>
                    <Input
                      placeholder="+1 (555) 000-0000"
                      value={toNumber}
                      onChange={(e) => setToNumber(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Voice Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" />
                  Voice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Select
                  value={selectedVoiceId}
                  onValueChange={(v) => {
                    setSelectedVoiceId(v);
                    const found = allVoices.find((voice) => voice.id === v);
                    setSelectedVoiceName(found?.name || "");
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select a voice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allVoices.map((v) => (
                      <SelectItem key={`voice-${v.rowId}`} value={v.id}>
                        <div className="flex items-center gap-2">
                          <span>{v.name}</span>
                          <Badge variant="secondary" className="text-xs capitalize">{v.badge}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                    {allVoices.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No voices saved. Go to Voice Library to save voices first.
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {allVoices.length === 0 && (
                  <p className="text-xs text-muted-foreground/60">
                    Save voices in the Voice Library to use them here.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Initiate Call */}
            <Button
              className="w-full gap-2 h-11 text-sm font-medium"
              onClick={handleInitiateCall}
              disabled={initiateMutation.isPending}
            >
              {initiateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />
                  {isWebCall ? "Starting Web Call..." : "Initiating Call..."}
                </>
              ) : (
                <>{isWebCall ? <Globe className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  {isWebCall ? "Start Web Call" : "Initiate Call"}
                </>
              )}
            </Button>
            <div className="flex gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
              <span>
                {isWebCall
                  ? "Web calls run in your browser with real-time interruption. The AI will stop speaking immediately when you speak."
                  : "Ensure your Retell AI API key and phone number are configured in Settings before initiating a call."}
              </span>
            </div>
          </div>

          {/* ─── Right columns: Parameters ───────────────────────────────── */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="conversation">
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="conversation" className="text-xs gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Conversation
                </TabsTrigger>
                <TabsTrigger value="voice" className="text-xs gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  Voice Params
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Tools
                </TabsTrigger>
              </TabsList>

              {/* ─── Conversation ─────────────────────────────────────────── */}
              <TabsContent value="conversation" className="space-y-4">
                {/* Tone */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-primary" />
                      Conversation Style
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Conversation Tone</Label>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {TONES.map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => setTone(value)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-xs font-medium transition-all border text-left",
                              tone === value
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Personality Traits</Label>
                      <Input
                        placeholder="e.g. 'Confident, concise, uses simple language'"
                        value={personality}
                        onChange={(e) => setPersonality(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Language */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      🌐 Language & Region
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Call Language</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">🇮🇳 Indian Languages</div>
                          {INDIAN_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              <span className="font-medium">{lang.label}</span>
                              {lang.nativeLabel && (
                                <span className="text-muted-foreground text-xs"> ({lang.nativeLabel})</span>
                              )}
                            </SelectItem>
                          ))}
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">🌍 Global Languages</div>
                          {GLOBAL_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              <span className="font-medium">{lang.label}</span>
                              {lang.nativeLabel && (
                                <span className="text-muted-foreground text-xs"> ({lang.nativeLabel})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {MULTILINGUAL_ONLY_CODES.includes(language) && (
                        <p className="text-xs text-amber-400 flex items-start gap-1.5 mt-1">
                          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          This language uses Retell's multilingual auto-detect mode. Voice quality may vary. Ensure your selected voice supports this language.
                        </p>
                      )}
                    </div>
                    {/* Indian Language Quick Presets */}
                    {LANGUAGE_MAP[language]?.isIndian && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Quick Presets for Indian Telecalling</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {INDIAN_PRESETS.filter(p => p.language === language || (language === "en-US" && p.language === "en-IN")).map((preset) => (
                            <button
                              key={preset.label}
                              onClick={() => {
                                setLanguage(preset.language);
                                setTone(preset.tone);
                                setSystemPrompt(preset.prompt);
                              }}
                              className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left text-xs transition-all border bg-muted/50 text-muted-foreground border-transparent hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                            >
                              <span className="font-medium">{preset.label}</span>
                              <span className="text-xs opacity-60 capitalize">{preset.tone}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Show all Indian presets if no Indian language selected */}
                    {!LANGUAGE_MAP[language]?.isIndian && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Indian Telecalling Presets</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {INDIAN_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              onClick={() => {
                                setLanguage(preset.language);
                                setTone(preset.tone);
                                setSystemPrompt(preset.prompt);
                              }}
                              className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left text-xs transition-all border bg-muted/50 text-muted-foreground border-transparent hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                            >
                              <span className="font-medium">{preset.label}</span>
                              <span className="text-xs opacity-60">{LANGUAGE_MAP[preset.language]?.label} · {preset.tone}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ─── System Prompt Card ─────────────────────────────────── */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">System Prompt</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Define how the AI should behave during the call. e.g. 'You are a professional sales representative for Acme Corp...'"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={5}
                      className="text-sm resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Use case (e.g. 'sales demo call')"
                        value={promptUseCase}
                        onChange={(e) => setPromptUseCase(e.target.value)}
                        className="text-sm h-8 flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => suggestPromptMutation.mutate({ useCase: promptUseCase, tone, personality })}
                        disabled={suggestPromptMutation.isPending || !promptUseCase}
                        className="gap-1.5 h-8 text-xs shrink-0"
                      >
                        {suggestPromptMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        AI Suggest
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── Voice Parameters ─────────────────────────────────────── */}
              <TabsContent value="voice" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-primary" />
                      Retell AI Voice Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <SliderField
                      label="Voice Temperature"
                      value={voiceTemperature}
                      onChange={setVoiceTemperature}
                      min={0}
                      max={2}
                      step={0.05}
                      format={(v) => v.toFixed(2)}
                    />
                    <SliderField
                      label="Voice Speed"
                      value={voiceSpeed}
                      onChange={setVoiceSpeed}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      format={(v) => `${v.toFixed(1)}x`}
                    />
                    <SliderField
                      label="Responsiveness"
                      value={responsiveness}
                      onChange={setResponsiveness}
                      min={0}
                      max={1}
                      step={0.05}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />
                    <SliderField
                      label="Interruption Sensitivity"
                      value={interruptionSensitivity}
                      onChange={setInterruptionSensitivity}
                      min={0}
                      max={1}
                      step={0.05}
                      format={(v) => `${Math.round(v * 100)}%`}
                    />
                    <div className="flex gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                      <span>Higher interruption sensitivity means the AI stops speaking more easily when you speak. Set to 100% for maximum responsiveness.</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── AI Tools ─────────────────────────────────────────────── */}
              <TabsContent value="ai" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Conversation Script Generator
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Generate a sample conversation script to preview how the AI will interact during the call.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Topic (e.g. 'product onboarding')"
                        value={scriptTopic}
                        onChange={(e) => setScriptTopic(e.target.value)}
                        className="text-sm h-8 flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateScriptMutation.mutate({ scenario: scriptTopic, tone, turns: 6 })}
                        disabled={generateScriptMutation.isPending || !scriptTopic}
                        className="gap-1.5 h-8 text-xs shrink-0"
                      >
                        {generateScriptMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        Generate
                      </Button>
                    </div>

                    {generatedScript.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-auto rounded-lg border border-border p-3">
                        {generatedScript.map((line, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex gap-2 text-xs",
                              line.speaker === "AI" ? "flex-row" : "flex-row-reverse"
                            )}
                          >
                            <span
                              className={cn(
                                "shrink-0 px-1.5 py-0.5 rounded text-xs font-medium",
                                line.speaker === "AI"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {line.speaker}
                            </span>
                            <p className="text-muted-foreground leading-relaxed">{line.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      Quick Presets
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Sales Demo", prompt: "You are a professional sales representative. Introduce the product, highlight key benefits, and guide the prospect toward scheduling a demo.", tone: "professional" as const },
                        { label: "Customer Support", prompt: "You are a helpful customer support agent. Listen carefully, empathize with the customer's issue, and provide clear solutions.", tone: "empathetic" as const },
                        { label: "Interview Prep", prompt: "You are an experienced interviewer conducting a technical interview. Ask relevant questions, listen to answers, and provide constructive feedback.", tone: "formal" as const },
                        { label: "Casual Chat", prompt: "You are a friendly conversationalist. Keep the conversation light, engaging, and fun. Ask open-ended questions and share interesting perspectives.", tone: "casual" as const },
                      ].map(({ label, prompt, tone: presetTone }) => (
                        <button
                          key={label}
                          onClick={() => {
                            setSystemPrompt(prompt);
                            setTone(presetTone);
                            toast.success(`"${label}" preset applied`);
                          }}
                          className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-left bg-muted/50 hover:bg-muted border border-transparent hover:border-border transition-all"
                        >
                          <span>{label}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
