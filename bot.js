const { ActivityHandler, MessageFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token'); // ⬅️ заавал
const { askAI } = require('./graph/aiClient');

class TeamsAIBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const userText = (context.activity.text || '').trim();

      await context.sendActivity(
        MessageFactory.text('🔍 Хайж байна...')
      );

      let spSummary = '';

      try {
        // 1️⃣ Graph access token авна
        const accessToken = await getGraphToken();

        // 2️⃣ SharePoint хайлт
        const results = await searchSharePoint(userText, accessToken);

        if (results.length > 0) {
          results.forEach(r => {
            spSummary += `📄 ${r.fileName}\n🔗 ${r.url}\n\n`;
          });
        } else {
          spSummary = 'Холбогдох файл олдсонгүй.';
        }
      } catch (err) {
        console.error('SharePoint error:', err);
        spSummary = 'SharePoint хайлт хийхэд алдаа гарлаа.';
      }

      let finalAnswer = spSummary;

      try {
        finalAnswer = await askAI(userText, spSummary);
      } catch (err) {
        console.error('AI error:', err);
      }

      await context.sendActivity(finalAnswer);
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      await context.sendActivity(
        '👋 Сайн байна уу! Би ZAG AI Bot. SharePoint-оос баримт хайж өгнө.'
      );
      await next();
    });
  }
}

module.exports.TeamsAIBot = TeamsAIBot;
