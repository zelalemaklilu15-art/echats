# ImprovMX ን ማግበር (support@ / info@ / contact@ / admin@echats.site)

## ሁኔታ
- አዲሱ ላኪ noreply@notify.echats.site ኮዱ ተቀይሮ ተሰማርቷል (ተጠናቋል)።
- ቀሪው፦ echats.site DNS ላይ የImprovMX MX መዝገቦች መጨመር።
- AI ኤጀንቱ የDNS መዝገቦችን የሚቀይርበት መሳሪያ የለውም፤ ፈቃድ ቢሰጥም አይቻልም። ስለዚህ ይህ ደረጃ በእርስዎ እጅ ብቻ ይሰራል።

## እርስዎ የሚያደርጉት (አንድ ጊዜ ብቻ)
1. More → Emails ላይ notify.echats.site "Active" መሆኑን ያረጋግጡ (ከዚያ በፊት MX ይቆለፋል)።
2. Settings → Workspace domains → echats.site → Advanced → DNS records።
3. የድሮ mxa/mxb.eu.mailgun.org MX ካለ ያጥፉ።
4. + Add record፦ MX, Host @, Answer mx1.improvmx.com, Priority 10, TTL 300።
5. + Add record፦ MX, Host @, Answer mx2.improvmx.com, Priority 20, TTL 300።
6. TXT (SPF) @ ን ወደ `v=spf1 include:mailgun.org include:spf.improvmx.com ~all` ያስተካክሉ።
7. ImprovMX ላይ "Check again" ይጫኑ። "Go Premium" አያስፈልግም።

## ኤጀንቱ የሚያደርገው (ካጸደቁ በኋላ)
- የDNS ሁኔታውን ፈትሾ ትክክል መሆኑን ያረጋግጣል፣ ስህተት ካለ በትክክል ይነግርዎታል።
- noreply@notify.echats.site ኢሜይሎች መላካቸውን ያረጋግጣል።
