import { serveWalletOperation } from '../_shared/wallet-endpoint.ts';
serveWalletOperation('wallet_activate_secure', (body, req) => ({
  p_device: body.device_id ?? body.device_hash ?? '',
  p_agent: typeof body.user_agent === 'string' ? body.user_agent.slice(0, 500) : '',
  p_ip: req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown',
}));
