import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Phone, Megaphone, BookUser, Settings, Clapperboard, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { useChatList } from "@/hooks/useChatStore";
import { useMissedCalls } from "@/hooks/useMissedCalls";

interface NavItem {
  path: string;
  icon: React.ComponentType<any>;
  label: string;
  matchPaths?: string[];
  accentClass: string;
}

const navItems: NavItem[] = [
  { path: "/chats",    icon: MessageCircle, label: "Chats",    matchPaths: ["/chats", "/chat"], accentClass: "text-primary" },
  { path: "/calls",    icon: Phone,         label: "Calls", accentClass: "text-cosmic-mint" },
  { path: "/channels", icon: Megaphone,     label: "Channels", accentClass: "text-cosmic-cyan" },
  { path: "/wallet",   icon: Wallet,        label: "Wallet",   matchPaths: ["/wallet", "/add-money", "/send-money", "/request-money", "/transaction-history", "/transaction-detail", "/transaction-receipt", "/gifts", "/buy-stars", "/scheduled-payments"], accentClass: "text-tertiary" },
  { path: "/etok",     icon: Clapperboard,  label: "Etok",     matchPaths: ["/etok"], accentClass: "text-cosmic-magenta" },
  { path: "/contacts", icon: BookUser,      label: "Contacts", accentClass: "text-cosmic-mint" },
  { path: "/settings", icon: Settings,      label: "Settings", accentClass: "text-primary" },
];

export function BottomNavigation() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { totalUnread } = useChatList();
  const { missedCount, markCallsAsSeen } = useMissedCalls();

  const isActive = (item: NavItem) => {
    const paths = item.matchPaths || [item.path];
    return paths.some(p => location.pathname.startsWith(p));
  };

  const handleNavClick = (item: NavItem) => {
    if (item.path === "/calls") markCallsAsSeen();
    navigate(item.path);
  };

  const getBadge = (item: NavItem): number => {
    if (item.path === "/chats") return totalUnread;
    if (item.path === "/calls") return missedCount;
    return 0;
  };

  return (
    <div className="glass-strong fixed bottom-0 left-0 right-0 z-50 border-t border-tertiary/15 shadow-card safe-x">
      <nav className="flex items-stretch justify-around h-[66px] max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon   = item.icon;
          const badge  = getBadge(item);

          return (
            <button
              key={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={() => handleNavClick(item)}
              className="relative flex min-w-0 flex-col items-center justify-center flex-1 gap-1 py-2 transition-all"
            >
              {active && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-x-1 inset-y-1 rounded-md border border-primary/10 bg-primary/10"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}

              <motion.div
                animate={{
                  scale: active ? 1.12 : 1,
                  y: active ? -1 : 0,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className="relative z-10"
              >
                <Icon className={`h-[22px] w-[22px] transition-colors ${active ? item.accentClass : "text-muted-foreground"}`} strokeWidth={active ? 2.4 : 1.8} />
                {badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500 }}
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 text-[10px] font-black rounded-full bg-destructive text-destructive-foreground flex items-center justify-center px-1 leading-none shadow-card"
                  >
                    {badge > 99 ? "99+" : badge}
                  </motion.span>
                )}
              </motion.div>

              <span className={`relative z-10 truncate text-[9.5px] font-bold leading-none transition-colors ${active ? item.accentClass : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="h-safe-area-bottom" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
    </div>
  );
}
