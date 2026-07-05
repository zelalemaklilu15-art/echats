import './index.css'

const formatError = (error: unknown) => {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim();
  return String(error);
};

const showBootError = (error: unknown) => {
  console.error("[Boot] Application failed before React mounted:", error);
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = "";

  const main = document.createElement("main");
  main.className = "min-h-screen bg-background text-foreground flex items-center justify-center p-6";

  const section = document.createElement("section");
  section.className = "w-full max-w-xl border border-border bg-card p-6 shadow-lg";

  const title = document.createElement("h1");
  title.className = "text-2xl font-bold";
  title.textContent = "Application failed to start";

  const copy = document.createElement("p");
  copy.className = "mt-3 text-sm text-muted-foreground";
  copy.textContent = "A startup error stopped React from mounting. The full browser error is shown below.";

  const pre = document.createElement("pre");
  pre.className = "mt-4 max-h-72 overflow-auto border border-border bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap";
  pre.textContent = formatError(error);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "mt-4 inline-flex h-10 items-center justify-center bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  button.textContent = "Reload app";
  button.addEventListener("click", () => window.location.reload());

  section.append(title, copy, pre, button);
  main.append(section);
  root.append(main);
};

window.addEventListener("error", (event) => {
  const message = String(event?.message || "");
  console.error("[WindowError]", event.error ?? message);
  if (/Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)) {
    if (!sessionStorage.getItem("__echat_chunk_reload")) {
      sessionStorage.setItem("__echat_chunk_reload", "1");
      location.reload();
      return;
    }
  }
  const root = document.getElementById("root");
  if (root && root.innerHTML.trim().length === 0) showBootError(event.error ?? message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[UnhandledRejection]", event.reason);
  const root = document.getElementById("root");
  if (root && root.innerHTML.trim().length === 0) showBootError(event.reason);
});

const unregisterAppServiceWorkers = async () => {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith('/sw.js') || r.installing?.scriptURL.endsWith('/sw.js') || r.waiting?.scriptURL.endsWith('/sw.js')).map((r) => r.unregister().catch(() => {})));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('echat-')).map((k) => caches.delete(k).catch(() => {})));
    }
  } catch { /* noop */ }
};

// Service worker: remove the old app-shell worker everywhere. It previously
// cached stale builds and could show a black screen before React even started.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await unregisterAppServiceWorkers();
    } catch { /* noop */ }
  });
}

import('./bootstrap').catch(showBootError);
