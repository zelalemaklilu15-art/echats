# ቻት፣ የድምፅ ጥሪ እና የቪዲዮ ጥሪን በጥልቀት መፈተሽና ስህተቶችን ማስተካከል

የNOWPayments ቁልፎችን እስክትልክ ድረስ ይህ ሥራ ይቀጥላል። Wallet እና ሌሎች ገፆች አይነኩም።

## 1. መጀመሪያ ማረጋገጥ (ኮድ ከመቀየሩ በፊት)
ሁለት የተለያዩ የሙከራ አካውንቶችን በሁለት browser ውስጥ በመክፈት፣ እውነተኛ ተጠቃሚ እንደሚያደርገው ደረጃ በደረጃ መሞከር፦
- **ቻት፦** መላክ፣ መቀበል፣ ማረም፣ መሰረዝ፣ ምላሽ (reply)፣ ፎቶ/ፋይል/የድምፅ መልዕክት፣ "ታይቷል" ምልክት፣ "እየጻፈ ነው"፣ ገፁን ደግሞ ሲከፍቱ መልዕክቶች መቆየታቸው፣ የቡድን ቻት።
- **የድምፅ ጥሪ፦** መደወል → መቀበል → መነጋገር → መዝጋት → ወዲያው ድጋሜ መደወል (3 ጊዜ ተከታትሎ)፤ አለመቀበል፣ ያለመመለስ፣ ማይክ ማጥፋት/ማብራት።
- **የቪዲዮ ጥሪ፦** ከላይ ያለው ሁሉ + ካሜራ ማጥፋት/ማብራት፣ የፊት/የኋላ ካሜራ መቀየር፣ ከድምፅ ወደ ቪዲዮ መቀየር።
- **የጥሪ ታሪክ እና ያመለጡ ጥሪዎች** በትክክል መመዝገባቸው።
- የስህተት መዝገቦችን (console / network) በእያንዳንዱ ደረጃ መከታተል።

ያልተሳካ እያንዳንዱ ነገር ምክንያቱ ተረጋግጦ ዝርዝር ይዘጋጃል።

## 2. ማስተካከል
- የተገኙትን ስህተቶች ብቻ ማስተካከል፤ የሚሰራውን አለመንካት።
- ለእያንዳንዱ የተስተካከለ ደንብ (ለምሳሌ "ጥሪ ካለቀ በኋላ ወዲያው መደወል ይቻላል") ትንሽ አውቶማቲክ ፈተና መጨመር።

## 3. የመጨረሻ ማረጋገጫ
- ያሉት ሁሉም ፈተናዎች (156+) መሳካታቸው።
- ተመሳሳዩን የሁለት-browser ሙከራ ደግሞ ማካሄድ።
- የሙከራ መልዕክቶችንና ጥሪዎችን ማጽዳት።

## እዚህ መሞከር የማይቻለው
እውነተኛ ስልኮች፣ የተለያዩ የሞባይል ኔትወርኮች፣ እና መተግበሪያው ተዘግቶ ሳለ የሚመጣ የጥሪ ማሳወቂያ — እነዚህን አንተ በስልክህ ትሞክራቸዋለህ።

## Technical details
- Files likely involved: `src/hooks/useCallManager.ts`, `useCallSignaling.ts`, `useWebRTC.ts`, `src/lib/etokIceServers.ts`, `callLogService.ts`, `src/pages/Chat.tsx`, `GroupChat.tsx`, `src/lib/chatStore.ts`, `src/hooks/useChatStore.ts`.
- Playwright with two contexts, Chromium fake media flags (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`), two minted test sessions.
- Respect AGENTS rules: stale-generation rejection, server-side push only, viewer-scoped caches, profile access.
- Add vitest cases next to `callLifecycle.test.ts` / `callMedia.test.ts`.
