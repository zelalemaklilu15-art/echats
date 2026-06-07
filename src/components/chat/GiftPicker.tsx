import { useEffect, useState } from "react";
import { Gift as GiftIcon, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AVAILABLE_GIFTS,
  getStarsBalance,
  refreshStarsBalance,
  RARITY_COLORS,
  RARITY_BG,
  type Gift,
} from "@/lib/giftsService";
import { toast } from "sonner";

interface GiftPickerProps {
  open: boolean;
  onClose: () => void;
  onSend: (giftId: string, message?: string) => void;
}

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];

export const GiftPicker = ({ open, onClose, onSend }: GiftPickerProps) => {
  const [selected, setSelected] = useState<Gift | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const [balance, setBalance] = useState(getStarsBalance());

  useEffect(() => {
    if (!open) return;
    refreshStarsBalance().then(setBalance).catch(() => setBalance(getStarsBalance()));
  }, [open]);

  const filtered = filter === "all"
    ? AVAILABLE_GIFTS
    : AVAILABLE_GIFTS.filter(g => g.rarity === filter);

  const sorted = [...filtered].sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );

  const handleSend = () => {
    if (!selected) return;
    if (balance < selected.stars) {
      toast.error(`Not enough Stars. You need ${selected.stars} ⭐ but have ${balance} ⭐`);
      return;
    }
    onSend(selected.id, message.trim() || undefined);
    setSelected(null);
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <GiftIcon className="h-5 w-5 text-primary" />
              Send a Gift
            </span>
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <Star className="h-4 w-4 text-yellow-500" />
              {balance} Stars
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          {["all", "common", "rare", "epic", "legendary"].map(r => (
            <Button
              key={r}
              variant={filter === r ? "default" : "outline"}
              size="sm"
              className="capitalize text-xs h-7"
              onClick={() => setFilter(r)}
            >
              {r}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 overflow-y-auto flex-1 pr-1">
          {sorted.map(gift => (
            <button
              key={gift.id}
              onClick={() => setSelected(gift)}
              className={cn(
                "rounded-xl p-2.5 flex flex-col items-center gap-1 border-2 transition-all",
                RARITY_BG[gift.rarity],
                selected?.id === gift.id
                  ? "border-primary scale-[1.03]"
                  : "border-transparent hover:border-border"
              )}
            >
              <span className="text-3xl">{gift.emoji}</span>
              <span className="text-xs font-medium leading-tight text-center">{gift.name}</span>
              <span className={cn("text-xs font-semibold flex items-center gap-0.5", RARITY_COLORS[gift.rarity])}>
                <Star className="h-2.5 w-2.5" />
                {gift.stars}
              </span>
              <Badge
                variant="outline"
                className={cn("text-[10px] h-4 capitalize px-1", RARITY_COLORS[gift.rarity])}
              >
                {gift.rarity}
              </Badge>
            </button>
          ))}
        </div>

        {selected && (
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
              <span className="text-2xl">{selected.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{selected.name}</p>
                <p className={cn("text-xs", RARITY_COLORS[selected.rarity])}>
                  {selected.stars} Stars • {selected.rarity}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a message... (optional)"
              rows={2}
              className="resize-none text-sm"
            />
            <Button
              onClick={handleSend}
              className="w-full"
              disabled={balance < selected.stars}
            >
              {balance < selected.stars
                ? `Need ${selected.stars - balance} more Stars`
                : `Send ${selected.emoji} for ${selected.stars} ⭐`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
