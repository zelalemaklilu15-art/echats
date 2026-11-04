# የአገልግሎት ውሎች (Terms of Service) ገጽ

አካውንት ሳይኖር ማንም ሊያነበው የሚችል `echats.site/terms` ገጽ — በእንግሊዝኛ፣ ለዓለም አቀፍ ተጠቃሚዎች፣ ግልጽና ጠንካራ።

## ይዘቱ (ክፍሎች)
1. ውሎቹን መቀበል እና ዕድሜ (ቢያንስ 13፤ ለWallet 18+)
2. መለያ፣ የይለፍ ቃል፣ PIN እና ደህንነት — የተጠቃሚው ኃላፊነት
3. የተፈቀደና የተከለከለ አጠቃቀም (ማጭበርበር፣ ትንኮሳ፣ ሕገወጥ ይዘት፣ spam፣ ሲስተሙን ማጥቃት)
4. የተጠቃሚ ይዘት (ቻት፣ eTok፣ Live፣ Story፣ Channel) — ባለቤትነት ለተጠቃሚው፣ ለማሳየት ፈቃድ ለEchat
5. Wallet እና ክፍያዎች — PIN ማረጋገጫ፣ ተመላሽ ያለመሆን፣ ፀረ-ገንዘብ ማጭበርበር (AML) ቁጥጥር፣ አጠራጣሪ ግብይት መያዝ
6. Stars እና የውስጥ ግዢዎች
7. የአእምሮ ንብረት (Echat ስም፣ ሎጎ፣ ኮድ)
8. ሪፖርት ማድረግና የቅጂ መብት ቅሬታ (DMCA አይነት)
9. መለያ ማገድ/መዝጋት
10. የዋስትና ገደብ ("as is") እና የኃላፊነት ገደብ
11. ካሳ (Indemnification)
12. የሚገዛው ሕግና አለመግባባት መፍታት (ገለልተኛ፣ ዓለም አቀፍ አገላለጽ — ሀገር አልተጠቀሰም)
13. የውሎች ለውጥ፣ መለያየት (severability)፣ ማነጋገሪያ (support@echats.site)
- "Last updated" ቀን ከላይ

## የሚደረጉ ለውጦች
- ገጹ እንደ Privacy/About ተመሳሳይ ቋሚ ጽሑፍ ብቻ — ከዳታቤዝ ምንም አያነብም
- በመነሻ ገጹ ታችኛው ክፍል እና በPrivacy ገጹ ላይ "Terms" አገናኝ
- በምዝገባ ገጹ ላይ "By creating an account you agree to the Terms and Privacy" አገናኝ
- ወደ sitemap መጨመር

## ማስታወሻ
ጽሑፉን እኔ እጽፈዋለሁ፤ በጥንቃቄ የተዘጋጀ ቢሆንም የሕግ ባለሙያ ምክርን አይተካም። የሚገዛ ሀገር ሕግ እና የኩባንያ ስም ካለህ ንገረኝ፤ ካልሆነ "Echat" እና ገለልተኛ አገላለጽ እጠቀማለሁ።

## ቴክኒካዊ
- `src/pages/PublicInfo.tsx`፡ `page="terms"` ይዘት መጨመር
- `src/App.tsx`፡ `/terms` route
- `Landing.tsx` footer፣ `Auth.tsx` የምዝገባ ጽሑፍ፣ `public/sitemap.xml`
- ፈተና፡ ሳይገቡ `/terms` መከፈቱን Playwright ማረጋገጥ
