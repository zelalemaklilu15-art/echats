# Fix "User not found" on a contact's profile

## What's happening

Opening another user's profile from a chat always shows "User not found", even though the user exists.

Confirmed cause: the contact profile page asks the database for *all* profile columns, including private ones (phone, birthday). For privacy those two columns are readable only by their owner, so the whole request is rejected and the page treats the rejection as "this user doesn't exist".

A second, smaller bug on the same page: the shared media/files lookup uses old column names for the chat table, so the Media/Files tabs are always empty on that page.

## The fix

1. Load the contact's public profile through the existing secure backend function that returns only public fields (id, username, name, avatar, bio, online state, last seen). This is the same path other screens already use successfully.
2. Distinguish real states in the UI:
   - loading spinner while fetching
   - "User not found" only when the backend truly returns no profile
   - a clear error message with a Retry button when the request fails (network/permission), instead of silently claiming the user doesn't exist
3. Stop requesting private fields (phone, birthday) for other users; birthday-related UI on this page only shows when the data is actually available.
4. Fix the chat lookup to use the correct participant columns so shared media and files load.

## Technical notes

- File: `src/pages/ContactProfile.tsx`
- Replace `supabase.from("profiles").select("*").eq("id", userId).single()` with `supabase.rpc("get_public_profile", { profile_id: userId })` and read the first row.
- Add `error` state alongside `loading`/`profile`; render three distinct branches.
- Chat lookup filter becomes `and(participant_1.eq.<me>,participant_2.eq.<them>),and(participant_1.eq.<them>,participant_2.eq.<me>)`.
- No database or policy changes needed.
