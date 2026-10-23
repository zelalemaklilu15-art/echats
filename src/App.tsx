// @ts-nocheck
import { MfaChallengeScreen } from "@/components/MfaChallengeScreen";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef } from "react";
import { toast } from "sonner";
import PageTransition from "./components/PageTransition";
import { usePresence } from "@/hooks/usePresence";
import { useAppPushNotifications } from "@/hooks/useAppPushNotifications";
import logoImage from "@/assets/echat-logo.png";
import { CallProvider } from "@/contexts/CallContext";
import { CallOverlay } from "@/components/call/CallOverlay";
import { DevHealthBanner } from "@/components/dev/DevHealthBanner";
import { useViewerEpoch } from "@/hooks/useViewerEpoch";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { chatStore } from "@/lib/chatStore";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { initAccentColor } from "@/lib/profileCustomizationService";
import { BottomNavigation } from "@/components/BottomNavigation";
import AppLockGate from "./components/AppLockScreen";
import WalletLockGate from "./components/WalletLockScreen";
import { getDueReminders } from "@/lib/reminderService";
import { checkTodaysBirthdays } from "@/lib/birthdayService";
import OfflineBanner from "@/components/OfflineBanner";

// Lazy-load every page — massively reduces initial bundle.
const Splash = lazy(() => import("./pages/Splash"));
const Auth = lazy(() => import("./pages/Auth"));
const Chats = lazy(() => import("./pages/Chats"));
const Chat = lazy(() => import("./pages/Chat"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Calls = lazy(() => import("./pages/Calls"));
const CallHistory = lazy(() => import("./pages/CallHistory"));
const SavedMessages = lazy(() => import("./pages/SavedMessages"));
const NewGroup = lazy(() => import("./pages/NewGroup"));
const GroupChat = lazy(() => import("./pages/GroupChat"));
const AddGroupMembers = lazy(() => import("./pages/AddGroupMembers"));
const NewMessage = lazy(() => import("./pages/NewMessage"));
const NewContact = lazy(() => import("./pages/NewContact"));
const Wallet = lazy(() => import("./pages/Wallet"));
const WalletQR = lazy(() => import("./pages/WalletQR"));
const Features = lazy(() => import("./pages/Features"));
const AddMoney = lazy(() => import("./pages/AddMoney"));
const SendMoney = lazy(() => import("./pages/SendMoney"));
const Airtime = lazy(() => import("./pages/Airtime"));
import WalletSecurityGate from "./components/wallet/WalletSecurityGate";
const RequestMoney = lazy(() => import("./pages/RequestMoney"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const TransactionReceipt = lazy(() => import("./pages/TransactionReceipt"));
const TransactionDetail = lazy(() => import("./pages/TransactionDetail"));
const AddAccount = lazy(() => import("./pages/AddAccount"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ContactProfile = lazy(() => import("./pages/ContactProfile"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const DataStorageSettings = lazy(() => import("./pages/DataStorageSettings"));
const Channels = lazy(() => import("./pages/Channels"));
const ChannelView = lazy(() => import("./pages/ChannelView"));
const Bots = lazy(() => import("./pages/Bots"));
const BotChat = lazy(() => import("./pages/BotChat"));
const NearbyPeople = lazy(() => import("./pages/NearbyPeople"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ActiveSessions = lazy(() => import("./pages/ActiveSessions"));
const VoiceChatRoom = lazy(() => import("./pages/VoiceChatRoom"));
const LiveStories = lazy(() => import("./pages/LiveStories"));
const QuickRepliesSettings = lazy(() => import("./pages/QuickRepliesSettings"));
const BusinessProfileSettings = lazy(() => import("./pages/BusinessProfileSettings"));
const GiftsPage = lazy(() => import("./pages/GiftsPage"));
const BuyStars = lazy(() => import("./pages/BuyStars"));
const Etok = lazy(() => import("./pages/Etok"));
const EtokOnboarding = lazy(() => import("./pages/EtokOnboarding"));
const EtokCamera = lazy(() => import("./pages/EtokCamera"));
const EtokSearch = lazy(() => import("./pages/EtokSearch"));
const EtokLive = lazy(() => import("./pages/EtokLive"));
const EtokProfile = lazy(() => import("./pages/EtokProfile"));
const EtokAnalytics = lazy(() => import("./pages/EtokAnalytics"));
const EtokCreatorTools = lazy(() => import("./pages/EtokCreatorTools"));
const EtokSettings = lazy(() => import("./pages/EtokSettings"));
const GlobalSearch = lazy(() => import("./pages/GlobalSearch"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const ScheduledPayments = lazy(() => import("./pages/ScheduledPayments"));
const Reminders = lazy(() => import("./pages/Reminders"));
const ChatStats = lazy(() => import("./pages/ChatStats"));
const GroupCall = lazy(() => import("./pages/GroupCall"));
const SavingsGoals = lazy(() => import("./pages/SavingsGoals"));
const SoundSettings = lazy(() => import("./pages/SoundSettings"));
const BroadcastList = lazy(() => import("./pages/BroadcastList"));
const PaymentRequest = lazy(() => import("./pages/PaymentRequest"));
const Pay = lazy(() => import("./pages/Pay"));
const Stories = lazy(() => import("./pages/Stories"));
const CloseFriends = lazy(() => import("./pages/CloseFriends"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const FolderInvite = lazy(() => import('./pages/FolderInvite'));

// Initialize accent color from localStorage on app load
initAccentColor();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const guard = (isAuthenticated: boolean, El: JSX.Element, withTransition = true) => {
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return withTransition ? <PageTransition>{El}</PageTransition> : El;
};

const AppRoutes = () => {
  const { authState, user, needsMfa, mfaMode, clearMfa } = useAuth();
  const viewerEpoch = useViewerEpoch();
  const viewerKey = `${user?.id ?? "signed-out"}:${viewerEpoch}`;
  const location = useLocation();
  const navigate = useNavigate();

  const loginToastShownRef = useRef(false);
  const redirectToChatsDoneRef = useRef(false);

  // Reminder checker
  useEffect(() => {
    const check = () => {
      const due = getDueReminders();
      due.forEach((r) => {
        toast(`🔔 Reminder: "${r.messageText}"`, {
          action: { label: "View", onClick: () => navigate(`/chat/${r.chatId}`) },
          duration: 8000,
        });
      });
    };
    const interval = setInterval(check, 60_000);
    check();
    return () => clearInterval(interval);
  }, [navigate]);

  // Birthday checker — disabled. Other users' birthdays are private now.
  useEffect(() => {
    if (!user?.id) return;
    sessionStorage.setItem("echat_bday_checked", "1");
  }, [user?.id]);

  const isAuthenticated = authState === "authenticated";

  useEffect(() => {
    if (user?.id) {
      chatStore.initialize(user.id).catch((err) => {
        console.error("[ChatStore] initialize failed:", err);
      });
    } else {
      chatStore.cleanup();
    }
  }, [user?.id]);

  usePresence(user?.id);
  useAppPushNotifications(user?.id ?? null);

  // Only greet a real sign-in (signed-out -> signed-in), not every app open.
  const sawSignedOutRef = useRef(false);
  useEffect(() => { if (authState === "unauthenticated") sawSignedOutRef.current = true; }, [authState]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!loginToastShownRef.current && sawSignedOutRef.current) {
      toast.success("Login successful");
    }
    loginToastShownRef.current = true;
    if (redirectToChatsDoneRef.current) return;
    const search = new URLSearchParams(location.search);
    const nextRaw = search.get("next");
    const safeNext = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : null;
    if (safeNext) {
      redirectToChatsDoneRef.current = true;
      navigate(safeNext, { replace: true });
      return;
    }
    if (location.pathname === "/chats") {
      redirectToChatsDoneRef.current = true;
      return;
    }
    const publicPaths = new Set(["/", "/auth", "/forgot-password"]);
    if (publicPaths.has(location.pathname)) {
      redirectToChatsDoneRef.current = true;
      navigate("/chats", { replace: true });
    }
  }, [isAuthenticated, location.pathname, location.search, navigate]);

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-8">
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-32 h-32">
            <div className="relative w-32 h-32 rounded-3xl overflow-hidden shadow-primary">
              <img src={logoImage} alt="Echat Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-foreground">Echat</h1>
            <p className="text-lg text-muted-foreground">Fast. Simple. Secure.</p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-1 w-1/2 bg-gradient-primary rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && needsMfa) {
    return <MfaChallengeScreen onVerified={clearMfa} mode={mfaMode} email={user?.email} />;
  }

  const isEtokRoute = location.pathname.startsWith("/etok");
  const showBottomNav =
    isAuthenticated &&
    !isEtokRoute &&
    ["/chats", "/calls", "/channels", "/contacts", "/settings", "/bots", "/nearby"].includes(location.pathname);

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={isAuthenticated ? <Navigate to="/chats" replace /> : <PageTransition><Splash /></PageTransition>} />
          <Route path="/index" element={isAuthenticated ? <Navigate to="/chats" replace /> : <Navigate to="/" replace />} />
          <Route path="/auth" element={isAuthenticated ? <Navigate to="/chats" replace /> : <PageTransition><Auth /></PageTransition>} />
          <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/chats" replace /> : <PageTransition><ForgotPassword /></PageTransition>} />
          <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
          <Route path="/chats" element={guard(isAuthenticated, <Chats key={user?.id ?? 'signed-out'} />)} />
          <Route path="/folder-invite/:token" element={<FolderInvite key={viewerKey} />} />
          <Route path="/chat" element={isAuthenticated ? <Navigate to="/chats" replace /> : <Navigate to="/" replace />} />
          <Route path="/chat/:chatId" element={guard(isAuthenticated, <Chat />)} />
          <Route path="/profile" element={guard(isAuthenticated, <Profile />)} />
          <Route path="/settings" element={guard(isAuthenticated, <Settings />)} />
          <Route path="/contacts" element={guard(isAuthenticated, <Contacts />)} />
          <Route path="/calls" element={guard(isAuthenticated, <Calls />)} />
          <Route path="/call-history" element={guard(isAuthenticated, <CallHistory />)} />
          <Route path="/saved-messages" element={guard(isAuthenticated, <SavedMessages />)} />
          <Route path="/new-group" element={guard(isAuthenticated, <NewGroup />)} />
          <Route path="/group/:groupId" element={guard(isAuthenticated, <GroupChat />)} />
          <Route path="/group/:groupId/add-members" element={guard(isAuthenticated, <AddGroupMembers />)} />
          <Route path="/contact/:userId" element={guard(isAuthenticated, <ContactProfile />)} />
          <Route path="/privacy-settings" element={guard(isAuthenticated, <PrivacySettings />)} />
          <Route path="/notification-settings" element={guard(isAuthenticated, <NotificationSettings />)} />
          <Route path="/data-storage" element={guard(isAuthenticated, <DataStorageSettings />)} />
          <Route path="/new-message" element={guard(isAuthenticated, <NewMessage />)} />
          <Route path="/new-contact" element={guard(isAuthenticated, <NewContact />)} />
          <Route path="/wallet" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><Wallet /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/scheduled-payments" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><ScheduledPayments /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/wallet/qr" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><WalletQR /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/features" element={guard(isAuthenticated, <Features />)} />
          <Route path="/add-money" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><AddMoney /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/send-money" element={guard(isAuthenticated, <WalletSecurityGate><SendMoney /></WalletSecurityGate>)} />
          <Route path="/airtime" element={guard(isAuthenticated, <WalletSecurityGate><Airtime /></WalletSecurityGate>)} />
          <Route path="/request-money" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><RequestMoney /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/transaction-history" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><TransactionHistory /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/transaction-receipt" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><TransactionReceipt /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/transaction-detail/:transactionId" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><TransactionDetail /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/add-account" element={guard(isAuthenticated, <AddAccount />)} />
          <Route path="/channels" element={guard(isAuthenticated, <Channels key={viewerKey} />)} />
          <Route path="/channel/:id" element={guard(isAuthenticated, <ChannelView key={viewerKey} />)} />
          <Route path="/bots" element={guard(isAuthenticated, <Bots />)} />
          <Route path="/bot/:id" element={guard(isAuthenticated, <BotChat />)} />
          <Route path="/nearby" element={guard(isAuthenticated, <NearbyPeople />)} />
          <Route path="/active-sessions" element={guard(isAuthenticated, <ActiveSessions />)} />
          <Route path="/voice-chat/:id" element={guard(isAuthenticated, <VoiceChatRoom />)} />
          <Route path="/live-stories" element={guard(isAuthenticated, <Navigate to="/etok/live" replace />)} />
          <Route path="/quick-replies" element={guard(isAuthenticated, <QuickRepliesSettings />)} />
          <Route path="/business-profile" element={guard(isAuthenticated, <BusinessProfileSettings />)} />
          <Route path="/gifts" element={guard(isAuthenticated, <GiftsPage />)} />
          <Route path="/buy-stars" element={guard(isAuthenticated, <BuyStars />)} />
          <Route path="/search" element={guard(isAuthenticated, <GlobalSearch />, false)} />
          <Route path="/ai-assistant" element={guard(isAuthenticated, <AIAssistant />, false)} />
          <Route path="/etok/onboarding" element={guard(isAuthenticated, <EtokOnboarding />, false)} />
          <Route path="/etok" element={guard(isAuthenticated, <Etok key={viewerKey} />, false)} />
          <Route path="/etok/camera" element={guard(isAuthenticated, <EtokCamera key={viewerKey} />, false)} />
          <Route path="/etok/search" element={guard(isAuthenticated, <EtokSearch key={viewerKey} />, false)} />
          <Route path="/etok/live" element={guard(isAuthenticated, <EtokLive key={viewerKey} />, false)} />
          <Route path="/etok/live/:streamId" element={guard(isAuthenticated, <EtokLive key={viewerKey} />, false)} />
          <Route path="/etok/profile/:userId" element={guard(isAuthenticated, <EtokProfile key={viewerKey} />, false)} />
          <Route path="/etok/me" element={guard(isAuthenticated, <EtokProfile key={viewerKey} />, false)} />
          <Route path="/etok/analytics" element={guard(isAuthenticated, <EtokAnalytics />, false)} />
          <Route path="/etok/creator-tools" element={guard(isAuthenticated, <EtokCreatorTools />, false)} />
          <Route path="/etok/settings" element={guard(isAuthenticated, <EtokSettings key={viewerKey} />, false)} />
          <Route path="/reminders" element={guard(isAuthenticated, <Reminders />)} />
          <Route path="/chat-stats/:chatId" element={guard(isAuthenticated, <ChatStats />)} />
          <Route path="/group-call/:roomId" element={guard(isAuthenticated, <GroupCall />, false)} />
          <Route path="/savings-goals" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><SavingsGoals /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/sound-settings" element={guard(isAuthenticated, <SoundSettings />)} />
          <Route path="/broadcast" element={guard(isAuthenticated, <BroadcastList />)} />
          <Route path="/payment-request" element={guard(isAuthenticated, <WalletSecurityGate><WalletLockGate><PaymentRequest /></WalletLockGate></WalletSecurityGate>)} />
          <Route path="/pay/request/:requestId" element={<Pay />} />
          <Route path="/pay/:recipient/:amount?" element={<Pay />} />
          <Route path="/stories" element={guard(isAuthenticated, <Stories key={viewerKey} />)} />
          <Route path="/close-friends" element={guard(isAuthenticated, <CloseFriends key={viewerKey} />)} />
          <Route path="/.lovable/oauth/consent" element={<PageTransition><OAuthConsent /></PageTransition>} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </Suspense>
      {showBottomNav && <BottomNavigation />}
    </>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <OfflineBanner />
            <AuthProvider>
              <AppLockGate>
                <CallProvider>
                  <AppRoutes />
                  <CallOverlay />
                  <DevHealthBanner />
                </CallProvider>
              </AppLockGate>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
