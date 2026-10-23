# የቻት ገፅ ላይኛው ክፍል — ልክ እንደ ቪዲዮው (ቴሌግራም) ዝቅ/ከፍ

## ከቪዲዮው ያየሁት (ቴሌግራም እንዴት እንደሚሰራ)
1. **ቅደም ተከተል:** ርዕስ (Telegram) → Stories ረድፍ → Search chats → ፎልደር ታቦች (All Chats…) → ዝርዝሩ።
2. **ጣትን ይከተላል:** ሲያሸበልሉ ክፍሉ በአንዴ አይዘጋም/አይከፈትም፤ ጣትዎ በሄደበት ልክ ቀስ በቀስ ያጥራል። ጣትዎን ሲያነሱ ወደ ቅርብ ሁኔታ (ክፍት ወይም ዝግ) በለስላሳ ይጠጋል።
3. **Stories ወደ ትንሽ ክምር ይቀየራሉ:** ወደ ታች ሲሸበልሉ የStories ረድፍ ያንሳል እና ወደ 2–3 ትናንሽ የተደራረቡ ፎቶዎች ሆኖ ከርዕሱ ጎን ይቀመጣል። እሱን ሲነኩ Stories ይከፈታሉ።
4. **Search ይደበቃል፣ የSearch ምልክት ይመጣል:** Search bar ሲደበቅ በርዕሱ ረድፍ ቀኝ በኩል የፍለጋ (🔍) ምልክት ይታያል፤ Search bar ሲመለስ ምልክቱ ይጠፋል።
5. **ወደ ላይ ሲመለሱ:** መጀመሪያ Search bar ይመለሳል። ከላይኛው ጫፍ ላይ ደርሰው ወደ ታች ሲጎትቱ (pull down) Stories ሙሉ ረድፍ ሆነው ይከፈታሉ።
6. **የማይንቀሳቀሱ:** ርዕስ ረድፍ (አቫታር + unread badge + ምናሌ) እና ፎልደር ታቦች ሁሌም ይታያሉ።

## የሚለወጠው
- ከላይ ያሉት 6 ባህሪያት በEchat ቻት ገፅ ላይ ይተገበራሉ።
- አሁን ያለው "በአንዴ ይዘጋል/ይከፈታል" አሰራር ይወገዳል — ይህ ነበር መንቀጥቀጡንና "አያሸበልልም" የሚለውን ስሜት የፈጠረው።

## የማይነኩ
- ቀለሞች፣ Cosmic ዲዛይን፣ badges፣ ፎልደር ታቦች፣ የታች ማውጫ፣ የቻት ተግባራት፣ Stories መፍጠር/ማየት እና የግላዊነት ህጎች።

## ቴክኒካዊ ዝርዝር
- `src/pages/Chats.tsx`:
  - የአሁኑን boolean `headerCollapsed` + lock/threshold handler ማስወገድ።
  - Scroll-linked offset፦ `offset = clamp(offset + dy, 0, storiesH + searchH)` በ`requestAnimationFrame`፤ በሚያሸበልሉበት ጊዜ በቀጥታ `transform`/`height` በref ላይ (React re-render ሳይኖር) ማዘመን — ለለስላሳነት።
  - ቅደም ተከተል፦ መጀመሪያ Stories ይታጠፋሉ (0→storiesH)፣ ከዛ Search (storiesH→storiesH+searchH)። ወደ ላይ ሲመለሱ Search ብቻ ይመለሳል፤ Stories የሚከፈቱት `scrollY===0` ላይ touch pull-down (>~60px) ሲኖር ወይም ገፁ ሲከፈት ብቻ።
  - Scroll ሲቆም (~120ms) ወይም `touchend` ላይ ወደ ቅርብ ሁኔታ snap (transition ~200ms)።
  - Header sticky ውስጥ ቁመቱ ሲቀየር ገፁ እንዳይዘል — collapsible ቦታ በheader ውስጥ ብቻ ነው፤ ዝርዝሩ የሚሸበለለው ሁሌም `window` ላይ ስለሆነ feedback loop እንዳይኖር offset ከ`dy` ብቻ ይሰላል (ከራሱ የቁመት ለውጥ የሚመጣ scroll ችላ ይባላል)።
  - በርዕስ ረድፍ፦ Stories ክምር (opacity/scale = progress) ከ"Echat" ጎን፣ የSearch icon (opacity = search progress)።
  - `prefers-reduced-motion` ሲሆን snap ብቻ፣ animation የለም።
- `src/components/stories/StoriesBar.tsx`:
  - `StoriesBar` ውስጥ ያሉትን story groups ለክምሩ ለመጠቀም ትንሽ `StoriesStack` ኤክስፖርት (ተመሳሳይ ዳታ፣ ተጨማሪ ጥያቄ ሳይኖር — shared state በcallback/prop)። StoriesBar mounted ሆኖ ይቆያል።
- ማረጋገጫ፦ Playwright 384×800 ላይ ረጅም ዝርዝር ፈጥሮ በቀስታ/በፍጥነት ማሸበለል፤ በየደረጃው screenshot፣ ቁመቱ ከscroll ጋር በሂደት መቀየሩን፣ መንቀጥቀጥ አለመኖሩን እና snap መስራቱን ማረጋገጥ። ነባር tests ማስኬድ።
