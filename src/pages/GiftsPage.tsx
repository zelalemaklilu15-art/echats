import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, MoreVertical, Star, Gift,
  Heart, Trophy, Award, Rocket,
  Wallet, PieChart, User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getStarsBalance, refreshStarsBalance } from "@/lib/giftsService";
import { toast } from "sonner";

/* ─── design tokens ─── */
const BG   = "#0D0A1A";
const CARD = "#16102A";
const P    = "#7C3AED";
const PA   = "rgba(124,58,237,0.18)";

/* ─── demo gift data (Received tab) ─── */
interface DemoGift {
  id: string;
  name: string;
  from: string;
  stars: number;
  icon: typeof Star;
}

const DEMO_RECEIVED: DemoGift[] = [
  { id: "g1", name: "Super Star",     from: "Alex Rivera",  stars: 100, icon: Trophy  },
  { id: "g2", name: "Great Friend",   from: "Sarah Chen",   stars: 250, icon: Heart   },
  { id: "g3", name: "Top Supporter",  from: "Jordan Lee",   stars: 150, icon: Award   },
  { id: "g4", name: "Nitro Boost",    from: "Emily White",  stars: 150, icon: Rocket  },
];

const DEMO_SENT: DemoGift[] = [
  { id: "s1", name: "Birthday Cake",  from: "Mia Johnson",  stars: 25,  icon: Gift    },
  { id: "s2", name: "Shooting Star",  from: "Carlos Kim",   stars: 25,  icon: Star    },
];

type Tab = "received" | "sent";

const GiftsPage = () => {
  const navigate      = useNavigate();
  const [tab, setTab] = useState<Tab>("received");
  const [starsBalance, setStarsBalance] = useState(getStarsBalance());

  useEffect(() => {
    refreshStarsBalance().then(setStarsBalance).catch(() => setStarsBalance(getStarsBalance()));
  }, []);

  const items = tab === "received" ? DEMO_RECEIVED : DEMO_SENT;

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 80 }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "48px 16px 16px" }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          data-testid="button-back-gifts">
          <ArrowLeft style={{ color: "rgba(255,255,255,0.85)", width: 22, height: 22 }} />
        </motion.button>
        <h1 style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 18, color: "#fff", margin: 0 }}>
          My Gifts
        </h1>
        <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}>
          <MoreVertical style={{ color: "rgba(255,255,255,0.45)", width: 20, height: 20 }} />
        </button>
      </div>

      {/* ── TOTAL BALANCE CARD ── */}
      <div style={{ padding: "0 16px 20px" }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            background: `linear-gradient(135deg, rgba(124,58,237,0.28), rgba(124,58,237,0.12))`,
            borderRadius: 20,
            border: "1px solid rgba(124,58,237,0.3)",
            padding: "20px 20px",
          }}
          data-testid="total-balance-card"
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 10px" }}>
            Total Balance
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Star circle icon */}
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: P,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(124,58,237,0.5)",
              flexShrink: 0,
            }}>
              <Star style={{ color: "#fff", width: 20, height: 20 }} fill="#fff" />
            </div>
            <p style={{ fontWeight: 800, fontSize: 32, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
              {starsBalance.toLocaleString()} Stars
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── TABS: Received | Sent ── */}
      <div style={{
        display: "flex", padding: "0 16px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        marginBottom: 20,
        gap: 24,
      }}>
        {(["received", "sent"] as Tab[]).map(t => (
          <button key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "12px 0",
              fontSize: 16, fontWeight: 700,
              color: tab === t ? P : "rgba(255,255,255,0.38)",
              borderBottom: tab === t ? `2.5px solid ${P}` : "2.5px solid transparent",
              marginBottom: -1,
              textTransform: "capitalize",
            }}
            data-testid={`tab-${t}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── GIFT CARDS GRID ── */}
      <div style={{ flex: 1, padding: "0 16px", overflowY: "auto" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {items.map((gift, idx) => {
              const Icon = gift.icon;
              return (
                <motion.div
                  key={gift.id}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.06 }}
                  style={{
                    background: CARD,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.07)",
                    padding: "16px 12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                  data-testid={`card-gift-${gift.id}`}
                >
                  {/* Icon area */}
                  <div style={{
                    width: "100%",
                    aspectRatio: "1 / 0.75",
                    borderRadius: 14,
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}>
                    <Icon style={{ color: "#7c3aed", width: 36, height: 36, opacity: 0.85 }} />
                  </div>

                  {/* Gift name */}
                  <p style={{ fontWeight: 700, fontSize: 15, color: "#fff", margin: 0, textAlign: "center" }}>
                    {gift.name}
                  </p>

                  {/* From: [purple name] */}
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", margin: 0, textAlign: "center" }}>
                    From:{" "}
                    <span style={{ color: "#a78bfa", fontWeight: 600 }}>{gift.from}</span>
                  </p>

                  {/* Stars pill */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: P,
                    borderRadius: 999,
                    padding: "5px 12px",
                    marginTop: 2,
                  }}>
                    <div style={{
                      width: 15, height: 15, borderRadius: "50%",
                      border: "1.5px solid rgba(255,255,255,0.5)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Star style={{ color: "#fff", width: 8, height: 8 }} fill="#fff" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                      {gift.stars}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Empty state */}
        {items.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, textAlign: "center", gap: 12 }}>
            <Gift style={{ color: "rgba(124,58,237,0.4)", width: 48, height: 48 }} />
            <p style={{ fontWeight: 700, fontSize: 16, color: "#fff", margin: 0 }}>No gifts yet</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", margin: 0 }}>
              {tab === "received" ? "Gifts sent to you will appear here" : "Gifts you send will appear here"}
            </p>
          </div>
        )}
      </div>

      {/* ── SEND A GIFT BUTTON (fixed above bottom nav) ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => toast.info("Select a contact to send a gift")}
          data-testid="button-send-gift"
          style={{
            width: "100%", padding: "16px 0",
            borderRadius: 999, border: "none", cursor: "pointer",
            background: P,
            boxShadow: "0 6px 28px rgba(124,58,237,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontWeight: 700, fontSize: 16, color: "#fff",
          }}
        >
          <Gift style={{ width: 20, height: 20 }} />
          Send a Gift
        </motion.button>
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
          { label: "WALLET",   path: "/wallet",             icon: Wallet,   active: false },
          { label: "STARS",    path: "/buy-stars",          icon: Star,     active: true  },
          { label: "ACTIVITY", path: "/transaction-history",icon: null,     active: false },
          { label: "PROFILE",  path: "/profile",            icon: null,     active: false },
        ].map(({ label, path, icon: Icon, active }) => (
          <button key={label}
            onClick={() => navigate(path)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer", padding: "0 10px",
            }}
            data-testid={`nav-${label.toLowerCase()}`}
          >
            {label === "ACTIVITY" ? (
              /* Activity: list/ledger icon */
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="3" rx="1.5" fill={active ? P : "rgba(255,255,255,0.4)"} />
                <rect x="3" y="10.5" width="18" height="3" rx="1.5" fill={active ? P : "rgba(255,255,255,0.4)"} />
                <rect x="3" y="17" width="18" height="3" rx="1.5" fill={active ? P : "rgba(255,255,255,0.4)"} />
              </svg>
            ) : label === "PROFILE" ? (
              <User style={{ width: 22, height: 22, color: "rgba(255,255,255,0.4)" }} />
            ) : Icon ? (
              <Icon
                style={{ width: 22, height: 22, color: active ? P : "rgba(255,255,255,0.4)" }}
                fill={active ? P : "none"}
              />
            ) : null}
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 400,
              color: active ? P : "rgba(255,255,255,0.4)",
              letterSpacing: "0.05em",
            }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default GiftsPage;
