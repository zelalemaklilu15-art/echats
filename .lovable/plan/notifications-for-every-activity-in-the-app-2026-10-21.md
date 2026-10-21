# Notifications for every activity in the app

## What was found
- Wallet notifications work because the server sends them itself when money moves.
- Chat and group notifications depend on the sender's phone asking the server to notify — several send paths in the chat screen (photos, some message types) skip that step, and the notification service shows no activity at all, so in practice they rarely go out.
- eTok (likes, comments, follows), gifts, payment requests, stories and missed calls have no notification at all.

## What will change
Notifications move to the server: whenever something is saved (a new message, a like, a comment...), the database itself triggers the notification. Nothing depends on the sender's phone anymore.

Covered activities:
- Chat: new direct message (with photo/voice/file preview text)
- Groups: new group message (all members except the sender)
- Channels: new post to subscribers
- eTok: new like, comment, reply, follower, and when someone you follow posts a video or goes live
- Gifts received, payment requests received
- Stories from contacts
- Missed calls
- Wallet (already working, unchanged)

Rules:
- You are never notified about your own actions.
- Muted chats/groups and users who turned a type off in Notification Settings get nothing for it.
- Busy activity is grouped (e.g. many likes on one video share one notification that updates instead of 50 separate ones).
- Tapping a notification opens the right screen (chat, group, video, wallet...).

## Verification
- Two test accounts: send a message, group message, like, comment, follow, gift, payment request — confirm a notification record is sent for each in the server logs.
- Confirm the sender doesn't get notified and muted chats stay silent.
- Real phone delivery must be confirmed by you on two phones.

## Technical details
- Enable `pg_net`; one SECURITY DEFINER `notify_push(user_id, kind, title, body, url, tag)` function posting to a new internal `push-dispatch` edge function (authorized with a shared secret header, not callable by clients).
- AFTER INSERT triggers on messages, group_messages, channel posts, etok_likes, etok_comments, etok_follows, etok videos/live, gifts, payment_requests, stories, call logs (missed). Each wrapped in EXCEPTION so a push failure never blocks the insert.
- `push-dispatch` reuses `_shared/fcm.ts`, checks mute/notification preferences, uses tags for collapsing.
- Remove the client-side `notifyPush` calls to avoid duplicates; keep `send-call-notification` for ringing calls and wallet functions as-is.
- Exact table names confirmed against the schema before writing the migration.
