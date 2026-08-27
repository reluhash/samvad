import { useState, useRef } from "react";
import { LANGUAGE_MAP, INDIAN_LANGUAGES } from "@shared/languages";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Mic,
  Upload,
  Play,
  Pause,
  Loader2,
  Search,
  Star,
  Trash2,
  Plus,
  Volume2,
  User,
  Sparkles,
  BookmarkPlus,
  Check,
  AudioLines,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RetellVoice = {
  voice_id: string;
  voice_name: string;
  provider: string;
  accent: string;
  gender: string;
  age: string;
  avatar_url?: string;
  preview_audio_url?: string;
};

type SavedVoice = {
  id: number;
  retellVoiceId: string;
  name: string;
  description: string | null;
  provider: string | null;
  gender: string | null;
  accent: string | null;
  age: string | null;
  category: "premade" | "cloned" | "generated";
  previewUrl: string | null;
};

// ─── Voice Card (Browse) ──────────────────────────────────────────────────────

function VoiceCard({
  voice,
  isSaved,
  onSave,
  onRemove,
  onPlay,
  playingId,
}: {
  voice: RetellVoice;
  isSaved: boolean;
  onSave: (v: RetellVoice) => void;
  onRemove?: () => void;
  onPlay: (url: string, id: string) => void;
  playingId: string | null;
}) {
  const isPlaying = playingId === voice.voice_id;

  return (
    <Card className="group border-border/40 bg-card/50 hover:border-primary/30 hover:bg-card/80 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {voice.avatar_url ? (
              <img src={voice.avatar_url} alt={voice.voice_name} className="w-full h-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{voice.voice_name}</span>
              {voice.gender && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 capitalize">{voice.gender}</Badge>
              )}
              {voice.accent && voice.accent !== "Unknown" && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-border/50">{voice.accent}</Badge>
              )}
              {/* Indian language badge */}
              {voice.accent && ["Indian", "Hindi", "Tamil", "Telugu", "Kannada", "Bengali", "Marathi", "Gujarati", "Malayalam", "Punjabi"].some(a => voice.accent?.toLowerCase().includes(a.toLowerCase())) && (
                <Badge className="text-xs px-1.5 py-0 bg-orange-500/20 text-orange-400 border-orange-400/30 border">🇮🇳 Indian</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              {voice.age && voice.age !== "Unknown" && (
                <span className="text-xs text-muted-foreground capitalize">{voice.age}</span>
              )}
              {voice.provider && (
                <span className="text-xs text-muted-foreground capitalize">{voice.provider}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {voice.preview_audio_url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onPlay(voice.preview_audio_url!, voice.voice_id)}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            )}
            {isSaved ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-400 hover:text-destructive"
                onClick={onRemove}
                title="Remove from library"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => onSave(voice)}
                title="Save to library"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Saved Voice Card ─────────────────────────────────────────────────────────

function SavedVoiceCard({
  voice,
  onRemove,
  onPlay,
  playingId,
}: {
  voice: SavedVoice;
  onRemove: () => void;
  onPlay: (url: string, id: string) => void;
  playingId: string | null;
}) {
  const isPlaying = playingId === voice.retellVoiceId;
  return (
    <Card className="border-border/40 bg-card/50 hover:border-primary/30 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {voice.category === "cloned" ? (
              <AudioLines className="h-5 w-5 text-primary" />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{voice.name}</span>
              <Badge
                variant={voice.category === "cloned" ? "default" : "secondary"}
                className="text-xs px-1.5 py-0 capitalize"
              >
                {voice.category}
              </Badge>
              {voice.gender && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-border/50 capitalize">
                  {voice.gender}
                </Badge>
              )}
            </div>
            {voice.accent && (
              <span className="text-xs text-muted-foreground capitalize">{voice.accent}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {voice.previewUrl && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onPlay(voice.previewUrl!, voice.retellVoiceId)}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VoiceLibrary() {
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneProvider, setCloneProvider] = useState<"elevenlabs" | "cartesia">("elevenlabs");
  const [cloneAudioFile, setCloneAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: retellVoices, isLoading: loadingRetell } = trpc.voices.listRetell.useQuery();
  const { data: savedVoices, isLoading: loadingSaved, refetch: refetchSaved } = trpc.voices.listSaved.useQuery();

  const saveMutation = trpc.voices.save.useMutation({
    onSuccess: (data) => {
      if (data.alreadyExists) {
        toast.info("Voice is already in your library");
      } else {
        toast.success("Voice saved to library");
      }
      refetchSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.voices.remove.useMutation({
    onSuccess: () => { toast.success("Voice removed from library"); refetchSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const cloneMutation = trpc.voices.clone.useMutation({
    onSuccess: () => {
      toast.success("Voice cloned and added to your library!");
      setCloneDialogOpen(false);
      setCloneName("");
      setCloneAudioFile(null);
      setRecordedBlob(null);
      refetchSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePlay = (url: string, id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingId(id);
    audio.onended = () => setPlayingId(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        setRecordedBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleClone = async () => {
    if (!cloneName.trim()) return toast.error("Please enter a voice name.");
    const audioSource = cloneAudioFile || (recordedBlob ? new File([recordedBlob], "recording.webm", { type: "audio/webm" }) : null);
    if (!audioSource) return toast.error("Please upload or record an audio sample.");

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", audioSource);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        throw new Error("Audio upload failed");
      }
      const data = await res.json();
      
      cloneMutation.mutate({
        audioUrl: data.url,
        storageKey: data.key,
        voiceName: cloneName.trim(),
        provider: "local" as any,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const [languageFilter, setLanguageFilter] = useState<"all" | "indian" | "english">("all");
  const voices = (retellVoices as RetellVoice[] | undefined) ?? [];
  const INDIAN_ACCENTS = ["indian", "hindi", "tamil", "telugu", "kannada", "bengali", "marathi", "gujarati", "malayalam", "punjabi"];
  const filteredVoices = voices.filter((v) => {
    const matchesSearch =
      v.voice_name.toLowerCase().includes(search.toLowerCase()) ||
      v.accent?.toLowerCase().includes(search.toLowerCase()) ||
      v.gender?.toLowerCase().includes(search.toLowerCase());
    const isIndianVoice = INDIAN_ACCENTS.some(a => v.accent?.toLowerCase().includes(a));
    const matchesLanguage =
      languageFilter === "all" ||
      (languageFilter === "indian" && isIndianVoice) ||
      (languageFilter === "english" && !isIndianVoice);
    return matchesSearch && matchesLanguage;
  });
  const savedVoiceIds = new Set((savedVoices ?? []).map((v) => v.retellVoiceId));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <audio ref={audioRef} className="hidden" />

      {/* Header */}
      <div className="px-6 py-5 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Voice Library</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Browse voices and manage your local cloned voice collection
            </p>
          </div>
          <Button onClick={() => setCloneDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Clone Voice
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="browse" className="h-full flex flex-col">
          <div className="flex items-center gap-4 mb-4 shrink-0">
            <TabsList className="bg-muted/40">
              <TabsTrigger value="browse" className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Browse Voices
                {voices.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{voices.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-2">
                <Star className="h-3.5 w-3.5" />
                My Library
                {(savedVoices?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{savedVoices?.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search voices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
            {/* Language filter buttons */}
            <div className="flex items-center gap-1.5">
              {(["all", "indian", "english"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLanguageFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                    languageFilter === f
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:border-border"
                  }`}
                >
                  {f === "all" ? "All" : f === "indian" ? "🇮🇳 Indian" : "🌍 Global"}
                </button>
              ))}
            </div>
          </div>

          <TabsContent value="browse" className="flex-1 overflow-auto mt-0">
            {loadingRetell ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredVoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <Volume2 className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">
                  {search ? "No voices match your search." : "No premade voices available."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredVoices.map((voice) => (
                  <VoiceCard
                    key={voice.voice_id}
                    voice={voice}
                    isSaved={savedVoiceIds.has(voice.voice_id)}
                    onSave={(v) =>
                      saveMutation.mutate({
                        retellVoiceId: v.voice_id,
                        name: v.voice_name,
                        provider: v.provider,
                        gender: v.gender,
                        accent: v.accent,
                        age: v.age,
                        category: "premade",
                        previewUrl: v.preview_audio_url,
                      })
                    }
                    onRemove={() => {
                      const saved = (savedVoices ?? []).find((s) => s.retellVoiceId === voice.voice_id);
                      if (saved) removeMutation.mutate({ id: saved.id });
                    }}
                    onPlay={handlePlay}
                    playingId={playingId}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="flex-1 overflow-auto mt-0">
            {loadingSaved ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (savedVoices ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <Star className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Your library is empty.</p>
                <p className="text-xs text-muted-foreground/60">
                  Browse voices and bookmark them, or clone your own voice.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(savedVoices ?? []).map((voice) => (
                  <SavedVoiceCard
                    key={voice.id}
                    voice={voice as SavedVoice}
                    onRemove={() => removeMutation.mutate({ id: voice.id })}
                    onPlay={handlePlay}
                    playingId={playingId}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Clone Voice Dialog ─────────────────────────────────────────────── */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AudioLines className="h-5 w-5 text-primary" />
              Clone a Voice
            </DialogTitle>
            <DialogDescription>
              Upload or record a 10-second audio sample to create a local cloned voice profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Voice Name</Label>
              <Input
                placeholder="e.g. My Voice, Sales Rep, Support Agent"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 hidden">
              <Label className="text-xs text-muted-foreground">Voice Provider</Label>
              <div className="flex gap-2">
                {(["elevenlabs", "cartesia"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCloneProvider(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all border ${
                      cloneProvider === p
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background/50 text-muted-foreground border-border/50 hover:border-primary/50"
                    }`}
                  >
                    {p === "elevenlabs" ? "ElevenLabs" : "Cartesia"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Audio Sample</Label>
              <div
                className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {cloneAudioFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Volume2 className="h-4 w-4 text-primary" />
                    <span className="font-medium truncate max-w-[200px]">{cloneAudioFile.name}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Click to upload audio file</p>
                    <p className="text-xs text-muted-foreground/60">MP3, WAV, M4A, WEBM supported</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setCloneAudioFile(f); setRecordedBlob(null); }
                  }}
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or record</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="sm"
                onClick={isRecording ? stopRecording : startRecording}
                className="gap-2 flex-1"
              >
                <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
                {isRecording ? "Stop Recording" : "Start Recording"}
              </Button>
              {recordedBlob && !cloneAudioFile && (
                <Badge variant="secondary" className="gap-1 text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                  <Check className="h-3 w-3" /> Recorded
                </Badge>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleClone}
              disabled={cloneMutation.isPending || isUploading || (!cloneAudioFile && !recordedBlob)}
              className="gap-2"
            >
              {(cloneMutation.isPending || isUploading) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Clone Voice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
