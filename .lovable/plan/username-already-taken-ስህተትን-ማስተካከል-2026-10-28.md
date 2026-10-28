# "Username already taken" ስህተትን ማስተካከል

## ምክንያቱ (ተረጋግጧል)
አዲስ ሰው ሲመዘገብ ገና አልገባም (signed-out)። የስም መፈተሻው የተጠቃሚዎችን መረጃ ለማንበብ ይሞክራል፣ ግን የግላዊነት ጥበቃው ለማያውቀው ሰው ይከለክላል ("permission denied")። ኮዱ ማንኛውንም ስህተት "ስሙ ተይዟል" ብሎ ስለሚቆጥረው፣ ማንኛውም ስም "already taken" ይላል።

## መፍትሄ
1. አዲስ ትንሽ የሰርቨር ተግባር `is_username_available(name)` — እውነት/ሐሰት ብቻ ይመልሳል (ስም፣ ፎቶ ወይም ID አይገልጥም)። ለማይገቡ ጎብኚዎችም ይፈቀዳል። የፊደል ህጎችን (3–30፣ a-z 0-9 _) ይፈትሻል።
2. የመመዝገቢያ ገፅ እና "Add account" ገፅ ይህን ተግባር ይጠቀማሉ።
3. ስህተት ሲፈጠር "taken" ሳይሆን "ስሙን መፈተሽ አልተቻለም፣ እንደገና ይሞክሩ" ይላል።
4. ሁለት ሰዎች አንድ ስም በአንድ ጊዜ ቢወስዱ — በዳታቤዝ ውስጥ unique ደንብ መኖሩን አረጋግጣለሁ፣ ከሌለም እጨምራለሁ (ያሉ ተደጋጋሚ ስሞችን ካሉ መጀመሪያ እፈትሻለሁ)።

## Technical
- Migration: `security definer` SQL function, `search_path=public`, grant execute to anon, authenticated; case-insensitive compare on `profiles.username`.
- Update `isUsernameUnique` in `src/lib/supabaseAuth.ts` and `src/lib/supabaseService.ts` to call the RPC; distinguish error vs taken.
- Test: available name → true, existing name → false, invalid format → false.
- Verify with Playwright signed-out signup on a free name.
