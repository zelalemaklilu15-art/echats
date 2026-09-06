# የCall Notification ቋሚ ማስተካከያ

## የተረጋገጠው ችግር

- በምስሉ ላይ ያለው `echats.lovable.app` published app አሁን ባለው source ውስጥ የሌለውን የድሮ “Notifications enabled but cloud sync unavailable” መልዕክት እያሳየ ነው።
- Published app ላይ `/firebase-messaging-sw.js` በቀጥታ ሲፈተሽ 404 ይመልሳል፤ local preview ላይ ግን ፋይሉ 200 እና ትክክለኛ JavaScript ይመልሳል።
- ስለዚህ permission ከተፈቀደ በኋላ FCM token ሳይወጣ ይቋረጣል፤ አሁን የሚታየው UIም የቆየ published build ነው።

## የሚደረገው

1. **Notification መንገዱን አንድ ማድረግ**
   - Settings እና Notification Settings ሁለቱም አንድ `usePushNotifications` flow እንዲጠቀሙ ማረጋገጥ።
   - ከFCM ጋር የማይገናኘውን የድሮ `push-sw.js`/subscription flow ከtoggle መንገድ ማስወገድ፣ ተደጋጋሚ registration እንዳይኖር።

2. **Service worker ከtoken በፊት ማረጋገጥ**
   - `/firebase-messaging-sw.js` መኖሩን እና JavaScript መመለሱን በfrontend ቅድሚያ መፈተሽ።
   - Worker registration/activation ከተሳካ ብቻ Firebase `getToken()` እንዲሄድ ማድረግ።
   - የworker፣ Firebase token፣ session ወይም token save ስህተት በየደረጃው ሙሉ መልዕክት እንዲታይ ማድረግ።

3. **Toggle ሁኔታን ትክክል ማድረግ**
   - Permission ብቻ ስለተፈቀደ toggle እንዳይበራ፤ FCM token ተገኝቶ በ`device_tokens` ከተቀመጠ በኋላ ብቻ ON እንዲሆን።
   - ሲሳካ ግልጽ success፣ ሲወድቅ `Stage: ... — Error: ...` የሚል በስክሪን ላይ የሚታይ መልዕክት ማሳየት።

4. **Published app ላይ ማድረስ እና ማረጋገጥ**
   - የፊት-ገጽ ለውጦቹን ማጠናቀቅና production build ማረጋገጥ።
   - አዲሱን ስሪት publish ማድረግ።
   - Published URL ላይ `/firebase-messaging-sw.js` 200 መመለሱን፣ የድሮው generic toast መጥፋቱን፣ እና toggle flow አዲሱን stage/error መልዕክት መጠቀሙን ማረጋገጥ።

## ወሰን

- Backend/RPC/database ላይ ምንም ለውጥ አይደረግም።
- ለውጡ frontend፣ Firebase messaging worker እና published app verification ብቻ ነው።
