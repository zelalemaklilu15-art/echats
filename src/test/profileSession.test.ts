import { describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ callback: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { onAuthStateChange: (callback: typeof mock.callback) => { mock.callback = callback; } } } }));
import { PROFILE_ACCESS_EVENT } from '@/lib/profileAccess';
describe('profile session invalidation', () => {
  it('repeated sign-in for the current viewer preserves content while switching or signing out invalidates access', () => {
    const changed = vi.fn(); window.addEventListener(PROFILE_ACCESS_EVENT, changed);
    try {
      mock.callback?.('INITIAL_SESSION', { user: { id: 'viewer-a' } });
      expect(changed).toHaveBeenCalledTimes(1);
      mock.callback?.('SIGNED_IN', { user: { id: 'viewer-a' } });
      mock.callback?.('TOKEN_REFRESHED', { user: { id: 'viewer-a' } });
      expect(changed).toHaveBeenCalledTimes(1);
      mock.callback?.('SIGNED_IN', { user: { id: 'viewer-b' } });
      expect(changed).toHaveBeenCalledTimes(2);
      mock.callback?.('SIGNED_OUT', null); expect(changed).toHaveBeenCalledTimes(3);
    } finally { window.removeEventListener(PROFILE_ACCESS_EVENT, changed); }
  });
});