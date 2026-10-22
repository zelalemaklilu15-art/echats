import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ on: vi.fn(), remove: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: () => { const ch = { on: mocks.on, subscribe: () => ch }; mocks.on.mockReturnValue(ch); return ch; },
  removeChannel: mocks.remove,
} }));
vi.mock('@/lib/profileAccess', () => ({ PROFILE_ACCESS_EVENT: 'profile-access', getAccessProfiles: vi.fn(), hiddenProfile: vi.fn() }));
import { callLogService } from '@/lib/callLogService';
afterEach(() => vi.clearAllMocks());
describe('call history refresh', () => {
  it('refreshes caller and receiver history for both new calls and changed outcomes', () => {
    const updated = vi.fn(); const unsubscribe = callLogService.subscribeToCallLogs('self', updated);
    expect(mocks.on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ event: '*', filter: 'receiver_id=eq.self' }), expect.any(Function));
    expect(mocks.on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ event: '*', filter: 'caller_id=eq.self' }), expect.any(Function));
    for (const [, , callback] of mocks.on.mock.calls) callback({ new: { id: 'call', status: 'completed', call_type: 'voice' } });
    expect(updated).toHaveBeenCalledTimes(2); unsubscribe();
  });
});