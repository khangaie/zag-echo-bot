const { ActivityHandler } = require("botbuilder");
const { getGraphToken } = require("./graph/token");
const { searchSharePoint } = require("./graph/sharepointSearch");
class ZAGBot extends ActivityHandler {
 constructor() {
   super();
   this.onMessage(async (context) => {
     try {
       const question = (context.activity.text || "").trim();
       if (!question) {
         await context.sendActivity("❗ Асуултаа бичнэ үү.");
         return;
       }
       await context.sendActivity("🔎 SharePoint баримт хайж байна...");
       const accessToken = await getGraphToken();
       const files = await searchSharePoint(question, accessToken);
       if (!files || files.length === 0) {
         await context.sendActivity("❌ Холбогдох баримт олдсонгүй.");
         return;
       }
       let reply = "📄 **Олдсон баримтууд:**\n\n";
       files.forEach((f, i) => {
         reply += `${i + 1}. ${f.name}\n${f.url}\n\n`;
       });
       await context.sendActivity(reply);
     } catch (err) {
       console.error("BOT ERROR:", err);
       await context.sendActivity("❌ Алдаа гарлаа. Log stream-ийг шалгана уу.");
       return;
     }
   });
   this.onMembersAdded(async (context) => {
     await context.sendActivity(
       "👋 Сайн байна уу!\n\n" +
       "Би дараах зүйлсийг хийж чадна:\n" +
       "• SharePoint баримт хайх\n" +
       "• PDF / OCR баримт унших\n" +
       "• AI хариу өгөх"
     );
   });
 }
}
module.exports = ZAGBot;
