# ሁሉንም ወደ echats.site ማዛወር

## አሁን ያለው ሁኔታ
- ድረ-ገጹ: `echats.site` እና `www.echats.site` ተገናኝተው እየተዘጋጁ ነው (Lovable በራሱ ያስተካክላል፣ ደቂቃዎች ይወስዳል)።
- ኢሜይል: አሁንም `notify.echat.online` ላይ ነው፣ እና አይሰራም (DNS አልተስተካከለም)።

## የሚደረገው
1. **የኢሜይል ዶሜይኑን ወደ `notify.echats.site` መቀየር** — ዶሜይኑ ከLovable ስለተገዛ፣ የሚያስፈልጉት መዝገቦች በራሳቸው ይገባሉ። ምንም ወደ yegarahost መሄድ አያስፈልግም።
   - ለዚህ ደረጃ "Set up email domain" የሚል መስኮት እከፍትልሃለሁ፣ እዚያ `echats.site` ን ትመርጣለህ።
2. **ሁሉም ኢሜይሎች ከ echats.site ይላካሉ** — የመመዝገቢያ ማረጋገጫ፣ የይለፍ ቃል መቀየሪያ፣ የመግቢያ ኮድ፣ የwallet ማረጋገጫ ኮዶች፣ የኢሜይል መቀየሪያ — ሁሉም ከ `noreply@notify.echats.site` ይመጣሉ።
3. **የኢሜይሎቹ ውስጥ ያሉ ሊንኮች እና ስሞች** ወደ `echats.site` ይቀየራሉ (የድሮው echat.online ወይም echats.lovable.app ሊንክ አይቀርም)።
4. **የመግቢያ እና መመለሻ አድራሻዎች** (ለምሳሌ ከኢሜይል ሊንክ ሲመለሱ) ወደ `https://echats.site` ይስተካከላሉ።
5. **የድሮው echat.online** ከኢሜይል ማዋቀሩ ይወገዳል (እዚያ ያለው yegarahost ድረ-ገጽህና የ mail.echat.online ሳጥን አይነኩም)።
6. **ማረጋገጥ** — ዶሜይኑ ሲረጋገጥ የሙከራ ምዝገባ አድርጌ ኢሜይሉ መምጣቱን አያለሁ።
7. **ማውጣት (Publish)** — ያንተን ፈቃድ ካገኘሁ በኋላ ብቻ። ከዚያ የስልኩ መተግበሪያ (APK) እንደገና መገንባት አለበት።

## ማስታወሻ
- `echatozf@echat.online` የሚለው የመልዕክት ሳጥን (mailbox) በ yegarahost ላይ ስለሆነ እንደ ነበረ ይቀራል። ወደ echats.site ሳጥን ከፈለግክ ለብቻው መከፈት አለበት (Lovable የመቀበያ ሳጥን አይሰጥም)።

## ቴክኒካዊ ዝርዝር
- አዲስ email domain `notify.echats.site` (setup dialog)፤ auth-email-hook ውስጥ `SITE_NAME`/`ROOT_DOMAIN`/`FROM_DOMAIN` እና የ template ሊንኮች ወደ echats.site፤ hook ን deploy።
- auth `site_url` እና redirect allow-list ላይ `https://echats.site` መጨመር፤ ኮድ ውስጥ የተጻፉ `echats.lovable.app`/`echat.online` አድራሻዎችን (payment links፣ share links) መፈተሽና መቀየር።
- memory ውስጥ ያለውን email-sender ማስታወሻ ማዘመን።
