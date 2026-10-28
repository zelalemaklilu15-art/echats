# የ Wallet ተጠቃሚ የነበሩ መለያዎችን ማጥፋት እንዲቻል

## ለምን አልጠፋም
ተጠቃሚው ሲጠፋ የሱ Wallet አብሮ ይጠፋል። ነገር ግን የዛ Wallet የገንዘብ ታሪክ (የላከውና የተቀበለው) ጥበቃ ስላለው ዳታቤዙ ማጥፋቱን ይከለክላል። ስለዚህ "still linked to data" የሚለው ስህተት ይመጣል።

## መፍትሄ
- ሁሉም የገንዘብ ልውውጥ ታሪክ ይቀመጣል — አይጠፋም፤ በሌላኛው ወገን ያለው ሰውም ታሪኩን ማየት ይቀጥላል።
- የተጠቃሚው Wallet ሲጠፋ ታሪኩ ይቆያል፣ ከጠፋው Wallet ጋር ብቻ መያያዙ ይቋረጣል።
- Wallet ውስጥ ገንዘብ (ቀሪ ሂሳብ) ያለው ተጠቃሚ እንዲጠፋ አይፈቀድም፤ ግልፅ መልዕክት ይታያል — ገንዘብ በዝምታ እንዳይጠፋ።
- ከዚያ ያንን ተጠቃሚ (ashinafiaklilu@gmail.com) እንደገና አጥፍቼ እፈትሻለሁ።

## Technical details
- Migration: `wallet_transactions.wallet_id` and `counterparty_wallet_id` FKs to `wallets` → `ON DELETE SET NULL` (drop NOT NULL on `wallet_id`).
- `BEFORE DELETE` trigger on `wallets` raising when `balance > 0`.
- PGlite test: zero-balance delete succeeds and keeps transactions; positive balance is refused.
