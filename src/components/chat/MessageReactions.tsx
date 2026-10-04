// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getReactions, addReaction, groupReactions, type ReactionGroup } from "@/lib/reactionService";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  rotate: number;
}

interface MessageReactionsProps {
  messageId: string;
  isOwn: boolean;
}

function ReactionBurst({ particles }: { particles: Particle[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, y: 0, x: p.x, scale: 1, rotate: 0 }}
            animate={{ opacity: 0, y: -70, x: p.x + (p.rotate > 0 ? 8 : -8), scale: 0.6, rotate: p.rotate }}
            exit={{}}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.4, 1] }}
            className="absolute bottom-0 left-1/2 text-base select-none"
            style={{ marginLeft: "-0.5em" }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function MessageReactions({ messageId, isOwn }: MessageReactionsProps) {
  const { userId } = useAuth();
  const [reactions, setReactions] = useState<ReactionGroup[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [particleCounter, setParticleCounter] = useState(0);

  useEffect(() => {
    if (!messageId || !userId) return;

    getReactions(messageId).then((data) => {
      setReactions(groupReactions(data, userId));
    });

    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions", filter: `message_id=eq.${messageId}` }, () => {
        getReactions(messageId).then((data) => {
          setReactions(groupReactions(data, userId));
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [messageId, userId]);

  const spawnParticles = useCallback((emoji: string) => {
    const newParticles: Particle[] = Array.from({ length: 9 }, (_, i) => ({
      id: particleCounter + i,
      emoji,
      x: (Math.random() - 0.5) * 44,
      rotate: (Math.random() - 0.5) * 60,
    }));
    setParticleCounter((c) => c + 9);
    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 900);
  }, [particleCounter]);

  const handleReact = async (emoji: string) => {
    setShowPicker(false);
    spawnParticles(emoji);
    await addReaction(messageId, emoji);
  };

  return (
    <div className={cn("relative", isOwn ? "flex justify-end" : "flex justify-start")}>
      <ReactionBurst particles={particles} />

      {reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {reactions.map((group, idx) => (
            <motion.button
              key={group.emoji}
              initial={{ scale: 0, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ delay: idx * 0.05, type: "spring", stiffness: 460, damping: 18 }}
              whileTap={{ scale: 0.75 }}
              whileHover={{ scale: 1.12 }}
              onClick={() => handleReact(group.emoji)}
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                group.hasOwn
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <span>{group.emoji}</span>
              <span className="font-medium">{group.count}</span>
            </motion.button>
          ))}
          <motion.button
            whileTap={{ scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setShowPicker(!showPicker)}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border border-border bg-muted/30 text-muted-foreground hover:bg-muted transition-colors"
          >
            +
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 8 }}
            transition={{ type: "spring", stiffness: 480, damping: 24 }}
            className={cn(
              "absolute z-50 bottom-full mb-1 flex gap-1 p-2 rounded-2xl bg-popover border border-border shadow-xl",
              isOwn ? "right-0" : "left-0"
            )}
          >
            {QUICK_EMOJIS.map((emoji, i) => (
              <motion.button
                key={emoji}
                initial={{ opacity: 0, scale: 0.4, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: "spring", stiffness: 500, damping: 20 }}
                whileHover={{ scale: 1.4, rotate: 12 }}
                whileTap={{ scale: 0.8 }}
                onClick={() => handleReact(emoji)}
                className="text-lg hover:bg-muted rounded-xl w-9 h-9 flex items-center justify-center transition-colors"
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {reactions.length === 0 && (
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => setShowPicker(!showPicker)}
          className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground mt-0.5"
        >
          😀
        </motion.button>
      )}
    </div>
  );
}
