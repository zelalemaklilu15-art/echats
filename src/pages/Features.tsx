import { ArrowLeft, Star, MessageCircle, Shield, Zap, Users, Camera, Phone, FileText, Globe, Video, Bot, Wallet, Bell, Lock, Map, Gamepad2, BarChart2, Radio, Mic, Pencil, Gift, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  status: "available" | "beta";
  color: string;
  path?: string;
}

const features: Feature[] = [
  { icon: MessageCircle, title: "Instant Messaging",       description: "Real-time 1-on-1 and group chats with reactions, replies, and pins",         status: "available", color: "text-blue-500" },
  { icon: Shield,        title: "End-to-End Encryption",   description: "Messages secured with military-grade encryption",                             status: "available", color: "text-green-500" },
  { icon: Users,         title: "Group Chats",             description: "Groups up to 200 members with polls, slow mode, and admin tools",             status: "available", color: "text-purple-500" },
  { icon: Phone,         title: "Voice & Video Calls",     description: "HD voice and video calls with screen sharing and background blur",            status: "available", color: "text-orange-500" },
  { icon: Camera,        title: "Photo & Video Sharing",   description: "Share images, videos, and documents in any chat",                            status: "available", color: "text-pink-500" },
  { icon: FileText,      title: "File Sharing",            description: "Send documents, PDFs, and any file type",                                    status: "available", color: "text-indigo-500" },
  { icon: Video,         title: "Group Video Calls",       description: "Host multi-person video calls powered by Jitsi Meet",                        status: "available", color: "text-cyan-500", path: "/group-call/demo" },
  { icon: Zap,           title: "Smart Replies",           description: "AI-powered quick reply suggestions based on message context",                 status: "available", color: "text-yellow-500" },
  { icon: Globe,         title: "Message Translation",     description: "Translate any message to English with one tap",                              status: "available", color: "text-teal-500" },
  { icon: Bot,           title: "Echat AI Assistant",      description: "Built-in AI assistant for smart conversations, summaries, and help",         status: "available", color: "text-violet-500", path: "/ai-assistant" },
  { icon: Wallet,        title: "In-App Wallet",           description: "Send money, request payments, savings goals, and QR pay",                   status: "available", color: "text-emerald-500", path: "/wallet" },
  { icon: Bell,          title: "Smart Notifications",     description: "Keyword-based filtering so only the messages that matter notify you",        status: "available", color: "text-amber-500", path: "/notification-settings" },
  { icon: Lock,          title: "App & Wallet Lock",       description: "PIN protection for the app and wallet",                                     status: "available", color: "text-red-500", path: "/privacy-settings" },
  { icon: Map,           title: "Live Location Sharing",   description: "Share your live GPS location for 15 min, 1 hr, or 8 hrs",                  status: "available", color: "text-lime-500" },
  { icon: Pencil,        title: "Shared Drawing Canvas",   description: "Draw and send sketches directly inside any chat",                           status: "available", color: "text-rose-500" },
  { icon: Gamepad2,      title: "Mini Games",              description: "Play Tic-Tac-Toe with friends right inside the chat",                      status: "available", color: "text-fuchsia-500" },
  { icon: BarChart2,     title: "Chat Statistics",         description: "View message counts, most active hours, and streaks per chat",             status: "available", color: "text-sky-500" },
  { icon: Radio,         title: "Broadcast Lists",         description: "Send one message to multiple contacts at once",                             status: "available", color: "text-pink-400", path: "/broadcast" },
  { icon: Mic,           title: "Voice Channels",          description: "Live audio rooms inside groups with real-time speaking detection",         status: "available", color: "text-purple-400" },
  { icon: Cake,          title: "Birthday Reminders",      description: "Get notified when your contacts have birthdays today",                     status: "available", color: "text-yellow-400" },
  { icon: Gift,          title: "Gifts & Stars",           description: "Send digital gifts and star reactions to friends",                         status: "available", color: "text-orange-400", path: "/gifts" },
  { icon: Star,          title: "Stories & Highlights",    description: "Share moments and save them as profile highlights",                        status: "beta",      color: "text-amber-400" },
];

const Features = () => {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 shrink-0">Available</Badge>;
      case "beta":
        return <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 shrink-0">Beta</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Echat Features</h1>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="p-6 rounded-xl bg-gradient-primary text-foreground mb-6 shadow-lg">
          <div className="text-center">
            <Star className="h-12 w-12 mx-auto mb-4 text-foreground/80" />
            <h2 className="text-2xl font-bold mb-1">Echat</h2>
            <p className="text-foreground/80 text-sm">
              {features.filter(f => f.status === "available").length} features fully available
            </p>
          </div>
        </div>

        <h3 className="font-semibold text-[13px] uppercase tracking-wider text-muted-foreground mb-4">All Features</h3>
        <div className="grid gap-3">
          {features.map((feature, index) => (
            <Card
              key={index}
              className={`p-4 transition-smooth ${feature.path ? "cursor-pointer hover:bg-muted/50 active:bg-muted/70" : ""}`}
              onClick={feature.path ? () => navigate(feature.path!) : undefined}
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-xl bg-muted ${feature.color} shrink-0`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-[14px] text-foreground truncate">{feature.title}</h4>
                    {getStatusBadge(feature.status)}
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Features;
