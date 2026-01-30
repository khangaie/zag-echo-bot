const { ActivityHandler, CardFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');
const { processFiles } = require('./graph/fileProcessor');
const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');
class TeamsAIBot extends ActivityHandler {
 constructor() {
   super();
   // ===============================
   // MESSAGE HANDLER
   // ===============================
   this.onMessage(async (context, next) => {
     try {
       const question = (context.activity.text || '').trim();
       if (!question) return;
       await context.sendActivity('🔍 Баримтаас хайж байна...');
       const token = await getGraphToken();
       const files = await searchSharePoint(question, token);
       if (!files.length) {
         await context.sendActivity('📄 Тохирох баримт олдсонгүй.');
         return;
       }
       const { extractedTextMap, ocrUsed } =
         await processFiles(files, token);
       const response = buildCopilotResponse({
         question,
         files,
         extractedTextMap,
         ocrUsed
       });
       // Adaptive card хамгаалалт
       if (response?.adaptiveCard) {
         await context.sendActivity({
           attachments: [
             CardFactory.adaptiveCard(response.adaptiveCard)
           ]
         });
       } else {
         await context.sendActivity('⚠️ Хариу бэлтгэхэд алдаа гарлаа.');
       }
       await next();
     } catch (err) {
       console.error('Bot error:', err);
       await context.sendActivity('❌ Алдаа гарлаа. Дахин оролдоно уу.');
     }
   });
   // ===============================
   // WELCOME MESSAGE (Монгол)
   // ===============================
   this.onMembersAdded(async (context) => {
     await context.sendActivity(
       '👋 **Сайн байна уу! Би ZAG-н хиймэл оюун ухааны BOT**\n\n' +
       '📚 **Байгууллагын мэдээллийн сангаас:**\n' +
       '• Процесс тайлбарлана\n' +
       '• Summary гаргана\n' +
       '• Холбогдох баримт хайж өгнө\n' +
       '• BPMN diagram ойлгомжтойгоор үзүүлнэ\n\n' +
       '✍️ *Жишээ асуулт:* **"Гэрээ байгуулах процесс"**'
     );
   });
 }
}
module.exports.TeamsAIBot = TeamsAIBot;
