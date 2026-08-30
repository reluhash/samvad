import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Mic,
  Phone,
  LayoutDashboard,
  Sparkles,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  AudioWaveform,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Mic,
    title: "Indic Voice Cloning",
    desc: "Zero-shot voice cloning with AI4Bharat IndicF5 & Kokoro — upload 5s of audio to clone any voice.",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
  {
    icon: Phone,
    title: "Direct Phone Calls",
    desc: "Initiate live phone calls via Twilio PSTN gateway directly to mobile phones worldwide.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Zap,
    title: "Ultra Low Latency",
    desc: "Real-time bidirectional speech streaming with Silero VAD, Whisper STT, and Gemma LLM.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: Sparkles,
    title: "LLM Intelligence",
    desc: "Self-hosted Gemma 4 26B model powering natural multi-turn conversations and post-call telemetry.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Shield,
    title: "Self-Hosted & Private",
    desc: "Full local GPU inference stack on dedicated hardware. Zero dependency on third-party cloud wrappers.",
    color: "text-rose-400",
    bg: "bg-rose-400/10",
  },
  {
    icon: Globe,
    title: "11+ Indian Languages",
    desc: "Native support for Hindi, Hinglish, Tamil, Telugu, Marathi, Bengali, and global languages.",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen overflow-auto">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-[85vh] px-6 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-violet-500/5 blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-blue-500/5 blur-3xl" />
        </div>

        {/* Animated waveform decoration */}
        <div className="flex items-end gap-1 mb-8 h-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="wave-bar w-1.5 rounded-full bg-primary/40"
              style={{ height: `${20 + Math.sin(i * 0.8) * 15}px` }}
            />
          ))}
        </div>

        <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium bg-primary/10 text-primary border-primary/20">
          🇮🇳 Samvad Voice AI Platform
        </Badge>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6 max-w-3xl leading-tight">
          Clone Voices.{" "}
          <span className="text-primary">Call Anyone.</span>
          <br />
          Self-Hosted Speech AI.
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed">
          Clone voices with IndicF5, initiate live PSTN phone calls to any mobile number, and conduct dynamic two-way AI conversations.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          {!loading && (
            isAuthenticated ? (
              <>
                <Button
                  size="lg"
                  onClick={() => navigate("/studio")}
                  className="gap-2 px-6 font-medium shadow-md"
                >
                  <Phone className="w-4 h-4" />
                  Open Call Studio
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/voices")}
                  className="gap-2 px-6 font-medium"
                >
                  <Mic className="w-4 h-4" />
                  Voice Library
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                onClick={() => navigate("/studio")}
                className="gap-2 px-6 font-medium shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            )
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-8 justify-center mt-16 text-center">
          {[
            { value: "11+", label: "Indian Languages" },
            { value: "<600ms", label: "Speech Latency" },
            { value: "50+", label: "Concurrent LLM Streams" },
            { value: "Twilio", label: "Direct PSTN Calling" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-2xl font-bold text-primary">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-3">Enterprise Voice AI Stack</h2>
          <p className="text-muted-foreground">High-performance conversational speech architecture</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
            <div
              key={title}
              className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-200 group"
            >
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", bg)}>
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5 text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

