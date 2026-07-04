// @ts-nocheck
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoImage from "@/assets/echat-logo.jpg";

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await (supabase.auth as any).oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const oauth = (supabase.auth as any).oauth;
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError("No redirect returned by the authorization server."); }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Authorization error</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "an app";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border/50 bg-card p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Echat" className="w-12 h-12 rounded-xl object-cover" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Connect {clientName}</h1>
            <p className="text-xs text-muted-foreground">to your Echat account</p>
          </div>
        </div>
        <p className="text-sm text-foreground/80">
          <span className="font-medium">{clientName}</span> is requesting access to use Echat as you.
          It will be able to read your chats, search users, and save notes to Saved Messages — all
          under your Echat permissions.
        </p>
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 py-3 rounded-2xl border border-border font-medium text-foreground hover:bg-muted transition"
          >
            Deny
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {busy ? "…" : "Approve"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          You can disconnect this app anytime from Echat settings.
        </p>
      </div>
    </main>
  );
}
