const KEY = "echat_savings_goals";

export interface SavingsGoal {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  currency: string;
  createdAt: string;
}

function load(userId: string): SavingsGoal[] {
  if (!userId) return [];
  try { return JSON.parse(localStorage.getItem(`${KEY}:${userId}`) || "[]"); } catch { return []; }
}
function save(userId: string, d: SavingsGoal[]) { if (!userId) throw new Error('Please sign in'); localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(d)); }

export function getGoals(userId: string): SavingsGoal[] { return load(userId); }

export function createGoal(userId: string, name: string, emoji: string, targetAmount: number, deadline?: string): SavingsGoal {
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) throw new Error('Enter a valid target amount');
  const g: SavingsGoal = { id: `goal_${Date.now()}`, name, emoji, targetAmount, currentAmount: 0, deadline, currency: "ETB", createdAt: new Date().toISOString() };
  save(userId, [...load(userId), g]);
  return g;
}

export function addFundsToGoal(id: string, amount: number): SavingsGoal | null {
  throw new Error('Savings transfers are unavailable. No money has been moved.');
}

export function deleteGoal(userId: string, id: string): void { save(userId, load(userId).filter(g => g.id !== id)); }
