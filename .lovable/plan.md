# Notification privacy: Everyone / Contacts / Nobody

## What changes for users
- A new setting in Privacy Settings: "Show my name and photo in other people's notifications": Everyone, My Contacts, Nobody.
- When you send a message, gift, call, request and so on, the person's lock-screen notification follows **your** setting:
  - Everyone: your name shows (only if they are already allowed to see your profile under the strict profile rules).
  - My Contacts: your name shows only if you saved them as a contact.
  - Nobody: they always see a generic notification.
- A generic notification reads "New message" (or "New group message", "Incoming call", "New gift", "Payment request"), with no name, no photo and no message text. Group notifications keep the group name but hide who sent the message.
- Tapping the notification still opens the right chat or screen. Inside the app, names follow the existing profile rules and do not change.

## Current state
- The privacy options that exist today (last seen, profile photo and so on) are saved only on the phone, so the notification service cannot read them. The new setting will be saved on your account.
- Notification names are already checked for each recipient using the strict profile rules. This setting adds a further limit on top of those rules.

## Verification
- Automated tests for each setting: Everyone, Contacts with a saved contact, Contacts without a saved contact, and Nobody. Each test checks the name and message text the notification would show.
- A check that no notification ever carries the sender's photo.
- You will need to confirm the lock-screen result on two phones.

## Technical details
- Migration: table `notification_privacy (user_id uuid pk, show_identity text check in ('everyone','contacts','nobody') default 'contacts', updated_at)`. GRANTs, RLS limited to the owner, plus an upsert function.
- `notification_profile_name(viewer, subject)` is extended to also take this setting into account. A new `notification_identity_allowed(viewer, subject)` returns a boolean, and only the service role can call it.
- `push-dispatch`, `send-call-notification` and `send-notification`: if the name is not allowed, use the generic title and body for that type and remove the preview text. Never set `icon`/`image` to the sender's avatar (check `_shared/fcm.ts`). Then redeploy.
- `PrivacySettings.tsx`: new section that reads and writes the server-side setting through Cosmic tokens.
- Add PGlite tests to `src/test/` that cover all four cases.
