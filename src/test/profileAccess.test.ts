// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const C = '00000000-0000-4000-8000-000000000003';
const CHAT = '00000000-0000-4000-8000-000000000010';
let db: PGlite;

async function asUser(id: string, sql: string) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${id}',false);`);
  try { return await db.query(sql); }
  finally { await db.exec('RESET ROLE'); }
}

async function access(viewer = A, subject = B) {
  const result = await asUser(viewer, `SELECT public.can_read_profile('${subject}') AS allowed`);
  return (result.rows[0] as { allowed: boolean }).allowed;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,username text,name text,avatar_url text,bio text,is_online boolean DEFAULT true,last_seen timestamptz DEFAULT now(),is_active boolean DEFAULT true,phone text,birthday date,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    GRANT ALL ON public.profiles TO authenticated;
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY profiles_select_safe ON public.profiles FOR SELECT TO authenticated USING(true);
    CREATE TABLE public.chats(id uuid PRIMARY KEY,participant_1 uuid,participant_2 uuid);
    GRANT ALL ON public.chats TO authenticated;
    ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
    CREATE POLICY chats_parties ON public.chats TO authenticated USING(auth.uid() IN (participant_1,participant_2)) WITH CHECK(auth.uid() IN (participant_1,participant_2));
    CREATE TABLE public.messages(id uuid DEFAULT gen_random_uuid(),chat_id uuid,sender_id uuid,receiver_id uuid,content text,media_url text,file_name text,message_type text);
    GRANT ALL ON public.messages TO authenticated;
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK(auth.uid()=sender_id);
    CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated USING(auth.uid() IN(sender_id,receiver_id));
    CREATE TABLE public.call_logs(id uuid DEFAULT gen_random_uuid(),caller_id uuid,receiver_id uuid,room_id text,status text DEFAULT 'missed',ended_at timestamptz,created_at timestamptz DEFAULT now());
    GRANT ALL ON public.call_logs TO authenticated;
    ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY cl_insert ON public.call_logs FOR INSERT TO authenticated WITH CHECK(auth.uid()=caller_id);
    CREATE POLICY cl_select ON public.call_logs FOR SELECT TO authenticated USING(auth.uid() IN(caller_id,receiver_id));
    CREATE POLICY cl_update ON public.call_logs FOR UPDATE TO authenticated USING(auth.uid() IN(caller_id,receiver_id));
    CREATE TABLE public.channel_posts(id text,channel_id text,sender_id uuid,sender_name text,content text,type text,views integer,edited boolean,reactions jsonb,created_at timestamptz DEFAULT now());
    GRANT ALL ON public.channel_posts TO authenticated;
    CREATE FUNCTION public.can_view_channel(text,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='public-channel' $$;
    CREATE TABLE storage.objects(bucket_id text,name text);
    GRANT SELECT ON storage.objects TO authenticated;
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE TABLE public.etok_sounds(id uuid,title text,author_name text,cover_emoji text,duration integer,video_count integer,is_original boolean,audio_url text,created_at timestamptz DEFAULT now());
    GRANT SELECT ON public.etok_sounds TO anon,authenticated;
    CREATE TABLE public.etok_hashtags(name text PRIMARY KEY,view_count integer,trending boolean);
    CREATE UNIQUE INDEX sounds_identity_idx ON public.etok_sounds(lower(title),lower(author_name));
  `);
  await db.exec(readFileSync('drizzle/migrations/0006_strict_profile_access.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0007_profile_identity_safe_delivery.sql', 'utf8'));
}, 30000);

beforeEach(async () => {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false);
    DELETE FROM public.profile_contacts; DELETE FROM public.messages; DELETE FROM public.chats;
    DELETE FROM public.call_logs; DELETE FROM public.profiles; DELETE FROM storage.objects; DELETE FROM public.channel_posts;
    INSERT INTO public.profiles(id,username,name,avatar_url,bio,phone) VALUES
      ('${A}','alice','Alice','avatars/${A}/avatar.jpg','A bio','private'),
      ('${B}','bob','Bob','avatars/${B}/avatar.jpg','B bio','private'),
      ('${C}','cara','Cara','avatars/${C}/avatar.jpg','C bio','private');
    INSERT INTO public.chats VALUES('${CHAT}','${A}','${B}');
    INSERT INTO storage.objects VALUES('avatars','${B}/avatar.jpg');
  `);
});
afterAll(async () => { await db?.close(); });

describe('strict profile RLS (actual migration SQL)', () => {
  it('allows self but does not authorize a stranger by ID or an empty chat', async () => {
    expect(await access(A, A)).toBe(true);
    expect(await access()).toBe(false);
    const raw = await asUser(A, `SELECT name,avatar_url FROM public.profiles WHERE id='${B}'`);
    expect(raw.rows).toEqual([]);
    const stub = await asUser(A, `SELECT * FROM public.get_public_profile('${B}')`);
    expect(stub.rows[0]).toMatchObject({ name: 'Hidden profile', avatar_url: null, bio: null, username: null });
  });

  it('keeps one-sided messages hidden and reveals reciprocal chats', async () => {
    await asUser(A, `INSERT INTO public.messages(chat_id,sender_id,receiver_id,content) VALUES('${CHAT}','${A}','${B}','Hello')`);
    expect(await access()).toBe(false);
    await asUser(B, `INSERT INTO public.messages(chat_id,sender_id,receiver_id,content) VALUES('${CHAT}','${B}','${A}','Hi')`);
    expect(await access()).toBe(true);
    const visible = await asUser(A, `SELECT name,avatar_url FROM public.profiles WHERE id='${B}'`);
    expect(visible.rows[0]).toMatchObject({ name: 'Bob', avatar_url: `avatars/${B}/avatar.jpg` });
  });

  it('saving someone never unlocks their identity; only subject-owned contacts grant access', async () => {
    await asUser(A, `INSERT INTO public.profile_contacts(owner_id,contact_user_id) VALUES('${A}','${B}')`);
    expect(await access(A, B)).toBe(false);
    expect(await access(B, A)).toBe(true);
    await asUser(B, `INSERT INTO public.profile_contacts(owner_id,contact_user_id) VALUES('${B}','${A}')`);
    expect(await access(A, B)).toBe(true);
    await asUser(B, `DELETE FROM public.profile_contacts WHERE owner_id='${B}'`);
    expect(await access(A, B)).toBe(false);
  });

  it('rejects forged subject-owned contacts and mismatched message participants', async () => {
    await expect(asUser(A, `INSERT INTO public.profile_contacts(owner_id,contact_user_id) VALUES('${B}','${A}')`)).rejects.toThrow();
    await expect(asUser(A, `INSERT INTO public.messages(chat_id,sender_id,receiver_id) VALUES('${CHAT}','${A}','${C}')`)).rejects.toThrow();
  });

  it('pending and completed-by-caller calls stay hidden until receiver acceptance', async () => {
    await asUser(A, `INSERT INTO public.call_logs(caller_id,receiver_id,room_id) VALUES('${A}','${B}','fresh')`);
    expect(await access()).toBe(false);
    await asUser(A, `UPDATE public.call_logs SET status='completed' WHERE room_id='fresh'`);
    expect(await access()).toBe(false);
    const caller = await asUser(A, `SELECT public.accept_profile_call('fresh') AS accepted`);
    expect(caller.rows[0]).toEqual({ accepted: false });
    await expect(asUser(A, `UPDATE public.call_logs SET receiver_accepted=true WHERE room_id='fresh'`)).rejects.toThrow();
    const receiver = await asUser(B, `SELECT public.accept_profile_call('fresh') AS accepted`);
    expect(receiver.rows[0]).toEqual({ accepted: true });
    expect(await access()).toBe(true);
  });

  it('cannot forge acceptance on insert or change chat/call participants', async () => {
    await expect(asUser(A, `INSERT INTO public.call_logs(caller_id,receiver_id,receiver_accepted) VALUES('${A}','${B}',true)`)).rejects.toThrow();
    await expect(asUser(A, `UPDATE public.chats SET participant_2='${C}' WHERE id='${CHAT}'`)).rejects.toThrow();
    await asUser(A, `INSERT INTO public.call_logs(caller_id,receiver_id,room_id) VALUES('${A}','${B}','fresh')`);
    await expect(asUser(A, `UPDATE public.call_logs SET receiver_id='${C}' WHERE room_id='fresh'`)).rejects.toThrow();
  });

  it('rejects stale or ended calls as acceptance sources', async () => {
    await db.exec(`INSERT INTO public.call_logs(caller_id,receiver_id,room_id,created_at) VALUES('${A}','${B}','stale',now()-interval '3 minutes');
      INSERT INTO public.call_logs(caller_id,receiver_id,room_id,ended_at) VALUES('${A}','${B}','ended',now());`);
    for (const room of ['stale', 'ended']) {
      const result = await asUser(B, `SELECT public.accept_profile_call('${room}') AS accepted`);
      expect(result.rows[0]).toEqual({ accepted: false });
    }
    expect(await access()).toBe(false);
  });

  it('username search returns handles without stranger name/photo and ignores short searches', async () => {
    const short = await asUser(A, `SELECT * FROM public.search_users_public('bo')`);
    expect(short.rows).toEqual([]);
    const found = await asUser(A, `SELECT * FROM public.search_users_public('@bob')`);
    expect(found.rows[0]).toMatchObject({ username: 'bob', name: 'Hidden profile', avatar_url: null });
  });

  it('batch profile reads and public channel posts do not bypass identity authorization', async () => {
    const batch = await asUser(A, `SELECT public.get_profiles_safe(ARRAY['${B}'::uuid]) AS profiles`);
    expect((batch.rows[0] as { profiles: unknown[] }).profiles[0]).toMatchObject({ profile_hidden: true, avatar_url: null });
    await db.exec(`INSERT INTO public.channel_posts(id,channel_id,sender_id,sender_name,content) VALUES('post','public-channel','${B}','Bob snapshot','post content')`);
    const posts = await asUser(A, `SELECT * FROM public.get_channel_posts_safe('public-channel')`);
    expect(posts.rows[0]).toMatchObject({ sender_name: 'Hidden profile', content: 'post content' });
    await expect(asUser(A, 'SELECT sender_name FROM public.channel_posts')).rejects.toThrow();
    await expect(asUser(A, 'SELECT author_name FROM public.etok_sounds')).rejects.toThrow();
  });

  it('private avatar object reads follow the same relationship access', async () => {
    expect((await asUser(A, `SELECT name FROM storage.objects WHERE bucket_id='avatars'`)).rows).toEqual([]);
    await asUser(B, `INSERT INTO public.profile_contacts(owner_id,contact_user_id) VALUES('${B}','${A}')`);
    expect((await asUser(A, `SELECT name FROM storage.objects WHERE bucket_id='avatars'`)).rows).toEqual([{ name: `${B}/avatar.jpg` }]);
    await expect(asUser(A, 'SELECT phone FROM public.profiles')).rejects.toThrow();
  });
});