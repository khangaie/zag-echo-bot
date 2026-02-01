const { ActivityHandler, CardFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');
const { processFiles } = require('./graph/fileProcessor');
const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');
class ZAGBot extends ActivityHandler {
 constructor() {
   super();
   this.onMessage(async (context, next) => {
     try {
       const question = (context.activity.text || '').trim();
       if (!question) return;
       await context.sendActivity('🔍 Баримтаас хайж байна...');
       const accessToken = await getGraphToken();
       const files = await searchSharePoint(question, accessToken);
       if (!files.length) {
         await context.sendActivity('❌ Тохирох баримт олдсонгүй.');
         return;
       }
       const { extractedTextMap, ocrUsed } =
         await processFiles(files, accessToken);
       const response = buildCopilotResponse({
         question,
         files,
         extractedTextMap,
         ocrUsed
       });
       await context.sendActivity({
         attachments: [CardFactory.adaptiveCard(response.adaptiveCard)]
       });
     } catch (err) {
       console.error('BOT ERROR:', err);
       await context.sendActivity('❌ Алдаа гарлаа. Системийн лог шалгана уу.');
     }
     await next();
   });
   this.onMembersAdded(async (context) => {
     await context.sendActivity(
       '👋 Сайн байна уу!\n\n' +
       '🤖 ZAG AI Bot\n' +
       '• Процесс тайлбарлана\n' +
       '• SharePoint баримт хайна\n' +
       '• Copilot маягийн хариу өгнө\n\n' +
       'Жишээ: **Гэрээ байгуулах процесс**'
     );
   });
 }
}
module.exports = ZAGBot;
