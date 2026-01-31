const { ActivityHandler } = require('botbuilder');
const { detectIntent } = require('./ai/intentDetector');
const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');
const { getGraphToken } = require('./graph/token');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { processFiles } = require('./graph/fileProcessor');
class Bot extends ActivityHandler {
 constructor() {
   super();
   this.onMessage(async (context, next) => {
     const question = context.activity.text?.trim();
     if (!question) {
       await context.sendActivity('Асуултаа бичнэ үү.');
       return;
     }
     await context.sendActivity('🔍 Баримтаас хайж байна...');
     try {
       // 1️⃣ Intent тодорхойлох
       const intent = detectIntent(question);
       // 2️⃣ Graph access token авах
       const accessToken = await getGraphToken();
       // 3️⃣ SharePoint хайлт
       const files = await searchSharePoint({
         query: question,
         accessToken
       });
       if (!files || files.length === 0) {
         await context.sendActivity(
           buildCopilotResponse({
             question,
             intent,
             extractedTextMap: {},
             files: [],
             ocrUsed: false
           })
         );
         return;
       }
       // 4️⃣ Файлуудыг OCR / текст болгох
       const { extractedTextMap, ocrUsed } =
         await processFiles(files, accessToken);
       // 5️⃣ Эцсийн Copilot response
       const response = buildCopilotResponse({
         question,
         intent,
         extractedTextMap,
         files,
         ocrUsed
       });
       await context.sendActivity(response);
     } catch (err) {
       console.error('Bot error:', err);
       await context.sendActivity(
         '❌ SharePoint-оос мэдээлэл авах үед алдаа гарлаа.'
       );
     }
     await next();
   });
 }
}
module.exports.Bot = Bot;
