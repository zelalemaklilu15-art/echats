// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, Search, UserPlus, Loader2, Users, MessageCircle, UserCheck, BadgeCheck, Cake } from "lucide-react";
import { checkTodaysBirthdays } from "@/lib/birthdayService";
import { getVerification, getBadgeConfig } from "@/lib/verificationService";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { useNavigate } from "react-router-dom";
import { useChatList, useProfile } from "@/hooks/useChatStore";
import { chatStore, Chat, PublicProfile } from "@/lib/chatStore";
import { searchUsers, findOrCreateChat } from "@/lib/supabaseService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatLastSeen } from "@/lib/formatLastSeen";

const ContactItem = ({ userId, onClick }: { userId: string; onClick: (id: string) => void }) => {
  const { profile, loading } = useProfile(userId);

  if (loading || !profile) {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-12 h-12 rounded-2xl bg-muted animate-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-muted rounded-lg animate-shimmer" />
          <div className="h-3 w-20 bg-muted rounded-lg animate-shimmer" />
        </div>
      </div>
    );
  }

  const lastSeen = formatLastSeen(profile.last_seen, profile.is_online);

  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      data-testid={`contact-item-${userId}`}
      onClick={() => onClick(userId)}
      className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
    >
      <ChatAvatar
        name={profile.name || profile.username}
        src={profile.avatar_url || undefined}
        status={profile.is_online ? "online" : "offline"}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="font-semibold text-[14px] text-foreground truncate leading-tight">
            {profile.name || profile.username}
          </p>
          {(() => {
            const v = getVerification(userId);
            if (!v) return null;
            const cfg = getBadgeConfig(v.badge);
            return <BadgeCheck className={`h-3.5 w-3.5 flex-shrink-0 ${cfg.color}`} />;
          })()}
        </div>
        <p className="text-[12px] text-muted-foreground truncate mt-0.5">@{profile.username}</p>
        {lastSeen && (
          <p className={`text-[11px] mt-0.5 font-medium ${profile.is_online ? "text-emerald-400" : "text-muted-foreground"}`}>
            {lastSeen}
          </p>
        )}
      </div>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
        <MessageCircle className="h-4 w-4" />
      </div>
    </motion.button>
  );
};

const SearchResultRow = ({ user, onClick }: { user: PublicProfile; onClick: () => void }) => (
  <motion.button
    whileTap={{ scale: 0.99 }}
    onClick={onClick}
    className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-left"
  >
    <ChatAvatar
      name={user.name || user.username}
      src={user.avatar_url || undefined}
      status={user.is_online ? "online" : "offline"}
      size="md"
    />
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-[14px] text-foreground truncate">{user.name || user.username}</p>
      <p className="text-[12px] text-muted-foreground">@{user.username}</p>
    </div>
    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
      <UserPlus className="h-4 w-4" />
    </div>
  </motion.button>
);

const Contacts = () => {
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching]       = useState(false);
  const navigate = useNavigate();
  const { chats, loading } = useChatList();
  const currentUserId = chatStore.getCurrentUserId();
  const contactIds = Array.from(new Set(chats.map(c => chatStore.getOtherUserId(c)))).filter(id => id && id !== currentUserId);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setSearchResults((await searchUsers(q)).filter(u => u.id !== currentUserId)); }
      catch { /* noop */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, currentUserId]);

  const openChat = async (userId: string) => {
    if (!currentUserId) return;
    const id = await findOrCreateChat(currentUserId, userId);
    if (id) navigate(`/chat/${id}`);
    else toast.error("Failed to open chat");
  };

  const [suggestions, setSuggestions] = useState<PublicProfile[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [birthdayContacts, setBirthdayContacts] = useState<{ id: string; name: string | null; username: string }[]>([]);

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("profiles")
      .select("id, name, username, avatar_url, is_online, last_seen")
      .neq("id", currentUserId)
      .limit(10)
      .then(({ data }) => {
        if (data) {
          const existingIds = new Set(contactIds);
          setSuggestions((data as PublicProfile[]).filter(u => !existingIds.has(u.id)).slice(0, 6));
        }
      });
  }, [currentUserId, contactIds.length]);

  useEffect(() => {
    // Other users' birthdays are now private. Disable cross-user birthday
    // notifications to respect privacy.
    setBirthdayContacts([]);
  }, [currentUserId, contactIds.length]);

  const handleAddContact = async (userId: string) => {
    await openChat(userId);
    setAddedIds(prev => new Set([...prev, userId]));
  };

  const isSearchMode = searchQuery.trim().length >= 2;

  return (
    <div className="min-h-screen bg-background pb-24">
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
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted/60 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-black text-[18px] leading-tight gradient-text">Contacts</h1>
              {!isSearchMode && contactIds.length > 0 && (
                <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5">{contactIds.length} contact{contactIds.length !== 1 ? "s" : ""}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate("/new-contact")}
            className="p-2.5 rounded-2xl transition-all"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-primary)" }}
            data-testid="button-add-contact"
          >
            <UserPlus className="h-[17px] w-[17px] text-white" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3.5 relative">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder="Search by username…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-muted/70 border border-border/50 rounded-2xl pl-10 pr-10 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-all"
            data-testid="input-contact-search"
          />
          {searching && <Loader2 className="absolute right-7 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
        </div>
      </div>

      {/* Birthday Banner */}
      {birthdayContacts.length > 0 && (
        <div className="mx-4 mt-3 mb-1 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Cake className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Birthday today!</p>
            <p className="text-xs text-muted-foreground">
              {birthdayContacts.map(c => c.name || c.username).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Search results */}
      <AnimatePresence>
        {isSearchMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 pt-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2">
              {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
            </p>
            {!searching && searchResults.length === 0 && (
              <div className="text-center py-10">
                <p className="text-muted-foreground text-[14px]">No users found for "{searchQuery}"</p>
              </div>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
                {searchResults.map(u => (
                  <SearchResultRow key={u.id} user={u} onClick={() => openChat(u.id)} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* People You May Know */}
      {!isSearchMode && suggestions.length > 0 && (
        <div className="px-4 pt-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">People You May Know</p>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {suggestions.map(u => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-shrink-0 w-[100px] rounded-2xl bg-card border border-border/50 p-3 flex flex-col items-center gap-2"
              >
                <ChatAvatar
                  name={u.name || u.username}
                  src={u.avatar_url || undefined}
                  status={u.is_online ? "online" : "offline"}
                  size="md"
                />
                <p className="text-[11px] font-semibold text-center truncate w-full">{u.name || u.username}</p>
                <p className="text-[10px] text-muted-foreground text-center truncate w-full">@{u.username}</p>
                {addedIds.has(u.id) ? (
                  <div className="w-full py-1 rounded-lg bg-emerald-500/15 flex items-center justify-center gap-1">
                    <UserCheck className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] text-emerald-500 font-semibold">Added</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddContact(u.id)}
                    className="w-full py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center gap-1"
                  >
                    <UserPlus className="h-3 w-3" />
                    Add
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Contact list */}
      {!isSearchMode && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : contactIds.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center py-24 px-8 text-center"
            >
              <motion.div
                className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))", border: "1px solid hsl(var(--primary) / 0.15)" }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Users className="h-10 w-10 text-primary/60" />
              </motion.div>
              <h2 className="text-[18px] font-bold mb-2">No contacts yet</h2>
              <p className="text-muted-foreground text-[14px] max-w-[240px] leading-relaxed">
                Search for users by username above to start chatting. Your contacts will appear here.
              </p>
            </motion.div>
          ) : (
            <div className="px-4 pt-4">
              <div className="bg-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
                {contactIds.map(id => (
                  <ContactItem key={id} userId={id} onClick={openChat} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Contacts;
