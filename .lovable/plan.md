# የኢሜይል ዶሜይን ለምን አልተዋቀረም

## ምክንያቱ
መዝገቦቹን ያስገቡት yegarahost ላይ ነው። ኢንተርኔት ግን የ echat.online መዝገቦችን የሚያነበው ከ dogado / cloudpit ነው (cns1.cloudpit.de፣ cns2.cloudpit.com፣ cns3.cloudpit.io)። ስለዚህ yegarahost ላይ ያለው ምንም ቦታ ላይ አይታይም። በመተግበሪያው ኮድ ላይ ምንም ችግር የለም፤ መጠበቅም መፍትሄ አይሆንም።

## መፍትሄ (ከሁለቱ አንዱን ይምረጡ)

**አማራጭ 1፦ መዝገቦቹን dogado / cloudpit ላይ ማስገባት**
1. ወደ dogado መለያዎ ይግቡ እና የ echat.online DNS ገጽን ይክፈቱ።
2. More → Emails → Manage Domains ላይ የሚታዩትን 4 መዝገቦች ያስገቡ፦
   - NS፣ Name `notify` → ns3.lovable.cloud
   - NS፣ Name `notify` → ns4.lovable.cloud
   - TXT፣ Name `_lovable-email` → ሙሉ እሴቱን ከ More → Emails ይቅዱ
   - TXT፣ Name `_dmarc` → `v=DMARC1; p=none;`
3. Save ወይም Apply ይጫኑ።

**አማራጭ 2፦ DNS ን ወደ yegarahost ማዛወር**
ዶሜይኑን በገዙበት ቦታ፣ የስም አገልጋዮቹን (nameservers) yegarahost ወደሚሰጣቸው ይቀይሩ። ማስጠንቀቂያ፦ በ cloudpit ላይ ያሉ የድር ጣቢያ እና የኢሜይል (MX) መዝገቦች መጀመሪያ yegarahost ላይ መገልበጥ አለባቸው። ካልሆነ ለጊዜው መስራት ያቆማሉ።

## ከዚያ በኋላ
- እኔ መዝገቦቹ ኢንተርኔት ላይ መታየታቸውን እፈትሻለሁ።
- እርስዎ More → Emails ላይ Verify Domain ይጫኑ። ብዙ ጊዜ ከጥቂት ደቂቃዎች እስከ ጥቂት ሰዓታት ይወስዳል።
- የኮድ ለውጥ አያስፈልግም።
