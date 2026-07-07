import { useState, useEffect } from "react";
import {
  ArrowLeft, Phone, Video, PhoneCall, PhoneIncoming,
  PhoneMissed, Loader2, Plus,
} from "lucide-react";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { useNavigate } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { callLogService, CallLogWithProfile } from "@/lib/callLogService";
import { toast } from "sonner";
import { getSessionUserSafe } from "@/lib/authSession";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const formatDuration = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

function groupLogs(logs: CallLogWithProfile[]): { label: string; items: CallLogWithProfile[] }[] {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const groups = new Map<string, CallLogWithProfile[]>();
  for (const log of logs) {
    const d = new Date(log.created_at);
    let key: string;
    if (d.toDateString() === todayStr) key = "Today";
    else if (d.toDateString() === yesterdayStr) key = "Yesterday";
    else key = d.toLocaleDateString([], { month: "short", day: "numeric" });

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log);
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const Calls = () => {
  const navigate = useNavigate();
  const { startCall, callState, isReady } = useCall();
  const [callLogs, setCallLogs] = useState<CallLogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "missed">("all");

  useEffect(() => {
    (async () => {
      const { user } = await getSessionUserSafe();
      if (user) {
        setCurrentUserId(user.id);
        setCallLogs(await callLogService.getCallLogs(50));
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const unsub = callLogService.subscribeToCallLogs(currentUserId, () => {
      callLogService.getCallLogs(50).then(setCallLogs);
    });
    return unsub;
  }, [currentUserId]);

  const getPeer = (log: CallLogWithProfile) => {
    const out = log.caller_id === currentUserId;
    const p = out ? log.receiver_profile : log.caller_profile;
    return { name: p?.name || (p as any)?.username || "Unknown", avatar: p?.avatar_url || undefined };
  };

  const getTypeLabel = (log: CallLogWithProfile) => {
    if (log.status === "missed")    return "Missed";
    if (log.status === "rejected")  return "Declined";
    if (log.status === "failed")    return "Failed";
    return log.caller_id === currentUserId ? "Outgoing" : "Incoming";
  };

  const isBad = (log: CallLogWithProfile) =>
    log.status === "missed" || log.status === "rejected" || log.status === "failed";

  const handleCall = async (log: CallLogWithProfile) => {
    if (!isReady) { toast.error("Call system not ready"); return; }
    if (callState !== "idle") { toast.error("Already in a call"); return; }
    const out = log.caller_id === currentUserId;
    const peerId = out ? log.receiver_id : log.caller_id;
    const pp = out ? log.receiver_profile : log.caller_profile;
    await startCall(peerId, pp?.name || (pp as any)?.username || "Unknown", log.call_type, pp?.avatar_url || undefined);
  };

  const filtered = callLogs.filter(l => activeTab === "all" || isBad(l));
  const grouped  = groupLogs(filtered);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: "hsl(var(--background) / 0.97)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          borderBottom: "1px solid hsl(var(--border) / 0.4)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/chats")} className="p-2 -ml-2 rounded-xl hover:bg-muted/60 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-black text-[18px] leading-tight gradient-text">Calls</h1>
              {callLogs.length > 0 && (
                <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5">{callLogs.length} records</p>
              )}
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate("/new-contact")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold text-white transition-all"
            style={{ background: "var(--gradient-success)", boxShadow: "0 4px 16px hsl(145 65% 45% / 0.4)" }}
            data-testid="button-new-call"
          >
            <Plus className="h-3.5 w-3.5" />
            New Call
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {(["all", "missed"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-2xl text-[12px] font-bold transition-all capitalize",
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              data-testid={`tab-calls-${tab}`}
            >
              {tab === "all" ? "All" : "Missed"}
              {tab === "missed" && callLogs.filter(isBad).length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {callLogs.filter(isBad).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {grouped.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 px-8 text-center"
          >
            <motion.div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))",
                border: "1px solid hsl(var(--primary) / 0.15)",
              }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              {activeTab === "missed"
                ? <PhoneMissed className="h-10 w-10 text-red-400/70" />
                : <Phone className="h-10 w-10 text-primary/60" />
              }
            </motion.div>
            <h2 className="text-[18px] font-bold mb-2">
              {activeTab === "missed" ? "No missed calls" : "No calls yet"}
            </h2>
            <p className="text-muted-foreground text-[14px] max-w-[240px] leading-relaxed">
              {activeTab === "missed"
                ? "You're all caught up! No missed calls."
                : "Start a voice or video call with your contacts."
              }
            </p>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="px-4 pt-4">
            {grouped.map(({ label, items }) => (
              <div key={label} className="mb-5">
                {/* Section header */}
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold px-1 mb-2">
                  {label}
                </p>

                {/* Calls in section */}
                <div className="rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/40">
                  {items.map((log, i) => {
                    const peer     = getPeer(log);
                    const bad      = isBad(log);
                    const typeLabel = getTypeLabel(log);
                    const isVideo  = log.call_type === "video";
                    const isOutgoing = log.caller_id === currentUserId;

                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3.5 hover:bg-muted/25 transition-colors",
                          "border-l-[3px]",
                          bad        ? "border-l-red-500/50"
                          : !isOutgoing ? "border-l-emerald-500/50"
                          :               "border-l-primary/40"
                        )}
                      >
                        <div className="relative">
                          <ChatAvatar name={peer.name} src={peer.avatar} size="md" />
                          {/* Call type badge on avatar */}
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-card",
                            bad ? "bg-red-500" : isVideo ? "bg-primary" : "bg-emerald-500"
                          )}>
                            {bad
                              ? <PhoneMissed className="h-2.5 w-2.5 text-white" />
                              : isVideo
                                ? <Video className="h-2.5 w-2.5 text-white" />
                                : isOutgoing
                                  ? <PhoneCall className="h-2.5 w-2.5 text-white" />
                                  : <PhoneIncoming className="h-2.5 w-2.5 text-white" />
                            }
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-semibold text-[14px] truncate",
                            bad ? "text-red-400" : "text-foreground"
                          )}>
                            {peer.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className={cn(
                              "text-[12px]",
                              bad ? "text-red-400/70" : "text-muted-foreground"
                            )}>
                              {typeLabel} · {formatTime(log.created_at)}
                            </p>
                            {log.duration_seconds && log.duration_seconds > 0 && (
                              <span className="text-[11px] bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                                {formatDuration(log.duration_seconds)}
                              </span>
                            )}
                          </div>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.88 }}
                          onClick={() => handleCall(log)}
                          disabled={callState !== "idle"}
                          className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors",
                            "bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-40"
                          )}
                          data-testid={`call-back-${log.id}`}
                        >
                          {isVideo
                            ? <Video className="h-4.5 w-4.5" />
                            : <Phone className="h-4.5 w-4.5" />
                          }
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB — New Call */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 20 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => navigate("/new-contact")}
        className="fixed bottom-24 right-4 z-10 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30"
        data-testid="fab-new-call"
      >
        <Plus className="h-6 w-6" />
      </motion.button>
    </div>
  );
};

export default Calls;
