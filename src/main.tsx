import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Service worker: one-time recovery from prior stale-cache builds (v1/v2),
// then register the fresh worker. This fixes the black-screen-after-deploy bug.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const RECOVERY_KEY = 'echat_sw_recovery_v3';
      if (!localStorage.getItem(RECOVERY_KEY)) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
        }
        localStorage.setItem(RECOVERY_KEY, '1');
      }
      await navigator.serviceWorker.register('/sw.js');
    } catch { /* noop */ }
  });
}

// Auto-recover from chunk load errors (e.g. after a deploy). Reload once.
window.addEventListener('error', (e: any) => {
  const msg = String(e?.message || '');
  if (/Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
    if (!sessionStorage.getItem('__echat_chunk_reload')) {
      sessionStorage.setItem('__echat_chunk_reload', '1');
      location.reload();
    }
  }
});
