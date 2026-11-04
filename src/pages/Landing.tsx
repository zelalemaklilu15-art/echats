import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  MessageSquare,
  Phone,
  Wallet,
  Video,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  Globe,
} from "lucide-react";
import logoImage from "@/assets/echat-logo.png";

const features = [
  {
    icon: MessageSquare,
    title: "Messages",
    text: "Fast, clean chats with groups, channels, folders and saved messages.",
    tint: "from-violet-500/25 to-fuchsia-500/10",
  },
  {
    icon: Phone,
    title: "Calls",
    text: "Voice and video calls, one-to-one and group, right inside the chat.",
    tint: "from-fuchsia-500/25 to-pink-500/10",
  },
  {
    icon: Wallet,
    title: "Wallet",
    text: "Send, request and schedule money. PIN-guarded, with a full history.",
    tint: "from-amber-400/25 to-yellow-500/10",
  },
  {
    icon: Video,
    title: "eTok",
    text: "Record and share short videos with effects, sounds and hashtags.",
    tint: "from-cyan-400/25 to-sky-500/10",
  },
  {
    icon: Radio,
    title: "Live",
    text: "Go live, host broadcasts and talk to your audience in real time.",
    tint: "from-emerald-400/25 to-teal-500/10",
  },
  {
    icon: ShieldCheck,
    title: "Privacy first",
    text: "Profiles, contacts and wallets stay private until you choose to share.",
    tint: "from-indigo-400/25 to-violet-500/10",
  },
];

const steps = [
  { n: "1", title: "Create your account", text: "Pick a username, add your email, done." },
  { n: "2", title: "Invite people you know", text: "Share your link and start a chat in seconds." },
  { n: "3", title: "Explore everything", text: "Chats, calls, wallet, videos and live — one app." },
];

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: "easeOut" as const },
});

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="cosmic-shell overflow-x-hidden">
      {/* ── Header ── */}
      <header className="cosmic-header sticky top-0 z-30">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-xl">
              <img src={logoImage} alt="" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">Echat</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-smooth hover:text-foreground"
            >
              Sign in
            </Link>
            <button
              onClick={() => navigate("/auth")}
              className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-primary transition-smooth hover:opacity-90"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto w-full max-w-6xl px-5 pt-16 pb-14 sm:pt-24">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-[110px]"
          style={{ background: "hsl(var(--primary) / 0.22)" }}
        />
        <div className="relative text-center">
          <motion.div {...fade(0)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(var(--accent))" }} />
              One app for everything you do
            </span>
          </motion.div>

          <motion.h1
            {...fade(0.1)}
            className="mx-auto mt-6 max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl"
          >
            <span className="text-foreground">Message. Call. Pay.</span>{" "}
            <span className="gradient-text">Create.</span>
          </motion.h1>

          <motion.p
            {...fade(0.2)}
            className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            Echat brings your chats, calls, money, videos and live streams into one
            fast, private app — so you stop jumping between five.
          </motion.p>

          <motion.div {...fade(0.3)} className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate("/auth")}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-primary transition-smooth hover:opacity-90 sm:w-auto"
            >
              Create your account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="w-full rounded-2xl border border-border/70 bg-card/50 px-7 py-3.5 text-base font-medium text-foreground transition-smooth hover:bg-card sm:w-auto"
            >
              I already have one
            </button>
          </motion.div>

          <motion.p {...fade(0.4)} className="mt-5 text-xs text-muted-foreground">
            Free to join · No ads in your chats · Your data stays private
          </motion.p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="cosmic-panel rounded-2xl p-5"
            >
              <div
                className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.tint}`}
              >
                <f.icon className="h-5 w-5" style={{ color: "hsl(var(--foreground))" }} />
              </div>
              <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-14">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Up and running in a minute
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="glass rounded-2xl p-5 text-center"
            >
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                {s.n}
              </div>
              <p className="font-semibold text-foreground">{s.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Closing call to action ── */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="cosmic-panel relative overflow-hidden rounded-3xl px-6 py-12 text-center"
        >
          <div
            className="pointer-events-none absolute inset-x-0 -top-24 h-56 blur-[90px]"
            style={{ background: "hsl(var(--secondary) / 0.28)" }}
          />
          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Bring your people into one place
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
              Create your account, then invite the people you already talk to every day.
            </p>
            <button
              onClick={() => navigate("/auth")}
              className="group mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-primary transition-smooth hover:opacity-90"
            >
              Get started — it's free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 py-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4" />
            <span>Echat — built for everyone, everywhere</span>
          </div>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/app-features" className="hover:text-foreground">Features</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </nav>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Fast
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Private
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Community
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
