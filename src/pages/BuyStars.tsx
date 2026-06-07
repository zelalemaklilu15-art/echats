import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Star, Sparkles, Award, Wallet,
  Gift, Check, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BUY_STARS_PACKAGES,
  buyStarsWithWallet,
  getStarsBalance,
  refreshStarsBalance,
  type StarsPurchasePackage,
} from "@/lib/giftsService";
import { walletService } from "@/lib/walletService";
import { toast } from "sonner";

/* ─── design tokens ─── */
const BG   = "#0D0A1A";
const CARD = "#16102A";
const P    = "#7C3AED";
const PA   = "rgba(124,58,237,0.18)";

function formatETB(n: number) {
  return n.toLocaleString("en-ET", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* icon and sub-label per package */
const PKG_META: Record<string, { icon: typeof Star; starsLabel: string }> = {
  starter: { icon: Star,     starsLabel: "100 Stars"    },
  pro:     { icon: Star,     starsLabel: "500 Stars"    },
  whale:   { icon: Sparkles, starsLabel: "2,500 Stars"  },
  legend:  { icon: Award,    starsLabel: "10,000 Stars" },
};

type Tab = "packages" | "gifts";

export default function BuyStars() {
  const navigate = useNavigate();
  const [tab,           setTab]          = useState<Tab>("packages");
  const [starsBalance,  setStarsBalance] = useState(getStarsBalance);
  const [walletBalance, setWalletBalance]= useState(() => walletService.getCachedBalance());
  const [selected,      setSelected]     = useState<StarsPurchasePackage | null>(null);
  const [purchasing,    setPurchasing]   = useState(false);

  useEffect(() => {
    refreshStarsBalance().then(setStarsBalance).catch(() => {});
    walletService.getWalletBalance().then(d => {
      if (d.wallet) setWalletBalance(d.wallet.balance);
    }).catch(() => {});
  }, []);

  const handleBuy = async (pkg: StarsPurchasePackage) => {
    setSelected(pkg);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setPurchasing(true);
    await new Promise(r => setTimeout(r, 900));
    const ok = await buyStarsWithWallet(selected.stars, selected.bonus, selected.price);
    if (ok) {
      setStarsBalance(getStarsBalance());
      walletService.getWalletBalance(true).then(d => {
        if (d.wallet) setWalletBalance(d.wallet.balance);
      }).catch(() => {});
      toast.success(`${(selected.stars + selected.bonus).toLocaleString()} Stars added to your account!`);
      setSelected(null);
      navigate("/gifts");
    } else {
      toast.error("Insufficient wallet balance. Please top up your wallet.");
      setSelected(null);
    }
    setPurchasing(false);
  };

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 80 }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "48px 16px 12px", gap: 8 }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/gifts")}
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          data-testid="button-back-buy-stars">
          <ArrowLeft style={{ color: "rgba(255,255,255,0.85)", width: 22, height: 22 }} />
        </motion.button>

        <h1 style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 18, color: "#fff", margin: 0 }}>
          Buy Stars
        </h1>

        {/* Stars balance pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: PA,
          border: "1px solid rgba(124,58,237,0.35)",
          borderRadius: 999, padding: "5px 12px",
        }} data-testid="stars-balance-pill">
          <div style={{
            width: 16, height: 16, borderRadius: "50%",
            border: "1.5px solid #a78bfa",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Star style={{ color: "#a78bfa", width: 9, height: 9 }} fill="#a78bfa" />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>
            {starsBalance.toLocaleString()} Stars
          </span>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", padding: "0 16px", gap: 20, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 0 }}>
        {(["packages", "gifts"] as Tab[]).map(t => (
          <button key={t}
            onClick={() => t === "gifts" ? navigate("/gifts") : setTab(t)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "12px 0",
              fontSize: 15, fontWeight: 700,
              color: tab === t ? P : "rgba(255,255,255,0.4)",
              borderBottom: tab === t ? `2.5px solid ${P}` : "2.5px solid transparent",
              marginBottom: -1,
            }}
            data-testid={`tab-${t}`}
          >
            {t === "packages" ? "Buy Packages" : "My Gifts"}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px 16px" }}>

        {/* ── HERO ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          {/* Purple ring + filled inner circle with star */}
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            border: "2px solid rgba(124,58,237,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
            background: "rgba(124,58,237,0.06)",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: `linear-gradient(135deg, rgba(124,58,237,0.6), rgba(124,58,237,0.4))`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Star style={{ color: "#fff", width: 24, height: 24 }} fill="#fff" />
            </div>
          </div>

          <h2 style={{
            fontWeight: 800, fontSize: 22, color: "#fff",
            textAlign: "center", margin: "0 0 10px", lineHeight: 1.3,
          }}>
            Get Stars for virtual gifts
          </h2>
          <p style={{
            fontSize: 13, color: "rgba(255,255,255,0.45)",
            textAlign: "center", lineHeight: 1.6, margin: 0,
            maxWidth: 260,
          }}>
            Stars can be used to send virtual gifts to friends and creators across the platform.
          </p>
        </div>

        {/* ── PACKAGES LIST ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {BUY_STARS_PACKAGES.map((pkg, idx) => {
            const meta = PKG_META[pkg.id] ?? { icon: Star, starsLabel: `${pkg.stars.toLocaleString()} Stars` };
            const Icon = meta.icon;
            const isPopular = !!pkg.popular;

            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                style={{
                  background: CARD,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.07)",
                  padding: "16px",
                  display: "flex", alignItems: "center", gap: 14,
                  position: "relative",
                  overflow: "hidden",
                }}
                data-testid={`card-package-${pkg.id}`}
              >
                {/* POPULAR corner ribbon */}
                {isPopular && (
                  <div style={{
                    position: "absolute", top: 8, right: -14,
                    background: P,
                    color: "#fff",
                    fontSize: 9, fontWeight: 800,
                    letterSpacing: "0.1em",
                    padding: "3px 22px",
                    transform: "rotate(38deg)",
                    transformOrigin: "center",
                  }}>
                    POPULAR
                  </div>
                )}

                {/* Left: purple icon square */}
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: `linear-gradient(135deg, ${P}, rgba(124,58,237,0.7))`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
                }}>
                  <Icon style={{ color: "#fff", width: 22, height: 22 }} />
                </div>

                {/* Middle: name + stars */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 16, color: "#fff", margin: "0 0 3px" }}>
                    {pkg.name}
                  </p>
                  <p style={{ fontSize: 13, color: "#a78bfa", margin: 0, fontWeight: 500 }}>
                    {meta.starsLabel}
                  </p>
                </div>

                {/* Right: price pill button */}
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  onClick={() => handleBuy(pkg)}
                  data-testid={`button-buy-${pkg.id}`}
                  style={{
                    background: P,
                    borderRadius: 999, border: "none", cursor: "pointer",
                    padding: "8px 16px",
                    fontWeight: 700, fontSize: 14, color: "#fff",
                    flexShrink: 0,
                    boxShadow: "0 4px 14px rgba(124,58,237,0.4)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatETB(pkg.price)} ETB
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* ── PROMO CODE SECTION ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: CARD,
            borderRadius: 16,
            border: "1px dashed rgba(124,58,237,0.3)",
            padding: "20px 16px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}
        >
          <Gift style={{ color: "#a78bfa", width: 28, height: 28 }} />
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0, textAlign: "center" }}>
            Have a promo code for stars?
          </p>
          <button
            onClick={() => toast.info("Enter your promo code")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            data-testid="button-redeem-code"
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: P }}>Redeem Code</span>
          </button>
        </motion.div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#0f0c1f",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "10px 0 20px",
        zIndex: 50,
      }}>
        {[
          { icon: Wallet, label: "Wallet",   path: "/wallet"  },
          { icon: Star,   label: "Stars",    path: "/buy-stars", active: true },
          { icon: null,   label: "Activity", path: "/transaction-history" },
          { icon: null,   label: "Profile",  path: "/profile"  },
        ].map(({ icon: Icon, label, path, active }) => (
          <button key={label}
            onClick={() => navigate(path)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer", padding: "0 12px",
            }}
            data-testid={`nav-${label.toLowerCase()}`}
          >
            {label === "Activity" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke={active ? P : "rgba(255,255,255,0.4)"} strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : label === "Profile" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke={active ? P : "rgba(255,255,255,0.4)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : Icon ? (
              <Icon style={{ width: 22, height: 22, color: active ? P : "rgba(255,255,255,0.4)" }}
                fill={active && label === "Stars" ? P : "none"} />
            ) : null}
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? P : "rgba(255,255,255,0.4)" }}>
              {label.toUpperCase()}
            </span>
          </button>
        ))}
      </div>

      {/* ── CONFIRMATION BOTTOM SHEET ── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 40 }}
              onClick={() => !purchasing && setSelected(null)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
                background: CARD,
                borderRadius: "28px 28px 0 0",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "20px 20px 40px",
              }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
              <h2 style={{ fontWeight: 700, fontSize: 18, color: "#fff", textAlign: "center", margin: "0 0 20px" }}>
                Confirm Purchase
              </h2>

              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
                {[
                  { label: "Package",      value: selected.name },
                  { label: "Stars",        value: `${(selected.stars + selected.bonus).toLocaleString()} ⭐` },
                  { label: "Amount",       value: `${formatETB(selected.price)} ETB`, color: "#ef4444" },
                  { label: "Wallet after", value: `${formatETB(Math.max(0, walletBalance - selected.price))} ETB` },
                ].map((row, i) => (
                  <div key={row.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 16px",
                    borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: row.color ?? "#fff" }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConfirm}
                disabled={purchasing}
                data-testid="button-confirm-purchase"
                style={{
                  width: "100%", padding: "16px 0",
                  borderRadius: 999, border: "none", cursor: "pointer",
                  background: P, color: "#fff",
                  fontWeight: 700, fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 6px 24px rgba(124,58,237,0.45)",
                  opacity: purchasing ? 0.7 : 1,
                }}
              >
                {purchasing ? (
                  <><Loader2 style={{ width: 18, height: 18, animationName: "spin", animationDuration: "1s", animationIterationCount: "infinite" }} /> Processing...</>
                ) : (
                  <><Check style={{ width: 18, height: 18 }} /> Confirm Purchase</>
                )}
              </motion.button>

              <button
                onClick={() => setSelected(null)}
                style={{ width: "100%", padding: "14px 0", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", fontSize: 14, marginTop: 4 }}
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
