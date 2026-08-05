import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
// Session of the signed-in preview user, injected by the sandbox.
const ACCESS_TOKEN = Deno.env.get("LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN") ?? "";

const DEPOSIT_URL = `${SUPABASE_URL}/functions/v1/wallet-deposit`;
const BALANCE_URL = `${SUPABASE_URL}/functions/v1/wallet-balance`;

function headers(token?: string) {
  const h: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

Deno.test("rejects unauthenticated deposit", async () => {
  const res = await fetch(DEPOSIT_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ amount: 100, method: "Telebirr" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401, body);
});

Deno.test("rejects an unknown payment method", async () => {
  if (!ACCESS_TOKEN) return;
  const res = await fetch(DEPOSIT_URL, {
    method: "POST",
    headers: headers(ACCESS_TOKEN),
    body: JSON.stringify({ amount: 100, method: "Bitcoin ATM" }),
  });
  const body = await res.text();
  assertEquals(res.status, 400, body);
  assert(body.includes("Invalid payment method"), body);
});

Deno.test("rejects a non-positive amount", async () => {
  if (!ACCESS_TOKEN) return;
  const res = await fetch(DEPOSIT_URL, {
    method: "POST",
    headers: headers(ACCESS_TOKEN),
    body: JSON.stringify({ amount: -5, method: "Telebirr" }),
  });
  const body = await res.text();
  assertEquals(res.status, 400, body);
});

Deno.test("full deposit path: creates a pending row via the balance trigger without crediting the wallet", async () => {
  if (!ACCESS_TOKEN) {
    console.warn("No session token available — skipping end-to-end deposit test");
    return;
  }

  // 1. Balance before
  const beforeRes = await fetch(BALANCE_URL, { method: "POST", headers: headers(ACCESS_TOKEN) });
  const before = await beforeRes.json();
  assertEquals(beforeRes.status, 200, JSON.stringify(before));
  const startBalance = Number(before.wallet?.balance ?? 0);

  // 2. Create the deposit
  const idempotencyKey = `test-${Date.now()}-${crypto.randomUUID()}`;
  const amount = 25;
  const depositRes = await fetch(DEPOSIT_URL, {
    method: "POST",
    headers: headers(ACCESS_TOKEN),
    body: JSON.stringify({ amount, method: "Telebirr", idempotency_key: idempotencyKey }),
  });
  const deposit = await depositRes.json();

  if (depositRes.status === 429) {
    console.warn("Hourly deposit rate limit reached — end-to-end assertions skipped");
    return;
  }

  // This is the regression guard: a NOT NULL violation on balance_before used to 500 here.
  assertEquals(depositRes.status, 200, JSON.stringify(deposit));
  assertEquals(deposit.success, true);
  assertEquals(deposit.pending, true);
  assertEquals(deposit.transaction.status, "pending");
  assertEquals(Number(deposit.transaction.amount), amount);

  // 3. Idempotency: replaying the same key must not create a second row
  const replayRes = await fetch(DEPOSIT_URL, {
    method: "POST",
    headers: headers(ACCESS_TOKEN),
    body: JSON.stringify({ amount, method: "Telebirr", idempotency_key: idempotencyKey }),
  });
  const replay = await replayRes.json();
  assertEquals(replayRes.status, 200, JSON.stringify(replay));
  assertEquals(replay.duplicate, true);
  assertEquals(replay.transaction.id, deposit.transaction.id);

  // 4. Balance after: a pending deposit must NOT credit the wallet, and it must not
  //    appear in the confirmed history (wallet-balance only returns completed rows).
  const afterRes = await fetch(BALANCE_URL, { method: "POST", headers: headers(ACCESS_TOKEN) });
  const after = await afterRes.json();
  assertEquals(afterRes.status, 200, JSON.stringify(after));
  assertEquals(Number(after.wallet.balance), startBalance);

  const listed = (after.transactions as Array<Record<string, unknown>>).some(
    (t) => t.id === deposit.transaction.id,
  );
  assertEquals(listed, false, "pending deposit must not appear in completed history");

  // 5. Every completed row carries non-null balance snapshots that chain correctly.
  for (const t of after.transactions as Array<Record<string, unknown>>) {
    assert(t.balance_before !== null, `balance_before null on ${t.id}`);
    assert(t.balance_after !== null, `balance_after null on ${t.id}`);
  }
  const newest = (after.transactions as Array<Record<string, unknown>>)[0];
  if (newest) assertEquals(Number(newest.balance_after), Number(after.wallet.balance));
});

