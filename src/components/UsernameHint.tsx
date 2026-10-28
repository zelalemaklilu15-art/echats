import { USERNAME_RULE } from "@/lib/usernameCheck";

type S = "available" | "taken" | "invalid" | "checking" | "error" | null;

export function UsernameHint({ status }: { status: S }) {
  if (!status) return null;
  const map: Record<Exclude<S, null>, { text: string; cls: string }> = {
    available: { text: "✓ Username is available", cls: "text-primary" },
    taken: { text: "Username already taken", cls: "text-destructive" },
    invalid: { text: USERNAME_RULE, cls: "text-destructive" },
    checking: { text: "Checking…", cls: "text-muted-foreground" },
    error: { text: "Couldn't check right now", cls: "text-muted-foreground" },
  };
  const m = map[status];
  return <p className={`mt-1.5 px-2 text-xs ${m.cls}`} data-testid="username-hint">{m.text}</p>;
}
