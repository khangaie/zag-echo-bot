const { ActivityHandler, CardFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');
const { processFiles } = require('./graph/fileProcessor');
const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');
function createBot() {
 const bot = new ActivityHandler();
 bot.onMessage(async (context, next) => {
   try {
     const question = (context.activity.text || '').trim();
     if (!question) return;
     await context.sendActivity('🔍 Баримтаас хайж байна...');
     // 🔑 Graph access token
     const accessToken = await getGraphToken();
     // 📂 SharePoint хайлт
     const files = await searchSharePoint(question, accessToken);
     if (!files || files.length === 0) {
       await context.sendActivity('❌ Тохирох баримт олдсонгүй.');
       return;
     }
     // 📄 Файл OCR / уншилт
     const { extractedTextMap, ocrUsed } =
       await processFiles(files, accessToken);
     // 🤖 Copilot response
     const response = buildCopilotResponse({
       question,
       files,
       extractedTextMap,
       ocrUsed
     });
     await context.sendActivity({
       attachments: [
         CardFactory.adaptiveCard(response.adaptiveCard)
       ]
     });
   } catch (err) {
     console.error('BOT ERROR:', err);
     await context.sendActivity(
       '❌ Алдаа гарлаа. Системийн лог шалгана уу.'
     );
   }
   await next();
 });
 bot.onMembersAdded(async (context) => {
   await context.sendActivity(
     '👋 **Сайн байна уу!**\n\n' +
     '🤖 **ZAG AI Bot**\n' +
     '• Процесс тайлбарлана\n' +
     '• Summary гаргана\n' +
     '• Холбогдох баримт хайж өгнө\n' +
     '• BPMN diagram үүсгэнэ\n\n' +
     '✍️ Жишээ асуулт: **"Гэрээ байгуулах процесс"**'
   );
 });
 return bot;
}
module.exports = { createBot };
