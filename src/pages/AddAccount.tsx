// @ts-nocheck
import { useState, useEffect } from "react";
import { ArrowLeft, Plus, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "@/lib/supabaseService";
import { checkUsername, normalizeUsername, isValidUsernameFormat, usernameMessage, USERNAME_RULE } from "@/lib/usernameCheck";
import { toast } from "sonner";
import { getSessionUserSafe } from "@/lib/authSession";

const AddAccount = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { user } = await getSessionUserSafe();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    checkAuth();
  }, [navigate]);

  const handleUpdateProfile = async () => {
    if (!phoneNumber.trim() || !name.trim() || !username.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!userId) {
      toast.error("Please login first");
      navigate("/auth");
      return;
    }

    // Validate username format
    const normalizedUsername = normalizeUsername(username);
    if (!isValidUsernameFormat(normalizedUsername)) {
      toast.error(USERNAME_RULE);
      return;
    }

    setLoading(true);
    
    try {
      const st = await checkUsername(normalizedUsername);
      if (st !== "available") {
        toast.error(usernameMessage(st));
        setLoading(false);
        return;
      }

      const fullPhoneNumber = `+251${phoneNumber.replace(/\s/g, '')}`;
      
      await updateProfile(userId, {
        username: normalizedUsername,
        name: name.trim(),
        phone_number: fullPhoneNumber,
      });
      
      toast.success("Profile updated successfully");
      navigate("/settings");
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Update Profile</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Update Your Profile
          </h2>
          <p className="text-muted-foreground">
            Enter your profile details
          </p>
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Display Name
              </label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Username (unique)
              </label>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-lg border border-r-0 border-border">
                  @
                </span>
                <Input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="rounded-l-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Must be unique. Others can find you with this.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Country
              </label>
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-border bg-input">
                <span className="text-sm">🇪🇹</span>
                <span className="text-sm text-foreground">Ethiopia</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Phone Number
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-lg">
                  +251
                </span>
                <Input
                  type="tel"
                  placeholder="9 XX XXX XXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="p-6">
        <Button 
          onClick={handleUpdateProfile}
          disabled={!phoneNumber.trim() || !name.trim() || !username.trim() || loading}
          className="w-full h-12 rounded-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-primary"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <User className="h-5 w-5 mr-2" />
              Update Profile
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AddAccount;
