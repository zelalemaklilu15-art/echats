import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MoreVertical, Plus, Pencil, Trash2, Home, Wallet, PieChart, User, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { walletService } from "@/lib/walletService";

/* ─── design tokens ─── */
const BG    = "hsl(var(--surface-lowest))";
const CARD  = "hsl(var(--surface-low))";
const P     = "hsl(var(--tertiary))";
const PA    = "hsl(var(--tertiary) / 0.18)";

type Frequency = "Once" | "Daily" | "Weekly" | "Monthly" | "Yearly";
type Status    = "pending" | "processed" | "cancelled";

interface ScheduledPayment {
  id: string;
  toUserId: string;
  toName: string;
  amount: number;
  note?: string;
  scheduledAt: string;
  status: Status;
  frequency?: Frequency;
  avatarColor?: string;
}

const STORAGE_KEY = "echat_scheduled_payments";

/* seed demo data so the page always looks populated */
const DEMO_SEED: ScheduledPayment[] = [
  {
    id: "demo-1", toUserId: "u1", toName: "Abebe Bikila",
    amount: 2500, scheduledAt: "2024-10-28T10:00:00",
    status: "pending", frequency: "Monthly", avatarColor: "hsl(var(--surface-high))",
  },
  {
    id: "demo-2", toUserId: "u2", toName: "Sara Jenkins",
    amount: 12400, scheduledAt: "2024-11-02T09:00:00",
    status: "pending", frequency: "Once", avatarColor: "hsl(var(--surface-high))",
  },
  {
    id: "demo-3", toUserId: "u3", toName: "Netflix Subscription",
    amount: 450, scheduledAt: "2023-10-15T08:00:00",
    status: "processed", frequency: "Monthly",
  },
  {
    id: "demo-4", toUserId: "u4", toName: "Rent Payment",
    amount: 15000, scheduledAt: "2023-10-01T08:00:00",
    status: "processed", frequency: "Monthly",
  },
];

function loadPayments(): ScheduledPayment[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_SEED));
      return DEMO_SEED;
    }
    return raw;
  } catch { return DEMO_SEED; }
}

function savePayments(payments: ScheduledPayment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
}

function formatDateTime(iso: string): string {
  try {
    const d    = new Date(iso);
    const month = d.toLocaleString("en-US", { month: "short" });
    const day   = String(d.getDate()).padStart(2, "0");
    const h24   = d.getHours();
    const mins  = String(d.getMinutes()).padStart(2, "0");
    const ampm  = h24 >= 12 ? "PM" : "AM";
    const h12   = h24 % 12 === 0 ? 12 : h24 % 12;
    const hStr  = String(h12).padStart(2, "0");
    return `${month} ${day} • ${hStr}:${mins} ${ampm}`;
  } catch { return iso; }
}

function formatDateOnly(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.toLocaleString("en-US", { month: "short" });
    const day   = String(d.getDate()).padStart(2, "0");
    const year  = d.getFullYear();
    return `${month} ${day}, ${year}`;
  } catch { return iso; }
}

function formatETB(n: number) {
  return n.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Deterministic avatar gradient from name */
const AVATAR_GRADIENTS = [
  ["hsl(var(--secondary))", "hsl(var(--tertiary))"],
  ["hsl(var(--surface-high))", "hsl(var(--cosmic-cyan))"],
  ["hsl(var(--surface-high))", "hsl(var(--cosmic-mint))"],
  ["hsl(var(--surface-high))", "hsl(var(--cosmic-magenta))"],
  ["hsl(var(--surface-high))", "hsl(var(--tertiary))"],
];
function avatarGradient(name: string): [string, string] {
  const i = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[i] as [string, string];
}

const ScheduledPayments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<ScheduledPayment[]>(loadPayments);

  /* auto-process past-due payments */
  useEffect(() => {
    const interval = setInterval(() => {
      const all  = loadPayments();
      const now  = new Date();
      let changed = false;
      for (const p of all) {
        if (p.status === "pending" && new Date(p.scheduledAt) <= now) {
          p.status = "processed";
          walletService.deductLocalBalance(p.amount);
          toast.success(`Payment of ${formatETB(p.amount)} ETB to ${p.toName} processed`);
          changed = true;
        }
      }
      if (changed) { savePayments(all); setPayments([...all]); }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = (id: string) => {
    const all = loadPayments().filter(p => p.id !== id);
    savePayments(all); setPayments(all);
    toast.success("Deleted");
  };

  const upcoming   = payments.filter(p => p.status === "pending");
  const completed  = payments.filter(p => p.status === "processed");

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: 80 }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", padding: "48px 16px 16px" }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/wallet")}
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft style={{ color: "hsl(var(--foreground) / 0.85)", width: 22, height: 22 }} />
        </motion.button>
        <h1 style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 18, color: "hsl(var(--foreground))", margin: 0 }}>
          Scheduled Payments
        </h1>
        <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}>
          <MoreVertical style={{ color: "hsl(var(--foreground) / 0.45)", width: 20, height: 20 }} />
        </button>
      </div>

      {/* ── SCHEDULE NEW PAYMENT BUTTON ── */}
      <div style={{ padding: "8px 16px 24px" }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/send-money")}
          data-testid="button-schedule-new"
          style={{
            width: "100%", padding: "16px 0",
            borderRadius: 999, border: "none", cursor: "pointer",
            background: P,
            boxShadow: "0 6px 28px hsl(var(--tertiary) / 0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontWeight: 700, fontSize: 16, color: "hsl(var(--foreground))",
          }}
        >
          <Plus style={{ width: 20, height: 20 }} />
          Schedule New Payment
        </motion.button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>

        {/* ── UPCOMING PAYMENTS ── */}
        {upcoming.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: "hsl(var(--foreground))", margin: 0 }}>Upcoming Payments</h2>
              <div style={{
                background: PA,
                borderRadius: 999, padding: "4px 12px",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--primary))" }}>
                  {upcoming.length} Active
                </span>
              </div>
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <AnimatePresence>
                {upcoming.map((p, idx) => {
                  const [g1, g2] = avatarGradient(p.toName);
                  const initial  = p.toName.charAt(0).toUpperCase();
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      style={{
                        background: CARD,
                        borderRadius: 18,
                        border: "1px solid hsl(var(--foreground) / 0.07)",
                        padding: "14px 16px",
                        display: "flex", alignItems: "center", gap: 12,
                      }}
                      data-testid={`card-upcoming-${p.id}`}
                    >
                      {/* Avatar circle */}
                      <div style={{
                        width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                        background: `linear-gradient(135deg, ${g1}, ${g2})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20, fontWeight: 800, color: "hsl(var(--foreground))",
                        border: "2px solid hsl(var(--foreground) / 0.12)",
                      }}>
                        {initial}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 16, color: "hsl(var(--foreground))", margin: "0 0 2px" }}>
                          {p.toName}
                        </p>
                        <p style={{ fontSize: 12, color: "hsl(var(--foreground) / 0.4)", margin: "0 0 5px" }}>
                          {formatDateTime(p.scheduledAt)}
                          {p.frequency && (
                            <span style={{ color: "hsl(var(--primary))", marginLeft: 4 }}>• {p.frequency}</span>
                          )}
                        </p>
                        <p style={{ fontWeight: 700, fontSize: 14, color: "hsl(var(--primary))", margin: 0 }}>
                          ETB {formatETB(p.amount)}
                        </p>
                      </div>

                      {/* Edit + Delete icons */}
                      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                        <motion.button whileTap={{ scale: 0.85 }}
                          onClick={() => toast.info("Edit coming soon")}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Pencil style={{ color: "hsl(var(--foreground) / 0.35)", width: 16, height: 16 }} />
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.85 }}
                          onClick={() => handleDelete(p.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                          data-testid={`button-delete-${p.id}`}>
                          <Trash2 style={{ color: "hsl(var(--foreground) / 0.35)", width: 16, height: 16 }} />
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── RECENTLY COMPLETED ── */}
        {completed.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: 18, color: "hsl(var(--foreground))", margin: "0 0 14px" }}>
              Recently Completed
            </h2>

            <div style={{
              background: CARD,
              borderRadius: 18,
              border: "1px solid hsl(var(--foreground) / 0.07)",
              overflow: "hidden",
            }}>
              {completed.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "16px",
                    borderTop: idx > 0 ? "1px solid hsl(var(--foreground) / 0.06)" : "none",
                  }}
                  data-testid={`row-completed-${p.id}`}
                >
                  {/* Purple checkmark circle */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: PA,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Check style={{ color: "hsl(var(--primary))", width: 16, height: 16, strokeWidth: 2.5 }} />
                  </div>

                  {/* Name + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))", margin: "0 0 2px" }}>
                      {p.toName}
                    </p>
                    <p style={{ fontSize: 12, color: "hsl(var(--foreground) / 0.38)", margin: 0 }}>
                      {formatDateOnly(p.scheduledAt)}
                    </p>
                  </div>

                  {/* Amount */}
                  <p style={{ fontWeight: 700, fontSize: 14, color: "hsl(var(--foreground))", flexShrink: 0, margin: 0 }}>
                    ETB {formatETB(p.amount)}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {upcoming.length === 0 && completed.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, textAlign: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: PA, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus style={{ color: "hsl(var(--primary))", width: 28, height: 28 }} />
            </div>
            <p style={{ fontWeight: 700, fontSize: 16, color: "hsl(var(--foreground))", margin: 0 }}>No scheduled payments</p>
            <p style={{ fontSize: 13, color: "hsl(var(--foreground) / 0.38)", margin: 0 }}>Schedule a payment from Send Money</p>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "hsl(var(--surface-lowest))",
        borderTop: "1px solid hsl(var(--foreground) / 0.07)",
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "10px 0 20px",
        zIndex: 50,
      }}>
        {[
          { icon: Home,     label: "Home",     path: "/home"     },
          { icon: Wallet,   label: "Wallet",   path: "/wallet",   active: true },
          { icon: PieChart, label: "Insights", path: "/insights" },
          { icon: User,     label: "Profile",  path: "/profile"  },
        ].map(({ icon: Icon, label, path, active }) => (
          <button key={label}
            onClick={() => navigate(path)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer", padding: "0 12px",
            }}
            data-testid={`nav-${label.toLowerCase()}`}
          >
            <Icon style={{ width: 22, height: 22, color: active ? P : "hsl(var(--foreground) / 0.4)" }} />
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? P : "hsl(var(--foreground) / 0.4)" }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScheduledPayments;
