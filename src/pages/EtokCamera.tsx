import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, RotateCcw, Zap, ZapOff, Timer, Gauge, Music, Mic, Type, Sticker, Scissors, Wand2, CheckCircle2, ChevronDown, Hash, AtSign, Image, Video, CameraOff, AlertCircle, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadVideoAsync as uploadVideo, fetchAllSounds, type EtokSound } from "@/lib/etokService";

type Stage = "record" | "preview" | "edit" | "post";
type VideoPrivacy = "everyone" | "friends" | "only_me";

const DURATIONS = [
  { label: "15s", value: 15 },
  { label: "60s", value: 60 },
  { label: "3 min", value: 180 },
  { label: "10 min", value: 600 },
];

const SPEEDS = [
  { label: "0.3x", value: 0.3 },
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "2x", value: 2 },
  { label: "3x", value: 3 },
];

const EFFECTS = [
  { emoji: "✨", label: "Beauty", css: "brightness(1.1) contrast(0.9)" },
  { emoji: "🎨", label: "Vintage", css: "sepia(0.6)" },
  { emoji: "🌈", label: "Rainbow", css: "hue-rotate(180deg) saturate(2)" },
  { emoji: "⚡", label: "Vivid", css: "saturate(1.8) contrast(1.1)" },
  { emoji: "🌙", label: "Dark", css: "brightness(0.7) contrast(1.2)" },
  { emoji: "👻", label: "Ghost", css: "opacity(0.8) grayscale(0.5)" },
];

const VOICE_EFFECTS = ["Normal", "Robot 🤖", "Mic 🎤", "Echo 🔊", "Chipmunk 🐿️", "Deep 🗣️"];
const TEXT_FONTS = ["Normal", "Bold", "Italic", "Neon", "Typewriter", "Classic"];
const STICKER_TYPES = [
  { emoji: "❓", label: "Q&A" },
  { emoji: "📊", label: "Poll" },
  { emoji: "⏰", label: "Countdown" },
  { emoji: "🕐", label: "Timer" },
  { emoji: "📍", label: "Location" },
  { emoji: "🌡️", label: "Temperature" },
];

const THUMBNAIL_EMOJIS = ["🕺", "💃", "🎵", "😂", "🍗", "✈️", "💪", "🎨", "👗", "🏔️", "🌹", "🐉"];
const BG_COLORS = [
  "from-purple-900 to-pink-900", "from-blue-900 to-cyan-900",
  "from-green-900 to-teal-900", "from-orange-900 to-red-900",
  "from-indigo-900 to-purple-900", "from-rose-900 to-orange-900",
];

const EtokCamera = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";

  const [stage, setStage] = useState<Stage>("record");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [selectedSpeed, setSelectedSpeed] = useState(1);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [timerSetting, setTimerSetting] = useState<0 | 3 | 10>(0);
  const [countdown, setCountdown] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [showEffects, setShowEffects] = useState(false);
  const [showSpeeds, setShowSpeeds] = useState(false);
  const [showSounds, setShowSounds] = useState(false);
  const [showVoiceEffects, setShowVoiceEffects] = useState(false);
  const [showTextAdd, setShowTextAdd] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [selectedSound, setSelectedSound] = useState<EtokSound | null>(null);
  const [selectedVoiceEffect, setSelectedVoiceEffect] = useState("Normal");
  const [addedTexts, setAddedTexts] = useState<string[]>([]);
  const [textInput, setTextInput] = useState("");
  const [selectedFont, setSelectedFont] = useState("Normal");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<VideoPrivacy>("everyone");
  const [allowComments, setAllowComments] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [thumbnailEmoji, setThumbnailEmoji] = useState(THUMBNAIL_EMOJIS[0]);
  const [thumbnailColor, setThumbnailColor] = useState(BG_COLORS[0]);

  const cameraRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleGalleryPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please choose a video file"); return; }
    const MAX = 200 * 1024 * 1024;
    if (file.size > MAX) { toast.error("Video too large (max 200MB)"); return; }
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    const url = URL.createObjectURL(file);
    setRecordedBlob(file);
    setRecordedUrl(url);
    // Probe duration
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = url;
    probe.onloadedmetadata = () => {
      const d = Math.max(1, Math.min(Math.round(probe.duration || 1), 600));
      setElapsed(d);
    };
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setStage("preview");
  };

  const [sounds, setSounds] = useState<EtokSound[]>([]);
  useEffect(() => { fetchAllSounds().then(setSounds); }, []);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      setCameraError(null);
      setCameraReady(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
        cameraRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setCameraError(msg.includes("denied") || msg.includes("Permission")
        ? "Camera access denied. Please allow camera access in your browser settings."
        : msg.includes("NotFound")
          ? "No camera found on this device."
          : "Could not access camera. " + msg
      );
    }
  }, [facingMode]);

  useEffect(() => {
    if (stage === "record") {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [stage, facingMode]);

  useEffect(() => {
    if (stage !== "record" && streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [stage]);

  useEffect(() => {
    if (stage === "preview" && previewRef.current && recordedUrl) {
      previewRef.current.src = recordedUrl;
    }
  }, [stage, recordedUrl]);

  const effectCss = EFFECTS.find(e => e.label === selectedEffect)?.css ?? "none";

  const beginActualRecording = () => {
    const stream = streamRef.current;
    if (!stream) { toast.error("Camera not ready"); return; }

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
      const emoji = THUMBNAIL_EMOJIS[Math.floor(Math.random() * THUMBNAIL_EMOJIS.length)];
      const color = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
      setThumbnailEmoji(emoji);
      setThumbnailColor(color);
      setStage("preview");
    };

    recorder.start(100);
    setRecording(true);
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 0.1;
        if (next >= selectedDuration) {
          stopRecording();
          return selectedDuration;
        }
        return next;
      });
    }, 100);
  };

  const startRecording = () => {
    if (timerSetting > 0) {
      setCountdown(timerSetting);
      let count = timerSetting;
      countdownRef.current = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(countdownRef.current);
          beginActualRecording();
        }
      }, 1000);
    } else {
      beginActualRecording();
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const handlePost = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to post a video");
      navigate("/auth");
      return;
    }
    if (!recordedBlob || recordedBlob.size === 0) {
      toast.error("Record a video before posting");
      return;
    }
    if (!description.trim()) {
      toast.error("Please add a description");
      return;
    }
    setPosting(true);
    setUploadProgress(0);
    try {
      const hashtags = description.match(/#(\w+)/g)?.map(h => h.slice(1)) ?? [];
      const postedVideo = await uploadVideo(
        recordedBlob,
        {
          authorId: currentUserId,
          description,
          hashtags,
          soundName: selectedSound?.title ?? "Original Sound",
          duration: Math.max(1, Math.round(elapsed)),
          privacy,
          allowComments,
          allowDuet,
          allowStitch,
          allowDownload,
        },
        (pct) => setUploadProgress(pct)
      );
      if (!postedVideo) {
        throw new Error("Video was not saved");
      }
      toast.success("Video posted!");
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      navigate(`/etok?video=${postedVideo.id}`, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post video";
      toast.error(message);
    } finally {
      setPosting(false);
    }
  };

  const progressPct = elapsed / selectedDuration;
  const circumference = 2 * Math.PI * 34;

  if (stage === "record") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        {/* Camera preview or error */}
        <div className="absolute inset-0">
          {cameraError ? (
            <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center gap-4 px-8">
              <CameraOff className="h-16 w-16 text-white/40" />
              <p className="text-white/60 text-center text-sm leading-relaxed">{cameraError}</p>
              <Button onClick={startCamera} variant="outline" size="sm" className="text-white border-white/30">
                Try Again
              </Button>
            </div>
          ) : (
            <video
              ref={cameraRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
                filter: effectCss,
              }}
            />
          )}
          {/* Dark vignette */}
          {!cameraError && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />}
        </div>

        {/* REC indicator */}
        {recording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600/90 backdrop-blur px-3 py-1 rounded-full z-20"
          >
            <motion.div
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-white"
            />
            <span className="text-white text-xs font-bold">
              {Math.floor(elapsed)}s / {selectedDuration}s
            </span>
          </motion.div>
        )}

        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown > 0 && (
            <motion.div
              key={countdown}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center z-30"
            >
              <span className="text-white text-[120px] font-black drop-shadow-2xl">{countdown}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-4 z-20">
          <button onClick={() => navigate(-1)} data-testid="button-close-camera">
            <X className="h-7 w-7 text-white drop-shadow" />
          </button>
          <div className="flex items-center gap-4">
            <button onClick={() => setFlashOn(!flashOn)}>
              {flashOn
                ? <Zap className="h-6 w-6 text-yellow-400" />
                : <ZapOff className="h-6 w-6 text-white" />
              }
            </button>
            <button onClick={() => setTimerSetting(timerSetting === 0 ? 3 : timerSetting === 3 ? 10 : 0)}>
              <div className="flex flex-col items-center">
                <Timer className={cn("h-6 w-6", timerSetting > 0 ? "text-yellow-400" : "text-white")} />
                {timerSetting > 0 && <span className="text-yellow-400 text-[9px] font-bold">{timerSetting}s</span>}
              </div>
            </button>
          </div>
        </div>

        {/* Duration selector */}
        <div className="absolute top-24 left-0 right-0 flex justify-center gap-2 z-20">
          {DURATIONS.map(d => (
            <button
              key={d.value}
              onClick={() => setSelectedDuration(d.value)}
              className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-colors", selectedDuration === d.value ? "bg-white text-black border-white" : "text-white border-white/40 bg-black/20")}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="absolute top-36 left-0 right-0 flex justify-center gap-4 z-20">
          <span className="text-white text-xs font-semibold">Video</span>
          <span className="text-white/30">|</span>
          <button className="text-white/50 text-xs">Photo Slideshow</button>
        </div>

        {/* Right sidebar */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-5 z-20">
          <button onClick={() => setShowSpeeds(!showSpeeds)} className="flex flex-col items-center gap-0.5">
            <Gauge className="h-6 w-6 text-white" />
            <span className="text-white text-[10px]">{selectedSpeed}x</span>
          </button>
          <button onClick={() => setShowEffects(!showEffects)} className="flex flex-col items-center gap-0.5">
            <Wand2 className={cn("h-6 w-6", selectedEffect ? "text-yellow-400" : "text-white")} />
            <span className={cn("text-[10px]", selectedEffect ? "text-yellow-400" : "text-white")}>Effects</span>
          </button>
          <button
            onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")}
            className="flex flex-col items-center gap-0.5"
          >
            <RotateCcw className="h-6 w-6 text-white" />
            <span className="text-white text-[10px]">Flip</span>
          </button>
        </div>

        {/* Speed selector */}
        <AnimatePresence>
          {showSpeeds && (
            <motion.div
              initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
              className="absolute right-16 top-1/2 -translate-y-1/2 bg-black/80 backdrop-blur rounded-2xl p-3 flex flex-col gap-2 z-30"
            >
              {SPEEDS.map(s => (
                <button
                  key={s.value}
                  onClick={() => { setSelectedSpeed(s.value); setShowSpeeds(false); }}
                  className={cn("text-sm font-semibold px-3 py-1 rounded-full transition-colors", selectedSpeed === s.value ? "bg-white text-black" : "text-white")}
                >
                  {s.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Effects picker */}
        <AnimatePresence>
          {showEffects && (
            <motion.div
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
              className="absolute bottom-40 left-4 right-4 bg-black/85 backdrop-blur rounded-2xl p-4 z-30"
            >
              <h3 className="text-white text-sm font-bold mb-3">Filters & Effects</h3>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => { setSelectedEffect(null); setShowEffects(false); }}
                  className={cn("flex flex-col items-center gap-1 p-3 rounded-xl border", !selectedEffect ? "bg-white/20 border-white" : "bg-white/5 border-transparent")}
                >
                  <span className="text-2xl">🚫</span>
                  <span className="text-white text-xs">None</span>
                </button>
                {EFFECTS.map(e => (
                  <button
                    key={e.label}
                    onClick={() => { setSelectedEffect(selectedEffect === e.label ? null : e.label); setShowEffects(false); }}
                    className={cn("flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors", selectedEffect === e.label ? "bg-primary/40 border-primary" : "bg-white/5 border-transparent")}
                  >
                    <span className="text-2xl">{e.emoji}</span>
                    <span className="text-white text-xs">{e.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 pb-10 flex flex-col items-center gap-5 z-20">
          {/* Camera not ready indicator */}
          {!cameraReady && !cameraError && (
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Starting camera...
            </div>
          )}

          <div className="flex items-center gap-8">
            {/* Gallery: upload an existing video */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleGalleryPick}
            />
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="w-14 h-14 rounded-xl bg-white/10 border border-white/30 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Upload from gallery"
            >
              <Image className="h-6 w-6 text-white" />
            </button>

            {/* Record button with arc progress */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                {recording && (
                  <motion.circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke="#ff0050" strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progressPct)}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <button
                onPointerDown={!recording && cameraReady ? startRecording : undefined}
                onPointerUp={recording ? stopRecording : undefined}
                data-testid="button-record"
                disabled={!cameraReady && !cameraError}
                className="relative w-16 h-16 flex items-center justify-center focus:outline-none"
              >
                <motion.div
                  animate={recording ? { scale: 0.55, borderRadius: "8px" } : { scale: 1, borderRadius: "50%" }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="w-14 h-14 bg-[#ff0050]"
                />
              </button>
            </div>

            {/* Flip camera */}
            <button
              onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")}
              className="w-14 h-14 rounded-xl bg-white/10 border border-white/30 flex items-center justify-center"
            >
              <RotateCcw className="h-6 w-6 text-white" />
            </button>
          </div>

          {recording && (
            <button
              onPointerDown={stopRecording}
              className="px-8 py-2.5 bg-white/20 rounded-full text-white font-bold text-sm border border-white/30"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 pt-12 pb-3 z-20 absolute top-0 left-0 right-0">
          <button onClick={() => { setStage("record"); setRecordedBlob(null); if (recordedUrl) URL.revokeObjectURL(recordedUrl); setRecordedUrl(null); setElapsed(0); }}>
            <X className="h-7 w-7 text-white drop-shadow" />
          </button>
          <span className="text-white font-bold text-base drop-shadow">Preview</span>
          <button
            onClick={() => setStage("edit")}
            className="px-5 py-1.5 bg-[#ff0050] rounded-full text-white text-sm font-bold"
          >
            Next
          </button>
        </div>

        {recordedUrl ? (
          <video
            ref={previewRef}
            src={recordedUrl}
            autoPlay
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className={cn("absolute inset-0 bg-gradient-to-b flex items-center justify-center", thumbnailColor)}>
            <span className="text-9xl">{thumbnailEmoji}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        <div className="absolute bottom-10 left-4 right-4 flex items-center gap-3">
          <button
            onClick={() => { setStage("record"); setRecordedBlob(null); if (recordedUrl) URL.revokeObjectURL(recordedUrl); setRecordedUrl(null); setElapsed(0); }}
            className="flex-1 py-3 rounded-full border border-white/40 text-white font-semibold text-sm"
          >
            Re-record
          </button>
          <button
            onClick={() => setStage("edit")}
            className="flex-1 py-3 rounded-full bg-[#ff0050] text-white font-bold text-sm"
          >
            Use Video
          </button>
        </div>
      </div>
    );
  }

  if (stage === "edit") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-12 pb-3 flex-shrink-0">
          <button onClick={() => setStage("preview")}><X className="h-6 w-6 text-white" /></button>
          <span className="text-white font-bold">Edit Video</span>
          <button onClick={() => setStage("post")} className="px-4 py-1.5 bg-[#ff0050] rounded-full text-white text-sm font-semibold">
            Next
          </button>
        </div>

        {/* Preview thumbnail */}
        <div className="mx-4 rounded-2xl overflow-hidden h-48 relative flex-shrink-0">
          {recordedUrl ? (
            <video src={recordedUrl} muted loop autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className={cn("absolute inset-0 bg-gradient-to-b flex items-center justify-center", thumbnailColor)}>
              <span className="text-7xl">{thumbnailEmoji}</span>
            </div>
          )}
          {addedTexts.map((t, i) => (
            <div key={i} className="absolute top-4 left-0 right-0 text-center text-white font-bold text-lg drop-shadow">
              {t}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Sound */}
          <div className="bg-white/10 rounded-2xl p-4">
            <button onClick={() => setShowSounds(!showSounds)} className="flex items-center gap-3 w-full">
              <Music className="h-5 w-5 text-[#ff0050]" />
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">{selectedSound ? selectedSound.title : "Add Sound"}</p>
                {selectedSound && <p className="text-white/60 text-xs">{selectedSound.authorName}</p>}
              </div>
              <ChevronDown className="h-4 w-4 text-white/60" />
            </button>
            <AnimatePresence>
              {showSounds && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 space-y-2">
                    {sounds.map(s => (
                      <button key={s.id} onClick={() => { setSelectedSound(s); setShowSounds(false); }}
                        className={cn("flex items-center gap-3 w-full p-2 rounded-xl", selectedSound?.id === s.id ? "bg-[#ff0050]/30" : "bg-white/5")}
                      >
                        <span className="text-2xl">{s.coverEmoji}</span>
                        <div className="flex-1 text-left">
                          <p className="text-white text-sm">{s.title}</p>
                          <p className="text-white/60 text-xs">{s.authorName}</p>
                        </div>
                        {selectedSound?.id === s.id && <CheckCircle2 className="h-4 w-4 text-[#ff0050]" />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Voice effects */}
          <div className="bg-white/10 rounded-2xl p-4">
            <button onClick={() => setShowVoiceEffects(!showVoiceEffects)} className="flex items-center gap-3 w-full">
              <Mic className="h-5 w-5 text-[#ff0050]" />
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-semibold">Voice Effects</p>
                <p className="text-white/60 text-xs">{selectedVoiceEffect}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-white/60" />
            </button>
            <AnimatePresence>
              {showVoiceEffects && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 flex flex-wrap gap-2">
                    {VOICE_EFFECTS.map(ve => (
                      <button key={ve} onClick={() => { setSelectedVoiceEffect(ve); setShowVoiceEffects(false); }}
                        className={cn("px-3 py-1.5 rounded-full text-xs font-medium border", selectedVoiceEffect === ve ? "bg-[#ff0050] border-[#ff0050] text-white" : "border-white/30 text-white")}
                      >
                        {ve}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Text */}
          <div className="bg-white/10 rounded-2xl p-4">
            <button onClick={() => setShowTextAdd(!showTextAdd)} className="flex items-center gap-3 w-full">
              <Type className="h-5 w-5 text-[#ff0050]" />
              <p className="text-white text-sm font-semibold">Add Text</p>
              <ChevronDown className="h-4 w-4 text-white/60 ml-auto" />
            </button>
            <AnimatePresence>
              {showTextAdd && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {TEXT_FONTS.map(f => (
                        <button key={f} onClick={() => setSelectedFont(f)}
                          className={cn("px-2 py-1 text-xs rounded border", selectedFont === f ? "bg-[#ff0050] border-[#ff0050] text-white" : "border-white/30 text-white")}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Enter text..."
                        className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      />
                      <Button size="sm" className="bg-[#ff0050]" onClick={() => { if (textInput.trim()) { setAddedTexts(prev => [...prev, textInput]); setTextInput(""); } }}>
                        Add
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Stickers */}
          <div className="bg-white/10 rounded-2xl p-4">
            <button onClick={() => setShowStickers(!showStickers)} className="flex items-center gap-3 w-full">
              <Sticker className="h-5 w-5 text-[#ff0050]" />
              <p className="text-white text-sm font-semibold">Stickers</p>
              <ChevronDown className="h-4 w-4 text-white/60 ml-auto" />
            </button>
            <AnimatePresence>
              {showStickers && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {STICKER_TYPES.map(s => (
                      <button key={s.label} onClick={() => { toast.success(`${s.label} sticker added!`); setShowStickers(false); }}
                        className="flex flex-col items-center gap-1 p-3 bg-white/10 rounded-xl hover:bg-white/20"
                      >
                        <span className="text-2xl">{s.emoji}</span>
                        <span className="text-white text-xs">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Trim */}
          <div className="bg-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <Scissors className="h-5 w-5 text-[#ff0050]" />
              <p className="text-white text-sm font-semibold">Trim & Split</p>
              <span className="text-white/40 text-xs ml-auto">{Math.round(elapsed)}s</span>
            </div>
            <div className="mt-3 bg-white/20 rounded-full h-3 relative">
              <div className="absolute left-1/4 right-1/4 top-0 bottom-0 bg-[#ff0050] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b flex-shrink-0">
        <button onClick={() => setStage("edit")}><X className="h-6 w-6" /></button>
        <span className="font-bold text-base">Post Video</span>
        <div />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Video thumbnail preview */}
        <div className="flex gap-3 p-4 border-b">
          <div className="w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 relative">
            {recordedUrl ? (
              <video src={recordedUrl} muted className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className={cn("absolute inset-0 bg-gradient-to-b flex items-center justify-center", thumbnailColor)}>
                <span className="text-3xl">{thumbnailEmoji}</span>
              </div>
            )}
          </div>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe your video... #hashtag @mention"
            className="flex-1 border-0 bg-transparent resize-none p-0 text-sm min-h-[80px]"
            data-testid="input-video-description"
          />
        </div>

        <div className="flex gap-3 px-4 py-3 border-b">
          <button onClick={() => setDescription(d => d + " #")} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full">
            <Hash className="h-4 w-4 text-primary" />
            <span className="text-sm">Hashtag</span>
          </button>
          <button onClick={() => setDescription(d => d + " @")} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full">
            <AtSign className="h-4 w-4 text-primary" />
            <span className="text-sm">Mention</span>
          </button>
        </div>

        <div className="divide-y divide-border">
          <div className="px-4 py-3">
            <p className="text-sm font-semibold mb-2">Who can watch</p>
            <div className="flex gap-2">
              {(["everyone", "friends", "only_me"] as VideoPrivacy[]).map(p => (
                <button key={p} onClick={() => setPrivacy(p)}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-medium border transition-colors", privacy === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}
                >
                  {p === "everyone" ? "🌍 Everyone" : p === "friends" ? "👥 Friends" : "🔒 Only Me"}
                </button>
              ))}
            </div>
          </div>

          {[
            { label: "Allow Comments", icon: "💬", state: allowComments, toggle: () => setAllowComments(!allowComments) },
            { label: "Allow Duet", icon: "🤝", state: allowDuet, toggle: () => setAllowDuet(!allowDuet) },
            { label: "Allow Stitch", icon: "✂️", state: allowStitch, toggle: () => setAllowStitch(!allowStitch) },
            { label: "Allow Download", icon: "⬇️", state: allowDownload, toggle: () => setAllowDownload(!allowDownload) },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </div>
              <button onClick={item.toggle} className={cn("w-12 h-6 rounded-full transition-colors relative", item.state ? "bg-primary" : "bg-muted")}>
                <motion.div animate={{ x: item.state ? 24 : 2 }} className="absolute top-1 w-4 h-4 rounded-full bg-white" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Upload progress */}
      {posting && (
        <div className="px-4 py-2 border-t">
          <div className="flex items-center gap-2 mb-1">
            <Upload className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${uploadProgress}%` }}
              className="h-full bg-primary rounded-full"
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      <div className="p-4 pb-8 border-t flex-shrink-0">
        <Button
          className="w-full h-12 text-base font-bold"
          onClick={handlePost}
          disabled={posting || !description.trim()}
          data-testid="button-post-video"
        >
          {posting ? `Uploading ${uploadProgress}%...` : "Post Video 🚀"}
        </Button>
      </div>
    </div>
  );
};

export default EtokCamera;
