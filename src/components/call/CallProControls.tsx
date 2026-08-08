import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Mic, Camera, Wifi, WifiOff } from 'lucide-react';
import { useCall } from '@/contexts/CallContext';
import { cn } from '@/lib/utils';

/** Small badge that surfaces the live network health from getStats(). */
export const NetworkBadge = () => {
  const { networkStats } = useCall();
  const { quality, roundTripMs, packetLossPercent } = networkStats;
  if (quality === 'unknown') return null;

  const poor = quality === 'poor';
  const fair = quality === 'fair';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-[11px] font-semibold',
        poor
          ? 'bg-red-500/20 border-red-500/30 text-red-300'
          : fair
            ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
            : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
      )}
    >
      {poor ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
      <span className="capitalize">{quality}</span>
      <span className="opacity-60 font-mono">
        {roundTripMs}ms · {packetLossPercent}%
      </span>
    </div>
  );
};

/** Full-width warning shown only when the connection degrades. */
export const PoorConnectionWarning = () => {
  const { networkQuality } = useCall();
  const show = networkQuality === 'poor' || networkQuality === 'fair';
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="absolute left-1/2 -translate-x-1/2 z-30 rounded-full px-4 py-1.5 backdrop-blur"
          style={{
            top: 'calc(env(safe-area-inset-top, 12px) + 72px)',
            background: networkQuality === 'poor' ? 'rgba(220,38,38,0.85)' : 'rgba(217,119,6,0.85)',
          }}
        >
          <span className="text-white text-[12px] font-semibold">
            {networkQuality === 'poor' ? 'Poor connection' : 'Unstable connection'} — quality reduced
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Instant peer-to-peer chat over the RTCDataChannel (never touches the DB). */
export const InCallChatPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { chatMessages, sendCallChatMessage, markChatRead } = useCall();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) markChatRead();
  }, [open, chatMessages.length, markChatRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl overflow-hidden flex flex-col"
          style={{
            height: '58%',
            background: 'rgba(10,12,20,0.92)',
            backdropFilter: 'blur(24px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <span className="text-white font-semibold text-[15px]">In-call chat</span>
            <button onClick={onClose} className="p-2 rounded-full bg-white/10" aria-label="Close chat">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {chatMessages.length === 0 && (
              <p className="text-white/40 text-[13px] text-center mt-6">
                Messages here are peer-to-peer and disappear when the call ends.
              </p>
            )}
            {chatMessages.map((m) => (
              <div key={m.id} className={cn('flex', m.fromSelf ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3.5 py-2 text-[14px]',
                    m.fromSelf ? 'bg-primary text-primary-foreground' : 'bg-white/12 text-white',
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (sendCallChatMessage(text)) setText('');
            }}
            className="flex items-center gap-2 px-4 py-3 border-t border-white/10"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 12px)' }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message…"
              className="flex-1 bg-white/10 text-white placeholder:text-white/40 rounded-full px-4 py-2.5 text-[16px] outline-none border border-white/10"
            />
            <button
              type="submit"
              className="w-11 h-11 rounded-full bg-primary flex items-center justify-center disabled:opacity-40"
              disabled={!text.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4 text-primary-foreground" />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Live camera / microphone switcher — uses replaceTrack, never drops the call. */
export const DeviceSwitcherSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { devices, refreshDevices, switchCamera, switchMicrophone } = useCall();

  useEffect(() => {
    if (open) refreshDevices();
  }, [open, refreshDevices]);

  const cams = devices.filter((d) => d.kind === 'videoinput');
  const mics = devices.filter((d) => d.kind === 'audioinput');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="absolute inset-x-0 bottom-0 z-40 rounded-t-3xl overflow-hidden max-h-[62%] overflow-y-auto"
          style={{
            background: 'rgba(10,12,20,0.94)',
            backdropFilter: 'blur(24px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 16px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <span className="text-white font-semibold text-[15px]">Devices</span>
            <button onClick={onClose} className="p-2 rounded-full bg-white/10" aria-label="Close devices">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          <div className="px-4 py-3">
            <p className="text-white/40 text-[11px] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Camera className="h-3 w-3" /> Camera
            </p>
            {cams.length === 0 && <p className="text-white/40 text-[13px] mb-3">No cameras detected</p>}
            {cams.map((d) => (
              <button
                key={d.deviceId}
                onClick={() => {
                  switchCamera(d.deviceId);
                  onClose();
                }}
                className="w-full text-left text-white text-[15px] rounded-xl px-4 py-3 mb-1.5 bg-white/8 active:bg-white/15"
              >
                {d.label}
              </button>
            ))}

            <p className="text-white/40 text-[11px] uppercase tracking-wide mt-4 mb-2 flex items-center gap-1.5">
              <Mic className="h-3 w-3" /> Microphone
            </p>
            {mics.map((d) => (
              <button
                key={d.deviceId}
                onClick={() => {
                  switchMicrophone(d.deviceId);
                  onClose();
                }}
                className="w-full text-left text-white text-[15px] rounded-xl px-4 py-3 mb-1.5 bg-white/8 active:bg-white/15"
              >
                {d.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Picture-in-Picture toggle for the remote video element. */
export function useRemotePiP(videoRef: React.RefObject<HTMLVideoElement>) {
  const [isPiP, setIsPiP] = useState(false);
  const supported = typeof document !== 'undefined' && (document as any).pictureInPictureEnabled;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);
    el.addEventListener('enterpictureinpicture', onEnter);
    el.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      el.removeEventListener('enterpictureinpicture', onEnter);
      el.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [videoRef]);

  const toggle = async () => {
    try {
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture();
      } else if (videoRef.current) {
        await (videoRef.current as any).requestPictureInPicture();
      }
    } catch (e) {
      console.warn('[PiP] toggle failed', e);
    }
  };

  return { isPiP, supported, toggle };
}
