// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const G = '00000000-0000-4000-8000-000000000010';
const CHAT = '00000000-0000-4000-8000-000000000020';
let db: PGlite;
async function call<T = any>(sql: string): Promise<T> { return (await db.query<{ result: T }>(`SELECT ${sql} AS result`)).rows[0].result; }
async function asUser(id: string) { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id}',false); SET ROLE authenticated;`); }
const selection = `'[{"kind":"group","id":"${G}"},{"kind":"channel","id":"private-channel"}]'::jsonb`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE chats(id uuid PRIMARY KEY,participant_1 uuid,participant_2 uuid);
    CREATE TABLE groups(id uuid PRIMARY KEY,name text,created_by uuid);
    CREATE TABLE group_members(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,group_id uuid,user_id uuid,role text,UNIQUE(group_id,user_id));
    CREATE TABLE channels(id text PRIMARY KEY,name text,is_public boolean,created_by uuid);
    CREATE TABLE channel_subscribers(channel_id text,user_id uuid,PRIMARY KEY(channel_id,user_id));
    CREATE FUNCTION is_group_member(uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2) $$;
    CREATE FUNCTION is_group_admin(uuid,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2 AND role='admin') $$;
    CREATE FUNCTION can_view_channel(text,uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM channels c WHERE c.id=$1 AND (c.is_public OR c.created_by=$2 OR EXISTS(SELECT 1 FROM channel_subscribers WHERE channel_id=c.id AND user_id=$2))) $$;
    GRANT SELECT ON groups TO authenticated; GRANT INSERT ON group_members TO authenticated;
    ALTER TABLE group_members ENABLE ROW LEVEL SECURITY; CREATE POLICY gm_insert ON group_members FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());`);
  await db.exec(readFileSync('drizzle/migrations/0026_shareable_chat_folders.sql', 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec(`RESET ROLE; DELETE FROM chat_folders; DELETE FROM group_members; DELETE FROM channel_subscribers; DELETE FROM groups; DELETE FROM channels; DELETE FROM chats;
    INSERT INTO groups VALUES('${G}','Test group','${A}'); INSERT INTO group_members(group_id,user_id,role) VALUES('${G}','${A}','admin');
    INSERT INTO channels VALUES('private-channel','Private channel',false,'${A}');
    INSERT INTO chats VALUES('${CHAT}','${A}','${B}');`);
  await asUser(A);
  await call(`save_chat_folder('folder-a','Shared folder','folder','primary','[{"kind":"chat","id":"${CHAT}"},{"kind":"group","id":"${G}"},{"kind":"channel","id":"private-channel"}]')`);
});
afterAll(async () => { await db.close(); });
describe('folder invite authorization', () => {
  it('excludes private direct chats in the database, including fabricated invite items', async () => {
    const token = await call(`create_chat_folder_invite('folder-a')`);
    await asUser(B);
    const preview = await call(`preview_chat_folder_invite('${token}')`);
    expect(preview.items.map((i: any) => i.kind).sort()).toEqual(['channel', 'group']);
    await expect(call(`accept_chat_folder_invite('${token}','[{"kind":"chat","id":"${CHAT}"}]')`)).rejects.toThrow('Conversation unavailable');
    await db.exec('RESET ROLE');
    await expect(db.exec(`INSERT INTO chat_folder_invite_items SELECT id,'chat','${CHAT}' FROM chat_folder_invites`)).rejects.toThrow();
  });
  it('accepts authorized groups/private channels as ordinary member, and replays only once', async () => {
    const token = await call(`create_chat_folder_invite('folder-a')`); await asUser(B);
    const id = await call(`accept_chat_folder_invite('${token}',${selection})`);
    expect(await call(`accept_chat_folder_invite('${token}',${selection})`)).toBe(id);
    expect((await call(`get_chat_folder_state()`)).map((f: any) => f.id)).toEqual([id]);
    await db.exec('RESET ROLE');
    expect((await db.query(`SELECT role FROM group_members WHERE user_id='${B}'`)).rows).toEqual([{ role: 'member' }]);
    expect((await db.query(`SELECT channel_id FROM channel_subscribers WHERE user_id='${B}'`)).rows).toEqual([{ channel_id: 'private-channel' }]);
  });
  it('does not allow a guessed group ID to self-join', async () => {
    await asUser(B);
    await expect(db.exec(`INSERT INTO group_members(group_id,user_id,role) VALUES('${G}','${B}','member')`)).rejects.toThrow();
  });
  it('cannot read or change another account folder', async () => {
    await asUser(B); expect(await call('get_chat_folder_state()')).toEqual([]);
    expect((await db.query('SELECT * FROM chat_folders')).rows).toEqual([]);
    await expect(call(`save_chat_folder('folder-a','Stolen','folder','primary','[]')`)).rejects.toThrow('Folder unavailable');
    await expect(call(`delete_chat_folder('folder-a')`)).rejects.toThrow('Folder unavailable');
  });
  it('revocation blocks preview and acceptance without removing existing memberships', async () => {
    const token = await call(`create_chat_folder_invite('folder-a')`); await asUser(B);
    await call(`accept_chat_folder_invite('${token}',${selection})`); await asUser(A); await call(`revoke_chat_folder_invite('${token}')`); await asUser(B);
    await expect(call(`preview_chat_folder_invite('${token}')`)).rejects.toThrow('revoked');
    await expect(call(`accept_chat_folder_invite('${token}',${selection})`)).rejects.toThrow('revoked');
    expect((await call('get_chat_folder_state()'))).toHaveLength(1);
  });
  it('rechecks owner/admin permission after a link is created', async () => {
    const token = await call(`create_chat_folder_invite('folder-a')`);
    await db.exec(`RESET ROLE; UPDATE groups SET created_by='${B}' WHERE id='${G}'; DELETE FROM group_members WHERE user_id='${A}';`);
    await asUser(B);
    await expect(call(`accept_chat_folder_invite('${token}',${selection})`)).rejects.toThrow('Conversation unavailable');
    expect(await call('get_chat_folder_state()')).toEqual([]);
  });
  it('non-owner subscribers cannot share private channels', async () => {
    await db.exec(`RESET ROLE; INSERT INTO channel_subscribers VALUES('private-channel','${B}');`); await asUser(B);
    await call(`save_chat_folder('folder-b','Private','folder','primary','[{"kind":"channel","id":"private-channel"}]')`);
    await expect(call(`create_chat_folder_invite('folder-b')`)).rejects.toThrow('No shareable');
  });
  it('invalid selection rolls back the whole acceptance and cannot escalate role', async () => {
    const token = await call(`create_chat_folder_invite('folder-a')`); await asUser(B);
    await expect(call(`accept_chat_folder_invite('${token}','[{"kind":"group","id":"${G}"},{"kind":"channel","id":"forged"}]')`)).rejects.toThrow();
    expect(await call('get_chat_folder_state()')).toEqual([]);
    await db.exec('RESET ROLE'); expect((await db.query(`SELECT * FROM group_members WHERE user_id='${B}'`)).rows).toEqual([]);
  });
});