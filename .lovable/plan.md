# Voice/Video ጥሪ ችግሮችን በጥልቀት መፍታት

## የተገኙ ምክንያቶች (ከኮዱ የተረጋገጡ)

1. **ሁለተኛው ጥሪ አይደውልም — ዋናው ምክንያት**
   ጥሪ ሲዘጋ መተግበሪያው "ከ1.5–3 ሰከንድ በኋላ አጽዳ" የሚል ሰዓት ቆጣሪ ያስቀምጣል፤ ግን አይመዘገብም፣ አይሰረዝም፣ አንዳንዴም ሁለቴ ይቀመጣል (ዝጋ ሲጫን + ከሌላው ስልክ "ተዘጋ" መልዕክት ሲመጣ)። ስለዚህ፦
   - በዚህ ጊዜ ውስጥ ድጋሜ ቢደውሉ "Already in a call" ተብሎ በዝምታ ይቆማል።
   - ትንሽ ቆይተው ቢደውሉ፣ የቀደመው ቆጣሪ አዲሱን ጥሪ መሃል ላይ ያጠፋዋል።
   - ሌላው ስልክ ገና "ተዘግቷል" ሁኔታ ላይ ከሆነ አዲሱን ጥሪ "Busy" ብሎ ይመልሳል።
2. **የመገናኛ መስመሩ ተዘግቶ ወዲያው ዳግም ይከፈታል** — ጥሪ ሲያልቅ ወደ ሌላው ሰው የሚሄደው መስመር ይዘጋል፣ በሚቀጥለው ጥሪ ወዲያው በተመሳሳይ ስም ይከፈታል። መዝጋቱ ገና ሳያልቅ ስለሚከፈት ሊጣበቅ ይችላል (ይጠረጠራል፣ በሙከራ ይረጋገጣል)።
3. **የዘገየ "ተዘጋ/timeout" መልዕክት አዲሱን ጥሪ ይዘጋል** — ምንም ጥሪ በሌለበት ሁኔታ የሚመጣ የቀደመ መልዕክት ተቀብሎ ይተገበራል።

## ጥሪው ቆይቶ ብቻውን የሚዘጋበት ምክንያቶች (ይጠረጠራሉ — መጀመሪያ ይረጋገጣሉ)
- ተቀባዩ ስልክ ላይ መተግበሪያው ከበስተጀርባ/ማያው ጠፍቶ ከሆነ መልዕክቱ አይደርስም፤ ማሳወቂያ ብቻ ይሄዳል።
- የተለያዩ የሞባይል ኔትወርኮች (Ethio telecom / Safaricom) ላይ TURN አገልጋይ ሳይገኝ ቀርቶ ወደ STUN ብቻ ሲወርድ ግንኙነቱ አይፈጠርም።

## መፍትሔዎች
1. ሁሉንም የ"አጽዳ" ቆጣሪዎች አንድ ቦታ መመዝገብ፤ አዲስ ጥሪ ሲጀመር/ሲመጣ መሰረዝ፤ ጥሪ አንዴ ብቻ እንዲጸዳ።
2. ጥሪ ሲዘጋ ሁኔታውን ወዲያው ወደ "ዝግጁ" መመለስ (የ"ጥሪ አልቋል" መልዕክት ለዓይን ብቻ)፤ ስለዚህ ወዲያው ድጋሜ መደወል ይቻላል፣ ሌላውም "Busy" አይልም።
3. የቀደመ ጥሪ መልዕክቶችን (የተለየ room) ሙሉ በሙሉ ችላ ማለት።
4. ወደ ሌላው ሰው የሚሄደውን መስመር ጥሪዎች መካከል ሳይዘጋ ክፍት ማቆየት፣ ከተበላሸ ብቻ በአዲስ መተካት።
5. TURN ሲጠፋ ግልጽ መልዕክት መስጠትና ለመገናኘት ተጨማሪ ጊዜ መፍቀድ፤ የግንኙነት ደረጃዎችን (ተልኳል → ደርሷል → እየጠራ → ተገናኝቷል) በጥሪ ገፁ ላይ ማሳየት ስለዚህ የት እንደሚቆም ይታወቃል።
6. ከበስተጀርባ የነበረው ተቀባይ ማሳወቂያውን ሲጫን ጥሪው በቀጥታ እንዲከፈት ማረጋገጥ።

## ማረጋገጫ
- ሁለት የተለያዩ አካውንቶች በሁለት browser ውስጥ (በሙከራ ካሜራ/ማይክ)፦ voice ደውሎ መገናኘት → መዝጋት → ወዲያው ድጋሜ መደወል → video ደውሎ መገናኘት — 3 ጊዜ ተከታትሎ።
- ለ"ጥሪ ካለቀ በኋላ ድጋሜ መደወል ይቻላል" እና "የቀደመ ቆጣሪ አዲሱን ጥሪ አይዘጋም" ትንሽ ሙከራ (test)።
- በእውነተኛ ስልኮችና በተለያዩ ኔትወርኮች ላይ እዚህ መሞከር አልችልም — ያንን እርስዎ ይሞክሩታል።

## Technical details
- `useCallManager.ts`: `scheduleReset()` holding a single `resetTimerRef`; cleared in `resetCall`, `startCall`, `handleIncomingCall`; replace all raw `setTimeout(resetCall, …)`. `endCall`/`ended` → set `callStateRef='idle'` immediately for gating; keep UI `call_ended` briefly via separate display state. `handleCallStateEvent`: ignore when `!call` or roomId mismatch. Busy check treats `call_ended/missed/rejected/call_failed` as idle.
- `useCallSignaling.ts`: stop dropping peer channel on `releasePeer` (keep warm; drop only on send failure); when recreating, `await supabase.removeChannel` before `channel()`.
- `etokIceServers.ts`: longer TURN fetch window + log fallback; surface stage in call UI.
- Add vitest for reset/redial logic.
