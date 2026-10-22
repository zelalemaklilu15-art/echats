# Cosmic Obsidian redesign

## Strict profile access
- [x] Enforce established-interaction/contact access on profile reads and username search; protect alternate disclosure paths.
- [x] Keep hidden names/avatars stable across messaging, call history, channels and contact screens.
- [x] Test authorized and unauthorized access and verify the signed-in app flow.
- [ ] Verify voice/video calls and delivered notifications on two physical phones; requires user-held devices.

## Previous redesign work (outside this request)
- [ ] Apply the shared design tokens, typography, controls, overlays, and navigation.
- [ ] Restyle all routed page families and feature-specific components.
- [ ] Verify mobile layouts, routes, interactions, typecheck, tests, and production build.
- [ ] Report any Android SDK-only checks that still require a local device build.
## A-Z audit (step by step)
- [x] 1. General health: tests, errors (presence offline-on-leave fixed, denied-notification noise quieted)
- [x] 2. Sign-in & account (password reset page added, signup email-confirm handling)
- [x] 3. Chat (undo-send deleted the wrong message — fixed)
- [x] 4. Calls — fixed stale setup/signaling, immediate capture release, rapid mute/camera races, sender reuse, sound control and live history; 23 call tests and signed-in hangup/redial verified. Two-phone audio/video and lock-screen delivery remain pending above.
- [ ] 5. Wallet
- [ ] 6. eTok, Stories, Channels
- [ ] 7. Notifications & privacy
- [ ] 8. Design & mobile
