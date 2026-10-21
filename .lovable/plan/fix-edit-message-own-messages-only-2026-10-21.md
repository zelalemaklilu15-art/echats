# Fix "Edit message" (own messages only)

## Why it fails today
The server rule that guards message updates is broken: it compares each message against *every* message in the database instead of itself, so every edit is rejected and the app shows "Failed to edit message". The same broken rule also blocks the receiver from marking messages as read.

## What changes
1. **Server rule fixed** — replace the broken rule with a correct one:
   - Only the **sender** can change the text of a message.
   - The receiver can only change the delivery/read status — never the text, photo, or file.
   - Nobody can change who sent or received a message.
2. **Edit only shown on your own text messages** — in direct chats and group chats, the Edit option appears only for messages you sent (not for others' messages, photos, or voice notes).
3. **"edited" label** — an edited message shows a small "edited" tag for both people, and the change appears live on the other phone.
4. **Group chat edits saved on the server** — group edits currently only change on your own phone; they will now be saved so all members see the new text (sender only).
5. Empty edits are ignored; pressing Escape/✕ cancels.

## Technical details
- Migration: drop `messages_update` policy; add `messages_update_sender` (USING/WITH CHECK `auth.uid() = sender_id`) and a BEFORE UPDATE trigger that, when `auth.uid() = receiver_id`, raises if content/media_url/file_name/sender_id/receiver_id change, and blocks sender_id/receiver_id changes for everyone; receiver policy for status updates. Add `edited_at timestamptz` nullable column, set by the trigger when content changes.
- `group_messages`: add UPDATE policy for `auth.uid() = sender_id` + same immutable-column trigger + `edited_at`; `editGroupMessage` writes to the table.
- Chat.tsx / GroupChat.tsx: hide Edit unless `isOwn && type === "text"`; render "edited" from `edited_at`; realtime UPDATE events refresh the bubble.
- Verify: two accounts in the browser — sender edits succeeds and shows on the other side; receiver attempt is rejected.
