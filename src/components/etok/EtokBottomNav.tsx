import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, User, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface EtokBottomNavProps {
  onCreateClick?: () => void;
}

export function EtokBottomNav({ onCreateClick }: EtokBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const isHome = path === "/etok";
  const isSearch = path.startsWith("/etok/search");
  const isProfile = path.startsWith("/etok/me") || path.startsWith("/etok/profile");

  return (
    <div className="glass-strong fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-tertiary/15 pb-safe">
      {/* Home */}
      <button
        onClick={() => navigate("/etok")}
        className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
        data-testid="etok-nav-home"
      >
        <Home className={cn("h-6 w-6", isHome ? "text-tertiary" : "text-muted-foreground")} />
        <span className={cn("text-[10px] font-medium", isHome ? "text-tertiary" : "text-muted-foreground")}>Home</span>
      </button>

      {/* Friends */}
      <button
        onClick={() => navigate("/etok/search")}
        className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
        data-testid="etok-nav-search"
      >
        <Search className={cn("h-6 w-6", isSearch ? "text-primary" : "text-muted-foreground")} />
        <span className={cn("text-[10px] font-medium", isSearch ? "text-primary" : "text-muted-foreground")}>Discover</span>
      </button>

      {/* Create — TikTok-style pink + button */}
      <button
        onClick={onCreateClick ?? (() => navigate("/etok/camera"))}
        className="flex items-center justify-center flex-1 h-full"
        data-testid="etok-nav-create"
      >
        <div className="relative flex items-center justify-center">
          <div className="absolute h-8 w-[52px] translate-x-1.5 rounded-md bg-cosmic-magenta" />
          <div className="absolute h-8 w-[52px] -translate-x-1.5 rounded-md bg-cosmic-cyan" />
          <div className="relative flex h-8 w-[52px] items-center justify-center rounded-md bg-tertiary">
            <Plus className="h-5 w-5 text-tertiary-foreground" strokeWidth={3} />
          </div>
        </div>
      </button>

      {/* Back to main app */}
      <button
        onClick={() => navigate("/chats")}
        className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
        data-testid="etok-nav-back-to-app"
      >
        <div className="relative">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cosmic-magenta" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">Chat</span>
      </button>

      {/* Profile */}
      <button
        onClick={() => navigate("/etok/me")}
        className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
        data-testid="etok-nav-profile"
      >
        <User className={cn("h-6 w-6", isProfile ? "text-tertiary" : "text-muted-foreground")} />
        <span className={cn("text-[10px] font-medium", isProfile ? "text-tertiary" : "text-muted-foreground")}>Profile</span>
      </button>
    </div>
  );
}
