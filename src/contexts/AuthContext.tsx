// @ts-nocheck
import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUserSafe } from "@/lib/authSession";
import { callEmailTwoStep } from "@/lib/emailTwoStep";

export type AuthState = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  authState: AuthState;
  user: User | null;
  userId: string | null;
  /** Signed in with password/OAuth but a TOTP second step is still required. */
  needsMfa: boolean;
  mfaMode: "email" | "totp";
  clearMfa: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaMode, setMfaMode] = useState<"email" | "totp">("email");

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    let gen = 0;
    const applySession = (u: User | null) => {
      if (!mounted) return;
      const my = ++gen;
      setUser(u);
      if (!u) { setNeedsMfa(false); setAuthState("unauthenticated"); return; }
      setAuthState("authenticated");
      Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => ({ data: null })),
        callEmailTwoStep({ action: "status" }).catch(() => ({ ok: false })),
      ]).then(([aal, email]: any) => {
        if (!mounted || my !== gen) return;
        const totp = aal?.data?.nextLevel === "aal2" && aal?.data?.currentLevel !== "aal2";
        const emailNeeded = !!email?.ok && email.enabled && !email.verified;
        setMfaMode(totp ? "totp" : "email");
        setNeedsMfa(totp || emailNeeded);
      });
    };

    // Restore the persisted session before protected routes make auth decisions.
    getSessionUserSafe()
      .then(({ session, user: fallbackUser }) => {
        const u = session?.user ?? fallbackUser ?? null;
        applySession(u);

        const result = supabase.auth.onAuthStateChange((_event, nextSession) => {
          applySession(nextSession?.user ?? null);
        });
        subscription = result.data.subscription;
      })
      .catch(() => {
        applySession(null);

        const result = supabase.auth.onAuthStateChange((_event, nextSession) => {
          applySession(nextSession?.user ?? null);
        });
        subscription = result.data.subscription;
      });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ authState, user, userId: user?.id ?? null, needsMfa, mfaMode, clearMfa: () => setNeedsMfa(false) }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
