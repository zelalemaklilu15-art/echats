## በምስሉ ያየኋቸው 2 ስህተቶች

**1. የ notify NS መዝገቦች ዋጋ ተሳስቷል**
አሁን ያለው፦ `ns3.lovable.cloud.echat.online.` እና `ns4.lovable.cloud.echat.online.`
መሆን ያለበት፦ `ns3.lovable.cloud.` እና `ns4.lovable.cloud.`
ፓነሉ መጨረሻው ላይ ነጥብ (.) ስላልነበረ `echat.online` ጨምሮበታል። እያንዳንዱን ✏️ ይጫኑ፣ ዋጋውን `ns3.lovable.cloud.` (መጨረሻ ላይ ነጥብ ያለው) ብለው ያስተካክሉ። ለ ns4 እንዲሁ።

**2. ይህ ፓነል (dapanel / private-nameserver.net) ኢንተርኔት የሚያነበው አይደለም**
ዛሬ ፈትሼዋለሁ፦ echat.online የሚመራው በ `cns1.cloudpit.de`, `cns2.cloudpit.com`, `cns3.cloudpit.io` ነው። ፓነሉ ግን `ns5/ns6.private-nameserver.net` ይላል። ስለዚህ እዚህ የሚያስገቡት አይታይም።

ከሁለቱ አንዱን ያድርጉ፦
- ዶሜይኑን በገዙበት ቦታ (registrar) nameservers ን ወደ `ns5.private-nameserver.net` እና `ns6.private-nameserver.net` ይቀይሩ። (የድር ጣቢያ እና mail መዝገቦች ፓነሉ ላይ ስላሉ ይቀጥላሉ።)
- ወይም ተመሳሳይ መዝገቦችን በ cloudpit/dogado ውስጥ ያስገቡ።

_dmarc እና _lovable-email TXT መዝገቦቹ ትክክል ናቸው።

ሲጨርሱ ይንገሩኝ፤ ወዲያውኑ እፈትሻለሁ፣ ከዚያ More → Emails → Verify Domain።
