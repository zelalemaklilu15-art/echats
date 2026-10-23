# ከቴሌግራም የሚጨመሩ 3 ባህሪያት

## 1. Two-step ማረጋገጫ (በትክክል እንዲሠራ)
- አሁን ያለው፦ Privacy Settings ውስጥ 2FA ማብራት ይቻላል፤ ግን ሲገቡ ኮዱ አይጠየቅም፣ ስለዚህ ጥበቃ አይሰጥም።
- የሚጨመረው፦ 2FA ያበራ ሰው በአዲስ መሣሪያ ሲገባ (email/password ወይም Google) ከAuthenticator መተግበሪያ 6 አሃዝ ኮድ ይጠየቃል። ኮዱ ሳይገባ ቻት፣ Wallet ወይም ሌላ ገፅ አይከፈትም።
- 2FA ለማጥፋት ኮዱ ይጠየቃል።

## 2. በሰርጥ ልጥፎች ስር አስተያየት (Comments)
- እያንዳንዱ ልጥፍ ስር "💬 Comments (n)" ቁልፍ፤ ሲነኩ የአስተያየት ገፅ ይከፈታል።
- ሰርጡን ማየት የሚችል ሁሉ አስተያየት ይጽፋል፤ የራሱን ይሰርዛል፤ የሰርጡ ባለቤት ማንኛውንም ይሰርዛል እና በልጥፉ ላይ አስተያየት ማብራት/ማጥፋት ይችላል።
- አስተያየቶች በቀጥታ ይታያሉ፤ ለልጥፉ ባለቤትና ለተመለሰለት ሰው ማሳወቂያ ይላካል።
- የመገለጫ ግላዊነት ህጎች ይጠበቃሉ (ስም/ፎቶ የሚታየው በነባሩ ህግ መሰረት)።

## 3. የፎልደር አገናኝ ማጋራት
- አሁን ፎልደሮች በስልኩ ላይ ብቻ ይቀመጣሉ። ወደ አካውንቱ ይዛወራሉ፣ ስለዚህ በሁሉም መሣሪያ ይታያሉ (ነባር ፎልደሮች በራሳቸው ይዛወራሉ)።
- "Share folder" → አገናኝ። የሚጋሩት **ሰርጦችና ቡድኖች ብቻ** ናቸው (እንደ ቴሌግራም)፤ የግል ቻቶች በፍጹም አይጋሩም።
- አገናኙን የከፈተ ሰው ዝርዝሩን አይቶ "Add folder" ሲል የሕዝብ ሰርጦቹን ይቀላቀላል፤ ለግል ቡድኖች ፈቃድ ከሌለው አይገባም።
- ባለቤቱ አገናኙን መሰረዝ ይችላል።

## የማይነኩ
- Wallet፣ ጥሪዎች፣ eTok፣ Stories፣ ዲዛይን እና ነባር የግላዊነት ህጎች።

## ቅደም ተከተል
በአንድ ጊዜ አንድ ባህሪ፦ 1 → 2 → 3፤ እያንዳንዱ ተሞክሮ ካለቀ በኋላ ቀጣዩ።

## Technical details
- 2FA: after sign-in check `mfa.getAuthenticatorAssuranceLevel()`; if nextLevel=aal2 and current=aal1, route to a new MFA challenge screen; gate protected routes in App.tsx on aal. Sensitive RPCs (wallet) may additionally check `auth.jwt()->>'aal'` for enrolled users.
- Comments: table `channel_post_comments` (id, post_id, channel_id, author_id, text, created_at) + `channel_posts.comments_enabled`, `comments_count`; RLS via `can_view_channel`; delete by author or `is_channel_owner`; count trigger; push via `dispatch_push_event` trigger (server-side only); realtime subscription.
- Folders: tables `chat_folders`, `chat_folder_items`, `chat_folder_invites` (slug, revoked); one-time migration from localStorage; `join_folder_invite` SECURITY DEFINER RPC returning only channel/group items the joiner may access; private chats excluded at the database level.
- Tests: per-rule tests (2FA gate redirect, private chat never in shared folder, non-viewer cannot comment). Playwright on 384×658.
