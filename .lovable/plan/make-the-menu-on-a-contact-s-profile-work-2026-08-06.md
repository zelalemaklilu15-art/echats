# Make the ⋮ menu on a contact's profile work

## What's happening

On a contact's profile page the three-dot button in the top right is rendered but has no action attached, so tapping it does nothing.

## The fix

Turn it into a modern mobile-style action menu that slides up from the bottom (matching the app's mobile feel), with rounded rows, icons, and safe-area padding.

Menu actions, all reusing logic already on the page:

- Message — open the chat with this contact
- Voice call / Video call
- Mute / Unmute notifications (reflects current state)
- Send gift — opens the existing gift picker
- Share contact QR — opens the existing QR view
- Copy username / profile link, with a confirmation toast
- Search in this chat — jumps to the chat with search open
- Report user — reason picker plus optional details, same pattern used elsewhere in the app
- Block / Unblock — destructive style, keeps the existing confirmation dialog

Menu closes after each action; destructive items stay visually separated at the bottom.

## Technical notes

- File: `src/pages/ContactProfile.tsx`
- Add a `showMenu` state and wrap the header button in the shadcn `Sheet` (side="bottom") already used elsewhere in the project; give it `data-testid` hooks.
- Reuse existing handlers: `handleMessage`, `handleCall`, `handleToggleMute`, `handleBlockToggle`, `setShowGiftPicker`, QR state.
- Report flow: local dialog with reason radio group + textarea, writing to the existing reports service used by the Etok profile page.
- No database or backend changes needed.
