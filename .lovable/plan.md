# Make calls work end-to-end

Goal: voice and video calls connect reliably every time, on real networks, with correct history and notifications.

## Problems found in the current call code

- **Early ICE candidates are lost.** On the caller side, candidates start flowing right after the offer is created, but the sender only knows where to send them once `activeCall` is set — which happens later. Those first candidates (usually the ones that actually connect) are dropped. On the receiver side, candidates that arrive while the phone is still ringing are discarded too.
- **Signalling messages can be sent before the channel is ready.** Each offer/answer/candidate opens a throwaway realtime channel and sends immediately, without waiting for the subscription to be confirmed — so calls sometimes "ring nowhere".
- **The listening channel is torn down and rebuilt on every call-state change**, which can drop an incoming offer mid-handshake.
- **TURN servers are the dead public openrelay ones.** The project already has an edge function serving fresh TURN credentials (used by Etok live), but the call code doesn't use it — so any call between two users not on the same network fails to connect.
- **Call history is wrong.** Only the caller writes a log; declined, missed, failed and receiver-side calls never get recorded or updated, so the Calls tab under-reports.
- **No ring notification for the callee** when the app is backgrounded — the call notification function exists but nothing calls it.

## What will be fixed

1. **Reliable signalling**
   - Wait for a confirmed subscription before sending any offer/answer/candidate; retry once on failure.
   - Reuse one persistent outgoing channel per peer instead of creating and destroying one per message.
   - Keep the inbound listening channel alive for the whole session; state changes no longer resubscribe.

2. **Correct ICE handling**
   - Buffer outgoing candidates until the peer target is known, then flush.
   - Buffer inbound candidates until the remote description is set, then flush (both sides).
   - Fetch TURN/STUN from the existing credentials function, with the current public STUN list as fallback.

3. **Robust call lifecycle**
   - Fix stale-closure handlers so mute, hang-up, and connection-state transitions always act on the current call.
   - Handle busy, timeout, reject, and peer-hangup consistently on both sides, always cleaning up media tracks.
   - Auto-recover on a short ICE restart when the connection drops, before declaring failure.

4. **Accurate call history**
   - Receiver resolves the log row by room id and updates it (answered / declined / missed).
   - Caller marks failed and timed-out calls instead of leaving them as "missed".
   - Duration recorded from the moment the connection is established.

5. **Callee ringing notification**
   - Invoke the existing call-notification function when placing a call so the callee gets a push while backgrounded.

6. **Verification**
   - Two-browser Playwright run: place a call from one session, accept in the other, confirm both sides reach connected, media flows, hang-up ends both, and the Calls tab shows the right entry. Repeat for decline, no-answer, and video.

## Technical notes

- Files: `src/hooks/useWebRTC.ts`, `src/hooks/useCallSignaling.ts`, `src/hooks/useCallManager.ts`, `src/lib/callLogService.ts`, `src/contexts/CallContext.tsx`.
- Reuse `src/lib/etokIceServers.ts` for ICE config; make `createPeerConnection` async-aware.
- No schema changes expected; `call_logs` already has status, duration, and room id columns.
