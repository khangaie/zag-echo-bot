const { ActivityHandler, CardFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');

// Feature flag: ENV байхгүй үед автоматаар унтраалт
const FEATURE_RAG_CARD = (process.env.FEATURE_RAG_CARD || '0') === '1';

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    this.onMembersAdded(async (context, next) => {
      const welcome =
        "👋 Сайн байна уу?\n\n" +
        "Би **Заг Инженеринг ХХК**‑ийн хиймэл оюун ухааны туслах бот байна.\n" +
        "📚 Манай байгууллагын мэдлэгийн сан, SharePoint‑ийн баримтуудаас хайлт хийж танд шаардлагатай мэдээллийг олж өгдөг.\n\n" +
        "Та асуултаа бичээрэй, би туслахад бэлэн байна 😊";
      await context.sendActivity(welcome);
      await next();
    });

    this.onMessage(async (context, next) => {
      const question = (context.activity.text || '').trim();

      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return await next();
      }

      await context.sendActivity('🔎 SharePoint баримт хайж байна…');

      try {
        const accessToken = await getGraphToken();
        const spFiles = await searchSharePoint(question, accessToken);

        if (!spFiles || spFiles.length === 0) {
          await context.sendActivity('⚠️ Хайлтаар баримт олдсонгүй.');
          return await next();
        }

        if (!FEATURE_RAG_CARD) {
          // Хуучин зан төлөв: линк жагсаалт
          const lines = spFiles
            .map((f, i) => `${i + 1}. [${f.name}](${f.webUrl || '#'})`)
            .join('\n');
          await context.sendActivity(lines);
        } else {
          // Шинэ урсгал: RAG + Adaptive Card
          const { answerQuestion } = require('./ai/orchestrator');
          const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');
          const res = await answerQuestion(question);
          const card = buildCopilotResponse({
            question,
            files: res.docs,
            extractedTextMap: Object.fromEntries(
              res.docs.map(d => [d.fileName, d.content || ''])
            ),
            ocrUsed: false
          }).adaptiveCard;
          await context.sendActivity({
            attachments: [{
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: card
            }]
          });
        }

      } catch (e) {
        console.error('onMessage error:', e);
        await context.sendActivity('🚨 Дотоод алдаа гарлаа. Дараа дахин оролдоно уу.');
      }

      await next();
    });
  }
}

module.exports = ZAGBot;
