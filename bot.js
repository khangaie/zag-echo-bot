const { ActivityHandler, CardFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch'); // файл нэрээ тааруул

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const question = (context.activity.text || '').trim();
      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return await next();
      }

      await context.sendActivity('🔎 SharePoint баримт хайж байна…');

      try {
        const accessToken = await getGraphToken(); // танай токен олж авах функц
        const spFiles = await searchSharePoint(question, accessToken);

        if (!spFiles || spFiles.length === 0) {
          await context.sendActivity('⚠️ Хайлтаар баримт олдсонгүй.');
          return await next();
        }

        // энгийн жагсаалт
        const lines = spFiles.map((f, i) => `${i + 1}. [${f.name}](${f.webUrl})`).join('\n');
        await context.sendActivity(lines);
      } catch (e) {
        console.error('onMessage error:', e);
        await context.sendActivity('🚨 Дотоод алдаа гарлаа. Дараа дахин оролдоно уу.');
      }

      await next();
    });
  }
}

module.exports = ZAGBot;
