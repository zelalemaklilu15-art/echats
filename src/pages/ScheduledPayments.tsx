import { ArrowLeft, CalendarClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Local schedules are not financial records and must never fabricate payments.
export default function ScheduledPayments() {
  const navigate = useNavigate();
  return <div className="min-h-screen bg-background text-foreground px-4 py-8">
    <header className="flex items-center gap-3"><Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate('/wallet')}><ArrowLeft className="h-5 w-5" /></Button><h1 className="text-lg font-bold">Scheduled Payments</h1></header>
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground" />
      <p className="text-muted-foreground">Automatic payments are unavailable. No scheduled money has been sent.</p>
      <Button onClick={() => navigate('/send-money')}>Send Money</Button>
    </div>
  </div>;
}
