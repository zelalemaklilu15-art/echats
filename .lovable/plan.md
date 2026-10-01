# Echat AI — የወጪ ቁጥጥር መመሪያን ተግባራዊ ማድረግ

መመሪያው ያዘዛቸው አራት አቅጣጫዎች በመተግበሪያው ውስጥ እንደሚከተለው ይሰራሉ።

## 1. እንደ ስራው ክብደት መምረጥ (Routing)
- እያንዳንዱ ጥያቄ ከመላኩ በፊት በአጭሩ ይመደባል፦ **ቀላል** (ሰላምታ፣ አጠቃላይ ድጋፍ፣ አጭር ጥያቄ) ወይም **ከባድ** (ኮድ፣ የገንዘብ/ህግ ጉዳይ፣ ረጅም ትንተና)።
- ቀላል ጥያቄዎች በአጭር፣ ፈጣንና ርካሽ የአስተሳሰብ ደረጃ ይመለሳሉ፤ ከባድ ጥያቄዎች ሙሉ ጥልቅ አስተሳሰብ ያገኛሉ።
- በAI settings ያለው የሞዴል መምረጫ ይወገዳል፤ ተጠቃሚው መምረጥ አያስፈልገውም።
- ተደጋጋሚ ጥያቄዎችና የቆየ ውይይት ርዝመት ይገደባሉ (የመጨረሻ 40 → 20 መልዕክቶች) ወጪ ለመቀነስ።

## 2. ሲጠየቅ ብቻ መንቃት
- AI የሚነቃው ተጠቃሚው Echat AI ገጽ ላይ ሲጽፍ፣ በማንኛውም ቻት ውስጥ `/echatAI` ብሎ ሲጀምር፣ ወይም የAI ቁልፍ ሲጫን ብቻ ነው።
- ከበስተጀርባ በራሱ የሚሄድ ምንም AI ስራ አይኖርም።
- የይዘት ቁጥጥር፦ ሪፖርት የተደረጉ መልዕክቶች ብቻ በAI ይመረመራሉ።

## 3. የቀን ነጻ ገደብ
- እያንዳንዱ ተጠቃሚ **በቀን 15 ነጻ ጥያቄዎች**፤ በAI ገጹ ላይ "ዛሬ የቀረ፦ 12/15" ይታያል።
- ገደቡ ሲያልቅ ግልጽ መልዕክት እና Premium ለመግዛት አማራጭ ይታያል።
- ቆጠራው በአገልጋዩ ላይ ይደረጋል (ተጠቃሚው ሊያልፈው አይችልም)።

## 4. Premium በStars ወይም Wallet
- **Echat AI Premium** (ለምሳሌ 1 ቀን / 30 ቀን)፦ ያልተገደበ ጥያቄ፣ ጥልቅ ትንተና፣ የፕሮጀክት ረዳት።
- ክፍያ ከEchat Stars ወይም ከWallet ቀሪ ሂሳብ በቀጥታ ይቀነሳል፤ ግብይቱ በwallet ታሪክ ይታያል።
- በድምፅ ገንዘብ መላክ ገና ስለሌለ በዚህ ዙር አይካተትም (በኋላ Premium ውስጥ ይገባል)።

## ማረጋገጫ የሚፈልጉ ዝርዝሮች (ነባሪ ዋጋዎች — መቀየር ይቻላል)
- Premium ዋጋ፦ 1 ቀን = 50 Stars ወይም 10 ብር፤ 30 ቀን = 500 Stars ወይም 100 ብር። እውነተኛ ዋጋዎችን ይንገሩኝ።

## Technical details
- `ai-chat` edge function: move to Responses API with `openai/gpt-6-astra` (enforced default); routing implemented as `reasoningEffort: "low"` for simple vs `"medium"/"high"` for complex, using a cheap keyword/length heuristic classifier (no extra AI call). Remove client `model` param and model picker in AI settings Sheet.
- New tables (with GRANTs + RLS): `ai_usage_daily(user_id, day, count)`, `ai_premium_subscriptions(user_id, plan, expires_at, paid_with)`. SECURITY DEFINER RPCs: `consume_ai_quota()` (called server-side in ai-chat, returns remaining or 429-style error), `purchase_ai_premium(plan, method)` debiting `stars_balances` or wallet via existing trigger flow.
- `/echatAI` prefix detection in chat composer opens inline AI reply; report moderation hook reuses existing reports table.
- Handle 402/429 from gateway per error semantics; show quota counter in UI.
