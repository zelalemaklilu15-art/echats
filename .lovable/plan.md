# Remove the All / Unread / Groups buttons from the Chats screen

## What changes
- The row of All, Unread and Groups buttons below the search bar on the Chats screen is removed.
- The chat list always shows all chats, so nothing is hidden.
- The unread message count at the top of the screen stays.
- The folder row (All plus your own folders) stays. Tell me if you want that removed too.

## Technical details
- `src/pages/Chats.tsx`: delete the "Filter Chips" block (around lines 765-791). `activeFilter` stays fixed at `"all"`, so the filtering logic still works and no other code needs to change.
