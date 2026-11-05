# Fix "removeChild" crash on the sign-in page

## Likely cause
The screenshots show Chrome's Translate turned on (translate icon in the address bar). When Chrome translates the page, it swaps the page's text for its own. When the sign-in screen then changes (switching tabs, showing errors, loading), the app tries to remove text Chrome has already replaced, and the whole page crashes with "Failed to execute 'removeChild'". The site currently has no protection against this.

## Fix
1. Add a small safety guard that runs before the app starts: if the browser tries to remove or insert something that a translator has already moved, it quietly skips instead of crashing. Translation keeps working.
2. Mark the brand name, code fields, PIN and amount fields as "do not translate" so translation cannot break them.
3. Check the sign-in page with translation-style text changes to confirm it no longer crashes, then ask you before publishing.

## Technical details
- `index.html`: inline script patching `Node.prototype.removeChild` / `insertBefore` to no-op (with console warning) when the node's parent differs — the standard React + Google Translate workaround (facebook/react#11538).
- Add `translate="no"` on logo/brand text and OTP/PIN inputs in Auth.
- Playwright: open /auth, mutate text nodes like Translate does, toggle sign-in/sign-up, confirm no error screen.
