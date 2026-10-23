import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Hash, Loader2, Users, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { acceptFolderInvite, previewFolderInvite, type FolderInvitePreview } from '@/lib/chatFolderService';
import { toast } from 'sonner';

export default function FolderInvite() {
  const { token } = useParams(); const { userId } = useAuth(); const location = useLocation(); const navigate = useNavigate();
  const [preview, setPreview] = useState<FolderInvitePreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true; setPreview(null); setError('');
    if (token && userId) void previewFolderInvite(token).then(data => { if (current) { setPreview(data); setSelected(data.items.map(i => `${i.kind}:${i.id}`)); } }).catch(() => { if (current) setError('This link is unavailable or has been revoked.'); });
    return () => { current = false; };
  }, [token, userId]);
  if (!userId) return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname)}`} replace />;
  const accept = async () => {
    if (!token || !preview || busy) return; setBusy(true); setError('');
    try { const id = await acceptFolderInvite(token, preview.items.filter(i => selected.includes(`${i.kind}:${i.id}`)).map(({ kind, id }) => ({ kind, id }))); toast.success('Folder added'); navigate('/chats', { replace: true, state: { folderId: id } }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not add folder'); } finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-background text-foreground">
    <header className="flex items-center gap-3 border-b border-border px-4 py-3"><Button variant="ghost" size="icon" aria-label="Back to chats" onClick={() => navigate('/chats')}><ArrowLeft className="h-5 w-5" /></Button><h1 className="text-lg font-semibold">Folder invitation</h1></header>
    <section className="max-w-lg mx-auto px-5 py-8">
      {error && <div role="alert" className="flex items-start gap-3 mb-5 text-destructive"><AlertCircle className="h-5 w-5 shrink-0" /><p>{error}</p></div>}
      {!preview && !error ? <Loader2 aria-label="Loading folder" className="h-6 w-6 text-primary animate-spin mx-auto" /> : preview && <>
        <FolderOpen className="h-12 w-12 text-primary mb-4" /><h2 className="text-2xl font-bold break-words">{preview.name}</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-6">{preview.items.length} conversations</p>
        <div className="divide-y divide-border mb-6">{preview.items.map(item => { const key = `${item.kind}:${item.id}`; return <label key={key} className="flex items-center gap-3 py-4 cursor-pointer">
          {item.kind === 'group' ? <Users className="h-5 w-5 text-primary shrink-0" /> : <Hash className="h-5 w-5 text-accent shrink-0" />}
          <span className="flex-1 min-w-0"><span className="block font-medium break-words">{item.name}</span><span className="text-xs text-muted-foreground">{item.joined ? 'Already joined' : item.kind === 'group' ? 'Group' : 'Channel'}</span></span>
          <Checkbox disabled={busy} aria-label={`Include ${item.name}`} checked={selected.includes(key)} onCheckedChange={checked => setSelected(prev => checked ? [...prev, key] : prev.filter(s => s !== key))} />
        </label>; })}</div>
        <Button className="w-full" disabled={!selected.length || busy} onClick={accept}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add folder & join ({selected.length})</Button>
      </>}
    </section>
  </main>;
}