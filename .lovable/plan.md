# Two-Step Verification by Email (real, enforced)

## What changes for the user
- Privacy Settings -> "Two-Step Verification": turn on with one tap; we send a 6-digit code to your email to confirm. No authenticator app needed.
- Every new sign-in (new phone/browser) asks for a fresh 6-digit email code before the app opens. Code expires in 10 minutes, 5 wrong tries locks it, "Resend" after 60 s.
- Turning it off also requires an email code.
- Existing authenticator-app users keep working until they switch (no one gets locked out).

## Why the current version is not enough
- Today it uses an authenticator-app (QR) method, and the lock screen is only checked in the app itself. We will verify the current flow first, then replace it with email codes checked on the server.

## Steps
1. Verify current 2FA end-to-end on a test account and record what fails.
2. Server: store 2FA on/off per account and a per-sign-in "verified" record; codes stored only as hashes, with expiry, attempt limit and resend cooldown.
3. Server function to send and check codes; email sent from the app's email service (set up if not yet active).
4. Enforcement: the sign-in lock screen reads the server state; sensitive actions (wallet payments, PIN reset, changing 2FA, profile/email changes) are refused by the server if this sign-in is not verified.
5. Update Privacy Settings and the lock screen to the email flow in the Cosmic design.
6. Tests for: code required after sign-in, expiry, 5-try lock, resend cooldown, wrong-account code rejected, wallet blocked until verified. Then a full browser run with a real account.

## Technical details
- Session binding via the JWT `session_id` claim; table `login_second_factor(session_id, user_id, verified_at)`, `user_2fa_settings(user_id, enabled)`, `email_2fa_codes(user_id, session_id, code_hash, expires_at, attempts, sent_at)`; RLS owner-read only, writes only via SECURITY DEFINER RPCs / edge function.
- Helper `is_session_2fa_ok()` used inside wallet and settings RPCs; existing wallet PIN/email step-up rules unchanged.
- Edge function `email-2fa` (send / verify / enable / disable); transactional email template.
- Existing TOTP factors honored by `MfaChallengeScreen` until the user moves to email.
