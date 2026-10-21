import { useEffect, useState } from "react";
import OtpSheet from "./OtpSheet";
import PinSetupSheet from "./PinSetupSheet";

/** Forgot / change PIN: email code first (high-risk), then set the new PIN. */
export default function PinResetFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stage, setStage] = useState<"otp" | "pin" | null>(null);
  useEffect(() => { setStage(open ? "otp" : null); }, [open]);
  return (
    <>
      <OtpSheet open={stage === "otp"} onOpenChange={(o) => !o && onClose()}
        reason="Resetting your wallet PIN needs an email code." onVerified={() => setStage("pin")} />
      <PinSetupSheet open={stage === "pin"} onOpenChange={(o) => !o && onClose()} onDone={onClose}
        onStepUpRequired={() => setStage("otp")} />
    </>
  );
}
