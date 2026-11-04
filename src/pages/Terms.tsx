import { Link } from "react-router-dom";
import { useEffect } from "react";
import logoImage from "@/assets/echat-logo.png";

type Clause = { title: string; body: string[] };

const LAST_UPDATED = "November 4, 2026";

const clauses: Clause[] = [
  { title: "Acceptance of these Terms", body: [
    "These Terms of Service (\"Terms\") form a binding agreement between you and Echats (\"Echats\", \"we\", \"us\"), the company that operates the Echat service, and govern your access to and use of the Echat website at echats.site, the Echat mobile applications and all related features, including messaging, calls, Wallet, Stars, eTok, Live, Stories, Channels, bots and the AI assistant (together, the \"Services\").",
    "By creating an account, or by accessing or using the Services, you confirm that you have read, understood and agree to these Terms and to our Privacy page. If you do not agree, do not use the Services.",
    "If you use the Services on behalf of an organisation, you confirm you are authorised to accept these Terms for it, and \"you\" includes that organisation.",
  ]},
  { title: "Eligibility and age", body: [
    "You must be at least 13 years old, or the minimum age required to consent to online services in your country if higher, to use the Services.",
    "You must be at least 18 years old and have full legal capacity to use the Wallet, send or receive money, buy Stars or make any paid purchase.",
    "You may not use the Services if you are barred from doing so under applicable law, appear on a government sanctions list, or reside in a jurisdiction where the Services or a feature are prohibited.",
  ]},
  { title: "Your account", body: [
    "You must provide accurate, current and complete information and keep it updated. One person may not impersonate another or create accounts using false identities.",
    "You are responsible for keeping your password, Wallet PIN, email verification codes and devices secure, and for all activity under your account. Never share your PIN or codes with anyone — Echats staff will never ask for them.",
    "Notify us immediately at support@echats.site if you suspect unauthorised access. We are not liable for losses caused by your failure to protect your credentials.",
    "Usernames are not owned by you. We may reclaim or change a username that is inactive, misleading, infringing or abusive.",
  ]},
  { title: "Acceptable use", body: [
    "You agree to use the Services only for lawful purposes and in line with these Terms. You must not:",
    "• post or send content that is illegal, sexually exploits minors, promotes terrorism or violent extremism, incites violence or hatred, or harasses, threatens, bullies or doxxes others;",
    "• commit or facilitate fraud, scams, phishing, money laundering, terrorist financing, sanctions evasion, gambling where illegal, or the sale of illegal goods or services;",
    "• send spam, unsolicited bulk messages, chain messages or misleading promotions;",
    "• share someone's private information, intimate images or recordings without their consent;",
    "• infringe anyone's intellectual property, privacy or publicity rights;",
    "• hack, probe, scan, overload, reverse-engineer, scrape, or bypass any security, rate limit or access control of the Services;",
    "• use bots, automation or fake accounts to manipulate followers, views, likes, polls, comments or rankings;",
    "• upload viruses, malware or harmful code; or",
    "• encourage or help anyone else to do any of the above.",
  ]},
  { title: "Your content", body: [
    "You keep ownership of the messages, photos, videos, live streams, Stories, channel posts and other content you create (\"Your Content\").",
    "You grant Echats a worldwide, non-exclusive, royalty-free, sublicensable licence to host, store, copy, process, transmit, display and adapt Your Content solely to operate, secure and improve the Services and to show it to the audiences you choose. This licence ends when Your Content is deleted, except for copies kept in backups for a limited time or where retention is required by law.",
    "You are solely responsible for Your Content and confirm you have all rights needed to share it. Public content (such as public eTok videos, channels or live streams) may be seen, shared and reacted to by others.",
    "We do not pre-screen all content but may review, restrict, remove or report content that we reasonably believe violates these Terms or the law.",
  ]},
  { title: "Wallet and payments", body: [
    "The Wallet lets you hold a balance, send and request money, pay with QR codes and payment links, and schedule payments. Balances change only through Echats' ledger; screenshots or messages are not proof of payment.",
    "Every payment must be confirmed with your PIN. Additional email verification may be required for large payments, PIN resets and new devices.",
    "Payments you confirm are final. Check the recipient and amount carefully — Echats is not obliged to reverse payments sent in error, to the wrong person, or to someone who later fails to deliver goods or services.",
    "To protect users and comply with anti-money-laundering, counter-terrorist-financing and sanctions laws, we may request identity verification, set limits, delay, hold, refuse or reverse transactions, and freeze or close Wallets associated with suspected fraud or illegal activity. We may report such activity to authorities where required.",
    "Some transactions, such as airtime top-ups, may remain pending until confirmed by a third-party provider. Fees, if any, are shown before you confirm.",
    "You are responsible for any taxes that apply to your transactions.",
  ]},
  { title: "Stars and in-app purchases", body: [
    "Stars and other digital items are a limited, revocable licence to use features within the Services. They have no cash value, are not legal tender, cannot be transferred outside Echat and are non-refundable except where required by law.",
    "We may change the price, availability or features of Stars and digital items. Unused items may be lost if your account is closed for violating these Terms.",
  ]},
  { title: "Calls, Live and AI features", body: [
    "Do not record or broadcast others without their consent where consent is required by law.",
    "Echat is not a replacement for telephone service and cannot be used to contact emergency services.",
    "The AI assistant and bots may produce inaccurate or incomplete answers. Do not rely on them for medical, legal, financial or other professional advice. You are responsible for how you use their output.",
  ]},
  { title: "Echats' intellectual property", body: [
    "The Services, including the Echat name, logo, design, software and all content we provide, are owned by Echats or its licensors and protected by intellectual property laws.",
    "We grant you a personal, limited, non-exclusive, non-transferable, revocable licence to use the Services as permitted by these Terms. You may not copy, modify, distribute, sell or rent any part of the Services, or use our brand without written permission.",
    "If you send us feedback or suggestions, we may use them freely without any obligation to you.",
  ]},
  { title: "Reporting and copyright complaints", body: [
    "You can report users, messages, videos or channels inside the app or by email to support@echats.site.",
    "If you believe content infringes your copyright or other rights, send a notice to support@echats.site including: your contact details, the work you claim is infringed, the exact location of the content, a statement of good-faith belief that the use is unauthorised, a statement that your notice is accurate, and your physical or electronic signature.",
    "We may remove content and terminate accounts of repeat infringers. Submitting false notices may make you liable for damages.",
  ]},
  { title: "Third-party services", body: [
    "The Services may include links, bots, payment providers or content from third parties. We do not control and are not responsible for them; your use of them is governed by their own terms.",
  ]},
  { title: "Suspension and termination", body: [
    "You may stop using the Services and delete your account at any time from Settings. Before deleting, withdraw any Wallet balance you are entitled to.",
    "We may warn you, limit features, suspend or terminate your account, or remove content, with or without notice, if you breach these Terms, create risk or legal exposure for Echats or others, or if required by law.",
    "Sections that by their nature should survive termination — including content licences already granted, payment obligations, disclaimers, limitation of liability, indemnity and dispute terms — will survive.",
  ]},
  { title: "Changes to the Services", body: [
    "We continually improve Echat and may add, change, suspend or discontinue any feature at any time. We will try to give reasonable notice of significant changes that negatively affect you.",
  ]},
  { title: "Disclaimers", body: [
    "THE SERVICES ARE PROVIDED \"AS IS\" AND \"AS AVAILABLE\". TO THE FULLEST EXTENT PERMITTED BY LAW, ECHATS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT.",
    "We do not guarantee that the Services will be uninterrupted, error-free or completely secure, that messages or calls will always be delivered, or that content posted by others is accurate or safe.",
  ]},
  { title: "Limitation of liability", body: [
    "TO THE FULLEST EXTENT PERMITTED BY LAW, ECHATS AND ITS OWNERS, EMPLOYEES AND PARTNERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, GOODWILL OR OPPORTUNITY, ARISING FROM OR RELATED TO THE SERVICES.",
    "OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE SERVICES IS LIMITED TO THE GREATER OF (A) THE FEES YOU PAID TO ECHATS IN THE 12 MONTHS BEFORE THE CLAIM AND (B) USD 100. THIS LIMIT DOES NOT REDUCE ANY WALLET BALANCE THAT IS LAWFULLY YOURS.",
    "Some jurisdictions do not allow certain limitations, so some of the above may not apply to you. Nothing in these Terms limits liability that cannot be limited by law, such as for fraud or gross negligence.",
  ]},
  { title: "Indemnification", body: [
    "You agree to defend, indemnify and hold harmless Echats and its owners, employees and partners from any claims, losses, damages and expenses (including reasonable legal fees) arising from Your Content, your use of the Services, or your breach of these Terms or the law.",
  ]},
  { title: "Disputes and governing law", body: [
    "Before filing any claim, you agree to contact us at support@echats.site and try to resolve the dispute informally for at least 30 days.",
    "These Terms are governed by the laws applicable at Echats' principal place of business, without regard to conflict-of-law rules, unless the mandatory consumer protection laws of your country of residence provide otherwise. Nothing in these Terms removes rights you have as a consumer that cannot be waived.",
    "Any claim must be brought individually, not as part of a class or representative action, to the extent permitted by law.",
  ]},
  { title: "General", body: [
    "Changes to Terms: we may update these Terms from time to time. We will update the \"Last updated\" date and, for material changes, notify you in the app or by email. Continuing to use the Services after changes take effect means you accept them.",
    "Severability: if any provision is found unenforceable, the rest remains in full effect. Waiver: our failure to enforce a provision is not a waiver. Assignment: you may not transfer these Terms; we may assign them in connection with a merger, acquisition or sale of assets.",
    "Entire agreement: these Terms, together with the Privacy page and any feature-specific rules shown in the app (such as Wallet terms), are the entire agreement between you and Echats. If these Terms are translated, the English version prevails.",
    "Force majeure: we are not liable for delays or failures caused by events beyond our reasonable control.",
  ]},
  { title: "Contact", body: [
    "Questions about these Terms? Email support@echats.site.",
    "Echat is operated by Echats. In these Terms, \"Echat\" means the service and \"Echats\" means the company behind it.",
  ]},
];

const Terms = () => {
  useEffect(() => {
    document.title = "Terms of Service — Echat";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="cosmic-shell min-h-screen">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <img src={logoImage} alt="Echat logo" className="h-8 w-8 rounded-lg" />
          Echat
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/about" className="hover:text-foreground">About</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        <h1 className="gradient-text mt-6 text-4xl font-bold sm:text-5xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        <nav className="cosmic-panel mt-8 rounded-2xl p-5" aria-label="Contents">
          <h2 className="text-sm font-semibold text-foreground">Contents</h2>
          <ol className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            {clauses.map((c, i) => (
              <li key={c.title}><a href={`#s${i + 1}`} className="hover:text-foreground">{i + 1}. {c.title}</a></li>
            ))}
          </ol>
        </nav>
        <div className="mt-8 space-y-8">
          {clauses.map((c, i) => (
            <section key={c.title} id={`s${i + 1}`} className="scroll-mt-6">
              <h2 className="text-xl font-semibold text-foreground">{i + 1}. {c.title}</h2>
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {c.body.map((t, j) => <p key={j}>{t}</p>)}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Terms;
