# Echat — Android መተግበሪያ የግንባታ መመሪያ

መለያ፦ `com.echat.app` · ስም፦ Echat · ስሪት፦ 1.0.0

> የውሂብ ጎታው፣ የክፍያ ማረጋገጫው እና የAI ሚስጥራዊ ቁልፎች በአገልጋዩ ላይ ይቆያሉ። APK የሚይዘው የፊት ገጹን እና የሕዝብ (publishable) ቁልፉን ብቻ ነው።

## የሚያስፈልጉ ነገሮች
- Node 18+፣ Android Studio (ከSDK 34+ ጋር)፣ JDK 17።

## 1. የመጀመሪያ ዝግጅት
```bash
# በLovable ላይ "Export to GitHub" ይጫኑ፤ ከዚያ፦
git clone <your-repo> && cd <your-repo>
npm install
npx cap add android
npx cap update android
```

## 2. አዶና የመነሻ ማያ
`assets/icon.png` (1024×1024) እና `assets/splash.png` (2732×2732) ከEchat አርማ ያስቀምጡ። አርማው በ`src/assets/echat-logo.jpg` ይገኛል። ከዚያ፦
```bash
npx capacitor-assets generate --android
```

## 3. ስሪት
`android/app/build.gradle` ውስጥ፦ `versionCode 1`፣ `versionName "1.0.0"`።

## 4. ፈቃዶች (`android/app/src/main/AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```
ወደ መተግበሪያው የሚከፈቱ አገናኞች (`com.echat.app://`) እንዲሠሩ በMainActivity `<activity>` ውስጥ ይጨምሩ፦
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="com.echat.app" />
</intent-filter>
```
ካሜራና ማይክሮፎን በጥሪ ጊዜ እንዲሠሩ `MainActivity.java` ውስጥ WebView permission ይፍቀዱ። Capacitor ይህን በነባሪ ይፈቅዳል፤ የAndroid ፈቃዱ የሚጠየቀው ባህሪው ሲከፈት ብቻ ነው።

## 5. ማሳወቂያዎች (Firebase)
Firebase Console ውስጥ Android app (`com.echat.app`) ይጨምሩ። `google-services.json` ፋይሉን አውርደው በ`android/app/` ውስጥ ያስቀምጡ። ይህ ፋይል በGit ውስጥ አይቀመጥም።

## 6. የሙከራ APK
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# ውጤት: android/app/build/outputs/apk/debug/app-debug.apk
```
በቀጥታ ስልክ ላይ ለመጫን፦ `npx cap run android`።
ከLovable preview ጋር የቀጥታ ማደስ (live reload) ለመሞከር፦ `CAP_LIVE_RELOAD=1 npx cap sync android`። ይህን ለልቀት ግንባታ አይጠቀሙ።

## 7. የተፈረመ ልቀት (APK / AAB ለGoogle Play)
```bash
keytool -genkey -v -keystore ~/keys/echat-release.jks -alias echat -keyalg RSA -keysize 2048 -validity 10000
```
የፊርማ ቁልፉን **ከኮዱ ማከማቻ ውጭ** ያስቀምጡ፤ ቅጂውን በደህና ቦታ ያኑሩ። ቁልፉ ከጠፋ መተግበሪያውን ማዘመን አይቻልም።
`android/keystore.properties` ይፍጠሩ (Git ይህን ፋይል ችላ ይለዋል)፦
```
storeFile=/home/you/keys/echat-release.jks
storePassword=***
keyAlias=echat
keyPassword=***
```
`android/app/build.gradle` ውስጥ ፋይሉን የሚያነብ `signingConfigs.release` ይጨምሩ። ከዚያ፦
```bash
npm run build && npx cap sync android
cd android
./gradlew assembleRelease   # APK
./gradlew bundleRelease     # AAB ለGoogle Play
```

## 8. ከGit pull በኋላ ሁልጊዜ
```bash
npm install && npm run build && npx cap sync android
```
