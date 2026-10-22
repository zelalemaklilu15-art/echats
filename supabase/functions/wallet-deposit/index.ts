import { serveWalletOperation } from '../_shared/wallet-endpoint.ts';
serveWalletOperation('wallet_deposit_request', body => ({
  p_amount: body.amount, p_method: body.method, p_key: body.idempotency_key,
  p_device: body.device_id ?? '',
}));
