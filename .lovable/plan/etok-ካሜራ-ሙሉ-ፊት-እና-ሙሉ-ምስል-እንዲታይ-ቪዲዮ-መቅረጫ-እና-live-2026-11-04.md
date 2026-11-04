# eTok ካሜራ፦ ሙሉ ፊት እና ሙሉ ምስል እንዲታይ (ቪዲዮ መቅረጫ እና Live)

## ችግሩ ለምን ተከሰተ
1. **ስልክዎ ላይ ያለው Echat መተግበሪያ ገና አልተዘመነም።** የዛሬ ጠዋቱ ማስተካከያ ያለው በድረ-ገጹ ብቻ ነው። በስልኩ መተግበሪያ ውስጥ ያለው አሁንም የድሮው ካሜራ ነው። ስለዚህ ምስሉ አሁንም zoom ሆኖ ይታያል።
2. **የስልክ ካሜራዎች ምስልን በ 4:3 ቅርጽ ይወስዳሉ፤ ይህ ሰፊው እይታ ነው።** መተግበሪያው ረጅም (9:16) ቅርጽ ሲጠይቅ ስልኩ የምስሉን ሁለት ጎኖች ይቆርጣል። ከዚያ ስክሪኑም በድጋሚ ይቆርጣል። በዚህ ምክንያት ስልኩን ቢያርቁትም ፊትዎ በጣም ቀርቦ ይታያል።

በትክክለኛው የካሜራ ህግ ስልኩን ሲያርቁት ምስሉ መራቅ አለበት። ይህ ማስተካከያ ያንን ይመልሳል።

## የሚደረገው ማስተካከያ
1. ካሜራው የራሱን ሙሉ እና ሰፊ እይታ (4:3) እንዲሰጥ ይጠየቃል። ምንም አይቆረጥም።
2. ስክሪኑ ሙሉውን ምስል ያሳያል። ፊትዎ፣ ትከሻዎ እና ከጀርባዎ ያለው ሁሉ ይታያሉ። ከላይ እና ከታች የቀረው ባዶ ቦታ በዚያው ምስል በደብዛዛ (blur) መልክ ይሞላል።
3. ስልኩ ብዙ የፊት ካሜራዎች ካሉት ሰፊውን ይመርጣል። ዲጂታል zoom ወደ ዝቅተኛው (1x) ይመለሳል። ብርሃን እና ፎከስ በራሳቸው ይስተካከላሉ።
4. ሰዎች በቪዲዮው ወይም በ Live ላይ የሚያዩት እርስዎ ስክሪኑ ላይ የሚያዩትን ሙሉ ምስል ነው። ምንም አይቆረጥም።
5. የፊት ካሜራ ምስል እርስዎ ሲያዩት እንደ መስታወት ይገለበጣል። የተቀረጸው ቪዲዮ ግን በትክክለኛው አቅጣጫ ይቀመጣል።

## የሚመለከታቸው ቦታዎች
- eTok ቪዲዮ መቅረጫ (የፊት እና የኋላ ካሜራ፣ እና በመካከላቸው ሲቀያይሩ)
- eTok Live

## እንዴት እፈትሻለሁ
- ሰፊ ቅርጽ በሚሰጥ የሙከራ ካሜራ በስልክ መጠን ስክሪን ላይ እሞክራለሁ። ምስሉ አለመቆረጡን አረጋግጣለሁ።
- እውነተኛ የስልክ ካሜራ ከዚህ መሞከር አልችልም።
- **ለእርስዎ፦** ይህ ማስተካከያ ስልክዎ ላይ እንዲሰራ የ Echat መተግበሪያው (APK) እንደገና መገንባት አለበት። ድረ-ገጹም መታተም (Publish) አለበት። ያለዚያ ስልኩ የድሮውን ካሜራ ማሳየቱን ይቀጥላል።

## Technical details
- `src/lib/cameraStream.ts`: request `{ facingMode, aspectRatio: {ideal: 4/3}, width: {ideal: 1280} }`, with a fallback to `{ facingMode }`. Prefer the device with the lowest `zoom.min` / widest field of view when there are several devices with the same facing. Keep zoom min and continuous exposure/focus.
- `EtokCamera.tsx` and `EtokLive.tsx`: always use `object-contain` for the main video, plus a blurred `object-cover` background `<video>` that shares the same stream (`blur-2xl scale-110 opacity-60`, semantic tokens). Remove the cover/contain switching.
- Recording: MediaRecorder records the raw stream, which is the full frame; verify there is no canvas crop.
- Viewers in Live: use `object-contain` with the same blurred fill so they also see the full frame.
