# Echat AI ላይ ምስልና ዶክመንት ማያያዣ መጨመር

## ለምን አሁን የለም
Echat AI ሲሰራ ጽሑፍ ብቻ እንዲቀበል ነው የተሰራው፤ የመጻፊያ ሳጥኑ ላይ ማያያዣ ቁልፍ የለም፣ አገልጋዩም ጽሑፍ ብቻ ነው ወደ AI የሚልከው። AIው ራሱ ግን ምስልና PDF ማንበብ ይችላል፤ ስለዚህ መጨመሩ ጥሩ ሀሳብ ነው።

## የሚጨመረው
- ከመላኪያ ቁልፉ አጠገብ 📎 ቁልፍ፦ **ፎቶ** (ካሜራ ወይም ጋለሪ) እና **ዶክመንት** (PDF፣ TXT፣ DOCX)።
- ከመላክህ በፊት ትንሽ ቅድመ-እይታ (ምስል ወይም የፋይል ስም) እና ማስወገጃ ×።
- AIው ምስሉን ይገልጻል፣ ጽሑፍ ከፎቶ ያነባል፣ ዶክመንቱን ያጠቃልላል፣ ጥያቄ ይመልሳል።
- የተያያዘው ፋይል በውይይት ታሪኩ ውስጥ ይቀመጣል፤ ለአንተ ብቻ ነው የሚታየው (የግል ማከማቻ)።
- ገደብ፦ በአንድ መልዕክት እስከ 4 ፋይል፣ ምስል እስከ 10MB፣ ዶክመንት እስከ 20MB።
- እያንዳንዱ ፋይል ያለው ጥያቄ ከዕለታዊ 15 ነጻ ጥያቄዎች እንደ 1 ይቆጠራል (Premium ያልተገደበ)።

## የማይቀየር
ጽሑፍ ብቻ ውይይት፣ ምስል መፍጠር፣ Premium፣ Wallet እና ሌሎች ገፆች እንዳሉ ይቀራሉ።

## Technical details
- Private storage bucket `ai-attachments` with owner-only RLS (path `user_id/...`); `ai_messages.attachments jsonb` column.
- Client (`AIAssistant.tsx`, `aiAssistantService.ts`): file picker, validation, upload, send storage paths only.
- `ai-chat` edge function: verify paths belong to caller, download with service role, convert to base64 data URLs, send as Responses `input_image` / `input_file` parts (per multimodal skill); DOCX/TXT text extracted server-side and sent as text. Quota check unchanged.
- Tests for path ownership and size/count limits.
