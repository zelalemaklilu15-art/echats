
- Native (Capacitor) code lives in src/lib/native.ts and runs only behind isNative(); the web path must stay unchanged. Why: one codebase serves both the web app and the Android build.
- Release Android builds bundle dist; capacitor.config.ts sets server.url only when CAP_LIVE_RELOAD=1. Why: shipped APKs must not depend on the preview URL.
- Visual styling uses semantic Cosmic Obsidian tokens and shared UI primitives instead of page-level raw colors. Why: all web and Android screens must remain visually consistent and themeable.
- Push notifications are sent server-side: DB triggers call `dispatch_push_event` → `push-dispatch` edge function; never add client-side notify calls. Why: client paths were skipped and unreliable.
- Channels and payment requests live in the database; `channelService` keeps a localStorage cache refreshed by `useChannelSync`. Why: other users must see them and get notified.
