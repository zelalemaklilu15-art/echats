import { lazy as reactLazy, type ComponentType } from "react";

const KEY = "chunk-reload-at";

function isChunkError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(msg);
}

/** Like React.lazy, but after a new deploy (old file names gone) reloads the page once to get fresh files. */
export function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return reactLazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkError(err) && typeof window !== "undefined") {
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last > 10000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e) => {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last > 10000) {
      e.preventDefault();
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    }
  });
}
