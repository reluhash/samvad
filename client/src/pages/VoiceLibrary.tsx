import { useState, useRef } from "react";
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
  Trash2,
  Volume2,
  User,
  Sparkles,
  BookmarkPlus,
  Check,
  AudioLines,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type VoiceProfile = {
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
  voiceId?: string;
  retellVoiceId?: string;
  name: string;
  description?: string | null;
  provider?: string | null;
  gender?: string | null;
  accent?: string | null;
  age?: string | null;
  category: "premade" | "cloned" | "generated";
  previewUrl?: string | null;
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
  voice: VoiceProfile;
  isSaved: boolean;
  onSave: (v: VoiceProfile) => void;
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
  const effectiveId = voice.voiceId || voice.retellVoiceId || String(voice.id);
  const isPlaying = playingId === effectiveId;

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
                onClick={() => onPlay(voice.previewUrl!, effectiveId)}
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
  const [cloneAudioFile, setCloneAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: premadeVoices = [], isLoading: loadingPremade } = trpc.voices.listPremade.useQuery();
  const { data: savedVoices = [], isLoading: loadingSaved, refetch: refetchSaved } = trpc.voices.listSaved.useQuery();

  const saveMutation = trpc.voices.save.useMutation({
    onSuccess: (data) => {
      if (data.alreadyExists) {
        toast.info("Voice is already in your library");
      } else {
        toast.success("Voice saved to library");
        refetchSaved();
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.voices.remove.useMutation({
    onSuccess: () => {
      toast.success("Voice removed from library");
      refetchSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAllClonedMutation = trpc.voices.deleteAllCloned.useMutation({
    onSuccess: () => {
      toast.success("All cloned voices deleted");
      refetchSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  const cloneMutation = trpc.voices.clone.useMutation({
    onSuccess: (data) => {
      toast.success(`Voice "${data.voice_name}" cloned and ready!`);
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
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => toast.error("Unable to play audio sample"));
    setPlayingId(id);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started. Speak clearly for 5-10 seconds.");
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Recording captured!");
    }
  };

  const handleCloneSubmit = async () => {
    if (!cloneName.trim()) {
      toast.error("Please enter a voice profile name");
      return;
    }
    let fileToUpload: File | Blob | null = cloneAudioFile || recordedBlob;
    if (!fileToUpload) {
      toast.error("Please record audio or upload a sample file");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      if (fileToUpload instanceof File) {
        formData.append("file", fileToUpload);
      } else {
        formData.append("file", fileToUpload, "recording.webm");
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Audio upload failed");
      const { url } = await res.json();

      await cloneMutation.mutateAsync({
        name: cloneName.trim(),
        audioUrl: url,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to clone voice");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredPremade = premadeVoices.filter((v: VoiceProfile) =>
    v.voice_name.toLowerCase().includes(search.toLowerCase()) ||
    v.accent.toLowerCase().includes(search.toLowerCase()) ||
    v.gender.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col overflow-auto bg-background p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-primary" />
            Voice Library & Zero-Shot Cloning
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI4Bharat IndicF5 (Indian multilingual) and Kokoro (English) voice profiles
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteAllClonedMutation.mutate()}
            disabled={deleteAllClonedMutation.isPending}
            className="text-xs text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete All Clones
          </Button>
          <Button
            size="sm"
            onClick={() => setCloneDialogOpen(true)}
            className="text-xs gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Clone New Voice
          </Button>
        </div>
      </div>

      <Tabs defaultValue="catalog" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="catalog" className="text-xs">Premade Catalog ({premadeVoices.length})</TabsTrigger>
          <TabsTrigger value="saved" className="text-xs">My Saved Voices ({savedVoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search voices by name, accent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {loadingPremade ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPremade.map((v: VoiceProfile) => {
                const isSaved = savedVoices.some((s) => (s.voiceId || s.retellVoiceId) === v.voice_id);
                return (
                  <VoiceCard
                    key={v.voice_id}
                    voice={v}
                    isSaved={isSaved}
                    onSave={() =>
                      saveMutation.mutate({
                        voiceId: v.voice_id,
                        name: v.voice_name,
                        provider: v.provider,
                        gender: v.gender,
                        accent: v.accent,
                        age: v.age,
                        category: "premade",
                        previewUrl: v.preview_audio_url,
                      })
                    }
                    onPlay={handlePlay}
                    playingId={playingId}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          {loadingSaved ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : savedVoices.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No saved voices found. Clone a voice or save one from the catalog!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedVoices.map((v) => (
                <SavedVoiceCard
                  key={v.id}
                  voice={v}
                  onRemove={() => removeMutation.mutate({ id: v.id, voiceId: v.voiceId || v.retellVoiceId })}
                  onPlay={handlePlay}
                  playingId={playingId}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Clone Voice Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Zero-Shot Voice Cloning (IndicF5)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload a 5–10s audio clip or record with your microphone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Voice Profile Name</Label>
              <Input
                placeholder="e.g. Bipul Voice Clone"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Record Reference Audio (5–10s)</Label>
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleStopRecording}
                    className="text-xs gap-1.5 animate-pulse"
                  >
                    <Mic className="w-3.5 h-3.5" /> Stop Recording
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleStartRecording}
                    className="text-xs gap-1.5"
                  >
                    <Mic className="w-3.5 h-3.5" /> Start Mic Recording
                  </Button>
                )}
                {recordedBlob && <Badge variant="secondary" className="text-xs">Audio Captured</Badge>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Or Upload Audio File (.wav, .mp3, .m4a)</Label>
              <Input
                type="file"
                accept="audio/*"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files?.[0]) setCloneAudioFile(e.target.files[0]);
                }}
                className="text-xs h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleCloneSubmit}
              disabled={isUploading || cloneMutation.isPending}
              className="text-xs gap-2"
            >
              {isUploading || cloneMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Cloning Voice...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Clone & Register Voice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

