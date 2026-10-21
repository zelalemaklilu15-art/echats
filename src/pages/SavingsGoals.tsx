import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, TrendingUp, Wallet, Target as TargetIcon, BarChart2, User, MoreVertical, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getGoals, createGoal, addFundsToGoal, deleteGoal, type SavingsGoal } from "@/lib/savingsGoalService";
import { walletService } from "@/lib/walletService";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ─── tokens ─── */
const BG   = "hsl(var(--surface-lowest))";
const CARD = "hsl(var(--card))";
const P    = "hsl(var(--tertiary))";

const EMOJIS = ["🎯","🏠","✈️","📱","🎓","💍","🚗","💻","🏖️","🎸","⌚","💰"];

const SavingsGoals = () => {
  const navigate = useNavigate();
  const [goals,       setGoals]       = useState<SavingsGoal[]>([]);
  const [showCreate,  setShowCreate]  = useState(false);
  const [name,        setName]        = useState("");
  const [emoji,       setEmoji]       = useState("🎯");
  const [target,      setTarget]      = useState("");
  const [deadline,    setDeadline]    = useState("");
  const [addFundsId,  setAddFundsId]  = useState<string | null>(null);
  const [addAmount,   setAddAmount]   = useState("");

  useEffect(() => { setGoals(getGoals()); }, []);

  const handleCreate = () => {
    if (!name || !target) { toast.error("Enter name and target amount"); return; }
    const g = createGoal(name, emoji, parseFloat(target), deadline || undefined);
    setGoals(prev => [...prev, g]);
    setShowCreate(false); setName(""); setTarget(""); setDeadline(""); setEmoji("🎯");
    toast.success("Goal created!");
  };

  const handleAddFunds = async (id: string) => {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    const result = await walletService.getWalletBalance();
    if (!result.wallet || result.wallet.balance < amount) { toast.error("Insufficient wallet balance"); return; }
    walletService.deductLocalBalance(amount);
    const updated = addFundsToGoal(id, amount);
    if (updated) {
      setGoals(getGoals());
      const pct = Math.round((updated.currentAmount / updated.targetAmount) * 100);
      if (pct >= 100) toast.success(`🎉 Goal "${updated.name}" completed!`);
      else toast.success(`Added ${amount.toLocaleString()} ETB to "${updated.name}"`);
    }
    setAddFundsId(null); setAddAmount("");
  };

  const active    = goals.filter(g => g.currentAmount < g.targetAmount);
  const completed = goals.filter(g => g.currentAmount >= g.targetAmount);

  return (
    <div className="min-h-screen flex flex-col pb-28" style={{ background: BG }}>

      {/* ── HEADER ── */}
      <div className="flex items-center px-4 pt-12 pb-5">
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft style={{ color: "hsl(var(--foreground) / 0.85)", width: 22, height: 22 }} />
        </motion.button>
        <h1 className="flex-1 text-center font-bold text-[18px] text-foreground">Savings Goals</h1>
        <div className="w-9" />
      </div>

      <div className="px-4 flex-1">
        {/* ── CREATE NEW GOAL BUTTON ── */}
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => setShowCreate(true)}
          className="w-full py-4 rounded-full font-bold text-[16px] text-foreground flex items-center justify-center gap-2 mb-6"
          style={{ background: P, boxShadow: "0 6px 24px hsl(var(--tertiary) / 0.45)" }}
          data-testid="button-new-goal">
          <Plus style={{ width: 20, height: 20 }} />
          Create New Goal
        </motion.button>

        {/* ── ACTIVE GOALS ── */}
        {active.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-[17px] text-foreground">Active Goals</p>
              <div className="px-3 py-1 rounded-full"
                style={{ background: "hsl(var(--tertiary) / 0.2)", border: "1px solid hsl(var(--tertiary) / 0.35)" }}>
                <span className="text-[12px] font-bold" style={{ color: P }}>{active.length} Active</span>
              </div>
            </div>
            <div className="space-y-3">
              {active.map(g => {
                const pct = Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100);
                return (
                  <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-4"
                    style={{ background: CARD, border: "1px solid hsl(var(--foreground) / 0.08)" }}
                    data-testid={`goal-card-${g.id}`}>
                    {/* Top row */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: "hsl(var(--tertiary) / 0.2)", border: "1px solid hsl(var(--tertiary) / 0.25)" }}>
                        {g.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[16px] text-foreground">{g.name}</p>
                        <p className="text-[12px]" style={{ color: "hsl(var(--foreground) / 0.45)" }}>
                          Target: {g.targetAmount.toLocaleString()} ETB
                        </p>
                      </div>
                      <button onClick={() => { deleteGoal(g.id); setGoals(getGoals()); }}
                        className="w-8 h-8 flex items-center justify-center">
                        <MoreVertical style={{ color: "hsl(var(--foreground) / 0.4)", width: 18, height: 18 }} />
                      </button>
                    </div>

                    {/* Progress row */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-[14px] text-foreground">{g.currentAmount.toLocaleString()} ETB</span>
                      <span className="font-bold text-[14px]" style={{ color: P }}>{pct}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2.5 rounded-full mb-4 overflow-hidden"
                      style={{ background: "hsl(var(--foreground) / 0.1)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${P}, hsl(var(--secondary)))` }}
                      />
                    </div>

                    {/* Add Funds button */}
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => { setAddFundsId(g.id); setAddAmount(""); }}
                      className="w-full py-3 rounded-full font-bold text-[14px] text-foreground"
                      style={{ background: P, boxShadow: "0 4px 14px hsl(var(--tertiary) / 0.4)" }}>
                      Add Funds
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── COMPLETED GOALS ── */}
        {completed.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-[17px] text-foreground">Completed Goals</p>
              <Trophy style={{ color: "hsl(var(--tertiary))", width: 22, height: 22 }} />
            </div>
            <div className="space-y-3">
              {completed.map(g => (
                <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-4 relative overflow-hidden"
                  style={{ background: "hsl(var(--surface-high) / 0.8)", border: "1px solid hsl(var(--tertiary) / 0.2)" }}
                  data-testid={`goal-card-${g.id}`}>
                  {/* Ghost trophy watermark */}
                  <div className="absolute right-4 top-2 opacity-10">
                    <Trophy style={{ color: "hsl(var(--tertiary))", width: 60, height: 60 }} />
                  </div>
                  <div className="flex items-center gap-3 relative">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: "hsl(var(--tertiary) / 0.2)", border: "1px solid hsl(var(--tertiary) / 0.25)" }}>
                      🏆
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[16px] text-foreground">{g.name}</p>
                      <p className="text-[12px] font-semibold" style={{ color: P }}>
                        Goal Reached: {g.targetAmount.toLocaleString()} ETB
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {goals.length === 0 && !showCreate && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "hsl(var(--tertiary) / 0.15)", border: "1px solid hsl(var(--tertiary) / 0.25)" }}>
              <TargetIcon style={{ color: P, width: 36, height: 36 }} />
            </div>
            <div className="text-center">
              <p className="font-bold text-[17px] text-foreground mb-1.5">No savings goals yet</p>
              <p className="text-[13px]" style={{ color: "hsl(var(--foreground) / 0.4)" }}>Create a goal to start saving</p>
            </div>
          </div>
        )}
      </div>

      {/* ── CREATE GOAL BOTTOM SHEET ── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreate(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full rounded-t-3xl px-5 pt-5 pb-10"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--foreground) / 0.08)" }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "hsl(var(--foreground) / 0.2)" }} />
              <h2 className="font-bold text-[17px] text-foreground mb-5">New Savings Goal</h2>
              <div className="space-y-3.5">
                <div>
                  <p className="text-[11px] uppercase tracking-wide mb-2.5" style={{ color: "hsl(var(--foreground) / 0.45)" }}>Choose an icon</p>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map(e => (
                      <motion.button key={e} whileTap={{ scale: 0.9 }} onClick={() => setEmoji(e)}
                        className="w-11 h-11 rounded-xl text-xl flex items-center justify-center"
                        style={{ background: emoji === e ? "hsl(var(--tertiary) / 0.25)" : "hsl(var(--foreground) / 0.07)", outline: emoji === e ? `2px solid ${P}` : "none" }}>
                        {e}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Goal name (e.g. Buy House)"
                  className="w-full rounded-2xl px-4 py-3.5 text-[14px] outline-none text-foreground"
                  style={{ background: "hsl(var(--foreground) / 0.07)", border: "1px solid hsl(var(--foreground) / 0.1)" }}
                  data-testid="input-goal-name" />
                <input value={target} onChange={e => setTarget(e.target.value)}
                  placeholder="Target amount (ETB)" type="number"
                  className="w-full rounded-2xl px-4 py-3.5 text-[14px] outline-none text-foreground"
                  style={{ background: "hsl(var(--foreground) / 0.07)", border: "1px solid hsl(var(--foreground) / 0.1)" }}
                  data-testid="input-goal-target" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "hsl(var(--foreground) / 0.45)" }}>Deadline (optional)</p>
                  <input value={deadline} onChange={e => setDeadline(e.target.value)} type="date"
                    className="w-full rounded-2xl px-4 py-3.5 text-[14px] outline-none text-foreground"
                    style={{ background: "hsl(var(--foreground) / 0.07)", border: "1px solid hsl(var(--foreground) / 0.1)" }} />
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate}
                  className="w-full py-4 rounded-full font-bold text-[15px] text-foreground"
                  style={{ background: P, boxShadow: "0 4px 14px hsl(var(--tertiary) / 0.4)" }}
                  data-testid="button-create-goal">
                  Create Goal
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Funds Sheet */}
        {addFundsId && (
          <div className="fixed inset-0 z-50 flex items-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setAddFundsId(null)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full rounded-t-3xl px-5 pt-5 pb-10"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--foreground) / 0.08)" }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "hsl(var(--foreground) / 0.2)" }} />
              <h2 className="font-bold text-[17px] text-foreground mb-5">Add Funds to Goal</h2>
              <input value={addAmount} onChange={e => setAddAmount(e.target.value)}
                placeholder="Amount in ETB" type="number" autoFocus
                className="w-full rounded-2xl px-4 py-3.5 text-[14px] outline-none text-foreground mb-4"
                style={{ background: "hsl(var(--foreground) / 0.07)", border: "1px solid hsl(var(--foreground) / 0.1)" }}
                data-testid="input-add-funds" />
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleAddFunds(addFundsId)}
                className="w-full py-4 rounded-full font-bold text-[15px] text-foreground flex items-center justify-center gap-2"
                style={{ background: P, boxShadow: "0 4px 14px hsl(var(--tertiary) / 0.4)" }}
                data-testid="button-confirm-add-funds">
                <TrendingUp style={{ width: 18, height: 18 }} />
                Add Funds
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
        style={{ background: BG, borderTop: "1px solid hsl(var(--foreground) / 0.07)", boxShadow: "0 -8px 32px hsl(var(--surface-lowest) / 0.45)" }}>
        <div className="flex items-end justify-around px-2" style={{ height: 68 }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/wallet")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <Wallet style={{ color: "hsl(var(--foreground) / 0.38)", width: 20, height: 20 }} />
            <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--foreground) / 0.38)" }}>Wallet</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <TargetIcon style={{ color: P, width: 20, height: 20 }} />
            <span className="text-[10px] font-bold" style={{ color: P }}>Goals</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/transaction-history")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <BarChart2 style={{ color: "hsl(var(--foreground) / 0.38)", width: 20, height: 20 }} />
            <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--foreground) / 0.38)" }}>Stats</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate("/profile")}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full">
            <User style={{ color: "hsl(var(--foreground) / 0.38)", width: 20, height: 20 }} />
            <span className="text-[10px] font-semibold" style={{ color: "hsl(var(--foreground) / 0.38)" }}>Profile</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default SavingsGoals;
