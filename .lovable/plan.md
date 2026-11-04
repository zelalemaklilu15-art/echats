# አዲስ ሰው Wallet ማንቃት እንዲችል ማስተካከል

## ችግሩ ምንድነው
አንድ ሰው ደንቦቹን ተቀብሎ "Activate" ሲጫን፣ ስርዓቱ የተቀበለበትን ቀን ለመመዝገብ ይሞክራል። ያ ምዝገባ "አንድ ሰው አንድ መዝገብ ብቻ" የሚል ህግ ይፈልጋል፤ ግን ያ ህግ በዳታቤዙ ውስጥ የለም። ስለዚህ ማንቃቱ በሙሉ ይከሽፋል፣ እና ሰውየው "Could not complete this wallet operation" የሚል መልዕክት ያያል። የwallet ሁኔታው "pending_activation" ሆኖ ይቀራል። ለምሳሌ tilahungirma4116@gmail.com አሁን ልክ እንደዚህ ተጣብቋል።

## የሚደረገው ለውጥ
1. "አንድ ሰው አንድ የደንብ መቀበያ መዝገብ" የሚለውን ህግ መጨመር። አሁን ያሉት 4 መዝገቦች አንድም ተደጋጋሚ የላቸውም፤ ስለዚህ ምንም አይጠፋም።
2. ከለውጡ በኋላ ገንዘብ፣ PIN ወይም ሌላ የደህንነት ፍተሻ አይቀየርም።
3. ማንቃቱ እንደሚሰራ በአዲስ የሙከራ መለያ መፈተሽ፣ ከዚያ የሙከራ መለያውን ማጥፋት።

## Technical details
- Migration: `CREATE UNIQUE INDEX wallet_terms_acceptance_user_id_key ON public.wallet_terms_acceptance(user_id);` This matches the `ON CONFLICT(user_id)` clause in `wallet_activate_secure`.
- No function or client code changes are needed. The fix applies immediately on the live app, so no republish is required.
