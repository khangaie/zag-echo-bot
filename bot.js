const { ActivityHandler, MessageFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');
const { askAI } = require('./graph/askAI');

class TeamsAIBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const userText = (context.activity.text || '').trim();

      await context.sendActivity(
        MessageFactory.text('🔍 Хайж байна...')
      );

      let documents = [];

      try {
        const accessToken = await getGraphToken();
        documents = await searchSharePoint(userText, accessToken);
      } catch (err) {
        console.error('SharePoint error:', err);
        await context.sendActivity('SharePoint хайлт хийхэд алдаа гарлаа.');
        await next();
        return;
      }

      let answer;
      try {
        answer = await askAI(userText, documents);
      } catch (err) {
        console.error('AI error:', err);
        answer = 'AI хариу үүсгэхэд алдаа гарлаа.';
      }

      await context.sendActivity(answer);
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      await context.sendActivity(
        '👋 Сайн байна уу! Би ZAG AI Bot. Компанийн мэдээллийн сангаас баримт хайж өгнө.'
      );
      await next();
    });
  }
}

module.exports.TeamsAIBot = TeamsAIBot;
