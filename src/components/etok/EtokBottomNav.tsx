import { useNavigate, useLocation } from "react-router-dom";
import { Home, Compass, User, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EtokBottomNavProps {
  onCreateClick?: () => void;
  inFlow?: boolean;
}

export function EtokBottomNav({ onCreateClick, inFlow = false }: EtokBottomNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const items = [
    { name: "Home", icon: Home, path: "/etok", test: "home", active: pathname === "/etok" },
    { name: "Discover", icon: Compass, path: "/etok/search", test: "search", active: pathname.startsWith("/etok/search") },
    { name: "Create", icon: Plus, path: "/etok/camera", test: "create", active: pathname.startsWith("/etok/camera") },
    { name: "Chat", icon: MessageSquare, path: "/chats", test: "back-to-app", active: pathname === "/chats" },
    { name: "Profile", icon: User, path: "/etok/me", test: "profile", active: pathname.startsWith("/etok/me") || pathname.startsWith("/etok/profile") },
  ];
  return (
    <nav aria-label="eTok navigation" className={cn("etok-bottom-nav z-50 shrink-0 border-t border-primary/15 bg-surface-lowest safe-bottom", !inFlow && "fixed inset-x-0 bottom-0")}>
      <div className="mx-auto grid h-[66px] max-w-3xl grid-cols-5 items-center px-2">
        {items.map(item => (
          <Button key={item.name} variant="ghost" aria-label={item.name} aria-current={item.active ? "page" : undefined}
            data-testid={`etok-nav-${item.test}`} onClick={item.name === "Create" ? onCreateClick ?? (() => navigate(item.path)) : () => navigate(item.path)}
            className={cn("relative h-[60px] min-w-0 flex-col gap-1 rounded-lg px-0 text-muted-foreground", item.active && "text-primary")}>
            <span className={cn("flex h-7 w-10 items-center justify-center", item.name === "Create" && "h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-primary")}>
              <item.icon className="!h-5 !w-5" strokeWidth={item.active ? 2.5 : 1.75} />
            </span>
            <span className={cn("text-[10px]", item.name === "Create" && "sr-only")}>{item.name}</span>
            {item.active && <span className="absolute bottom-0 h-0.5 w-5 rounded-full bg-primary" />}
          </Button>
        ))}
      </div>
    </nav>
  );
}
