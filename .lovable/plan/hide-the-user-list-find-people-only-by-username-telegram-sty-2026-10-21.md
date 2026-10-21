# Hide the user list — find people only by username (Telegram-style)

## What's wrong today
- **Contacts page** shows "suggestions" — random registered accounts the user never interacted with.
- **Send Money** opens with a list of all users (it searches with an empty term).
- **Search** matches any part of a name or username (e.g. typing "a" lists up to 50 strangers).

## What changes
1. **No browsing strangers.** Contact suggestions are removed. Send Money and Request Money open with only people you already chat with.
2. **Search by username only.** Typing `@abebe` (or `abebe`) finds accounts whose username starts with it, minimum 3 characters, max 20 results. Searching by display name only matches people you already have a chat with.
3. **Exact username lookup** (open chat by @username, link sharing) keeps working.
4. Existing chats, groups, channels, eTok profiles and wallet history still show names/photos of people you're connected to — nothing else changes.

## Technical details
- Replace `search_users_public(search_term)`: return empty if trimmed term (without `@`) < 3 chars; match `username ILIKE term || '%'` for everyone, plus `name ILIKE '%'||term||'%'` only where a `chats` row links `auth.uid()` and the profile; exclude self; `LIMIT 20`; revoke from anon.
- `Contacts.tsx`: remove the suggestions query/section.
- `SendMoney.tsx`: drop the empty-term search; default list = recent chat partners (from `chats` + `profiles.in(ids)`).
- `src/lib/mcp/tools/search-users.ts`: route through the same RPC.
- `isUsernameUnique` / `searchByUsername` still work (prefix match includes exact).
- Not in scope: tightening the `profiles` table read rule (currently readable by any signed-in user via direct id lookups); can follow up if wanted.
- Verify: signed in, Contacts shows no strangers; search "a" → nothing; search an existing username prefix → found; Send Money opens with chat partners only.
