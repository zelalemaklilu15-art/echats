export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function paymentLink(origin: string, recipient: string, amount?: number, note?: string, requestId?: string) {
  const url = new URL(requestId ? `/pay/request/${encodeURIComponent(requestId)}` : `/pay/${encodeURIComponent(recipient.replace(/^@/, ''))}`, origin);
  if (!requestId && amount !== undefined) url.searchParams.set('amount', String(amount));
  if (!requestId && note) url.searchParams.set('note', note);
  return url.toString();
}

export function parsePaymentPath(path: string, search: string) {
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'pay') throw new Error('Invalid payment link');
  const params = new URLSearchParams(search);
  const requestId = segments[1] === 'request' ? segments[2] : params.get('ref');
  if (requestId) {
    if (!UUID_PATTERN.test(requestId)) throw new Error('Invalid payment request');
    return { requestId };
  }
  const recipient = segments[1]?.replace(/^@/, '');
  if (!recipient || !/^[\w.-]{3,100}$/.test(recipient)) throw new Error('Invalid recipient');
  const rawAmount = segments[2] ?? params.get('amount');
  const amount = rawAmount ? Number(rawAmount) : undefined;
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0 || amount > 100000 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001)) throw new Error('Invalid payment amount');
  const note = params.get('note') ?? params.get('reason') ?? '';
  if (note.length > 500 || segments.length > 3) throw new Error('Invalid payment link');
  return { recipient, amount, note };
}