const { ActivityHandler, CardFactory } = require('botbuilder');
 const { searchSharePoint } = require('./graph/sharepointSearch');
 const { getGraphToken } = require('./graph/token');   // <-- танай токен авах файл
+// Feature flag: Adaptive Card + RAG урсгал.
+// ENV байхгүй үед автоматаар унтраалт (false) — хуучин логик хэвээр.
+const FEATURE_RAG_CARD = (process.env.FEATURE_RAG_CARD || '0') === '1';

 class ZAGBot extends ActivityHandler {
   constructor() {
     super();
@@
     // ✉️ Хэрэглэгч мессеж бичих үед
     this.onMessage(async (context, next) => {
       const question = (context.activity.text || '').trim();

       // Хоосон мессеж хамгаалах
       if (!question) {
         await context.sendActivity('❓ Асуултаа бичнэ үү.');
         return await next();
       }

       await context.sendActivity('🔎 SharePoint баримт хайж байна…');

       try {
         // Token
         const accessToken = await getGraphToken();

         // Хайлт
         const spFiles = await searchSharePoint(question, accessToken);

         if (!spFiles || spFiles.length === 0) {
           await context.sendActivity('⚠️ Хайлтаар баримт олдсонгүй.');
           return await next();
         }

-        // Үр дүнгийн жагсаалт
-        const lines = spFiles
-          .map((f, i) => `${i + 1}. [${f.name}](${f.webUrl || '#'})`)
-          .join('\n');
-        await context.sendActivity(lines);
+        if (!FEATURE_RAG_CARD) {
+          // Хуучин зан төлөв: линк жагсаалт (эвдрэлгүй fallback)
+          const lines = spFiles
+            .map((f, i) => `${i + 1}. [${f.name}](${f.webUrl || '#'})`)
+            .join('\n');
+          await context.sendActivity(lines);
+        } else {
+          // Шинэ урсгал: Orchestrator + Adaptive Card (Copilot-стайл)
+          const { answerQuestion } = require('./ai/orchestrator');
+          const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');
+          const res = await answerQuestion(question);
+          const card = buildCopilotResponse({
+            question,
+            files: res.docs,
+            extractedTextMap: Object.fromEntries(
+              res.docs.map(d => [d.fileName, d.content || ''])
+            ),
+            ocrUsed: false
+          }).adaptiveCard;
+          await context.sendActivity({
+            attachments: [{
+              contentType: 'application/vnd.microsoft.card.adaptive',
+              content: card
+            }]
+          });
+        }

       } catch (e) {
         console.error('onMessage error:', e);
         await context.sendActivity('🚨 Дотоод алдаа гарлаа. Дараа дахин оролдоно уу.');
       }

       await next();
     });
   }
 }

 module.exports = ZAGBot;
