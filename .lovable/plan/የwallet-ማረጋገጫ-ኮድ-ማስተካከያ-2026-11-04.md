# የWallet ማረጋገጫ ኮድ ማስተካከያ

## ችግሩ
Wallet በአዲስ ስልክ ሲከፈት መተግበሪያው "Email code" ይጠይቃል። ነገር ግን የሚላከው ኢሜይል የ"Sign in" ቁልፍ ያለው የመግቢያ አገናኝ (login link) ብቻ ነው፤ ቁጥር ኮዱ በኢሜይሉ ውስጥ አይታይም። ምክንያቱ የWallet ኮዱ እና የመግቢያ አገናኙ አንድ ዓይነት የኢሜይል ቅርጽ ስለሚጠቀሙ ነው፤ ቅርጹ አገናኙን ብቻ ያሳያል።

## ማስተካከያው
1. የ"Sign-in" ኢሜይሉ በግልጽ ትልቅ ባለ 6 አሃዝ ኮድ እንዲያሳይ ማድረግ — ርዕሱ "Your Echat verification code" ይሆናል።
2. ኮዱን በመተግበሪያው "Email code" ሳጥን ውስጥ ማስገባት እንደሚገባ ጽሑፍ ማከል።
3. የ"Sign in" አገናኙ እንዲወገድ — ሰዎች በስህተት ተጭነው ሌላ ቦታ እንዳይገቡ።
4. ኢሜይሉን ማሰማራት (deploy) — Publish አያስፈልግም፤ ለድረ-ገጹም ለAPKም ወዲያው ይሰራል።
5. ሙከራ፦ ኢሜይሉ ኮዱን እንደሚያሳይ ማረጋገጥ።

የWallet ደህንነት (PIN፣ የአዲስ ስልክ ማረጋገጫ) አይቀየርም።

## Technical
- `supabase/functions/_shared/email-templates/magic-link.tsx`: accept `token` prop, render code block, drop button.
- `auth-email-hook/index.ts`: pass `data.email_data.token` to magiclink render; subject "Your Echat verification code".
- Deploy `auth-email-hook`.
