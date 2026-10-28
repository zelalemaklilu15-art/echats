# እንደ ባለቤት ማንኛውንም ተጠቃሚ ማጥፋት እንዲቻል

## ለምን አሁንም ከለከለ
ባለፈው ያስቀመጥኩት ጥበቃ ነው፦ Wallet ውስጥ ገንዘብ ያለው (ይህ ተጠቃሚ 7,500 ETB አለው) መለያ እንዳይጠፋ ይከለክላል። እርስዎ ባለቤት ስለሆኑ ይህ ክልከላ አያስፈልግም።

## ምን ይደረጋል
- የ "ገንዘብ ያለው Wallet አይጠፋም" ክልከላ ይነሳል፤ ከ Users ገፅ Delete user ሲጫኑ ማንኛውም ተጠቃሚ ይጠፋል።
- የገንዘብ ልውውጥ ታሪኩ (የላከውና የተቀበለው) አይጠፋም፤ ሌላኛው ወገን ታሪኩን ማየት ይቀጥላል።
- ሌላ የሚያግድ ነገር ካለ ፈትሼ አስተካክላለሁ፣ ከዚያ እንደገና እንዲሞክሩ እነግርዎታለሁ።

ማሳሰቢያ፦ ተጠቃሚው ሲጠፋ በ Wallet ውስጥ ያለው 7,500 ETB አብሮ ይጠፋል።

## Technical details
- Migration: drop trigger `prevent_funded_wallet_delete_trg` and function `prevent_funded_wallet_delete`.
- Keep `ON DELETE SET NULL` ledger detach + trigger exceptions from 0028.
- Re-scan FKs/triggers (incl. storage.objects owner, etok_* to profiles) for any remaining restricting reference; dry-run delete in a rolled-back transaction is not possible via read tools, so verify via schema inspection.
- Add PGlite test: deleting a user with a funded wallet and completed transactions succeeds and transactions remain with null wallet refs.
