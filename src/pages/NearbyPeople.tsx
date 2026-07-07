import { useState, useEffect, useCallback } from "react";
import { MapPin, Radio, Check, X, Navigation, Wifi } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  isNearbyVisible, setNearbyVisible, getNearbyUsers, generateMockNearbyUsers,
  sendConnectionRequest, getConnectionRequests, acceptConnectionRequest, declineConnectionRequest, type NearbyUser,
} from "@/lib/nearbyService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatSecondsAgo(s: number) {
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

const NearbyPeople = () => {
  const { userId } = useAuth();
  const [visible, setVisible]         = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [requests, setRequests]       = useState<{ fromUserId: string; fromName: string; createdAt: string }[]>([]);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [secondsAgo, setSecondsAgo]   = useState(0);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId) { setVisible(isNearbyVisible(userId)); setRequests(getConnectionRequests(userId)); }
  }, [userId]);

  useEffect(() => {
    if (visible) { setNearbyUsers(getNearbyUsers()); setLastUpdated(Date.now()); }
  }, [visible]);

  useEffect(() => {
    const interval = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleToggleVisible = useCallback((checked: boolean) => {
    if (!userId) return;
    setNearbyVisible(userId, checked); setVisible(checked);
    if (checked) { setNearbyUsers(getNearbyUsers()); setLastUpdated(Date.now()); toast.success("You are now visible nearby"); }
    else toast.success("You are now hidden");
  }, [userId]);

  const handleRefresh = useCallback(() => {
    const users = generateMockNearbyUsers();
    setNearbyUsers(users); setLastUpdated(Date.now()); setSecondsAgo(0);
  }, []);

  const handleSayHi = useCallback((toUser: NearbyUser) => {
    if (!userId) return;
    sendConnectionRequest(userId, toUser.userId);
    setSentRequests(prev => new Set(prev).add(toUser.userId));
    toast.success(`Sent a Hi to ${toUser.name}`);
  }, [userId]);

  const handleAccept = useCallback((fromUserId: string) => {
    if (!userId) return;
    acceptConnectionRequest(userId, fromUserId);
    setRequests(prev => prev.filter(r => r.fromUserId !== fromUserId));
    toast.success("Connection accepted");
  }, [userId]);

  const handleDecline = useCallback((fromUserId: string) => {
    if (!userId) return;
    declineConnectionRequest(userId, fromUserId);
    setRequests(prev => prev.filter(r => r.fromUserId !== fromUserId));
    toast.success("Request declined");
  }, [userId]);

  return (
    <div className="min-h-screen bg-background pb-nav" data-testid="page-nearby">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-[17px]">People Nearby</h1>
            {visible && <p className="text-[11px] text-emerald-500 font-semibold">Visible · Updated {formatSecondsAgo(secondsAgo)}</p>}
          </div>
          {visible && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleRefresh}
              className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center" data-testid="button-refresh-nearby">
              <Navigation className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {/* Visibility toggle */}
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="flex items-center gap-3.5 px-4 py-4">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
              visible ? "bg-emerald-500/15 border border-emerald-500/25" : "bg-muted/60 border border-border/50")}>
              <Radio className={cn("h-4 w-4", visible ? "text-emerald-500" : "text-muted-foreground")} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[14px]">Make myself visible</p>
              <p className="text-[12px] text-muted-foreground">Let others nearby see you</p>
            </div>
            <Switch checked={visible} onCheckedChange={handleToggleVisible} data-testid="switch-nearby-visible" />
          </div>
        </div>

        {!visible && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center"
              style={{ width: 80, height: 80 }}>
              <MapPin className="h-9 w-9 text-primary/50" />
            </div>
            <div>
              <p className="font-semibold text-[15px] mb-1.5">Discover people nearby</p>
              <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">
                Turn on visibility to find people around you. Only approximate distances are shared.
              </p>
            </div>
          </div>
        )}

        {visible && (
          <>
            {/* Connection Requests */}
            {requests.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Connection Requests</p>
                <div className="space-y-2.5">
                  {requests.map(req => (
                    <motion.div key={req.fromUserId}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 bg-card rounded-2xl border border-primary/20 px-4 py-3.5">
                      <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[14px] font-black text-primary flex-shrink-0">
                        {getInitials(req.fromName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[14px] truncate">{req.fromName}</p>
                        <p className="text-[12px] text-muted-foreground">Wants to connect</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleAccept(req.fromUserId)}
                          className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center" data-testid={`button-accept-${req.fromUserId}`}>
                          <Check className="h-4 w-4 text-emerald-500" />
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDecline(req.fromUserId)}
                          className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center" data-testid={`button-decline-${req.fromUserId}`}>
                          <X className="h-4 w-4 text-red-400" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Nearby users */}
            {nearbyUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-muted/60 flex items-center justify-center">
                  <Wifi className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-[13px]" data-testid="text-no-nearby">No one nearby right now</p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{nearbyUsers.length} People Nearby</p>
                <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/40">
                  {nearbyUsers.map((user, i) => (
                    <motion.div key={user.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 px-4 py-3.5" data-testid={`card-nearby-${user.id}`}>
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[14px] font-black text-primary">
                          {getInitials(user.name)}
                        </div>
                        {user.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[14px] truncate">{user.name}</p>
                          <span className="text-[10px] bg-muted border border-border/50 rounded-full px-2 py-0.5 text-muted-foreground flex-shrink-0 font-medium">
                            {user.distance}
                          </span>
                        </div>
                        {user.bio && <p className="text-[12px] text-muted-foreground truncate mt-0.5">{user.bio}</p>}
                      </div>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSayHi(user)}
                        disabled={sentRequests.has(user.userId)}
                        className={cn("px-3.5 py-2 rounded-xl text-[12px] font-bold flex-shrink-0 transition-all",
                          sentRequests.has(user.userId)
                            ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25"
                            : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15")}
                        data-testid={`button-sayhi-${user.id}`}>
                        {sentRequests.has(user.userId) ? "✓ Sent" : "Say Hi"}
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NearbyPeople;
