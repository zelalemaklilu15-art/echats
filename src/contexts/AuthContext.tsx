// @ts-nocheck
import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getSessionUserSafe } from "@/lib/authSession";

export type AuthState = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  authState: AuthState;
  user: User | null;
  userId: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const applySession = (u: User | null) => {
      if (!mounted) return;
      setUser(u);
      setAuthState(u ? "authenticated" : "unauthenticated");
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
    <AuthContext.Provider value={{ authState, user, userId: user?.id ?? null }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
