# Code-only email 2FA (waiting on DNS)

Current status: notify.echat.online is "Verifying DNS". Usually a few minutes to a few hours once all 4 records (2 NS + 2 TXT) are added; at most 72 hours.

## When DNS is verified
1. Server creates its own 6-digit code (hashed, 10 min expiry, single use, 5 tries, 60s resend wait).
2. Email contains only the code — no "Log In" link.
3. Same flow used for sign-in 2FA and wallet security checks.
4. Test with a real account: link-free email arrives, wrong code is rejected, right code passes.
