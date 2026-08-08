import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff,
  Volume2, VolumeX, Phone, Signal, Hash,
  UserPlus, MessageCircle, CameraIcon, Monitor, MonitorOff, Aperture,
  SwitchCamera, PictureInPicture2, Settings2,
} from 'lucide-react';
import { ChatAvatar } from '@/components/ui/chat-avatar';
import { useCall } from '@/contexts/CallContext';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  NetworkBadge,
  PoorConnectionWarning,
  InCallChatPanel,
  DeviceSwitcherSheet,
  useRemotePiP,
} from './CallProControls';


const formatDuration = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
};

// Animated sound-wave bars shown while in call
const SoundWave = ({ active }: { active: boolean }) => (
  <div className="flex items-center gap-[3px]" style={{ height: 24 }}>
    {[0.6, 1.0, 0.8, 1.2, 0.7, 1.0, 0.5].map((amp, i) => (
      <motion.div
        key={i}
        className="w-[3px] rounded-full bg-white/50"
        animate={active
          ? { height: [4, 6 + amp * 16, 4], opacity: [0.4, 0.9, 0.4] }
          : { height: 4, opacity: 0.25 }
        }
        transition={active
          ? { duration: 0.55 + i * 0.07, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 }
          : {}
        }
      />
    ))}
  </div>
);

// Signal strength indicator
const SignalBars = ({ state }: { state: RTCPeerConnectionState | null }) => {
  const good = state === 'connected';
  const mid  = state === 'connecting' || state === 'new';
  const bars = [1, 2, 3, 4];
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 12 }}>
      {bars.map(b => (
        <div
          key={b}
          className="w-[3px] rounded-sm"
          style={{
            height: 3 + b * 2.5,
            background: good
              ? b <= 4 ? "rgba(52,211,153,0.9)" : "rgba(255,255,255,0.2)"
              : mid
                ? b <= 2 ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.2)"
                : "rgba(248,113,113,0.9)",
          }}
        />
      ))}
    </div>
  );
};

// Control button atom
const CtrlBtn = ({
  icon: Icon, label, onPress,
  active = false, danger = false, large = false,
  disabled = false, sublabel,
}: {
  icon: React.ElementType; label: string; onPress: () => void;
  active?: boolean; danger?: boolean; large?: boolean;
  disabled?: boolean; sublabel?: string;
}) => (
  <div className="flex flex-col items-center gap-1.5">
    <motion.button
      whileTap={{ scale: 0.86 }}
      onClick={onPress}
      disabled={disabled}
      className={cn(
        "rounded-full flex items-center justify-center transition-all select-none",
        large ? "w-[70px] h-[70px]" : "w-[58px] h-[58px]",
        disabled && "opacity-35 pointer-events-none"
      )}
      style={
        danger
          ? { background: "linear-gradient(145deg, #f87171, #dc2626)", boxShadow: "0 8px 24px rgba(239,68,68,0.4)" }
          : active
            ? { background: "rgba(248,113,113,0.85)", boxShadow: "0 4px 16px rgba(248,113,113,0.3)" }
            : { background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }
      }
    >
      <Icon className={large ? "h-7 w-7 text-white" : "h-5 w-5 text-white"} />
    </motion.button>
    <span className="text-white/50 text-[11px] font-medium leading-tight text-center">{label}</span>
    {sublabel && <span className="text-white/30 text-[9px] -mt-1">{sublabel}</span>}
  </div>
);

// Draggable PiP component
const DraggablePiP = ({ videoRef, isCameraOff, containerRef }: {
  videoRef: React.RefObject<HTMLVideoElement>;
  isCameraOff: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.1}
      dragConstraints={containerRef}
      className="w-[100px] h-[150px] rounded-2xl overflow-hidden"
      whileDrag={{ scale: 1.04 }}
      initial={{ opacity: 0, scale: 0.75 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        x, y,
        position: "absolute", top: 60, right: 12, zIndex: 30,
        cursor: "grab",
        border: "1.5px solid rgba(255,255,255,0.2)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      <video ref={videoRef} autoPlay playsInline muted
        className={cn("w-full h-full object-cover", isCameraOff && "hidden")}
      />
      {isCameraOff && (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
          <VideoOff className="h-6 w-6 text-white/40" />
        </div>
      )}
    </motion.div>
  );
};

export const CallScreen = () => {
  const {
    callState, activeCall, callDuration,
    isMuted, isCameraOff, errorMessage,
    localStream, remoteStream, connectionState,
    isScreenSharing, unreadChatCount,
    endCall, toggleMute, toggleCamera, resetCall,
    toggleScreenShare, switchCamera,
  } = useCall();

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);

  const [isSpeakerOn,     setSpeaker]       = useState(true);
  const [controlsVisible, setControlsVis]   = useState(true);
  const [isBlurBg,        setBlurBg]        = useState(false);
  const [chatOpen,        setChatOpen]      = useState(false);
  const [devicesOpen,     setDevicesOpen]   = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blurAnimRef = useRef<number>(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toggle: togglePiP, supported: pipSupported, isPiP } = useRemotePiP(remoteVideoRef);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const toggleBlurBg = useCallback(() => {
    setBlurBg(prev => !prev);
  }, []);


  useEffect(() => {
    if (!isBlurBg || !localVideoRef.current || !canvasRef.current) {
      cancelAnimationFrame(blurAnimRef.current);
      return;
    }
    const video = localVideoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      ctx.filter = "blur(10px) brightness(0.5)";
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";
      blurAnimRef.current = requestAnimationFrame(draw);
    };
    blurAnimRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(blurAnimRef.current);
  }, [isBlurBg]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Auto-hide controls for video calls
  const resetHideTimer = useCallback(() => {
    setControlsVis(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (callState === 'in_call') {
      hideTimer.current = setTimeout(() => setControlsVis(false), 4000);
    }
  }, [callState]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [callState, resetHideTimer]);

  if (!activeCall) return null;

  const isVideoCall   = activeCall.callType === 'video';
  const isConnecting  = callState === 'outgoing_calling' || callState === 'connecting';
  const isInCall      = callState === 'in_call';
  const isEnded       = ['call_ended','call_failed','rejected','missed'].includes(callState);
  const hasRemoteVideo = isVideoCall && !!remoteStream;
  const hasAvatar      = !!activeCall.peerAvatar;

  const getStatusText = () => {
    if (callState === 'outgoing_calling') return 'Calling…';
    if (callState === 'connecting')       return 'Connecting…';
    if (callState === 'in_call')          return formatDuration(callDuration);
    if (callState === 'call_ended')       return 'Call ended';
    if (callState === 'call_failed')      return errorMessage || 'Call failed';
    if (callState === 'rejected')         return 'Call declined';
    if (callState === 'missed')           return 'No answer';
    return '';
  };

  // ─────────────────────────────────────────────────────────────────────
  // VIDEO CALL — remote stream active
  // ─────────────────────────────────────────────────────────────────────
  if (hasRemoteVideo) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 bg-black overflow-hidden select-none"
        onClick={resetHideTimer}
      >
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

        {/* Full-screen remote video */}
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Subtle vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.35) 100%)" }}
        />

        {/* ── TOP BAR ── */}
        <AnimatePresence>
          {controlsVisible && (
            <motion.div
              key="top"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="absolute top-0 left-0 right-0 z-20"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%)", paddingTop: "env(safe-area-inset-top, 12px)" }}
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-white font-bold text-[18px] leading-tight">{activeCall.peerName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <SignalBars state={connectionState} />
                    <p className="text-white/60 text-[13px] font-mono">{getStatusText()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <NetworkBadge />
                  <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-1.5">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-emerald-400 text-[12px] font-bold">LIVE</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <PoorConnectionWarning />

        {/* ── LOCAL PiP (draggable) ── */}
        <DraggablePiP videoRef={localVideoRef} isCameraOff={isCameraOff} containerRef={containerRef} />

        {/* ── BOTTOM CONTROLS ── */}
        <AnimatePresence>
          {controlsVisible && (
            <motion.div
              key="btm"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.28 }}
              className="absolute bottom-0 left-0 right-0 z-20"
              style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)", paddingBottom: "env(safe-area-inset-bottom, 24px)" }}
            >
              {/* Blur canvas (hidden, provides blurred bg) */}
              {isBlurBg && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none z-0" />}

              {/* Secondary pro controls */}
              <div className="flex items-center justify-center gap-4 px-6 pt-4">
                <CtrlBtn icon={SwitchCamera} label="Flip" onPress={() => switchCamera()} disabled={isScreenSharing} />
                <CtrlBtn icon={Settings2} label="Devices" onPress={() => setDevicesOpen(true)} />
                <CtrlBtn
                  icon={MessageCircle}
                  label={unreadChatCount > 0 ? `Chat (${unreadChatCount})` : 'Chat'}
                  onPress={() => setChatOpen(true)}
                />
                <CtrlBtn icon={PictureInPicture2} label="PiP" onPress={togglePiP} active={isPiP} disabled={!pipSupported} />
                <CtrlBtn icon={Aperture} label={isBlurBg ? 'Blur On' : 'Blur BG'} onPress={toggleBlurBg} active={isBlurBg} />
              </div>

              <div className="flex items-center justify-center gap-5 px-8 py-6">
                <CtrlBtn icon={isMuted ? MicOff : Mic}   label={isMuted ? "Unmute" : "Mute"}       onPress={toggleMute}    active={isMuted} />
                <CtrlBtn icon={isScreenSharing ? MonitorOff : Monitor} label={isScreenSharing ? "Stop Share" : "Share"} onPress={toggleScreenShare} active={isScreenSharing} />
                <CtrlBtn icon={PhoneOff}                  label="End Call"                           onPress={endCall}       danger large />
                <CtrlBtn icon={isCameraOff ? VideoOff : Video} label={isCameraOff ? "Show" : "Camera"} onPress={toggleCamera} active={isCameraOff} />
              </div>
              {isScreenSharing && (
                <div className="flex justify-center pb-2">
                  <span className="text-xs text-white/60 bg-black/40 rounded-full px-3 py-1">Sharing screen</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <InCallChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        <DeviceSwitcherSheet open={devicesOpen} onClose={() => setDevicesOpen(false)} />


        {/* Tap hint when controls hidden */}
        <AnimatePresence>
          {!controlsVisible && (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-black/40 backdrop-blur rounded-full px-4 py-2"
            >
              <p className="text-white/50 text-[11px]">Tap to show controls</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // VOICE CALL / VIDEO WAITING — avatar view
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* ── Background: blurred avatar or animated gradient ── */}
      {hasAvatar ? (
        <>
          <img
            src={activeCall.peerAvatar}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110"
            style={{ filter: "blur(40px) saturate(1.6) brightness(0.3)" }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 90% 60% at 50% 15%, rgba(99,102,241,0.22) 0%, transparent 60%),
              radial-gradient(ellipse 60% 50% at 20% 80%, rgba(59,130,246,0.12) 0%, transparent 60%),
              radial-gradient(ellipse 50% 40% at 80% 70%, rgba(16,185,129,0.1) 0%, transparent 60%),
              linear-gradient(180deg, #04040f 0%, #080c1e 55%, #04040f 100%)
            `,
          }}
        />
      )}

      {/* Animated blobs over background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          { cx: "50%", cy: "25%", w: 380, color: "rgba(99,102,241,0.15)", dur: 5 },
          { cx: "20%", cy: "65%", w: 280, color: "rgba(59,130,246,0.1)",  dur: 7 },
          { cx: "80%", cy: "55%", w: 260, color: "rgba(16,185,129,0.08)", dur: 6 },
        ].map((b, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: b.w, height: b.w,
              left: b.cx, top: b.cy,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut", delay: i * 1.5 }}
          />
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="relative z-10 flex flex-col flex-1">

        {/* Top status bar */}
        <div className="flex items-center justify-between px-5 py-4 pt-12">
          <div className="flex items-center gap-2">
            {isVideoCall && (
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-full px-2.5 py-1">
                <Video className="h-3 w-3 text-white/70" />
                <span className="text-white/70 text-[11px] font-medium">Video</span>
              </div>
            )}
          </div>
          {isInCall && (
            <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur rounded-full px-2.5 py-1">
              <SignalBars state={connectionState} />
            </div>
          )}
        </div>

        {/* ── Avatar + rings ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="relative flex items-center justify-center mb-8">
            {/* Rings */}
            {(isConnecting || isInCall) && (
              <>
                {[220, 176, 144].map((size, idx) => (
                  <motion.div
                    key={size}
                    className="absolute rounded-full"
                    style={{
                      width: size, height: size,
                      background: isInCall
                        ? `rgba(16,185,129,${0.04 - idx * 0.01})`
                        : `rgba(99,102,241,${0.05 - idx * 0.01})`,
                      border: `1px solid ${isInCall ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)"}`,
                    }}
                    animate={{ scale: [0.88, 1.06, 0.88], opacity: [0.7, 0.25, 0.7] }}
                    transition={{
                      duration: isConnecting ? 1.6 : 3.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: idx * 0.45,
                    }}
                  />
                ))}
              </>
            )}

            {/* Glow */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: 156, height: 156,
                background: isInCall
                  ? "radial-gradient(circle, rgba(16,185,129,0.28) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)",
              }}
              animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: isConnecting ? 1.4 : 3, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Avatar */}
            <div
              className="relative z-10 w-[128px] h-[128px] rounded-full overflow-hidden"
              style={{
                boxShadow: isInCall
                  ? "0 0 0 3px rgba(16,185,129,0.4), 0 0 0 7px rgba(16,185,129,0.12), 0 24px 56px rgba(0,0,0,0.7)"
                  : "0 0 0 3px rgba(99,102,241,0.4), 0 0 0 7px rgba(99,102,241,0.12), 0 24px 56px rgba(0,0,0,0.7)",
              }}
            >
              <ChatAvatar name={activeCall.peerName} src={activeCall.peerAvatar} size="xl" className="w-full h-full" />
            </div>
          </div>

          {/* Name */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white font-black text-[34px] leading-none tracking-tight text-center mb-2"
          >
            {activeCall.peerName}
          </motion.h1>

          {/* Timer or status */}
          <AnimatePresence mode="wait">
            <motion.div
              key={callState}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-3 mb-5"
            >
              {isInCall ? (
                <span className="text-white/80 text-[22px] font-mono font-bold tracking-widest tabular-nums">
                  {formatDuration(callDuration)}
                </span>
              ) : (
                <span className={cn(
                  "text-[16px] font-medium",
                  isEnded && callState !== 'call_ended' ? "text-red-400" : "text-white/55"
                )}>
                  {getStatusText()}
                </span>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Sound wave while in call */}
          <AnimatePresence>
            {isInCall && !isMuted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="mb-2"
              >
                <SoundWave active />
              </motion.div>
            )}
            {isInCall && isMuted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/20 rounded-full px-3 py-1.5 mb-2"
              >
                <MicOff className="h-3 w-3 text-red-400" />
                <span className="text-red-400 text-[12px] font-semibold">Microphone muted</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ended close button */}
          {isEnded && (
            <motion.button
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              onClick={resetCall}
              className="mt-6 flex items-center gap-2 bg-white/10 hover:bg-white/16 border border-white/15 backdrop-blur text-white rounded-full px-7 py-3.5 text-[15px] font-semibold transition-colors"
              data-testid="button-close-call"
            >
              <Phone className="h-4 w-4" />
              Close
            </motion.button>
          )}
        </div>

        {/* ── CONTROLS ── */}
        {!isEnded && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 26 }}
            className="px-6 pb-14"
          >
            {/* Glassmorphism control panel */}
            <div
              className="rounded-3xl px-6 py-5"
              style={{
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
              }}
            >
              {isVideoCall ? (
                // ── Video call controls (3 main) ──
                <div className="flex items-center justify-center gap-8">
                  <CtrlBtn icon={isMuted ? MicOff : Mic}         label={isMuted ? "Unmute" : "Mute"}     onPress={toggleMute}    active={isMuted} />
                  <CtrlBtn icon={PhoneOff}                        label="End"                              onPress={endCall}       danger large />
                  <CtrlBtn icon={isCameraOff ? VideoOff : Video} label={isCameraOff ? "Camera Off" : "Camera"} onPress={toggleCamera} active={isCameraOff} />
                </div>
              ) : (
                // ── Voice call controls: 2 rows ──
                <>
                  {/* Row 1 — secondary */}
                  <div className="flex items-center justify-around mb-5">
                    <CtrlBtn
                      icon={isSpeakerOn ? Volume2 : VolumeX}
                      label="Speaker"
                      sublabel={isSpeakerOn ? "On" : "Off"}
                      onPress={() => setSpeaker(s => !s)}
                      active={!isSpeakerOn}
                    />
                    <CtrlBtn
                      icon={UserPlus}
                      label="Add"
                      onPress={() => {}}
                      disabled
                    />
                    <CtrlBtn
                      icon={Hash}
                      label="Keypad"
                      onPress={() => {}}
                      disabled
                    />
                    <CtrlBtn
                      icon={MessageCircle}
                      label="Message"
                      onPress={() => {}}
                      disabled
                    />
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/8 mb-5" />

                  {/* Row 2 — primary */}
                  <div className="flex items-center justify-center gap-10">
                    <CtrlBtn
                      icon={isMuted ? MicOff : Mic}
                      label={isMuted ? "Unmute" : "Mute"}
                      onPress={toggleMute}
                      active={isMuted}
                    />
                    <CtrlBtn
                      icon={PhoneOff}
                      label="End Call"
                      onPress={endCall}
                      danger
                      large
                    />
                    <CtrlBtn
                      icon={CameraIcon}
                      label="Video"
                      onPress={isVideoCall ? toggleCamera : () => {}}
                      disabled={!isVideoCall}
                      active={isVideoCall && isCameraOff}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Local PiP for video call awaiting remote */}
      {isVideoCall && localStream && (
        <DraggablePiP videoRef={localVideoRef} isCameraOff={isCameraOff} containerRef={containerRef as React.RefObject<HTMLDivElement>} />
      )}
    </div>
  );
};
