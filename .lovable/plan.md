# Telegram parity — round 2

We'll build these one stage at a time, and I'll test each stage before starting the next.

## Stage 1 — Make the Channel page work like Telegram's
- Header: channel photo, name, subscriber count, mute button. Tapping the header opens a Channel Info page with the description, link, subscribers, media, files and links tabs.
- Posts: photos, videos and files, a "views" eye with a count, post time, an "edited" label, reactions bar, comments (already working), forward/share and "copy post link".
- Pinned post bar at the top, plus a "jump to latest" button.
- Owner tools: edit channel info and photo, admin list, scheduled and silent posts, and post signatures.
- Subscriber side: Join or Leave button, mute, and report.
- The page follows the Cosmic Obsidian design.

## Stage 2 — Saved Messages
- A pinned "Saved Messages" chat appears at the top of Chats.
- You can save any message (private, group or channel) from its menu, and also write notes or files there yourself.
- Saved items stay private to your account. The existing saved-messages storage gets extended to cover all message types.

## Stage 3 — Sticker and GIF search
- The message box gets a sticker/GIF panel with search, recent items and favourites.
- Stickers and GIFs are sent as normal messages and work in private chats, groups and channel comments.

## Stage 4 — Group voice chat
- Group admins can start a live voice chat in a group, and members can join or leave it.
- During the chat: a speaker list, mute/unmute, raise hand, and admins can mute others.
- Only current group members can join. It reuses the existing call system and shows a "Voice chat live" bar in the group.

## Stage 5 — Multiple accounts on one device
- In Settings: add another account (up to 3) and switch between them with one tap.
- Each account's chats, wallet, folders and notifications stay fully separate. Every switch clears in-memory data first.
- The wallet still asks for the PIN, and 2-step verification still applies to every account.

## Technical details
- New database tables follow the existing rules: access controls on every table, write actions go through server functions, and notifications are sent from the server via push-dispatch.
- Channel posts gain media and a schedule time; there's a channel admins table; scheduled posts are published by a server job.
- GIF search runs through a server function. A GIF provider key (Tenor or Giphy) may be needed, and I'll ask for it before Stage 3.
- Voice chat uses a group calls table with participants, plus signalling that checks the user is still a group member.
- Multiple accounts: each account's sign-in is stored separately on the device and swapped in on switch. All caches are already scoped to the account.
- Tests are added for each stage's rules: who can post, who can join a voice chat, and that account data stays separate after a switch.
