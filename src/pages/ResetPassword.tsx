import { useEffect, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updatePassword } from "@/lib/supabaseAuth";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await updatePassword(password);
      toast.success("Password updated");
      navigate("/chats", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-6 space-y-6">
      <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
        <Lock className="h-10 w-10 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground text-center">Set a new password</h1>
      {!ready ? (
        <p className="text-center text-muted-foreground">
          Open this page from the link in your reset email. If the link expired, request a new one.
        </p>
      ) : (
        <Card className="p-4 space-y-3">
          <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Card>
      )}
      {ready && (
        <Button onClick={submit} disabled={loading} className="w-full h-12 rounded-full bg-gradient-primary">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save password"}
        </Button>
      )}
      <Button variant="ghost" onClick={() => navigate("/forgot-password")}>Request a new link</Button>
    </div>
  );
};

export default ResetPassword;
