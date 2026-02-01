const { ActivityHandler } = require("botbuilder");
const { getGraphToken } = require("./graph/token");
const { searchSharePoint } = require("./graph/sharepointSearch");
class ZAGBot extends ActivityHandler {
 constructor() {
   super();
   this.onMessage(async (context, next) => {
     try {
       const question = (context.activity.text || "").trim();
       if (!question) return;
       await context.sendActivity("🔍 SharePoint-оос хайж байна...");
       const accessToken = await getGraphToken();
       const files = await searchSharePoint(question, accessToken);
       if (!files.length) {
         await context.sendActivity("❌ Холбогдох баримт олдсонгүй.");
         return;
       }
       let reply = "📄 Олдсон баримтууд:\n\n";
       files.forEach(f => {
         reply += `• ${f.name}\n${f.url}\n\n`;
       });
       await context.sendActivity(reply);
     } catch (err) {
       console.error("BOT ERROR:", err);
       await context.sendActivity("❌ Алдаа гарлаа. Log-ийг шалгана уу.");
     }
     await next();
   });
   this.onMembersAdded(async (context) => {
     await context.sendActivity(
       "👋 Сайн байна уу!\n\n" +
       "• SharePoint баримт хайна\n" +
       "• Scanned PDF OCR уншина\n" +
       "• Copilot маягийн хариу өгнө"
     );
   });
 }
}
module.exports = ZAGBot;
