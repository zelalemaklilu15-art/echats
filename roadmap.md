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
- [ ] 5. Wallet — active audit; preserve financial data.
  - [x] Atomic transfers/payment requests, shared PIN lockout, server device checks and secure activation.
  - [x] Account-scoped caches, consistent wallet gates, full history/detail access and working payment links.
  - [x] Stop fabricated scheduled/savings payments; show pending deposits honestly.
  - [x] Require per-purchase PIN/device authorization for Stars and AI wallet spending; isolate local goals per account.
  - [x] Automated financial/security tests (111 total passing); signed-in device guard and invalid-link checks; Stars/AI PIN prompts opened without moving existing funds.
  - [ ] Complete real authorized transfer/request/airtime read-back; blocked by new-device email verification and no authorized payment test input. No live funds moved.
  - [ ] Real deposit settlement needs a payment provider; airtime remains pending as requested.
  - [x] Answer credit-cost concern; Stage 6 scope subsequently expanded at the user's explicit request.
- [ ] 6. eTok, Stories, Channels
  - [x] 6a. eTok fixes: server-owned counters, comment/reply validation, safe search, authenticated private uploads, favorite races and Live shutdown/reconnection.
  - [x] 6b. Stories fixes: server-enforced audiences/expiry, durable close-friends/polls, private media, owner viewing and viewer identity handling; signed-in create/view/delete verified.
  - [x] 6c. Channels fixes: owner-only posting/attribution, private subscription checks, newest-post pagination and synchronized viewer caches; signed-in create/post/reload/delete verified.
  - [x] 6d. Regression tests and signed-in checks: private eTok upload/reload/playback, comments/replies, favorite/QR, Story publish/view/delete and Channel reload persistence; Live capture/playback/end confirmed in stored state. Audit artifacts cleaned; private media buckets/policies verified.
  - [ ] 6e. Real host-to-viewer Live audio/video and reconnect on two physical phones; blocked by access to user-held devices. Browser capture used simulated camera/microphone, not two-phone delivery.
- [x] 7. Notifications & privacy — settings now obeyed by server (messages/groups/missed calls/preview), Story alerts only to its audience, eTok new-video alerts fixed. Lock-screen check on two phones pending.
- [x] 8. Design & mobile — 51 pages swept at phone size: no overflow or errors; repeated "Login successful" and faded Features banner fixed.

## Telegram parity features
- [x] Two-step verification enforced at sign-in: 6-digit authenticator gate before any screen opens; disabling 2FA requires the code.
- [x] Channel post comments: server-owned counters and authorization, comment panel with delete, owner comments on/off switch, push alerts to the post author and channel owner.
- [ ] Shareable folder links: durable account-scoped folders, secure group/channel invite preview and acceptance, owner revocation, and signed-in persistence/security verification; private direct chats never included.

