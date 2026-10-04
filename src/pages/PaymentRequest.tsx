import { publicOrigin } from "@/lib/native";
// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, Link2, Copy, Share2, Check, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG as QRCode } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

const PaymentRequest = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [username, setUsername] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("username").eq("id", user.id).single().then(({ data }) => {
        if (data) setUsername(data.username);
      });
    });
  }, []);

  const generateLink = () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    if (!username) { toast.error("Username not loaded yet"); return; }
    const base = publicOrigin();
    const params = note ? `?note=${encodeURIComponent(note)}` : "";
    const url = `${base}/pay/${username}/${amount}${params}`;
    setLink(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: `Pay me ${amount} ETB`, url: link });
    } else { handleCopy(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-3 z-20">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-bold text-[17px]">Payment Request Link</h1>
      </div>

      <div className="px-4 py-6 space-y-4">
        <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
          <div>
            <p className="text-[12px] text-muted-foreground mb-1.5 font-medium">Amount (ETB)</p>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              type="number"
              min="0"
              className="w-full bg-muted rounded-2xl px-4 py-3 text-[18px] font-bold outline-none"
              data-testid="input-request-amount"
            />
          </div>
          <div>
            <p className="text-[12px] text-muted-foreground mb-1.5 font-medium">Note (optional)</p>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What's it for?"
              className="w-full bg-muted rounded-2xl px-4 py-3 text-[14px] outline-none"
              data-testid="input-request-note"
            />
          </div>
          <button
            onClick={generateLink}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
            data-testid="button-generate-link"
          >
            <Link2 className="h-4 w-4" /> Generate Link
          </button>
        </div>

        {link && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-card rounded-2xl border border-border/50 p-4 flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-2xl">
                <QRCode value={link} size={180} level="M" />
              </div>
              <p className="text-[12px] text-muted-foreground text-center">Scan to pay {amount} ETB{note ? ` — ${note}` : ""}</p>
            </div>

            <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
              <p className="flex-1 text-[11px] text-muted-foreground truncate">{link}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleCopy} className="py-3.5 rounded-2xl bg-card border border-border/50 font-semibold text-[14px] flex items-center justify-center gap-2">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button onClick={handleShare} className="py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] flex items-center justify-center gap-2 shadow-lg shadow-primary/25">
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PaymentRequest;
