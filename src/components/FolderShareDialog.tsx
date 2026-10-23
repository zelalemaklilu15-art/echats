import { useEffect, useState } from 'react';
import { Copy, Link2, Loader2, Share2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createFolderInvite, folderInviteUrl, getFolderInvites, revokeFolderInvite, type ChatFolder, type FolderInvite } from '@/lib/chatFolderService';
import { shareContent } from '@/lib/native';

export default function FolderShareDialog({ folder, onClose }: { folder: ChatFolder | null; onClose: () => void }) {
  const [links, setLinks] = useState<FolderInvite[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true; setLinks([]); setLoading(true);
    if (folder) void getFolderInvites(folder.id).then(data => { if (current) setLinks(data); }).catch(() => { if (current) toast.error('Could not load links'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [folder?.id]);
  const create = async () => {
    if (!folder || busy) return;
    setBusy(true);
    try { await createFolderInvite(folder.id); setLinks(await getFolderInvites(folder.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create link'); }
    finally { setBusy(false); }
  };
  const revoke = async (token: string) => {
    if (busy) return; setBusy(true);
    try { await revokeFolderInvite(token); setLinks(prev => prev.filter(link => link.token !== token)); toast.success('Link revoked'); }
    catch { toast.error('Could not revoke link'); } finally { setBusy(false); }
  };
  const copy = async (token: string) => {
    try { await navigator.clipboard.writeText(folderInviteUrl(token)); toast.success('Link copied'); } catch { toast.error('Could not copy link'); }
  };
  return <Dialog open={!!folder} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-sm"><DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" />Share {folder?.name}</DialogTitle></DialogHeader>
      <div className="max-h-[55dvh] overflow-y-auto space-y-4">
        {loading ? <Loader2 aria-label="Loading links" className="h-5 w-5 animate-spin text-primary mx-auto" /> : links.filter(l => !l.revoked_at).map(link => <div key={link.token} className="space-y-2">
          <Input aria-label="Folder invite link" readOnly value={folderInviteUrl(link.token)} onFocus={e => e.currentTarget.select()} />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Copy link" title="Copy link" onClick={() => copy(link.token)}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" aria-label="Share link" title="Share link" onClick={async () => { if (!await shareContent({ title: folder?.name, url: folderInviteUrl(link.token) })) await copy(link.token); }}><Share2 className="h-4 w-4" /></Button>
            <Button variant="ghost" disabled={busy} className="ml-auto text-destructive" onClick={() => revoke(link.token)}><Unlink className="h-4 w-4 mr-2" />Revoke</Button>
          </div>
        </div>)}
      </div>
      <Button onClick={create} disabled={busy || loading}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}Create invite link</Button>
    </DialogContent>
  </Dialog>;
}