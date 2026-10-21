import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import PinPad from "./PinPad";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  summary?: string;
  error?: string;
  busy?: boolean;
  onSubmit: (pin: string) => void;
  onForgot?: () => void;
}

/** Bottom sheet asking for the wallet PIN before a money-moving action. */
export default function PinConfirmSheet({ open, onOpenChange, title = "Enter Wallet PIN", summary, error, busy, onSubmit, onForgot }: Props) {
  const [pin, setPin] = useState("");
  useEffect(() => { if (open) setPin(""); }, [open]);
  useEffect(() => { if (error) setPin(""); }, [error]);
  const ok = pin.length === 4 || pin.length === 6;

  return (
    <Drawer open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DrawerContent className="bg-card border-border pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <DrawerHeader className="text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <DrawerTitle className="font-display text-foreground">{title}</DrawerTitle>
          {summary && <DrawerDescription className="text-muted-foreground">{summary}</DrawerDescription>}
        </DrawerHeader>
        <div className="px-6 flex flex-col items-center gap-4">
          <PinPad value={pin} onChange={setPin} length={6} disabled={busy} />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button className="w-full max-w-[280px]" disabled={!ok || busy} onClick={() => onSubmit(pin)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
          </Button>
          {onForgot && <button type="button" onClick={onForgot} className="text-sm text-primary">Forgot PIN?</button>}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
