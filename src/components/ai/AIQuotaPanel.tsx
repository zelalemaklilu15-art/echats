import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import WalletPurchaseConfirm from "@/components/wallet/WalletPurchaseConfirm";
import { getDeviceId, newIdempotencyKey } from "@/lib/walletSecurity";

export const AI_QUOTA_EVENT = "echat:ai-quota-changed";

type Status = { used: number; daily_limit: number; is_premium: boolean; premium_expires_at: string | null };

const PLANS = [
  { id: "day", label: "1 ቀን", stars: 50, birr: 10 },
  { id: "month", label: "30 ቀን", stars: 500, birr: 100 },
] as const;

export function useAIQuota() {
  const [status, setStatus] = useState<Status | null>(null);
  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("get_ai_quota_status" as any);
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setStatus(row as Status);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(AI_QUOTA_EVENT, refresh);
    return () => window.removeEventListener(AI_QUOTA_EVENT, refresh);
  }, [refresh]);
  return { status, refresh };
}

export function AIQuotaBadge() {
  const { status } = useAIQuota();
  if (!status) return null;
  if (status.is_premium) {
    return <span className="text-[11px] text-primary flex items-center gap-1"><Crown className="h-3 w-3" /> Premium</span>;
  }
  const left = Math.max(0, status.daily_limit - status.used);
  return <span className="text-[11px] text-muted-foreground">ዛሬ የቀረ፦ {left}/{status.daily_limit}</span>;
}

export default function AIQuotaPanel() {
  const { status, refresh } = useAIQuota();
  const [busy, setBusy] = useState<string | null>(null);
  const [walletPlan, setWalletPlan] = useState<{ id: string; birr: number; key: string } | null>(null);

  const request = async (plan: string, method: "stars" | "wallet", key = newIdempotencyKey("ai"), pin?: string) => {
    setBusy(`${plan}-${method}`);
    try {
      const { data, error } = await supabase.rpc("purchase_ai_premium_secure" as any, {
        p_plan: plan, p_method: method, p_key: key, p_pin: pin ?? null, p_device: method === "wallet" ? await getDeviceId() : null,
      });
      return error ? { success: false, error: "Could not complete purchase. Please retry." } : data as { success: boolean; error?: string };
    } finally { setBusy(null); }
  };
  const done = () => {
    toast.success("Echat AI Premium ገቢር ሆኗል 🎉");
    refresh();
  };
  const buyWithStars = async (plan: string) => {
    const r = await request(plan, "stars");
    if (r.success) done(); else toast.error(r.error || "Purchase failed");
  };

  const left = status ? Math.max(0, status.daily_limit - status.used) : null;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">የAI አጠቃቀም</Label>
      <div className="p-3 rounded-xl border border-border bg-card text-sm">
        {!status ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status.is_premium ? (
          <p className="flex items-center gap-2 text-primary font-medium">
            <Crown className="h-4 w-4" /> Premium — ያልተገደበ፣ እስከ {new Date(status.premium_expires_at!).toLocaleString()}
          </p>
        ) : (
          <p>ዛሬ የቀረ ነጻ ጥያቄ፦ <b>{left}/{status.daily_limit}</b></p>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Echat AI Premium — ያልተገደበ ጥያቄ እና ጥልቅ ትንተና</p>
        {PLANS.map(p => (
          <div key={p.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
            <p className="text-sm font-semibold">{p.label}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void buyWithStars(p.id)}>
                {busy === `${p.id}-stars` ? <Loader2 className="h-4 w-4 animate-spin" /> : `⭐ ${p.stars} Stars`}
              </Button>
              <Button size="sm" disabled={!!busy} onClick={() => setWalletPlan({ id: p.id, birr: p.birr, key: newIdempotencyKey("ai") })}>
                {busy === `${p.id}-wallet` ? <Loader2 className="h-4 w-4 animate-spin" /> : `${p.birr} ብር (Wallet)`}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {walletPlan && <WalletPurchaseConfirm open onClose={() => setWalletPlan(null)}
        summary={`Pay ${walletPlan.birr} ETB for Echat AI Premium`}
        purchase={pin => request(walletPlan.id, "wallet", walletPlan.key, pin)}
        onDone={() => { setWalletPlan(null); done(); }} />}
    </div>
  );
}
