# ኢሜይሎች የማይደርሱበትን ችግር ማስተካከል

## ችግሩ (ተረጋግጧል)
የምዝገባ፣ የይለፍ ቃል መቀየሪያ እና የWallet ኮድ ኢሜይሎች ሁሉም በአንድ የኢሜይል መላኪያ በኩል ያልፋሉ። ይህ መላኪያ ኢሜይሉን ከ `notify.echats.site` ለመላክ ይሞክራል፣ ነገር ግን የተረጋገጠው አድራሻ `echats.site` ራሱ ነው። ስለዚህ እያንዳንዱ ኢሜይል "ላኪው አልታወቀም" ተብሎ ውድቅ ይሆናል (ዛሬ 3 ጊዜ ተከስቷል)። ዶሜይኑ ራሱ ጤናማ ነው።

## የሚደረገው
1. ላኪውን ወደ የተረጋገጠው `echats.site` መቀየር — ኢሜይሎች ከ `noreply@echats.site` ይላካሉ።
2. መላኪያውን እንደገና ማስነሳት (deploy) — Publish አያስፈልገውም፣ ለድረ-ገጹም ለAPKም ወዲያው ይሰራል።
3. በሙከራ ምዝገባ ኢሜይል መላኩን በመዝገቡ ማረጋገጥ።
4. የማስታወሻ ፋይሉን ላኪውን `echats.site` እንዲል ማሻሻል።

## Technical
- `supabase/functions/auth-email-hook/index.ts`: `SENDER_DOMAIN` and `FROM_DOMAIN` → `"echats.site"` (log error: 403 `no_matching_sender`; verified sender is the root domain registered via Lovable).
- Deploy `auth-email-hook`; trigger a signup/recovery and confirm a `sent` event in email logs.
- `email-2fa` uses `signInWithOtp`, so it is fixed by the same hook change.
