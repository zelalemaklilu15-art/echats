import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, Loader2, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const schema = z.object({
  subject: z.string().trim().min(1, "Add a subject").max(150),
  message: z.string().trim().min(1, "Write your message").max(4000),
});
const CATS = ["general", "account", "wallet", "technical", "other"] as const;
type Ticket = { id: string; subject: string; category: string; message: string; status: string; admin_reply: string | null; replied_at: string | null; created_at: string };

export default function Support() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const load = async () => {
    const { data } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
  };
  useEffect(() => { if (user) load(); }, [user?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ subject, message });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSending(true);
    const { data: row, error } = await supabase.from("support_tickets").insert({ user_id: user!.id, subject: parsed.data.subject, message: parsed.data.message, category }).select("id").single();
    if (!error && row) supabase.functions.invoke("support-email", { body: { event: "created", ticket_id: row.id } }).catch(() => {});
    setSending(false);
    if (error) { toast.error("Could not send. Try again."); return; }
    toast.success("Sent! A confirmation was emailed to you.");
    setSubject(""); setMessage(""); load();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4 flex items-center gap-3">
        <button onClick={() => nav(-1)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="font-black text-[18px] gradient-text">Help & Support</h1>
      </div>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Card className="p-4">
          <form onSubmit={submit} className="space-y-3">
            <div className="flex items-center gap-2 font-semibold"><LifeBuoy className="h-5 w-5 text-primary" /> Contact Echat Support</div>
            <Input placeholder="Subject" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {CATS.map((c) => (
                <Button key={c} type="button" size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)} className="capitalize">{c}</Button>
              ))}
            </div>
            <Textarea placeholder="Describe your question or problem" rows={5} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button type="submit" className="w-full" disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}</Button>
          </form>
        </Card>
        <h2 className="text-sm font-semibold text-muted-foreground">My requests</h2>
        {tickets.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
        {tickets.map((t) => (
          <Card key={t.id} className="p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{t.subject}</span>
              <Badge variant={t.status === "open" ? "secondary" : "default"} className="capitalize">{t.status}</Badge>
              <span className="ml-auto text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap text-muted-foreground">{t.message}</p>
            {t.admin_reply && (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                <p className="text-xs font-semibold text-primary mb-1">Echat Support</p>
                <p className="whitespace-pre-wrap">{t.admin_reply}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
