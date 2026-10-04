import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export const isNative = () => Capacitor.isNativePlatform();

/** Android/iOS-only setup. Does nothing in the browser. */
export async function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add("native-app");

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) { console.warn("status bar", e); }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {}

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      // 1) close open dialogs/sheets
      const open = document.querySelector('[role="dialog"][data-state="open"]');
      if (open) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        return;
      }
      // 2) go back, 3) exit on root
      const root = ["/", "/chats", "/index"].includes(window.location.pathname);
      if (canGoBack && !root) window.history.back();
      else App.exitApp();
    });
    // Deep links: com.echat.app://path -> in-app route
    App.addListener("appUrlOpen", ({ url }) => {
      try {
        const u = new URL(url);
        const path = (u.host ? `/${u.host}` : "") + u.pathname + u.search;
        if (path && path !== "/") window.location.assign(path);
      } catch {}
    });
  } catch (e) { console.warn("app plugin", e); }

  // External links: open http(s) links that leave this origin (and any
  // target="_blank" anchor) in the in-app browser instead of the WebView,
  // so the user never "gets stuck" outside the app.
  document.addEventListener(
    "click",
    (e) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!/^https?:\/\//i.test(href)) return;
      try {
        const url = new URL(href);
        if (url.origin === window.location.origin) return;
      } catch { return; }
      e.preventDefault();
      e.stopPropagation();
      openExternal(href);
    },
    true,
  );

  // Register for push once a user is signed in.
  const { data } = await supabase.auth.getSession();
  if (data.session) registerNativePush();
  supabase.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_IN") registerNativePush(); });
}

/** Open an external URL in the system/in-app browser (native only). */
export async function openExternal(url: string) {
  if (!isNative()) { window.open(url, "_blank", "noopener,noreferrer"); return; }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Share via the native share sheet when available, else web share/clipboard. */
export async function shareContent(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: data.title, text: data.text, url: data.url, dialogTitle: data.title });
      return true;
    } catch { return false; }
  }
  if (navigator.share) {
    try { await navigator.share(data); return true; } catch { return false; }
  }
  return false;
}

let pushStarted = false;
/** Asks notification permission and saves the device token on the server. Never throws. */
export async function registerNativePush() {
  if (!isNative() || pushStarted) return;
  pushStarted = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") { pushStarted = false; return; }
    PushNotifications.addListener("registration", async ({ value }) => {
      const { error } = await supabase.rpc("register_device_token" as any, {
        p_token: value, p_platform: "android", p_user_agent: navigator.userAgent,
      } as any);
      if (error) console.warn("native token save failed", error.message);
    });
    PushNotifications.addListener("registrationError", (e) => console.warn("push registration", e));
    PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const link = (notification.data as any)?.link || (notification.data as any)?.url;
      if (link && typeof link === "string" && link.startsWith("/")) window.location.assign(link);
    });
    await PushNotifications.register();
  } catch (e) {
    pushStarted = false;
    console.warn("native push unavailable", e);
  }
}
