# አዲሱን "የሚያበራ ምህዋር" ሎጎ የEchat ሎጎ ማድረግ

## ምን ይቀየራል
- የተመረጠው ሎጎ (በጥቁር ዳራ ላይ በሚያበራ ቀለበት የተከበበ "e") በመተግበሪያው ውስጥ አሁን ያለውን ሎጎ ይተካል። ይህም በመክፈቻው ገፅ፣ በመግቢያ/ምዝገባ ገፅ፣ በመቆለፊያ ገፅ እና በፈቃድ መስጫ ገፅ ላይ ይሆናል።
- በእነዚህ ገፆች ምልክቱ ብቻ ይታያል (ያለ "Echat" ጽሑፍ)፤ "Echat" የሚለው ስም እንደበፊቱ በጽሑፍ ይታያል።
- የአሳሹ ትር ምልክት (favicon) እና በስልክ ላይ "Add to Home Screen" ሲደረግ የሚታየው ምልክት በአዲሱ ሎጎ ይቀየራሉ።

## ቴክኒካዊ ዝርዝር
- ከአማራጭ 2 ምስል ውስጥ የክብ-ጠርዝ ካሬ ምልክቱን ብቻ ቆርጦ `src/assets/echat-logo.png` አድርጎ ማስቀመጥ፤ እንዲሁም `src/assets/echat-logo.jpg`ን በሚጠቀሙ ፋይሎች (App, Splash, Auth, AppLockScreen, OAuthConsent) ውስጥ ያለውን import ማዘመን።
- `public/favicon.png` (64px) እና `public/icon-192.png` / `public/icon-512.png` መፍጠር፤ `index.html` እና `manifest.json`ን ማዘመን፤ `favicon.ico`ን ማስወገድ።
- የAndroid መተግበሪያ ምልክት በቀጣዩ የAndroid ግንባታ (build) ጊዜ ይቀየራል።
