# Echat ሙሉ “Cosmic Obsidian” ዲዛይን ለውጥ

## ዓላማ
በተሰጠው ZIP ውስጥ ያሉትን **Chats, Conversation, Calls, Cosmic Calls, Creator Profile, Etok Live, Astral Gifts, Settings እና Wallet** ማጣቀሻዎች እንደ ዋና የንድፍ ህግ በመጠቀም፣ 66 የመተግበሪያ ገፆችን፣ ሁሉንም የጋራ ክፍሎች፣ መስኮቶች፣ ማውጫዎች፣ ባዶ/መጫን/ስህተት ሁኔታዎችና ቁልፎች ወደ አንድ ወጥ የ**Cosmic Obsidian** እይታ መቀየር።

ነባር መረጃ፣ መግቢያ፣ የመልዕክት፣ ጥሪ፣ Wallet፣ Stars፣ Etok፣ AI፣ notification እና Capacitor ተግባራት አይቀየሩም፤ ለውጡ በእይታ፣ አቀማመጥና የመጠቀም ልምድ ላይ ብቻ ይሆናል።

## 1. የንድፍ ስርዓት
- ZIP ውስጥ ያሉትን ትክክለኛ የCosmic ቀለሞች ወደ semantic tokens ማስገባት፦ Obsidian/Void መሬቶች፣ Violet primary፣ Magenta secondary፣ Astral Gold tertiary፣ Cyan/Mint status፣ የስህተት ቀለሞች።
- **Plus Jakarta Sans** ለሁሉም ዋና ጽሑፎች፤ **Cinzel** በZIP እንዳለው በተመረጡ luxury/astral ርዕሶች ብቻ። ፎንቶቹ በመተግበሪያው ውስጥ ይታሸጋሉ።
- የጽሑፍ መጠን፣ ክፍተት፣ 8px-or-less ካርድ radius፣ borders፣ shadows፣ glow፣ icon size፣ 44px+ touch target እና motion tokens ማዋሃድ።
- የዋናውን ጨለማ እይታ እንደ ZIP ትክክለኛ ማድረግ፤ light mode ሲመረጥ ንጽጽርና ተነባቢነት የጠበቀ ተዛማጅ theme ማቅረብ።
- 556 hardcoded hex፣ 521 rgb/rgba፣ 103 arbitrary color classes እና ከ800 በላይ inline style አጠቃቀሞችን በተዛማጅ token/classes መተካት፤ የተጠቃሚ accent customization እንዲቀጥል ማድረግ።

## 2. የጋራ መዋቅሮችና ንክኪዎች
- የሁሉም ገፆች ርዕስ፣ back button፣ search፣ overflow menu፣ bottom navigation፣ tabs፣ filters፣ list row፣ avatar/status፣ cards፣ FAB እና form controls በጋራ የCosmic components ማዋሃድ።
- ዋና Bottom Navigation እና Etok Bottom Navigation ተግባራቸውን ሳያጡ በአንድ የእይታ ቋንቋ ማዛመድ።
- Dialog፣ Sheet፣ Alert፣ confirmation፣ picker፣ share panel፣ context menu፣ tooltip እና toast ሁሉንም በአንድ ወጥ ንድፍ ማድረግ።
- Loading skeletons፣ empty states፣ offline፣ permission denied፣ error boundary፣ locked screens እና success/error feedback ለአዲሱ theme ማዛመድ።
- የZIP ውስጥ ያለውን subtle constellation texture፣ glass surface እና controlled glow በአፈጻጸም የማይጎዳ መጠን መጠቀም፤ `prefers-reduced-motion` ማክበር።

## 3. ሁሉም ገፆች

### A. መግቢያና መጀመሪያ
Splash, Auth, Forgot Password, OAuth Consent እና onboarding ሁኔታዎች፦ የEchat Cosmic brand፣ ግልጽ forms፣ password/error states፣ mobile keyboard ተስማሚነት።

### B. Chats እና Messaging
Chats, Chat, Group Chat, New Group, Add Members, New Message, Saved Messages, Broadcast List, Chat Stats፦ ZIP Chats/Conversation አቀማመጥን በትክክል መከተል፤ message bubbles፣ composer፣ attachments፣ voice/video recorder፣ reactions፣ reply/forward፣ polls፣ checklist፣ bill split፣ location፣ link preview፣ media viewer፣ GIF/sticker፣ search፣ theme/wallpaper pickers፣ import/export እና ሁሉም chat sheets ማዘመን።

### C. Contacts, Profiles እና Discovery
Contacts, Contact Profile, Profile, New Contact, Nearby, Close Friends, Global Search፦ creator-profile reference መሰረት የprofile header፣ stats፣ action buttons፣ menus፣ lists እና privacy states ማዘመን።

### D. Calls
Calls, Call History, voice/video Call overlays, Incoming Call, Group Call, Voice Chat፦ Cosmic Calls reference መሰረት call log፣ filters፣ quick dial፣ incoming/ongoing controls፣ participant grid፣ PiP፣ network status፣ in-call chat እና permission states ማዘመን። የWebRTC አሰራር አይቀየርም።

### E. Wallet, Payments, Stars እና Gifts
Wallet, QR, Add/Send/Request Money, Payment Request, Transaction History/Detail/Receipt, Add Account, Scheduled Payments, Savings Goals, Buy Stars, Gifts፦ ZIP Wallet/Astral Gifts አቀማመጥ፣ balance visibility፣ payment method cards፣ forms፣ receipts፣ confirmation dialogs፣ transaction statuses፣ PIN/lock/terms ሁሉ ማዘመን። የቀሪ ሂሳብና ግብይት logic አይነካም።

### F. Etok ሙሉ ክፍል
Etok feed, onboarding, camera, search, live, live detail, profile, analytics, creator tools, settings፣ video cards፣ comments፣ share sheet፣ gifts፦ ZIP Etok Live/Creator Profile ቋንቋን ወደ feed፣ overlays፣ recording controls፣ creator statistics፣ profile grids፣ live chat/gifting ሙሉ በሙሉ ማስፋፋት።

### G. Settings እና Privacy
Settings, Privacy, Notifications, Data & Storage, Sound, Quick Replies, Business Profile, Active Sessions, Reminders፦ ZIP Settings አቀማመጥ፣ grouped rows፣ toggles፣ selectors፣ destructive actions፣ profile summary እና sub-page headers ማዘመን።

### H. Channels, Bots, Stories, AI እና ቀሪ ገፆች
Channels/Channel View, Bots/Bot Chat, Stories/Live Stories, AIAssistant, Features, Not Found እና ሁሉም dynamic routes፦ ከላይ ከተገለጹት tokens/components ጋር ሙሉ ማዛመድ፤ የAI quota/premium፣ story viewer/editor እና channel/bot interactions እንዳይጎዱ ማረጋገጥ።

## 4. Android/Capacitor እና responsive ዝግጁነት
- ሁሉም fixed headers፣ bottom bars፣ sheets፣ camera/live overlays እና full-screen viewers `safe-area-inset-*` እንዲያከብሩ ማድረግ።
- 320px እስከ tablet/desktop ድረስ text overflow፣ clipping፣ overlap፣ horizontal scroll እና keyboard obstruction መፈተሽና ማስተካከል።
- Native back button፣ external browser፣ share፣ push notification፣ status bar፣ camera/mic/location/photo permissions እና deep links ከአዲሱ UI ጋር እንዲሰሩ ማረጋገጥ።
- የweb መንገድ እንዳይለወጥ፤ native-specific behavior ሁሉ `isNative()` በሚለው ጥበቃ ውስጥ እንዲቆይ።

## 5. የጥራት ማረጋገጫ
- Route inventory በመጠቀም 66ቱንም ገፆችና dynamic routes አንድ በአንድ መክፈት።
- ዋና የተጠቃሚ ፍሰቶች፦ auth፣ chat/group/media፣ voice/video call፣ wallet/payment/stars/gifts፣ Etok/live፣ settings/privacy፣ AI በPlaywright መፈተሽ።
- Mobile 360×800፣ 390×844፣ 412×915 እና desktop 1280px screenshots በማነጻጸር overflow/overlap/touch-target መፈተሽ።
- Dark/light፣ loading/empty/error/offline፣ keyboard open፣ denied permissions፣ long names/Amharic text፣ large balances እና reduced-motion states መፈተሽ።
- Typecheck፣ lint፣ tests እና production build ማስኬድ፤ build/runtime/console/network errors እስኪጠፉ ድረስ ማስተካከል።
- የAndroid project ከተገኘ `npx cap sync android` እና Gradle compile ማረጋገጥ፤ Android SDK ካልተገኘ ያልተሞከረውን በግልጽ ማሳወቅ።

## የመጨረሻ ውጤት
- ሁሉንም ገፆች፣ controls፣ components እና states የሚሸፍን አንድ ወጥ Cosmic Obsidian UI።
- ነባር ተግባራትና መረጃ ሳይቀየሩ የተሻሻለ mobile/web/Android ልምድ።
- የተፈተሹ routes/flows፣ የቀሩ ገደቦችና የbuild ሁኔታ ግልጽ ሪፖርት።
- ከህዝብ ልቀት በፊት የመጨረሻ ፈቃድዎ ይጠየቃል።

## ቴክኒካዊ ማስታወሻ
የተላከው ZIP የመጨረሻ central-directory ክፍል የለውም፣ ነገር ግን 30 የሚነበቡ local entries ውስጥ ያሉት 8 HTML mockups እና 9 screenshots ሙሉ የንድፍ መረጃቸው ተገኝቷል። እነዚህ ማጣቀሻዎች በቀጥታ ይከተላሉ፤ mockup የሌላቸው ገፆች ደግሞ በዚያው tokens፣ spacing፣ hierarchy እና interaction language ይሰራሉ።
