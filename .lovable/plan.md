# Make channels and payment requests real, with notifications

## Why they had no notifications
Channels (posts, subscribers) and payment requests are saved only on the phone that created them. Nobody else ever sees them, so the server has nothing to notify about. Notifications alone can't fix that; the data has to be saved on the server first.

## What will change
1. **Channels saved on the server**
   - Creating a channel, subscribing/unsubscribing, posting, editing, deleting, reactions and view counts are saved on the server, so subscribers on other phones see them.
   - Only the channel owner can post, edit or delete. Public channels can be found by everyone; private ones only via their link.
   - When the owner posts, every subscriber gets a notification ("Channel name: post preview"), and tapping it opens the channel.
2. **Payment requests saved on the server**
   - A request is sent to the other person: they see it, can pay it (through the normal PIN-protected send money flow) or decline it.
   - Notifications: the person gets one when a request arrives, and the requester gets one when it is paid or declined.
   - The requester can cancel a pending request.
3. Channels and requests already saved on a phone are uploaded once the first time that phone opens the new version, so nothing is lost.
4. The look stays the same; money rules (PIN, limits, balances) don't change.

## Verification
- Two test accounts: create a channel, subscribe from the other, post, and confirm the post and the notification arrive.
- Send a payment request, then pay it and decline another, checking each side gets its notification.
- Confirm a non-owner can't post and nobody can see someone else's payment requests.

## Technical details
- New tables: `channels`, `channel_subscribers`, `channel_posts` (with reactions jsonb, views), `payment_requests` (requester_id, payer_id, amount, note, status pending/paid/declined/cancelled, paid_transaction_id). GRANTs + RLS: owner-only writes, subscribers/public read; payment requests visible to the two parties only; status changes through SECURITY DEFINER RPCs (`respond_payment_request`, `cancel_payment_request`), and "paid" set only when it's linked to a real completed transfer.
- `channelService.ts` and RequestMoney/PaymentRequest move from localStorage to these tables, keeping the same function signatures; one-time migration of local data.
- Add `dispatch_push_event` triggers on `channel_posts` INSERT and `payment_requests` INSERT/UPDATE; extend `push-dispatch` with both cases.
