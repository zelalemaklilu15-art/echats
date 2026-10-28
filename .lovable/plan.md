# "Username already taken" — ከመሰረቱ ማስተካከል

## የተገኙ ምክንያቶች
1. **የተሳሳተ መልእክት:** ፈታሹ ስሙ ህጉን ካልተከተለ (ለምሳሌ ነጥብ `.`፣ ሰረዝ `-`፣ የአማርኛ ፊደል፣ ከ30 በላይ ፊደል) እንዲሁ "ተይዟል" ይላል። ስለዚህ ነፃ ስም እንኳ ቢሆን "taken" ይመጣል።
2. **የቀድሞው ስሪት:** ለውጡ የገባው በ Preview ብቻ ነው። በ echats.lovable.app ወይም በስልኩ (APK) ላይ ያለው አሮጌው ስሪት ሁሌም "taken" ይላል፣ እስኪታተም (Publish) ድረስ።

## መፍትሄ
1. ፈታሹ ሶስት ግልፅ መልሶች ይሰጣል፦ **ነፃ ነው** / **ተይዟል** / **ልክ አይደለም (ምክንያቱ)**።
2. በመመዝገቢያ ገፅ፣ በ "Add account" እና በ Profile ላይ ስም ሲፃፍ ወዲያው ከታች ያሳያል፦ "✓ ነፃ ነው"፣ "ተይዟል" ወይም "a-z፣ 0-9 እና _ ብቻ፣ 3–30 ፊደል"።
3. ተጠቃሚው የሚፅፈውን ወዲያው ያስተካክላል (ትልቅ ፊደል → ትንሽ፣ ክፍተት ያጠፋል፣ `@` ያስወግዳል)።
4. በምዝገባ ጊዜ ሁለት ሰዎች አንድ ስም ቢወስዱ፣ ግልፅ "ተይዟል" መልእክት ይመጣል (ግራ የሚያጋባ የሰርቨር ስህተት አይደለም)።
5. በ Preview ላይ ሙሉ ምዝገባን በነፃ ስም፣ በተያዘ ስም እና ህጉን በማይከተል ስም እፈትሻለሁ።
6. ከዚያ በ echats.lovable.app እና በ APK ላይ እንዲሰራ **Publish** ፈቃድዎን እጠይቃለሁ (APKም እንደገና መገንባት አለበት)።

## Technical
- Replace RPC with `check_username(p_username) returns text` ('available'|'taken'|'invalid'), security definer, anon+authenticated execute; keep `is_username_available` wrapper.
- `isUsernameUnique` → `checkUsername()` returning status; debounced inline check hook used in Auth, AddAccount, Profile, UsernameSettings.
- Map signup error "Database error saving new user"/unique violation to "Username already taken".
- Tests: status mapping for available/taken/invalid.
