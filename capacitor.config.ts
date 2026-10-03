import type { CapacitorConfig } from "@capacitor/cli";

// Release builds bundle the built web files from `dist`.
// Set CAP_LIVE_RELOAD=1 only for local testing against the live preview.
const liveReload = process.env.CAP_LIVE_RELOAD === "1";

const config: CapacitorConfig = {
  appId: "com.echat.app",
  appName: "Echat",
  webDir: "dist",
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: "#0b0f14", showSpinner: false },
    Keyboard: { resize: "body" as any, resizeOnFullScreen: true },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
  ...(liveReload
    ? { server: { url: "https://2a4a7ebc-c35f-4558-8360-80c95450661d.lovableproject.com?forceHideBadge=true", cleartext: false } }
    : {}),
};

export default config;
