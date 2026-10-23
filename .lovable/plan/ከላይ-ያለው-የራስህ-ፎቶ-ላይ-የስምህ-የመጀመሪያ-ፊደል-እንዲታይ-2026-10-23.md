# ከላይ ያለው የራስህ ፎቶ ላይ የስምህ የመጀመሪያ ፊደል እንዲታይ

## ችግሩ
በChats ገፅ ላይ ከላይ በግራ ያለው ክብ ፎቶ ሁሌም "Y" ያሳያል፤ ምክንያቱም ስሙ "You" ተብሎ ተቀምጧል።

## ማስተካከያው
- የራስህን ስም ይወስዳል፦ ስም Zelalem ከሆነ "Z"፣ ስም ከሌለ የusername የመጀመሪያ ፊደል።
- የራስህ ፎቶ ካለህ ፎቶው ይታያል።
- ሌላ ምንም አይቀየርም (badge፣ ቀለም፣ ወደ Profile መሄድ)።

## ቴክኒካዊ
- `src/pages/Chats.tsx` መስመር ~802: `useProfile(currentUserId)` ተጠቅሞ `<ChatAvatar name={profile?.name || profile?.username || "?"} src={profile?.avatar_url} .../>`።
