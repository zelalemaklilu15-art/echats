// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Share2, Loader2, Link2, Wallet, Home, BarChart2, User, RefreshCw, QrCode, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile, type Profile } from "@/lib/supabaseService";
import { toast } from "sonner";
import { publicOrigin } from "@/lib/native";
import { paymentLink } from "@/lib/paymentLinks";

/* ─── tokens ─── */
const BG   = "hsl(var(--surface-lowest))";
const CARD = "hsl(var(--surface-low))";
const P    = "hsl(var(--tertiary))";

const WalletQR = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile,     setProfile]     = useState<Profile | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [copiedId,    setCopiedId]    = useState(false);
  const [copiedLink,  setCopiedLink]  = useState(false);
  const [qrKey,       setQrKey]       = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    getProfile(user.id).then(p => setProfile(p)).finally(() => setLoading(false));
  }, [user?.id]);

  const walletId    = user?.id ?? "";
  const displayName = profile?.name || user?.email?.split("@")[0] || "User";
  const username    = profile?.username || "";

  /* Masked wallet ID: **** **** XXXX using last 4 chars */
  const last4       = walletId.slice(-4).toUpperCase();
  const maskedId    = `**** **** ${last4}`;
  const deepLink    = paymentLink(publicOrigin(), username || walletId);
  const payLink     = deepLink.replace(/^https?:\/\//, '');
  const qrValue     = deepLink;

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(walletId).catch(() => {});
    setCopiedId(true); setTimeout(() => setCopiedId(false), 2000);
    toast.success("Wallet ID copied");
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(deepLink).catch(() => {});
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Payment link copied");
  };

  const handleShare = async () => {
    const data = { title: `Pay ${displayName} on Echat`, text: `Send money to ${displayName}`, url: deepLink };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else await handleCopyLink();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: P }} />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col pb-28" style={{ background: BG }}>

      {/* ── HEADER ── */}
      <div className="flex items-center px-4 pt-12 pb-5">
        <motion.button whileTap={{ scale: 0.88 }}
          onClick={() => navigate("/wallet")}
          className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft style={{ color: "hsl(var(--foreground) / 0.85)", width: 22, height: 22 }} />
        </motion.button>
        <h1 className="flex-1 text-center font-bold text-[18px] text-foreground">QR Pay</h1>
        <div className="w-9" />
      </div>

      <div className="px-4 flex-1 space-y-4">

        {/* ── MAIN QR CARD ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl overflow-hidden"
          style={{ background: CARD, border: "1px solid hsl(var(--foreground) / 0.08)" }}>

          {/* QR image area — white polaroid frame → amber bg → QR code */}
          <div className="flex items-center justify-center pt-6 pb-6 px-8">
            <div className="rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: "#fff", padding: 14, boxShadow: "0 8px 32px hsl(var(--surface-lowest) / 0.35)" }}>
              <div className="rounded-xl overflow-hidden flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--tertiary)) 0%, hsl(var(--tertiary)) 35%, hsl(var(--tertiary)) 65%, hsl(var(--tertiary)) 100%)",
                  padding: "24px 28px 32px 28px",
                }}>
                <div className="bg-white rounded-lg p-2 shadow-lg">
                  <QRCodeSVG
                    key={qrKey}
                    value={qrValue || "echat://pay/demo"}
                    size={160}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Text + Refresh */}
          <div className="flex flex-col items-center pb-6 px-5">
            <p className="font-bold text-[19px] text-foreground mb-1">Scan to Pay</p>
            <p className="text-[13px] text-center mb-4" style={{ color: "hsl(var(--foreground) / 0.45)" }}>
              Hold the code within the scanner's frame
            </p>
            <motion.button whileTap={{ scale: 0.92 }}
              onClick={() => setQrKey(k => k + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full"
              style={{ border: `1px solid hsl(var(--tertiary) / 0.55)`, background: "hsl(var(--tertiary) / 0.1)" }}
              data-testid="button-refresh-qr">
              <RefreshCw style={{ color: P, width: 14, height: 14 }} />
              <span className="text-[13px] font-semibold" style={{ color: P }}>Refresh QR</span>
            </motion.button>
          </div>
        </motion.div>

        {/* ── YOUR WALLET ID row ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl"
          style={{ background: CARD, border: "1px solid hsl(var(--foreground) / 0.07)" }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "hsl(var(--tertiary) / 0.25)" }}>
            <Wallet style={{ color: "hsl(var(--primary))", width: 20, height: 20 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5"
              style={{ color: "hsl(var(--foreground) / 0.4)" }}>Your Wallet ID</p>
            <p className="font-bold text-[15px] text-foreground tracking-wide">{maskedId}</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleCopyId}
            className="px-4 py-2 rounded-full font-bold text-[13px]"
            style={{ background: "hsl(var(--foreground) / 0.12)", color: "hsl(var(--foreground))" }}
            data-testid="button-copy-wallet-id">
            {copiedId ? <Check style={{ width: 14, height: 14, color: "hsl(var(--cosmic-mint))" }} /> : "Copy"}
          </motion.button>
        </motion.div>

        {/* ── PAYMENT LINK row ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl"
          style={{ background: CARD, border: "1px solid hsl(var(--foreground) / 0.07)" }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "hsl(var(--tertiary) / 0.25)" }}>
            <Link2 style={{ color: "hsl(var(--primary))", width: 20, height: 20 }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] mb-0.5"
              style={{ color: "hsl(var(--foreground) / 0.4)" }}>Payment Link</p>
            <p className="font-bold text-[15px] text-foreground truncate">{payLink}</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleCopyLink}
            className="px-4 py-2 rounded-full font-bold text-[13px]"
            style={{ background: "hsl(var(--foreground) / 0.12)", color: "hsl(var(--foreground))" }}
            data-testid="button-copy-payment-link">
            {copiedLink ? <Check style={{ width: 14, height: 14, color: "hsl(var(--cosmic-mint))" }} /> : "Copy"}
          </motion.button>
        </motion.div>

        {/* ── SHARE VIA... BUTTON ── */}
        <motion.button whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          onClick={handleShare}
          className="w-full py-4 rounded-full font-bold text-[16px] text-foreground flex items-center justify-center gap-2.5"
          style={{ background: P, boxShadow: "0 6px 24px hsl(var(--tertiary) / 0.45)" }}
          data-testid="button-share-qr">
          <Upload style={{ width: 18, height: 18 }} />
          Share via...
        </motion.button>

        {/* Info text */}
        <p className="text-center text-[12px] px-4 pb-2" style={{ color: "hsl(var(--foreground) / 0.38)" }}>
          Sharing your QR code or payment link allows others to send you funds instantly and securely.
        </p>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
        style={{ background: BG, borderTop: "1px solid hsl(var(--foreground) / 0.07)", boxShadow: "0 -8px 32px hsl(var(--surface-lowest) / 0.45)" }}>
        <div className="flex items-end justify-around px-2" style={{ height: 68 }}>
          {/* Home */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/wallet")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <Home style={{ color: "hsl(var(--foreground) / 0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--foreground) / 0.38)" }}>Home</span>
          </motion.button>
          {/* Wallet (active) */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/wallet")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <Wallet style={{ color: P, width: 22, height: 22 }} />
            <span className="text-[10px] font-bold" style={{ color: P }}>Wallet</span>
          </motion.button>
          {/* Center QR button (raised) */}
          <div className="flex-1 flex items-start justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ marginTop: -22, background: `linear-gradient(135deg, ${P}, hsl(var(--secondary)))`, boxShadow: `0 4px 20px hsl(var(--tertiary) / 0.6), 0 0 0 4px ${BG}` }}>
              <QrCode style={{ color: "hsl(var(--foreground))", width: 24, height: 24 }} />
            </div>
          </div>
          {/* Insights */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/transaction-history")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <BarChart2 style={{ color: "hsl(var(--foreground) / 0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--foreground) / 0.38)" }}>Insights</span>
          </motion.button>
          {/* Profile */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/profile")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <User style={{ color: "hsl(var(--foreground) / 0.38)", width: 22, height: 22 }} />
            <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--foreground) / 0.38)" }}>Profile</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default WalletQR;
