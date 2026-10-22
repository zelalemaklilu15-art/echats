// @ts-nocheck
import { useState } from "react";
import { ArrowLeft, Mail, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { resetPassword } from "@/lib/supabaseAuth";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
      toast.success("Password reset email sent!");
    } catch (error: any) {
      const m = String(error?.message || '');
      if (/rate|too many|seconds/i.test(m)) toast.error("Too many requests. Please try again later.");
      else if (/invalid/i.test(m)) toast.error("Invalid email address");
      else toast.error("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/auth")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center px-6 space-y-8">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Check your email
            </h1>
            <p className="text-muted-foreground">
              We've sent a password reset link to
            </p>
            <p className="font-medium text-foreground">{email}</p>
          </div>

          <Card className="p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm text-muted-foreground">
                Click the link in your email to reset your password
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm text-muted-foreground">
                After resetting, return here to sign in
              </div>
            </div>
          </Card>

          <Button 
            onClick={() => navigate("/auth")}
            className="w-full max-w-sm h-12 rounded-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-primary"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/auth")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 space-y-8">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
          <Mail className="h-10 w-10 text-primary" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Forgot Password?
          </h1>
          <p className="text-muted-foreground">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </Card>

        <Button 
          onClick={handleResetPassword}
          disabled={!email.trim() || loading}
          className="w-full h-12 rounded-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-primary"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Reset Link"
          )}
        </Button>

        <Button 
          variant="ghost"
          onClick={() => navigate("/auth")}
          className="w-full"
        >
          Back to Sign In
        </Button>
      </div>
    </div>
  );
};

export default ForgotPassword;