## Deep performance refactor

Goal: make Echat feel as fast and stable as Telegram across chat, media, navigation, and the whole app.

### 1. Fix the recursive RLS that's failing in production
`group_members` SELECT policy queries itself → `42P17 infinite recursion`. This breaks `/chats` group loading on every render.

- Add `public.is_group_member(_group_id uuid, _user_id uuid)` and `public.is_group_admin(...)` as `SECURITY DEFINER` functions.
- Replace `gm_select` and `gm_delete` policies to call those functions instead of self-querying.

### 2. Route-level code splitting (biggest single win)
Currently `src/App.tsx` eagerly imports ~60 page components → giant initial bundle, slow first paint.

- Convert every page import to `React.lazy(() => import(...))`.
- Wrap `<Routes>` in `<Suspense>` with a lightweight skeleton (no logo animation — instant).
- Keep `Chats`, `Chat`, `Splash`, `Auth` as priority chunks via `/* webpackPrefetch */`-style `<link rel="modulepreload">` hints after auth.

### 3. Vite build optimization
- Add `build.target: "es2020"`, `cssCodeSplit: true`, `chunkSizeWarningLimit`.
- `manualChunks`: split `react`, `react-router`, `@tanstack/react-query`, `framer-motion`, `@supabase/*`, `lucide-react`, radix UI into vendor chunks.
- Drop `framer-motion` from the splash/loading screen and lazy-load it only where needed (heavy: ~120 KB gzipped).

### 4. React Query defaults
Default `QueryClient` re-fetches aggressively. Set:
- `staleTime: 30_000`, `gcTime: 5 * 60_000`
- `refetchOnWindowFocus: false`, `retry: 1`.

### 5. Chat list & message list virtualization
- `src/pages/Chats.tsx` (1431 lines) renders all chats — switch to `react-window` `FixedSizeList` for >30 items.
- `src/pages/Chat.tsx` (2025 lines) renders full message history — use `react-window` `VariableSizeList` reversed, with `overscanCount={8}` for Telegram-like smooth scroll.

### 6. Realtime / store stability
- Add reconnect backoff in chat realtime channel (logs show repeated CLOSED ↔ SUBSCRIBED).
- Debounce `loadChats` calls (currently re-fires on every store event).
- Single shared realtime channel per user instead of per-feature.

### 7. Image & media performance
- Add `loading="lazy"` + `decoding="async"` to every `<img>` (chat avatars, message images, stories).
- Image thumbnails: use Supabase Storage `transform: { width, quality }` on list views.
- Add a simple `<Img>` component with blurhash/placeholder + intersection-observer based load.

### 8. Animation pruning
- Remove `AnimatePresence` page transition wrapper (currently re-mounts every page on navigation, causing jank). Replace with CSS-only fade.
- Keep framer-motion only inside Splash, CallOverlay, Story viewer.

### 9. Service worker prefetch
- `public/sw.js` already exists — cache built JS/CSS chunks + avatars with stale-while-revalidate so repeat opens are instant.

### 10. Console hygiene
- Add React Router `v7_startTransition` + `v7_relativeSplatPath` future flags to silence warnings and enable concurrent transitions (also improves nav perf).

### Out of scope (this turn)
- Replacing chat backend protocol (would require WebSocket server work).
- Native push beyond current `usePushNotifications` hook.

### Execution order
1. Migration: fix `group_members` recursion.
2. `vite.config.ts`: manualChunks + target.
3. `src/App.tsx`: lazy routes + Suspense + router future flags + react-query defaults + drop AnimatePresence.
4. Install `react-window` and virtualize `Chats.tsx` + `Chat.tsx` message list.
5. Add `<Img>` lazy component, swap heavy `<img>` usages.
6. Chat realtime: debounce + reconnect.
7. Verify in preview, watch console for the recursion error gone and bundle size drop.

After step 1 (migration approval) I'll proceed straight through 2–7.