import { serveWalletOperation } from '../_shared/wallet-endpoint.ts';
export const HIGH_RISK_TRANSFER_ETB = 5000;
serveWalletOperation('wallet_transfer_atomic', body => ({
  p_recipient: body.recipient_id, p_amount: body.amount, p_note: body.note ?? '',
  p_key: body.idempotency_key, p_pin: body.pin, p_device: body.device_id ?? '',
  p_request: body.payment_request_id ?? null,
}));
