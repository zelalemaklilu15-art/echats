import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Phone, Video, PhoneMissed, Loader2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { callLogService, CallLogWithProfile } from "@/lib/callLogService";
import { getSessionUserSafe } from "@/lib/authSession";
import { cn } from "@/lib/utils";

const fmtDuration = (s?: number | null) => {
  if (!s || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}h ${m}m ${sec}s`
    : m > 0
      ? `${m}m ${sec}s`
      : `${sec}s`;
};

const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const CallHistory = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<CallLogWithProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "incoming" | "outgoing" | "missed">("all");

  useEffect(() => {
    (async () => {
      const { user } = await getSessionUserSafe();
      if (user) {
        setUserId(user.id);
        setLogs(await callLogService.getCallLogs(200));
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    return callLogService.subscribeToCallLogs(userId, () => {
      callLogService.getCallLogs(200).then(setLogs);
    });
  }, [userId]);

  const totals = useMemo(() => {
    const answered = logs.filter((l) => l.status === "completed");
    const seconds = answered.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
    return { calls: logs.length, answered: answered.length, seconds };
  }, [logs]);

  const filtered = logs.filter((l) => {
    if (filter === "all") return true;
    if (filter === "missed") return l.status !== "completed";
    const outgoing = l.caller_id === userId;
    return filter === "outgoing" ? outgoing : !outgoing;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <button onClick={() => navigate("/calls")} className="p-2 -ml-2 rounded-xl hover:bg-muted/60">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-black text-[18px] leading-tight gradient-text">Call History</h1>
            <p className="text-[11px] text-muted-foreground/80">
              {totals.calls} calls · {totals.answered} answered · {fmtDuration(totals.seconds)} talk time
            </p>
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {(["all", "incoming", "outgoing", "missed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-2xl text-[12px] font-bold capitalize whitespace-nowrap transition-all",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
              data-testid={`filter-history-${f}`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <Clock className="h-10 w-10 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-[14px]">No calls in this view yet.</p>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-2.5">
          {filtered.map((log) => {
            const outgoing = log.caller_id === userId;
            const peer = outgoing ? log.receiver_profile : log.caller_profile;
            const name = peer?.name || (peer as any)?.username || "Unknown";
            const bad = log.status !== "completed";
            return (
              <div
                key={log.id}
                className="rounded-2xl bg-card border border-border/50 p-4"
                data-testid={`history-item-${log.id}`}
              >
                <div className="flex items-center gap-3">
                  <ChatAvatar name={name} src={peer?.avatar_url || undefined} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] truncate">{name}</p>
                    <p className={cn("text-[12px] capitalize", bad ? "text-red-400" : "text-muted-foreground")}>
                      {outgoing ? "Outgoing" : "Incoming"} {log.call_type} · {log.status}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center">
                    {bad ? (
                      <PhoneMissed className="h-4 w-4 text-red-400" />
                    ) : log.call_type === "video" ? (
                      <Video className="h-4 w-4 text-primary" />
                    ) : (
                      <Phone className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-semibold">Started</p>
                    <p className="text-[12px] font-medium mt-0.5">{fmtDateTime(log.started_at || log.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-semibold">Ended</p>
                    <p className="text-[12px] font-medium mt-0.5">{fmtDateTime(log.ended_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-semibold">Duration</p>
                    <p className="text-[12px] font-medium mt-0.5">{fmtDuration(log.duration_seconds)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CallHistory;
