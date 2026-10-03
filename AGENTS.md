
- Native (Capacitor) code lives in src/lib/native.ts and runs only behind isNative(); the web path must stay unchanged. Why: one codebase serves both the web app and the Android build.
- Release Android builds bundle dist; capacitor.config.ts sets server.url only when CAP_LIVE_RELOAD=1. Why: shipped APKs must not depend on the preview URL.
