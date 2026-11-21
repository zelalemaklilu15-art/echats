// Human-paced support replies: a random delay between 8 and 22 minutes.
export const MIN_REPLY_DELAY_S = 8 * 60
export const MAX_REPLY_DELAY_S = 22 * 60
export function randomReplyDelaySeconds(rand: () => number = Math.random): number {
  return MIN_REPLY_DELAY_S + Math.floor(rand() * (MAX_REPLY_DELAY_S - MIN_REPLY_DELAY_S + 1))
}
// Wake the worker; it re-invokes itself until the job is due.
export async function kickReplyWorker(jobId: string, hops = 15) {
  const secret = Deno.env.get('INBOUND_EMAIL_SECRET') ?? ''
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/support-reply-worker`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-inbound-secret': secret },
      body: JSON.stringify({ job_id: jobId, hops }),
    })
  } catch (e) { console.error('kick reply worker failed', e) }
}
