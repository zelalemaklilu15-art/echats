// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
const A='00000000-0000-4000-8000-000000000001';
const B='00000000-0000-4000-8000-000000000002';
const C='00000000-0000-4000-8000-000000000003';
const V='00000000-0000-4000-8000-000000000010';
const W='00000000-0000-4000-8000-000000000011';
const S='00000000-0000-4000-8000-000000000020';
const L='00000000-0000-4000-8000-000000000030';
let db:PGlite;
async function asUser(id:string, sql:string) {
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${id}',false);`);
  try { return await db.query(sql); } finally { await db.exec('RESET ROLE'); }
}
async function visible(id:string, table:string, key:string) { return (await asUser(id,`SELECT id FROM public.${table} WHERE id='${key}'`)).rows.length; }
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(readFileSync('src/test/stage6-fixture.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0013_stage6_content_authorization.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0014_stage6_media_and_live_guards.sql','utf8'));
 await db.exec(readFileSync('drizzle/migrations/0015_stage6_legacy_policy_cleanup.sql','utf8'));
},30000);
beforeEach(async()=>{
 await db.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);
 DELETE FROM public.etok_videos;DELETE FROM public.etok_follows;DELETE FROM public.etok_blocked_users;DELETE FROM public.etok_privacy_settings;
 DELETE FROM public.user_stories;DELETE FROM public.story_close_friends;DELETE FROM public.profile_contacts;DELETE FROM storage.objects;
 DELETE FROM public.etok_live_streams;DELETE FROM public.channels;
 INSERT INTO public.etok_videos(id,author_id,video_url,description,hashtags) VALUES('${V}','${A}','etok-videos/${A}/v.mp4','test',ARRAY['coffee']),('${W}','${A}','etok-videos/${A}/w.mp4','other',ARRAY['other']);
 INSERT INTO public.user_stories(id,user_id,content) VALUES('${S}','${A}','{"text":"hello","privacy":"contacts"}');
 INSERT INTO public.etok_live_streams(id,host_id,title) VALUES('${L}','${A}','test');
 INSERT INTO public.channels(id,name,created_by,is_public) VALUES('private','Private','${A}',false),('public','Public','${A}',true);
 INSERT INTO public.channel_posts(id,channel_id,sender_id,content) VALUES('p','public','${A}','post');
 INSERT INTO storage.objects VALUES('etok-videos','${A}/v.mp4'),('chat-media','stories/${A}/s.jpg');`);
});
afterAll(async()=>{await db?.close();});
describe('Stage 6 actual database rules',()=>{
 it('only-me video blocks metadata and managed media',async()=>{
  await db.exec(`UPDATE public.etok_videos SET privacy='only_me' WHERE id='${V}'`);
  expect(await visible(B,'etok_videos',V)).toBe(0);expect(await visible(A,'etok_videos',V)).toBe(1);
  expect((await asUser(B,`SELECT * FROM storage.objects WHERE name='${A}/v.mp4'`)).rows).toHaveLength(0);
 });
 it('friends video needs reciprocal follows',async()=>{
  await db.exec(`UPDATE public.etok_videos SET privacy='friends' WHERE id='${V}';INSERT INTO public.etok_follows VALUES('${B}','${A}',now())`);
  expect(await visible(B,'etok_videos',V)).toBe(0);
  await db.exec(`INSERT INTO public.etok_follows VALUES('${A}','${B}',now())`);expect(await visible(B,'etok_videos',V)).toBe(1);
 });
 it('private account cannot be unlocked by self-following',async()=>{
  await db.exec(`INSERT INTO public.etok_privacy_settings(user_id,private_account) VALUES('${A}',true);INSERT INTO public.etok_follows VALUES('${B}','${A}',now())`);
  expect(await visible(B,'etok_videos',V)).toBe(0);
  await db.exec(`INSERT INTO public.etok_follows VALUES('${A}','${B}',now())`);expect(await visible(B,'etok_videos',V)).toBe(1);
 });
 it('blocking overrides public visibility',async()=>{await db.exec(`INSERT INTO public.etok_blocked_users(blocker_id,blocked_id) VALUES('${B}','${A}')`);expect(await visible(B,'etok_videos',V)).toBe(0);});
 it('like RPC is idempotent and updates ledger counts exactly',async()=>{
  await asUser(B,`SELECT public.set_etok_like('${V}',true)`);await asUser(B,`SELECT public.set_etok_like('${V}',true)`);
  expect((await db.query(`SELECT likes FROM public.etok_videos WHERE id='${V}'`)).rows[0]).toEqual({likes:1});
  await asUser(B,`SELECT public.set_etok_like('${V}',false)`);expect((await db.query(`SELECT likes FROM public.etok_videos WHERE id='${V}'`)).rows[0]).toEqual({likes:0});
 });
 it('clients cannot overwrite video financial-like counters',async()=>{await expect(asUser(A,`UPDATE public.etok_videos SET likes=500 WHERE id='${V}'`)).rejects.toThrow();});
 it('comments persist roots and replies and count cascade deletion',async()=>{
  const root=(await asUser(B,`INSERT INTO public.etok_comments(video_id,author_id,text) VALUES('${V}','${B}','root') RETURNING id`)).rows[0] as {id:string};
  await asUser(C,`INSERT INTO public.etok_comments(video_id,author_id,text,parent_id) VALUES('${V}','${C}','reply','${root.id}')`);
  expect((await db.query(`SELECT comments FROM public.etok_videos WHERE id='${V}'`)).rows[0]).toEqual({comments:2});
  await asUser(B,`DELETE FROM public.etok_comments WHERE id='${root.id}'`);expect((await db.query(`SELECT comments FROM public.etok_videos WHERE id='${V}'`)).rows[0]).toEqual({comments:0});
 });
 it('comment permissions fail closed',async()=>{await db.exec(`UPDATE public.etok_videos SET allow_comments=false WHERE id='${V}'`);await expect(asUser(B,`INSERT INTO public.etok_comments(video_id,author_id,text) VALUES('${V}','${B}','blocked')`)).rejects.toThrow();});
 it('reply cannot target another video',async()=>{
  const root=(await asUser(A,`INSERT INTO public.etok_comments(video_id,author_id,text) VALUES('${W}','${A}','root') RETURNING id`)).rows[0] as {id:string};
  await expect(asUser(B,`INSERT INTO public.etok_comments(video_id,author_id,text,parent_id) VALUES('${V}','${B}','bad','${root.id}')`)).rejects.toThrow();
 });
 it('daily views cannot be inflated by remounts',async()=>{await asUser(B,`SELECT public.record_etok_video_view('${V}','fyp')`);await asUser(B,`SELECT public.record_etok_video_view('${V}','fyp')`);expect((await db.query(`SELECT views FROM public.etok_videos WHERE id='${V}'`)).rows[0]).toEqual({views:1});});
 it('hashtag search treats punctuation as data',async()=>{expect((await asUser(B,`SELECT id FROM public.search_etok_videos('#coffee')`)).rows).toEqual([{id:V}]);expect((await asUser(B,`SELECT id FROM public.search_etok_videos('),privacy.eq.only_me')`)).rows).toEqual([]);});
 it('contacts story requires subject-owned contact authorization',async()=>{
  expect(await visible(B,'user_stories',S)).toBe(0);
  await db.exec(`INSERT INTO public.profile_contacts VALUES('${B}','${A}')`);expect(await visible(B,'user_stories',S)).toBe(0);
  await db.exec(`INSERT INTO public.profile_contacts VALUES('${A}','${B}')`);expect(await visible(B,'user_stories',S)).toBe(1);
 });
 it('close-friends story requires the owner list',async()=>{
  await db.exec(`UPDATE public.user_stories SET privacy='close_friends' WHERE id='${S}'`);expect(await visible(B,'user_stories',S)).toBe(0);
  await asUser(A,`INSERT INTO public.story_close_friends(owner_id,contact_user_id) VALUES('${A}','${B}')`);expect(await visible(B,'user_stories',S)).toBe(1);
 });
 it('expired stories are archived only for owner',async()=>{await db.exec(`UPDATE public.user_stories SET privacy='everyone',expires_at=now()-interval '1 second' WHERE id='${S}'`);expect(await visible(B,'user_stories',S)).toBe(0);expect(await visible(A,'user_stories',S)).toBe(1);});
 it('story media obeys the same audience as its row',async()=>{await db.exec(`UPDATE public.user_stories SET media_path='stories/${A}/s.jpg' WHERE id='${S}'`);expect((await asUser(B,`SELECT * FROM storage.objects WHERE bucket_id='chat-media'`)).rows).toHaveLength(0);await db.exec(`INSERT INTO public.profile_contacts VALUES('${A}','${B}')`);expect((await asUser(B,`SELECT * FROM storage.objects WHERE bucket_id='chat-media'`)).rows).toHaveLength(1);});
 it('a stranger cannot read a story viewer list through legacy policies',async()=>{
  await db.exec(`INSERT INTO public.profile_contacts VALUES('${A}','${B}')`);
  await asUser(B,`INSERT INTO public.story_views(story_id,viewer_id) VALUES('${S}','${B}')`);
  expect((await asUser(C,`SELECT viewer_id FROM public.story_views`)).rows).toHaveLength(0);
  expect((await asUser(A,`SELECT viewer_id FROM public.story_views`)).rows).toEqual([{viewer_id:B}]);
 });
 it('story media cannot be assigned across accounts',async()=>{await expect(asUser(B,`INSERT INTO public.user_stories(user_id,media_url) VALUES('${B}','chat-media/stories/${A}/s.jpg')`)).rejects.toThrow();});
 it('story view receipt is unique and count is server-owned',async()=>{await db.exec(`INSERT INTO public.profile_contacts VALUES('${A}','${B}')`);await asUser(B,`INSERT INTO public.story_views(story_id,viewer_id) VALUES('${S}','${B}') ON CONFLICT DO NOTHING`);await asUser(B,`INSERT INTO public.story_views(story_id,viewer_id) VALUES('${S}','${B}') ON CONFLICT DO NOTHING`);expect((await db.query(`SELECT views_count FROM public.user_stories WHERE id='${S}'`)).rows[0]).toEqual({views_count:1});});
 it('known private channel ID cannot self-authorize subscription',async()=>{await expect(asUser(B,`INSERT INTO public.channel_subscribers VALUES('private','${B}',now())`)).rejects.toThrow();expect((await asUser(B,`SELECT * FROM public.get_channel_posts_page('private')`)).rows).toEqual([]);});
 it('channel post attribution cannot be forged through UPDATE',async()=>{await expect(asUser(A,`UPDATE public.channel_posts SET sender_id='${B}' WHERE id='p'`)).rejects.toThrow();await asUser(A,`UPDATE public.channel_posts SET content='edited',edited=true WHERE id='p'`);});
 it('channel pagination returns newest posts rather than oldest 500',async()=>{await db.exec(`INSERT INTO public.channel_posts(id,channel_id,sender_id,content,created_at) SELECT 'p'||n,'public','${A}',n::text,now()+n*interval '1 second' FROM generate_series(1,510)n`);const rows=(await asUser(B,`SELECT * FROM public.get_channel_posts_page('public')`)).rows as {id:string;created_at:string}[];expect(rows).toHaveLength(100);expect(rows[0].id).toBe('p510');expect(rows[99].id).toBe('p411');});
 it('live counters cannot be spoofed on insert',async()=>{const rows=(await asUser(A,`INSERT INTO public.etok_live_streams(host_id,title,viewer_count,gift_total) VALUES('${A}','new',999,999) RETURNING viewer_count,gift_total`)).rows;expect(rows).toEqual([{viewer_count:0,gift_total:0}]);});
 it('live signaling requires joined member and host direction',async()=>{await expect(asUser(B,`INSERT INTO public.etok_webrtc_signals(stream_id,from_user_id,to_user_id,signal_type,payload) VALUES('${L}','${B}','${A}','request','{}')`)).rejects.toThrow();await asUser(B,`INSERT INTO public.etok_live_viewers(stream_id,user_id) VALUES('${L}','${B}')`);await asUser(B,`INSERT INTO public.etok_webrtc_signals(stream_id,from_user_id,to_user_id,signal_type,payload) VALUES('${L}','${B}','${A}','request','{}')`);await expect(asUser(B,`INSERT INTO public.etok_webrtc_signals(stream_id,from_user_id,to_user_id,signal_type,payload) VALUES('${L}','${B}','${C}','offer','{}')`)).rejects.toThrow();});
 it('expired live session rejects new viewers',async()=>{await db.exec(`UPDATE public.etok_live_streams SET last_heartbeat=now()-interval '3 minutes' WHERE id='${L}'`);await expect(asUser(B,`INSERT INTO public.etok_live_viewers(stream_id,user_id) VALUES('${L}','${B}')`)).rejects.toThrow();});
 it('poll accepts one valid choice per authorized viewer',async()=>{await db.exec(`UPDATE public.user_stories SET privacy='everyone',content='{"stickers":[{"id":"poll","type":"poll","options":["yes","no"]}]}' WHERE id='${S}'`);await expect(asUser(B,`INSERT INTO public.story_poll_votes VALUES('${S}','poll','${B}','invalid',now())`)).rejects.toThrow();await asUser(B,`INSERT INTO public.story_poll_votes VALUES('${S}','poll','${B}','yes',now())`);await expect(asUser(B,`INSERT INTO public.story_poll_votes VALUES('${S}','poll','${B}','no',now())`)).rejects.toThrow();});
});
