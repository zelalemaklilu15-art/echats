# Android APK (Capacitor) update

The app already has Capacitor set up (Echat, `com.echat.app`). This brings everything up to date with all recent changes and makes GitHub build the APK automatically.

## What will be done
1. Check the Android setup matches the current app: new Echat logo as the app icon and splash screen, dark splash color, app name "Echat".
2. Make sure the APK includes the latest app (chat, calls, wallet PIN, crypto, eTok, notifications, new Chats header) — the APK packs the built app, not the preview link.
3. Add an automatic GitHub build: every time changes reach GitHub, it builds a fresh APK you can download from the GitHub "Actions" page (no computer needed).
4. Android permissions for camera, microphone, notifications and internet so calls and push work.
5. Nothing in the web app changes.

## What you'll need to do
- GitHub sync sends my changes automatically. After it finishes, open your repo → Actions → latest run → download `echat-apk`.
- For push notifications in the APK, the Firebase `google-services.json` file must be added (as a GitHub secret). I'll tell you exactly where.

## Technical details
- `.github/workflows/android.yml`: Node + JDK 21, `npm ci`, `npm run build`, `npx cap add android` (if missing), `npx @capacitor/assets generate --android` from `src/assets/echat-logo.png`, inject permissions into AndroidManifest, write `google-services.json` from secret `GOOGLE_SERVICES_JSON` if set, `./gradlew assembleDebug`, upload artifact.
- `resources/icon.png`, `resources/splash.png` from the logo.
- Debug-signed APK (installable); release signing can be added later with a keystore.
