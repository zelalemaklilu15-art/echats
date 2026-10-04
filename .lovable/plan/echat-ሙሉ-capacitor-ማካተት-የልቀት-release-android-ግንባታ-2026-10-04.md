# Echat — ሙሉ Capacitor ማካተት + የልቀት (Release) Android ግንባታ

## ዓላማ
የweb app ሁሉም ገፆች እና UI/UX በAndroid (Capacitor) ላይ በትክክል እንዲሠሩ ማረጋገጥ፣ እና የሙከራ (debug) ሳይሆን **የተፈረመ release APK/AAB** ለማውጣት ሙሉ ዝግጅት።

## የአሁኑ ሁኔታ (የተረጋገጠ)
- Capacitor ፓኬጆች ተጭነዋል (core, android, app, browser, keyboard, push-notifications, splash-screen, status-bar)።
- `src/lib/native.ts` ከ`src/bootstrap.tsx` ጋር ተኗጋጥሯል፦ status bar, splash, የመመለሻ ቁልፍ, deep links, native push registration።
- `capacitor.config.ts` release ላይ `dist` ይጠቀማል፤ live reload በ`CAP_LIVE_RELOAD=1` ብቻ።
- `ANDROID_BUILD.md` የrelease ፊርማ መመሪያ አለው።
- `android/` ፎልደር የለም — ግንባቱ በተጠቃሚው ኮምፒውተር (Android Studio) ላይ ይካሄዳል።

## የሚከናወኑ ለውጦች

### 1. የገጽ-በገጽ native ማካተት (UI/UX)
ሁሉንም ገፆች (Chat, Calls, Etok, Wallet, Settings, AIAssistant, ወዘተ.) በመመርመር የሚከተሉት ይስተካከላሉ፦
- **Safe areas**: notch/status bar እና የታችኛው navigation bar አካባቢ ያለው ይዘት `env(safe-area-inset-*)` እንዲጠቀም፤ የጠፉ ገፆች ላይ መጨመር።
- **የውጭ አገናኞች**: በnative ላይ ሁሉም የውጭ ሊንኮች በ`@capacitor/browser` (in-app browser) እንዲከፈቱ፤ WebView ውስጥ መጥፋት እንዳይኖር።
- **Share**: የነባሩን browser share ወይም clipboard በnative ላይ Capacitor Share/plugin fallback።
- **Push**: native ላይ የweb service-worker መንገድ (firebase-messaging-sw) እንዳይሄድ — `isNative()` መሞከሪያ በ`firebaseMessaging.ts`/`usePushNotifications.ts` ላይ ማረጋገጥ (native token ቀድሞ `native.ts` ይመዘግባል)።
- **ፋይል/ፎቶ ምርጫ እና ካሜራ**: input[type=file] እና getUserMedia በWebView ውስጥ እንደሚሠሩ ማረጋገጥ፤ የሚያስፈልገው native permission handling መጨመር።
- **Haptics/keyboard**: የቁልፍ ሰሌዳ resize ባህሪይ (Chat input) ማረጋገጥ።

### 2. የልቀት (Release) ዝግጅት
- `ANDROID_BUILD.md` ማዘመን፦ የተፈረመ `assembleRelease` APK እና `bundleRelease` AAB ደረጃ በደረጃ፣ keystore ፍጠራ፣ `keystore.properties` ውቅር፣ `versionCode/versionName`።
- የፊርማ ቁልፎች በኮድ ማከማቻ ውስጥ አይቀመጡም (አሁንም እንደዚሁ ነው)።
- App icon/splash ማመንጫ መመሪያ (`@capacitor/assets`) ማጠናከር።

### 3. ማረጋገጫ
- Typecheck + production build (`npm run build`) ንጹሕ መሆኑን ማረጋገጥ።
- **ግልጽ ገደብ**: እዚህ አካባቢ Android SDK/Gradle የለም፤ ስለዚህ APK መገንባትና በስልክ ላይ መሞከር አይቻልም። የሚሠራው ኮድ-ደረጃ ማካተት ብቻ ነው፤ የመጨረሻው release ግንባታ እርስዎ `ANDROID_BUILD.md` እየተከተሉ በAndroid Studio ላይ ነው።

## የሚረከቡ ውጤቶች
1. ሁሉም ገፆች native-ዝግጁ የሆነ የተሻሻለ ኮድ።
2. የተሟላ የrelease APK/AAB መመሪያ (`ANDROID_BUILD.md`)።
3. የተለወጡ ፋይሎች ዝርዝር + የቀሩ (Android Studio ላይ ብቻ የሚሞከሩ) ነገሮች ግልጽ መግለጫ።

## ከፕሮጀክቱ ውጪ የሚሆኑ (እርስዎ ላይ)
- `npx cap add android` + `google-services.json` (Firebase Console)።
- Keystore ፍጠራ እና release ግንባታ በAndroid Studio።
- ከሕዝብ ልቀት በፊት የመጨረሻ ፈቃድዎ ይጠየቃል።
