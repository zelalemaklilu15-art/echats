# Allow deleting users who used the wallet

## Why it fails
When a user is deleted, their wallet is deleted automatically. That wallet's transaction history (money sent/received) is protected, so the database refuses and the whole user deletion fails with "still linked to data".

## Fix
- Keep every financial transaction record, so money history is never lost and the other side of each transfer still sees it.
- When a user's wallet is removed, its transaction records stay but are no longer tied to the removed wallet.
- Block deleting a user whose wallet still has money in it, with a clear message, so no balance disappears silently.

## Technical details
- Migration: change `wallet_transactions` FK to `wallets` to `ON DELETE SET NULL` (make `wallet_id` nullable if needed).
- Add a `BEFORE DELETE` trigger on `wallets` raising an error when `balance > 0`.
- Add a PGlite test: deleting a user with a zero-balance wallet and transactions succeeds and transactions remain; with a positive balance it is refused.
- Retry deleting the user after the migration.
