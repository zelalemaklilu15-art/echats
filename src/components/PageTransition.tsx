import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

// Lightweight CSS-only transition (replaces framer-motion to avoid per-route
// remount cost and reduce main-thread work — Telegram-style instant nav).
export const PageTransition = ({ children, className = "" }: PageTransitionProps) => {
  return <div className={`page-transition-in ${className}`}>{children}</div>;
};

export default PageTransition;
