import { Star, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGiftById, RARITY_COLORS, RARITY_BG, convertGiftToStars, type SentGift } from "@/lib/giftsService";
import { toast } from "sonner";
import { useState } from "react";

interface GiftMessageBubbleProps {
  gift: SentGift;
  isOwn: boolean;
  isReceiver: boolean;
}

export const GiftMessageBubble = ({ gift, isOwn, isReceiver }: GiftMessageBubbleProps) => {
  const giftDef = getGiftById(gift.giftId);
  const [converted, setConverted] = useState(gift.converted);

  if (!giftDef) return null;

  const handleConvert = async () => {
    const stars = await convertGiftToStars(gift.id);
    if (stars > 0) {
      setConverted(true);
      toast.success(`Converted to ${stars} ⭐ Stars!`);
    }
  };

  return (
    <div className={cn(
      "rounded-2xl p-4 min-w-[180px] text-center",
      RARITY_BG[giftDef.rarity],
      "border border-current/10"
    )}>
      <div className="text-5xl mb-2 animate-bounce">{giftDef.emoji}</div>
      <p className="font-bold text-sm">{giftDef.name}</p>
      <p className={cn("text-xs capitalize font-medium mb-1", RARITY_COLORS[giftDef.rarity])}>
        {giftDef.rarity} Gift
      </p>
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-2">
        <Star className="h-3 w-3 text-yellow-500" />
        <span>{giftDef.stars} Stars</span>
      </div>
      {gift.message && (
        <p className="text-xs text-muted-foreground italic mb-2">"{gift.message}"</p>
      )}
      {isReceiver && !converted && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handleConvert}
        >
          <RefreshCw className="h-3 w-3" />
          Convert to Stars
        </Button>
      )}
      {converted && (
        <p className="text-xs text-muted-foreground">Converted to Stars</p>
      )}
    </div>
  );
};
