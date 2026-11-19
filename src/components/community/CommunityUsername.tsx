import { useEffect, useState } from "react";
import { AtSign, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const RE = /^[a-z][a-z0-9_]{3,30}[a-z0-9]$/;

export function CommunityUsername({ kind, id, canEdit }: { kind: "channel" | "group"; id: string; canEdit: boolean }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const q = kind === "channel"
      ? supabase.from("channels").select("username").eq("id", id).maybeSingle()
      : supabase.from("groups").select("username").eq("id", id).maybeSingle();
    q.then(({ data }) => { if (alive) { const u = (data as { username?: string | null } | null)?.username ?? null; setCurrent(u); setValue(u ?? ""); } });
    return () => { alive = false; };
  }, [kind, id]);

  const link = current ? `${window.location.origin}/${kind === "channel" ? "c" : "g"}/${current}` : "";
  const clean = value.trim().toLowerCase().replace(/^@/, "");
  const valid = clean === "" || RE.test(clean);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_community_username" as never, { p_kind: kind, p_id: id, p_username: clean || null } as never);
    setSaving(false);
    if (error) { toast.error(error.message.includes("taken") ? "This @username is already taken" : "Could not save @username"); return; }
    setCurrent(clean || null); setEditing(false); toast.success(clean ? "@username saved" : "@username removed");
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error("Could not copy link"); }
  };

  if (!current && !canEdit) return null;

  return (
    <div className="px-5 py-3.5 border-b border-border/50 space-y-2">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Username</p>
      {editing ? (
        <>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={value} onChange={e => setValue(e.target.value)} placeholder="my_community" className="pl-9" maxLength={33} autoFocus />
          </div>
          <p className={valid ? "text-[11px] text-muted-foreground" : "text-[11px] text-destructive"}>5–32 characters: a–z, 0–9 and _. Must start with a letter.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setValue(current ?? ""); }}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={!valid || saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </>
      ) : current ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-primary truncate">@{current}</p>
            <p className="text-[11px] text-muted-foreground truncate">{link.replace(/^https?:\/\//, "")}</p>
          </div>
          <button onClick={copy} aria-label="Copy link" className="p-2 rounded-xl bg-muted">{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</button>
          {canEdit && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}><AtSign className="h-4 w-4 mr-1" />Set @username</Button>
      )}
    </div>
  );
}
