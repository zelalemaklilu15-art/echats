// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, Star, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChatAvatar } from "@/components/ui/chat-avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isCloseFriend, toggleCloseFriend, syncCloseFriends } from "@/lib/closeFriendsService";
import { getAccessProfiles } from "@/lib/profileAccess";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Contact {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

const CloseFriends = () => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, [userId]);

  const loadContacts = async () => {
    if (!userId) return;
    setLoading(true);
    try {
    await syncCloseFriends();
    const { data: chats } = await supabase
      .from("chats")
      .select("participant_1, participant_2")
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

    const otherIds = [...new Set((chats || []).map((c) =>
      c.participant_1 === userId ? c.participant_2 : c.participant_1
    ))];

    if (otherIds.length === 0) { setLoading(false); return; }

    const profiles = await getAccessProfiles(otherIds);

    const list: Contact[] = (profiles || []).map((p) => ({
      id: p.id,
      name: p.name || p.username || "User",
      username: p.username || "",
      avatar_url: p.avatar_url,
    }));

    setContacts(list);
    setCloseFriendIds(new Set(list.filter((c) => isCloseFriend(c.id)).map((c) => c.id)));
    setLoading(false);
    } catch { setLoading(false); toast.error("Could not load close friends"); }
  };

  const handleToggle = async (contactId: string, name: string) => {
    try {
    const added = await toggleCloseFriend(contactId);
    setCloseFriendIds((prev) => {
      const next = new Set(prev);
      if (added) { next.add(contactId); toast.success(`${name} added to Close Friends`); }
      else { next.delete(contactId); toast.success(`${name} removed from Close Friends`); }
      return next;
    });
    } catch { toast.error("Could not save close friends"); }
  };

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.username.toLowerCase().includes(search.toLowerCase())
  );

  const closeFriendsList = filtered.filter((c) => closeFriendIds.has(c.id));
  const othersList = filtered.filter((c) => !closeFriendIds.has(c.id));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-border/50 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-[17px]">Close Friends</h1>
            <p className="text-[11px] text-muted-foreground">{closeFriendIds.size} friends</p>
          </div>
        </div>
        <div className="relative px-4 pb-3">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-muted border border-border/50 text-[14px] outline-none focus:border-primary/50 transition-colors"
            data-testid="input-search-close-friends"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 bg-emerald-500/8 border-b border-emerald-500/15">
          <p className="text-[13px] text-emerald-500 font-medium">
            Share stories exclusively with Close Friends — they see a green ring.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading...</div>
        ) : (
          <>
            {closeFriendsList.length > 0 && (
              <div>
                <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Close Friends ({closeFriendsList.length})</p>
                {closeFriendsList.map((c) => (
                  <ContactRow key={c.id} contact={c} isClose={true} onToggle={() => handleToggle(c.id, c.name)} />
                ))}
              </div>
            )}

            <div>
              <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {closeFriendsList.length > 0 ? "Other Contacts" : "All Contacts"} ({othersList.length})
              </p>
              {othersList.length === 0 && !search && (
                <p className="text-center text-muted-foreground text-sm py-8">No contacts found</p>
              )}
              {othersList.map((c) => (
                <ContactRow key={c.id} contact={c} isClose={false} onToggle={() => handleToggle(c.id, c.name)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function ContactRow({ contact, isClose, onToggle }: { contact: Contact; isClose: boolean; onToggle: () => void }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onToggle}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer"
      data-testid={`contact-close-friend-${contact.id}`}
    >
      <div className={`p-[2px] rounded-full ${isClose ? "bg-gradient-to-tr from-green-400 to-emerald-500" : "bg-transparent"}`}>
        <div className="p-[1px] rounded-full bg-background">
          <ChatAvatar name={contact.name} src={contact.avatar_url || undefined} size="sm" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[14px] truncate">{contact.name}</p>
        <p className="text-xs text-muted-foreground">@{contact.username}</p>
      </div>
      <div className={`p-2 rounded-full transition-colors ${isClose ? "bg-green-500/15" : "bg-muted"}`}>
        <Star className={`h-4 w-4 ${isClose ? "fill-green-500 text-green-500" : "text-muted-foreground"}`} />
      </div>
    </motion.div>
  );
}

export default CloseFriends;
