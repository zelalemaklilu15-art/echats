# Wallet ገፅን በCosmic Obsidian ንድፍ መቀየር

## ለምን አልተቀየረም
እስካሁን የተቀየሩት የጋራ ቀለሞች፣ ቁልፎች፣ ካርዶች፣ መስኮቶችና የታችኛው ናቭ ብቻ ናቸው። የWallet ገፅ የራሱ የተፃፉ ቋሚ ቀለሞች (hex/rgba እና inline styles) ስላሉት የጋራ ቀለም ለውጥ አይደርሰውም — ገፁ ራሱ ገና አልተነካም።

## ምን ይሠራል (በZIP Wallet ንድፍ መሰረት)
- ዳራ: ጥቁር obsidian + የከዋክብት ብልጭታ
- የቀሪ ሂሳብ ካርድ: የወርቅ (astral gold) ቅልመት፣ Cinzel ርዕስ፣ glass ፓነል
- ፈጣን ተግባራት (Deposit, Send, Request, Withdraw): ክብ glass አዶዎች ከወርቅ/violet ጠርዝ ጋር
- Stars ክፍል: violet–berry ቅልመት
- የግብይት ታሪክ: cosmic-panel ረድፎች፤ የሁኔታ ቀለሞች (ተሳክቷል አረንጓዴ፣ በሂደት ወርቅ፣ ያልተሳካ ቀይ) ትርጉማቸው ይጠበቃል
- ራስጌ: cosmic-header ከመመለሻ ቀስት ጋር፣ safe-area ይጠበቃል
- ተዛማጅ የWallet መስኮቶች (Deposit, Send, Request, Withdraw sheets) ተመሳሳይ ገጽታ

## የማይቀየሩ
- ቀሪ ሂሳብ፣ ግብይቶች፣ ስሌቶች፣ የክፍያ ጥሪዎች፣ የገደብ/ድግግሞሽ ጥበቃ — ምንም አይነኩም
- የመመለሻ ቁልፍ፣ Android/native ባህሪያት

## ማረጋገጫ
- Typecheck + build
- Wallet ገፅን በስልክ መጠን (384px) ስክሪንሾት ወስዶ ከZIP ንድፍ ጋር ማወዳደር፣ ቀሪ ሂሳብና ታሪክ በትክክል መታየታቸውን ማረጋገጥ

## Technical details
- `src/pages/Wallet.tsx` እና የwallet ክፍሎች ውስጥ ያሉ hex/rgba/raw palette classes ወደ semantic tokens (`bg-surface-*`, `text-tertiary`, `bg-gradient-gold`, `cosmic-panel`, `cosmic-header`, `cosmic-icon-button`) መቀየር
- `.dark`/`.light` ውስጥ የጎደሉትን surface/tertiary/cosmic ተለዋዋጮች በ`src/index.css` ማሟላት (ካልሆነ አዲሶቹ classes አይሠሩም)
- ሎጂክ/state/handlers ሳይለወጡ JSX className/style ብቻ
