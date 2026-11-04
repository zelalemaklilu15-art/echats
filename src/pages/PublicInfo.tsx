import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import logoImage from "@/assets/echat-logo.png";

type Section = { title: string; text: string };
type Page = { title: string; docTitle: string; intro: string; sections: Section[] };

const pages: Record<"features" | "privacy" | "about", Page> = {
  features: {
    title: "Everything Echat can do",
    docTitle: "Features — Echat messaging, calls, wallet, videos & live",
    intro: "Echat brings chatting, calling, payments, short videos and live broadcasts together in one app.",
    sections: [
      { title: "Messages", text: "One-to-one chats, groups, channels, chat folders, saved messages, quick replies, reminders and broadcast lists." },
      { title: "Voice and video calls", text: "Call one person or a whole group in voice or video, straight from any chat, with a full call history." },
      { title: "Wallet", text: "Send and request money, pay with QR codes and payment links, schedule payments and set savings goals. Every payment is confirmed with your PIN." },
      { title: "eTok short videos", text: "Record short videos with effects, sounds and hashtags, follow creators and see your video analytics." },
      { title: "Live and Stories", text: "Go live to your audience, schedule broadcasts and share Stories with everyone or only close friends." },
      { title: "Assistant and bots", text: "Ask the built-in AI assistant for help and chat with bots for quick tasks." },
    ],
  },
  privacy: {
    title: "Privacy at Echat",
    docTitle: "Privacy — How Echat protects your profile, chats and wallet",
    intro: "Echat is built so that your personal details stay private until you choose to share them.",
    sections: [
      { title: "Your profile stays private", text: "Your name and photo are shown only to people you have actually talked to, called, or saved as a contact. Knowing your username or ID is not enough." },
      { title: "Account required", text: "Chats, wallets, videos and profiles are only available to signed-in users. Visitors without an account see only public information pages like this one." },
      { title: "Protected media", text: "Photos, videos and attachments are stored privately and only opened for people allowed to see them." },
      { title: "Wallet security", text: "Every payment needs your PIN. Large payments, PIN resets and new devices also need a code sent to your email." },
      { title: "Your audience, your choice", text: "Decide who can see your Stories and eTok videos, and who can comment on your channel posts." },
    ],
  },
  about: {
    title: "About Echat",
    docTitle: "About Echat — one app for people everywhere",
    intro: "Echat is an international super app that combines messaging, calls, a wallet, short videos and live streaming.",
    sections: [
      { title: "Why Echat", text: "Most people jump between many apps to talk, pay and share. Echat puts these everyday things in one fast, simple place." },
      { title: "Built for everyone", text: "Echat works on the web at echats.site and on Android phones." },
      { title: "Who makes Echat", text: "Echat is built and operated by Echats, an international technology company. Questions or feedback? Email support@echats.site." },
      { title: "Get started", text: "Create a free account with a username and your email, invite the people you talk to most, and start chatting." },
    ],
  },
};

const nav = [
  { to: "/app-features", label: "Features" },
  { to: "/privacy", label: "Privacy" },
  { to: "/about", label: "About" },
  { to: "/terms", label: "Terms" },
];

const PublicInfo = ({ page }: { page: keyof typeof pages }) => {
  const p = pages[page];
  useEffect(() => {
    document.title = p.docTitle;
    window.scrollTo(0, 0);
  }, [p]);

  return (
    <div className="cosmic-shell min-h-screen">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <img src={logoImage} alt="Echat logo" className="h-8 w-8 rounded-lg" />
          Echat
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="hover:text-foreground">{n.label}</Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl px-5 pb-16">
        <h1 className="gradient-text mt-6 text-4xl font-bold sm:text-5xl">{p.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{p.intro}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {p.sections.map((s) => (
            <section key={s.title} className="cosmic-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </section>
          ))}
        </div>
        <Link to="/auth" className="gradient-primary mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-primary-foreground">
          Create your account <ArrowRight className="h-4 w-4" />
        </Link>
      </main>
    </div>
  );
};

export default PublicInfo;
