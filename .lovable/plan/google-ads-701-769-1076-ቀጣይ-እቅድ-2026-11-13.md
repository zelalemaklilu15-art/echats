# Google Ads (701-769-1076) — ቀጣይ እቅድ

## አሁን ያለው ሁኔታ
Submit ቢጫኑም Google እስካሁን አካውንቱን ለAPI አላሳየኝም (የአካውንት ዝርዝሩ ባዶ ነው)። አዲስ አካውንት ለመታየት አንዳንዴ ጥቂት ደቂቃዎች ይወስዳል። ሌላው ምክንያት፦ Lovable ላይ ያገናኙት Gmail እና አካውንቱን የከፈቱበት Gmail ተመሳሳይ ላይሆኑ ይችላሉ።

## ደረጃዎች
1. **አካውንቱን ማገናኘት** — ደግሜ እፈልገዋለሁ፤ ሲገኝ 701-769-1076ን ከፕሮጀክቱ ጋር ለማገናኘት የማረጋገጫ ካርድ ይመጣልዎታል። ካልተገኘ ትክክለኛውን Gmail እንዲያገናኙ እጠይቅዎታለሁ።
2. **Google የፈጠረውን ማስታወቂያ ማየት** — Submit ሲሉ የተፈጠረውን ዘመቻ አንብቤ ጽሁፎቹን፣ ሀገራቱን እና በጀቱን አሳይዎታለሁ። ገንዘብ እንዳይቆርጥ በቅድሚያ ፓውዝ (Paused) እንዲሆን እጠይቅዎታለሁ።
3. **የምዝገባ መለኪያ (Conversion tracking)** — የGoogle tag በechats.site ላይ ጨምሬ፣ አንድ ሰው ሲመዘገብ Google እንዲያውቅ አደርጋለሁ። ለዚህ Publish ያስፈልጋል (ያለ እርስዎ ፍቃድ አላደርግም)።
4. **የዘመቻ ዝርዝር (Brief)** — ሀገራት፣ ቋንቋ፣ የዕለት በጀት እና አይነት (Google Search ወይም All Google channels) አብረን እንወስናለን። ርዕሶችን፣ ማብራሪያዎችን እና ቁልፍ ቃላትን እኔ አዘጋጅቼ እርስዎ ያጸድቃሉ።
5. **ዘመቻውን መፍጠር** — በAPI ፈጥሬ በPaused ሁኔታ አስቀምጠዋለሁ፤ ካርድ ከጨመሩ በኋላ እርስዎ ሲፈቅዱ ብቻ ይጀምራል።

## እርስዎ ብቻ የሚሰሩት
- በads.google.com ላይ የክፍያ ካርድ መጨመር
- Google ማንነት ማረጋገጫ ከጠየቀ ሰነድ ማቅረብ

## Technical details
- google_ads--setup_account (inspect → setup with account_id 7017691076) after list_accounts returns it.
- Read existing campaign via google_ads--search; pause via mutate with approval.
- Add gtag + sign-up conversion event in index.html / signup success path; verify send_to matches the account conversion action.
- Follow ad-campaign-create skill for the brief; create_campaign with status PAUSED.
