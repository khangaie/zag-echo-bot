const { ActivityHandler, MessageFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');
const { processFiles } = require('./graph/fileProcessor');
const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');
// 🔍 Асуултын intent тодорхойлох
function detectIntent(text) {
 const q = text.toLowerCase();
 if (q.includes('process') || q.includes('үйл явц') || q.includes('алхам')) {
   return 'process';
 }
 if (q.includes('hse') || q.includes('аюулгүй')) {
   return 'hse';
 }
 if (q.includes('policy') || q.includes('дүрэм') || q.includes('журам')) {
   return 'policy';
 }
 if (q.includes('contract') || q.includes('гэрээ')) {
   return 'contract';
 }
 return 'general';
}
class TeamsAIBot extends ActivityHandler {
 constructor() {
   super();
   // ===== MESSAGE HANDLER =====
   this.onMessage(async (context, next) => {
     const userText = (context.activity.text || '').trim();
     if (!userText) {
       await context.sendActivity('❗ Асуултаа бичнэ үү.');
       return next();
     }
     // 1️⃣ Intent тодорхойлох
     const intent = detectIntent(userText);
     await context.sendActivity(
       MessageFactory.text(`🔍 Хайж байна... (${intent})`)
     );
     let files = [];
     let accessToken;
     // 2️⃣ SharePoint search
     try {
       accessToken = await getGraphToken();
       // 👉 intent-ээр хайлтын хүрээ нарийсгана
       files = await searchSharePoint(userText, accessToken, intent);
     } catch (err) {
       console.error('SharePoint error:', err);
       await context.sendActivity(
         '❌ SharePoint-оос баримт хайхад алдаа гарлаа.'
       );
       return next();
     }
     if (!files.length) {
       await context.sendActivity(
         '📭 Тохирох баримт олдсонгүй.'
       );
       return next();
     }
     // 3️⃣ File processing (PDF + OCR)
     let extractedTextMap = {};
     let ocrUsed = false;
     try {
       const result = await processFiles(files, accessToken);
       extractedTextMap = result.extractedTextMap;
       ocrUsed = result.ocrUsed;
     } catch (err) {
       console.error('File processing error:', err);
     }
     // 4️⃣ Copilot-style response
     const response = buildCopilotResponse({
       question: userText,
       intent,
       files,
       extractedTextMap,
       ocrUsed
     });
     // 5️⃣ Final answer
     await context.sendActivity(
       MessageFactory.text(response.answer)
     );
     await next();
   });
   // ===== WELCOME MESSAGE =====
   this.onMembersAdded(async (context, next) => {
     await context.sendActivity(
       '👋 Сайн байна уу!\n\n' +
       '🤖 **ZAG AI Bot** танд компанийн мэдээллийн сангаас :\n' +
       '• процесс\n' +
       '• дүрэм журам\n' +
       '• HSE стандарт\n' +
       '• гэрээ\n\n' +
       '📌 Асуултаа энгийнээр бичихэд хангалттай.\n' +
       'Жишээ: **"Гэрээ байгуулах процесс"**'
     );
     await next();
   });
 }
}
module.exports.TeamsAIBot = TeamsAIBot;
