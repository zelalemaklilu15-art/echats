import { serveWalletOperation } from '../_shared/wallet-endpoint.ts';
serveWalletOperation('wallet_verify_own_pin', body => ({ p_pin: body.pin, p_device: body.device_id ?? '' }));
