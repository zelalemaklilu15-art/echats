# ሁሉንም ኢሜይሎች ልክ እንደ ምስሉ መቀየር

ባለፈው ጊዜ ቀለሞቹን ብቻ ነው የቀየርኩት። በዚህ ጊዜ የምስሉን አቀማመጥና ምስሎች በሙሉ እከተላለሁ።

## የሚቀየሩ ኢሜይሎች
ምዝገባ ማረጋገጫ፣ የይለፍ ቃል መቀየሪያ፣ የመግቢያ ሊንክ፣ ግብዣ፣ የኢሜይል መቀየሪያ፣ የማረጋገጫ ኮድ እና የዋሌት ደረሰኝ።

## ከምስሉ የሚወሰዱ ነገሮች
1. **ጨለማ ዳራ** እና ዙሪያውን የሚያበራ ሮዝ-ብርቱካናማ ብርሃን።
2. **ከላይ ባለ ግራዲየንት ባንድ** (ሐምራዊ → ሮዝ → ብርቱካናማ → ቢጫ)። በመሃሉ ነጭ የEchat ምልክት (የቻት አዶ ከምልክት ጋር) እና "Echat" ጽሑፍ።
3. **ነጭ የመስታወት ካርድ** ከባንዱ በታች በከፊል ተደራርቦ፣ ክብ ጠርዝና ለስላሳ ጥላ ያለው።
4. **ትልቅ 3D አዶ** ከርዕሱ በላይ፣ ለእያንዳንዱ ኢሜይል የሚስማማ፦
   - ምዝገባ / ኢሜይል መቀየሪያ፦ ፖስታ ከምልክት ጋር
   - የይለፍ ቃል / ኮድ፦ ቁልፍ ወይም መቆለፊያ
   - የመግቢያ ሊንክ / ግብዣ፦ ፖስታ ወይም ስጦታ
   - ደረሰኝ፦ የኪስ ቦርሳ ከምልክት ጋር
5. **ባለ ግራዲየንት ርዕስ** (ሐምራዊ → ብርቱካናማ)። ግራዲየንት የማያሳዩ የኢሜይል መተግበሪያዎች ሮዝ ቀለም ያሳያሉ።
6. **"Hi there,"** በሚለው ሰላምታ መጀመር። "Echat" የሚለው ቃል በቀለም ይጻፋል፣ ኢሜይሉም በሮዝ ዳራ ተደምቆ ይታያል።
7. **ባለ ግራዲየንት ክብ ቁልፍ** ከ3D ጥላ ጋር።
8. **ቀጭን መስመር** እና ከስሩ ማሳሰቢያ ጽሑፍ።
9. **ግርጌ**፦ የFacebook፣ Instagram፣ X (Twitter) እና Telegram አዶዎች በግራ፣ "Privacy policy" ሊንክ በቀኝ።

## የኮድ ኢሜይሎችና ደረሰኝ
- ኮዱ በካርዱ ውስጥ ትልቅ ሆኖ በሮዝ ጠርዝ ሳጥን ውስጥ ይታያል።
- ደረሰኙ ላይ መጠኑ ትልቅ ሆኖ ይታያል። የዝርዝር ሰንጠረዡ (ክፍያ፣ ቀሪ ሂሳብ፣ ቀን፣ የግብይት ቁጥር) በዚሁ ዲዛይን ይቆያል።

## ከእርስዎ የሚያስፈልገኝ
- የEchat የFacebook፣ Instagram፣ X እና Telegram ገጾች ሊንኮች። ሊንኮቹን እስኪሰጡኝ ድረስ የማህበራዊ ሚዲያ አዶዎቹ ወደ echats.site ይወስዳሉ።

## ማስታወሻ
- አንዳንድ የኢሜይል መተግበሪያዎች (እንደ Gmail) ምስሎችን መጀመሪያ ላይ ሊደብቁ ይችላሉ። በዚህ ጊዜ ምስሎቹ በሚገልጹ ጽሑፎች ይተካሉ።
- Outlook ግራዲየንትንና ብርሃኑን አያሳይም፤ በምትኩ ደማቅ ሮዝ ቀለም ያሳያል።

## Technical details
- Generate transparent PNG assets (logo mark, 3D icons per email type, four social icons) and host them via lovable-assets CDN; reference absolute URLs with `Img` (email clients require absolute https URLs).
- Rebuild `brand.ts` with shared layout components: `EmailShell` (dark body, glow, gradient header, overlapping card via negative top margin with table fallback), `HeroIcon`, `GradientHeading` (`background-clip:text` with solid fallback color), `GradientButton`, `EmailFooter` (social row + privacy link).
- Update all six auth templates and `wallet-receipt.tsx` to use the shell; keep existing props, subjects and hook `emails` map unchanged.
- Deploy `auth-email-hook`, `preview-transactional-email`, `push-dispatch`; render previews to HTML and screenshot with Playwright to compare against the reference.
