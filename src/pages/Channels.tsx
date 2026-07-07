import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Megaphone, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  getMyChannels,
  getSubscribedChannels,
  createChannel,
  type Channel,
} from "@/lib/channelService";
import { toast } from "sonner";
import { motion } from "framer-motion";

const Channels = () => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [version, setVersion] = useState(0);

  const myChannels = userId ? getMyChannels(userId) : [];
  const subscribedChannels = userId ? getSubscribedChannels(userId) : [];

  const filterChannels = (channels: Channel[]) => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  };

  const filteredMy = filterChannels(myChannels);
  const filteredSubscribed = filterChannels(subscribedChannels);
  const isEmpty = filteredMy.length === 0 && filteredSubscribed.length === 0;

  const handleCreate = () => {
    if (!channelName.trim()) {
      toast.error("Channel name is required");
      return;
    }
    if (!userId) return;
    createChannel(channelName.trim(), channelDescription.trim(), userId);
    toast.success("Channel created");
    setChannelName("");
    setChannelDescription("");
    setDialogOpen(false);
    setVersion((v) => v + 1);
  };

  const renderChannelCard = (channel: Channel, index: number) => (
    <motion.button
      key={channel.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => navigate(`/channel/${channel.id}`)}
      className="flex items-center gap-3.5 w-full px-4 py-3.5 hover:bg-muted/35 transition-colors text-left"
      data-testid={`card-channel-${channel.id}`}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-[17px] shrink-0 shadow-sm"
        style={{ backgroundColor: channel.avatarColor }}
      >
        {channel.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[14px] text-foreground truncate leading-tight">{channel.name}</p>
        {channel.description && (
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{channel.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        <Users className="h-3.5 w-3.5" />
        <span className="text-[12px] font-medium">{channel.subscriberCount}</span>
      </div>
    </motion.button>
  );

  return (
    <div className="min-h-screen bg-background pb-nav" data-testid="page-channels">
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
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          <div>
            <h1 className="font-black text-[20px] gradient-text leading-tight">Channels</h1>
            {(myChannels.length + subscribedChannels.length) > 0 && (
              <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5">
                {myChannels.length} owned · {subscribedChannels.length} subscribed
              </p>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setDialogOpen(true)}
            className="px-3.5 py-2 rounded-2xl flex items-center gap-1.5 text-white text-[12px] font-bold shadow-sm"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-primary)" }}
            data-testid="button-create-channel"
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </motion.button>
        </div>
        <div className="relative px-4 pb-3">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder="Search channels…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl pl-10 pr-4 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-all"
            style={{ background: "hsl(var(--muted) / 0.8)", border: "1px solid hsl(var(--border) / 0.5)" }}
            data-testid="input-search-channels"
          />
        </div>
      </div>

      {/* Empty states */}
      {isEmpty && !searchQuery && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center py-24 px-8 text-center"
        >
          <motion.div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))", border: "1px solid hsl(var(--primary) / 0.15)" }}
            animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Megaphone className="h-10 w-10 text-primary/50" />
          </motion.div>
          <h2 className="text-[18px] font-bold mb-2" data-testid="text-empty-channels">No channels yet</h2>
          <p className="text-muted-foreground text-[14px] mb-6 max-w-[220px] leading-relaxed">Create a channel to broadcast messages to many subscribers.</p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white shadow-primary"
            style={{ background: "var(--gradient-primary)" }}
            data-testid="button-create-channel-empty"
          >
            <Plus className="h-4 w-4" />Create Channel
          </motion.button>
        </motion.div>
      )}

      {isEmpty && searchQuery && (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-[14px] text-muted-foreground">No channels match "{searchQuery}"</p>
        </div>
      )}

      {/* Channel Lists */}
      {filteredMy.length > 0 && (
        <div className="pt-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-5 pb-2">My Channels</p>
          <div className="mx-4 bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
            {filteredMy.map((c, i) => renderChannelCard(c, i))}
          </div>
        </div>
      )}

      {filteredSubscribed.length > 0 && (
        <div className="pt-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-5 pb-2">Subscribed</p>
          <div className="mx-4 bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
            {filteredSubscribed.map((c, i) => renderChannelCard(c, i))}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Name</Label>
              <Input
                id="channel-name"
                placeholder="Channel name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                data-testid="input-channel-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-desc">Description</Label>
              <Input
                id="channel-desc"
                placeholder="What is this channel about?"
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
                data-testid="input-channel-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} data-testid="button-confirm-create">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Channels;
