# Two-step email: send a real code, not a login link

## Problem
The two-step code is sent with the built-in "sign in" email. That email has a **Log In** button. Tapping it signs the person in without typing a code, so the extra security step can be skipped. The wallet's extra security check sends the same email, so it has the same problem.

## What changes for the user
- The email says "Your Echat verification code: 123456". It has **no link or button**, so the only way through is typing the code in the app.
- The code expires in 10 minutes and works once. After 5 wrong tries the code is locked for 10 minutes. "Resend" is available after 60 seconds.
- Tapping an old "Log In" email link will no longer get anyone past two-step: the new sign-in still asks for a code.

## Steps
1. Check whether the app's email sending is set up. If no sender domain is ready, show the email setup screen first, because a code-only email needs it.
2. The server creates its own 6-digit code. Only a scrambled (hashed) copy is saved, tied to the person and to this one sign-in. The server sends the code-only email.
3. Checking a code compares it against that saved copy and counts expiry, single use, wrong tries and resend wait. The built-in sign-in email is no longer used for two-step or for the wallet's extra security check.
4. Any sign-in made from a "Log In" email link (magic link) is treated as a new device: it must pass the code before the app or the wallet opens.
5. Tests for: the email has no link, a wrong-account code is rejected, an expired code is rejected, a used code can't be used again, the 5-try lock, the resend wait, and a magic-link sign-in still needing the code. Then a full run with a real account.

## Technical details
- New table `email_2fa_codes(user_id, session_id, purpose, code_hash sha256+salt, expires_at, consumed_at)` with service-role access only. The `email-2fa` function does send/verify using it. No more `signInWithOtp`/`verifyOtp`.
- Email goes out through Lovable transactional email using a new `two-step-code` template with no links. `walletSecurity` step-up moves to the same function with `purpose: "wallet"`.
- `session_2fa_verifications` is unchanged, so new sessions (including magic-link ones) start unverified and are still blocked by `is_session_2fa_ok()`.
