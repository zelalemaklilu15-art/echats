# Wallet ውስጥ ያሉትን ሁሉንም ገፆች በCosmic ንድፍ መቀየር

## ለምን ቀረ

ዋናው Wallet ገፅ ተቀይሯል፣ ነገር ግን ከእሱ የሚከፈቱት ገፆች የራሳቸው የቆዩ ቋሚ ቀለሞች አሏቸው። ገና ያልተቀየሩት፦

- Add Money (ገንዘብ ማስገባት)
- Send Money (መላክ)
- Request Money (መጠየቅ)
- Payment Request / Pay Link
- Wallet QR (QR Pay)
- Transaction History (ታሪክ)
- Transaction Detail እና Receipt (ደረሰኝ)
- Scheduled Payments
- Savings Goals
- Buy Stars / Redeem
- የዋናው Wallet ገፅ ቀሪ ክፍሎች (Activity chart ታች፣ Recent transactions፣ የታችኛው ቁልፍ)

## ምን ይሠራል

በሁሉም ላይ እንደ Wallet ገፅ ተመሳሳይ ገጽታ፦ ጥቁር obsidian ዳራ፣ glass ፓነሎች፣ ወርቃማ ዋና ቁልፎችና ድምቀቶች፣ violet/berry ቅልመቶች፣ ክብ glass አዶዎች፣ ወርቃማ ጠርዝ ያለው መጠን ማሳያ። የሁኔታ ቀለሞች ትርጉማቸው ይጠበቃል (ተሳክቷል አረንጓዴ፣ በሂደት ወርቅ፣ ያልተሳካ ቀይ)። የባንክ/Telebirr አርማ ቀለሞችና QR ኮዱ (ለማንበብ ጥቁር-ነጭ) አይቀየሩም።

## የማይቀየሩ

ቀሪ ሂሳብ፣ ግብይቶች፣ የክፍያ ሂደት፣ PIN፣ ገደቦች — ቀለም/ገጽታ ብቻ ይቀየራል።

## ማረጋገጫ

እያንዳንዱን ገፅ በስልክ መጠን ከፍቼ ስክሪንሾት አያለሁ፣ ስህተት እንደሌለ አረጋግጣለሁ፤ typecheck + build።

## Technical details

- በእያንዳንዱ ፋይል hex/rgba/raw palette/`text-white` ወደ `hsl(var(--token) / a)` እና semantic classes (Wallet.tsx ላይ እንደተደረገው ተመሳሳይ ካርታ) መቀየር።
- SVG/chart attributes CSS var ስለማይቀበሉ የZIP ወርቅ hex ይጠቀማሉ።
- ሎጂክ/handlers/state አይነኩም።
- ሁሉንም wallet ገጽ ውስጥ ምንም ሳይቀር በአዲሱ ዲዛይን ቀይር