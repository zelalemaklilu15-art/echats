# መተግበሪያውን ከA-Z በደረጃ መፈተሽና ማስተካከል

አሁን ያለው ሁኔታ፦ መተግበሪያው ያለ ስህተት ይከፈታል፤ ሆኖም አንድ የቆየ ሙከራ (የ"online/offline" ሁኔታ) ይወድቃል፣ እና ማሳወቂያ ፍቃድ ሲከለከል ስህተት ይመዘገባል።

ስራው በ8 ትናንሽ ደረጃዎች ይከፈላል። እያንዳንዱ ደረጃ ሲያልቅ ምን እንደተገኘና እንደተስተካከለ አሳውቅዎታለሁ፤ ከዚያ ወደ ቀጣዩ እሄዳለሁ። ያሉ ተግባራትና የገንዘብ መረጃዎች አይነኩም።

## ደረጃዎች
1. **አጠቃላይ ጤና** — የሚወድቁ ሙከራዎች፣ የኮድ ስህተቶች፣ የደህንነት ፍተሻ ውጤቶች ዝርዝር ማውጣትና የቀላሎቹን ማስተካከል።
2. **መግቢያና መለያ** — ምዝገባ፣ መግቢያ፣ የይለፍ ቃል መርሳት፣ መውጣት፣ የመተግበሪያ መቆለፊያ።
3. **ቻት** — የግል ቻት፣ መልዕክት መላክ/ማስተካከል/መሰረዝ፣ ፎቶ/ድምፅ፣ ግሩፖች፣ ፍለጋ በusername።
4. **ጥሪዎች** — ድምፅና ቪዲዮ ጥሪ፣ ደጋግሞ መደወል፣ የጥሪ ታሪክ።
5. **Wallet** — PIN፣ ገንዘብ መላክ/መጠየቅ፣ የአየር ሰዓት፣ ታሪክ፣ QR Pay (ቀደም ሲል "ገፁ አልተገኘም" ያሳይ ነበር)።
6. **eTok፣ Stories፣ Channels** — ቪዲዮዎች፣ አስተያየቶች፣ ቀጥታ ስርጭት፣ ቻናል ልጥፎች።
7. **ማሳወቂያዎችና ግላዊነት** — ማሳወቂያ ፍቃድ ሲከለከል በጸጥታ መያዝ፣ የግላዊነት ቅንብሮች፣ የተደበቁ መገለጫዎች።
8. **ዲዛይንና ሞባይል** — ሁሉም ገፆች በCosmic ዲዛይን መሆናቸውንና በስልክ መጠን በትክክል መታየታቸውን ማረጋገጥ።

## እኔ ማረጋገጥ የማልችለው
- በሁለት እውነተኛ ስልኮች ላይ የሚደረግ ጥሪና የlock-screen ማሳወቂያ — በእርስዎ መሞከር ያስፈልጋል።
- የAndroid ግንባታ በኮምፒውተርዎ ላይ።

## Technical details
- Per step: run vitest, tsgo, security scan + supabase linter, Playwright signed-in route sweep with console/page-error capture; fix category-wide.
- Known now: `src/test/presence.test.ts` "marks offline on unmount" fails; FCM denied permission logged as error; `/wallet-qr` pay route 404; Supabase linter had 37 pre-existing findings.
- Track steps in roadmap.md.
