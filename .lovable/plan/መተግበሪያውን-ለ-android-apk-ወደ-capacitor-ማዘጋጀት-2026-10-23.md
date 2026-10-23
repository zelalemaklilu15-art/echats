&nbsp;

# መተግበሪያውን ለ Android APK ወደ Capacitor ማዘጋጀት

መተግበሪያው Capacitor በከፊል አለው (ስም: Echat)። አሁን ሙሉውን አዘምኜ ለ Android APK ልማት ዝግጁ አደርገዋለሁ፣ GitHub ላይም APK በራሱ እንዲሰራ አደርጋለሁ።

## የምሰራቸው

1. የ Android ቅንብሩን ከአሁኑ መተግበሪያ ጋር ማስተካከል፦ አዲሱ Echat logo እንደ መተግበሪያ ምልክት (icon) እና መክፈቻ ገፅ (splash)፣ ጥቁር የመክፈቻ ቀለም፣ ስም "Echat"።
2. APK ውስጥ የቅርብ ጊዜ ለውጦች በሙሉ እንዲካተቱ፦ ቻት፣ voice/video call፣ wallet PIN፣ crypto፣ eTok፣ ማሳወቂያዎች፣ አዲሱ የቻት ገፅ ላይኛው ክፍል። APK የሚይዘው ራሱ መተግበሪያውን ነው እንጂ የ preview ሊንክ አይደለም።
3. GitHub ላይ ራስ-ሰር APK መስሪያ፦ ለውጥ GitHub በደረሰ ቁጥር አዲስ APK ይሰራል፣ ከ GitHub "Actions" ገፅ ታወርደዋለህ (ኮምፒውተር አያስፈልግም)።
4. የ Android ፈቃዶች፦ ካሜራ፣ ማይክሮፎን፣ ማሳወቂያ፣ ኢንተርኔት — ጥሪዎችና ማሳወቂያዎች እንዲሰሩ።
5. የድር (web) መተግበሪያው ምንም አይቀየርም።

## አንተ የምትሰራው

- ለውጦቼ በራሳቸው ወደ GitHub ይሄዳሉ። ከዛ repo → Actions → የመጨረሻው → `echat-apk` አውርድ።
- በ APK ውስጥ push ማሳወቂያ እንዲሰራ የ Firebase `google-services.json` ፋይል እንደ GitHub secret መጨመር አለበት፤ የት እንደምታስገባው በትክክል እነግርሃለሁ።
- Android Studio ውስጥ ልማት መቀጠል ከፈለግህ፦ repo pull → `npm install` → `npm run build` → `npx cap sync android` → `npx cap open android`።

## ቴክኒካዊ ዝርዝር

- `.github/workflows/android.yml`: Node + JDK 21, `npm ci`, `npm run build`, `npx cap add android` (ከሌለ), `@capacitor/assets` ከ logo icon/splash, AndroidManifest ፈቃዶች, `GOOGLE_SERVICES_JSON` secret ካለ, `./gradlew assembleDebug`, artifact upload።
- `resources/icon.png`, `resources/splash.png` ከ logo።
- Debug-signed APK (መጫን ይቻላል)፤ ለ Play Store release signing በኋላ በ keystore ይጨመራል።
- እኔ በራሴ ኮምፒውተር ነው መተግበሪያውን የምሰራው እንጂ በ github አልፈልግም አንተ ብቻ ወደ capacitor ቀይረህ github ላይ ስቀልልኝ