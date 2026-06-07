// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export interface Gift {
  id: string;
  emoji: string;
  name: string;
  stars: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  animated?: boolean;
}

export interface SentGift {
  id: string;
  giftId: string;
  senderId: string;
  receiverId: string;
  chatId: string;
  message?: string;
  sentAt: string;
  converted: boolean;
  stars?: number;
}

export interface StarsPurchasePackage {
  id: string;
  name: string;
  stars: number;
  bonus: number;
  price: number;
  popular?: boolean;
  badge?: string;
}

export interface StarsPurchase {
  id: string;
  stars: number;
  bonusStars: number;
  price: number;
  purchasedAt: string;
}

export const BUY_STARS_PACKAGES: StarsPurchasePackage[] = [
  { id: "starter", name: "Starter Pack", stars: 100,   bonus: 0, price: 120 },
  { id: "pro",     name: "Pro Pack",     stars: 500,   bonus: 0, price: 550,  popular: true },
  { id: "whale",   name: "Whale Pack",   stars: 2500,  bonus: 0, price: 2400 },
  { id: "legend",  name: "Legend Pack",  stars: 10000, bonus: 0, price: 8900 },
];

export const AVAILABLE_GIFTS: Gift[] = [
  { id: "rose",      emoji: "🌹", name: "Red Rose",       stars: 10,   rarity: "common" },
  { id: "butterfly", emoji: "🦋", name: "Butterfly",      stars: 15,   rarity: "common" },
  { id: "cherry",    emoji: "🍒", name: "Lucky Cherries", stars: 5,    rarity: "common" },
  { id: "fire",      emoji: "🔥", name: "Fire Spirit",    stars: 30,   rarity: "common" },
  { id: "star",      emoji: "⭐", name: "Shooting Star",  stars: 25,   rarity: "common" },
  { id: "cake",      emoji: "🎂", name: "Birthday Cake",  stars: 25,   rarity: "common" },
  { id: "moon",      emoji: "🌙", name: "Silver Moon",    stars: 45,   rarity: "rare" },
  { id: "heart",     emoji: "💖", name: "Diamond Heart",  stars: 50,   rarity: "rare" },
  { id: "rocket",    emoji: "🚀", name: "Space Rocket",   stars: 75,   rarity: "rare" },
  { id: "lightning", emoji: "⚡", name: "Thunder",        stars: 80,   rarity: "rare" },
  { id: "trophy",    emoji: "🏆", name: "Golden Trophy",  stars: 100,  rarity: "rare" },
  { id: "rainbow",   emoji: "🌈", name: "Rainbow",        stars: 150,  rarity: "epic" },
  { id: "gem",       emoji: "💎", name: "Precious Gem",   stars: 200,  rarity: "epic" },
  { id: "unicorn",   emoji: "🦄", name: "Magic Unicorn",  stars: 250,  rarity: "epic" },
  { id: "crystal",   emoji: "🔮", name: "Crystal Ball",   stars: 300,  rarity: "legendary" },
  { id: "dragon",    emoji: "🐉", name: "Lucky Dragon",   stars: 500,  rarity: "epic" },
  { id: "planet",    emoji: "🪐", name: "Mystery Planet", stars: 750,  rarity: "legendary" },
  { id: "crown",     emoji: "👑", name: "Royal Crown",    stars: 1000, rarity: "legendary" },
];

let starsBalanceCache = 0;
let sentGiftsCache: SentGift[] = [];

function mapGift(row: any): SentGift {
  return {
    id: row.id,
    giftId: row.gift_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    chatId: row.chat_id,
    message: row.message ?? undefined,
    sentAt: row.sent_at,
    converted: !!row.converted,
    stars: row.stars_converted ?? row.stars,
  };
}

export function getStarsBalance(): number {
  return starsBalanceCache;
}

export async function refreshStarsBalance(): Promise<number> {
  const { data, error } = await (supabase as any).rpc("get_stars_balance");
  if (error) throw error;
  starsBalanceCache = Number(data ?? 0);
  return starsBalanceCache;
}

export async function getStarsPurchaseHistory(): Promise<StarsPurchase[]> {
  const { data, error } = await (supabase as any)
    .from("stars_purchases")
    .select("id, stars, bonus_stars, price, purchased_at")
    .order("purchased_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    stars: row.stars,
    bonusStars: row.bonus_stars,
    price: Number(row.price),
    purchasedAt: row.purchased_at,
  }));
}

export async function buyStarsWithWallet(stars: number, bonus: number, price: number): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("purchase_stars_with_wallet", {
    p_stars: stars,
    p_bonus: bonus,
    p_price: price,
    p_idempotency_key: `${Date.now()}-${crypto.randomUUID()}`,
  });
  if (error) return false;
  const row = Array.isArray(data) ? data[0] : data;
  starsBalanceCache = Number(row?.balance ?? starsBalanceCache);
  return !!row?.success;
}

export async function sendGift(
  giftId: string,
  senderId: string,
  receiverId: string,
  chatId: string,
  message?: string,
): Promise<SentGift | null> {
  const gift = AVAILABLE_GIFTS.find(g => g.id === giftId);
  if (!gift) return null;
  const { data, error } = await (supabase as any).rpc("send_chat_gift", {
    p_gift_id: giftId,
    p_receiver_id: receiverId,
    p_chat_id: chatId,
    p_message: message ?? null,
    p_stars: gift.stars,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.success) return null;
  starsBalanceCache = Number(row.balance ?? starsBalanceCache);
  const sentGift: SentGift = { id: row.gift_instance_id, giftId, senderId, receiverId, chatId, message, sentAt: new Date().toISOString(), converted: false };
  sentGiftsCache = [sentGift, ...sentGiftsCache];
  return sentGift;
}

export async function convertGiftToStars(giftInstanceId: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("convert_chat_gift_to_stars", {
    p_gift_instance_id: giftInstanceId,
  });
  if (error) return 0;
  const row = Array.isArray(data) ? data[0] : data;
  starsBalanceCache = Number(row?.balance ?? starsBalanceCache);
  sentGiftsCache = sentGiftsCache.map(g => g.id === giftInstanceId ? { ...g, converted: true, stars: row?.stars_added } : g);
  return Number(row?.stars_added ?? 0);
}

export async function getReceivedGifts(userId: string): Promise<SentGift[]> {
  const { data, error } = await (supabase as any)
    .from("stars_gifts")
    .select("*")
    .eq("receiver_id", userId)
    .order("sent_at", { ascending: false })
    .limit(100);
  if (error) return sentGiftsCache.filter(g => g.receiverId === userId);
  sentGiftsCache = (data ?? []).map(mapGift);
  return sentGiftsCache;
}

export async function getSentGifts(userId: string): Promise<SentGift[]> {
  const { data, error } = await (supabase as any)
    .from("stars_gifts")
    .select("*")
    .eq("sender_id", userId)
    .order("sent_at", { ascending: false })
    .limit(100);
  if (error) return sentGiftsCache.filter(g => g.senderId === userId);
  sentGiftsCache = (data ?? []).map(mapGift);
  return sentGiftsCache;
}

export function getGiftById(giftId: string): Gift | undefined {
  return AVAILABLE_GIFTS.find(g => g.id === giftId);
}

export const RARITY_COLORS: Record<string, string> = {
  common:    "text-slate-400",
  rare:      "text-blue-400",
  epic:      "text-purple-400",
  legendary: "text-yellow-400",
};

export const RARITY_GLOW: Record<string, string> = {
  common:    "",
  rare:      "shadow-blue-500/20",
  epic:      "shadow-purple-500/30",
  legendary: "shadow-yellow-500/40",
};

export const RARITY_BORDER: Record<string, string> = {
  common:    "border-border/60",
  rare:      "border-blue-500/30",
  epic:      "border-purple-500/40",
  legendary: "border-yellow-500/50",
};

export const RARITY_BG: Record<string, string> = {
  common:    "bg-muted/50",
  rare:      "bg-blue-500/8",
  epic:      "bg-purple-500/8",
  legendary: "bg-yellow-500/10",
};

export const RARITY_LABEL: Record<string, string> = {
  common:    "Common",
  rare:      "Rare",
  epic:      "Epic",
  legendary: "Legendary",
};
