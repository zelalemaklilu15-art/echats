import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import PinPad from "./PinPad";
import { setWalletPinAsync } from "@/lib/chatLockService";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void; onStepUpRequired?: () => void; }

/** Create (or reset after email check) a 4- or 6-digit wallet PIN. Hashed on the server. */
export default function PinSetupSheet({ open, onOpenChange, onDone, onStepUpRequired }: Props) {
  const [len, setLen] = useState<4 | 6>(6);
  const [stage, setStage] = useState<"enter" | "confirm">("enter");
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setStage("enter"); setFirst(""); setPin(""); setError(""); } }, [open]);

  useEffect(() => {
    if (pin.length !== len) return;
    if (stage === "enter") { setFirst(pin); setPin(""); setStage("confirm"); return; }
    if (pin !== first) { setError("PINs don't match. Try again."); setPin(""); setFirst(""); setStage("enter"); return; }
    (async () => {
      setBusy(true);
      try { await setWalletPinAsync(pin); toast.success("Wallet PIN saved"); onDone(); }
      catch (e) {
        const msg = (e as Error).message || "";
        if (msg.includes("STEP_UP_REQUIRED")) onStepUpRequired?.();
        else setError(msg.includes("WALLET_NOT_FOUND") ? "Activate your wallet first." : "Could not save PIN");
        setPin(""); setStage("enter");
      } finally { setBusy(false); }
    })();
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Drawer open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DrawerContent className="bg-card border-border pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <DrawerHeader className="text-center">
          <KeyRound className="mx-auto h-8 w-8 text-primary" />
          <DrawerTitle className="font-display text-foreground">
            {stage === "enter" ? "Create your Wallet PIN" : "Confirm your PIN"}
          </DrawerTitle>
          <DrawerDescription className="text-muted-foreground">You'll use it for every payment.</DrawerDescription>
        </DrawerHeader>
        <div className="px-6 flex flex-col items-center gap-4">
          {stage === "enter" && (
            <div className="flex gap-2">
              {[4, 6].map((n) => (
                <Button key={n} size="sm" variant={len === n ? "default" : "outline"} onClick={() => { setLen(n as 4 | 6); setPin(""); }}>
                  {n} digits
                </Button>
              ))}
            </div>
          )}
          <PinPad value={pin} onChange={(v) => { setError(""); setPin(v); }} length={len} disabled={busy} />
          {busy && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
