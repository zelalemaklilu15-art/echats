import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('@/lib/profileAccess', () => ({ PROFILE_ACCESS_EVENT: 'echat:profile-access' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: () => ({ download: mock.download }) } } }));
import { persistentMediaReference, resolveFeatureMedia } from '@/lib/featureMedia';
describe('authenticated content media lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T11:00:00Z'));
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue('blob:authorized'), revokeObjectURL: vi.fn() }));
    window.dispatchEvent(new Event('echat:profile-access'));
    mock.download.mockReset(); mock.download.mockResolvedValue({ data: new Blob(['media']), error: null });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('revalidates a cached media download after the cache deadline and fails closed when access was revoked', async () => {
    expect(await resolveFeatureMedia('etok-videos/owner/video.webm', 'etok-videos')).toBe('blob:authorized');
    mock.download.mockResolvedValue({ data: null, error: new Error('Denied') });
    vi.advanceTimersByTime(30001);
    expect(await resolveFeatureMedia('etok-videos/owner/video.webm', 'etok-videos')).toBeNull();
    expect(mock.download).toHaveBeenCalledTimes(2); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:authorized');
  });
  it('revokes Story media at its expiration without waiting for an account event', async () => {
    const deadline = Date.now() + 1000;
    expect(await resolveFeatureMedia('chat-media/stories/owner/photo.jpg', 'chat-media', deadline)).toBe('blob:authorized');
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:authorized');
  });
  it('does not release media from an in-flight download after the account changes', async () => {
    let finish: ((v: { data: Blob; error: null }) => void) | undefined;
    mock.download.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = resolveFeatureMedia('etok-videos/owner/video.webm', 'etok-videos');
    window.dispatchEvent(new Event('echat:profile-access')); finish?.({ data: new Blob(['old media']), error: null });
    expect(await pending).toBeNull(); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('does not release Story media when expiry occurs during download', async () => {
    let finish: ((v: { data: Blob; error: null }) => void) | undefined;
    mock.download.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = resolveFeatureMedia('chat-media/stories/owner/photo.jpg', 'chat-media', Date.now() + 1000);
    vi.advanceTimersByTime(1001); finish?.({ data: new Blob(['expired']), error: null });
    expect(await pending).toBeNull(); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('refuses already-expired Story media without a storage request', async () => {
    expect(await resolveFeatureMedia('chat-media/stories/owner/photo.jpg', 'chat-media', Date.now() - 1)).toBeNull();
    expect(mock.download).not.toHaveBeenCalled();
  });
  it('persists canonical chat attachments without bearer tokens or temporary blob URLs', () => {
    const source = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/sign/chat-media/owner/photo%20one.jpg?token=temporary-test-token`;
    expect(persistentMediaReference(source, 'chat-media')).toBe('chat-media/owner/photo one.jpg');
    expect(persistentMediaReference('blob:authorized', 'chat-media')).toBeNull();
  });
});