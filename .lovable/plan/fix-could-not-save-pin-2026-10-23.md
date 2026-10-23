# Fix "Could not save PIN"

## Cause
Saving the PIN runs a step on the server that scrambles (hashes) the PIN. That step lives in a separate part of the database the save function can't see, so every save fails, and the app shows "Could not save PIN".

## Fix
- Update the PIN save function so it can find the hashing tool. Nothing else in it changes: the 4/6-digit check, the email-code check when changing an existing PIN, and the lockout reset all stay the same.
- Check the PIN verify function and the other wallet functions that check PINs (transfer, airtime, purchases) for the same problem, and fix any that have it.
- Add a small test confirming a PIN can be saved and then verified.
- Try it in the preview: create a PIN, then make a payment with it.

## Technical details
New migration: recreate `set_wallet_pin` (and any function using `crypt`/`gen_salt` with no `extensions` schema) with `SET search_path = public, extensions`. Function bodies stay the same.
