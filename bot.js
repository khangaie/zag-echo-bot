// bot.js
const { ActivityHandler } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');

// Feature flag: RAG + OCR карт асаах/унтраах
const FEATURE_RAG_CARD = (process.env.FEATURE_RAG_CARD || '0') === '1';

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    // 👋 Welcome message
    this.onMembersAdded(async (context, next) => {
      const welcome =
        "👋 Сайн байна уу?\n\n" +
        "Би **Заг Инженеринг ХХК**‑ийн хиймэл оюун ухааны туслах бот байна.\n" +
        "📚 SharePoint мэдлэгийн сангаас хайлт хийж, танд шаардлагатай мэдээллийг олж өгдөг.\n\n" +
        "Та асуултаа бичээрэй 😊";
      await context.sendActivity(welcome);
      await next();
    });

    // 💬 Message handler
    this.onMessage(async (context, next) => {
      const question = (context.activity.text || '').trim();

      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return await next();
      }

      await context.sendActivity('🔎 SharePoint баримт хайж байна…');

      try {
        // 1) SharePoint хайлт (холбогдох линкүүд)
        const accessToken = await getGraphToken();
        const spFiles = await searchSharePoint(question, accessToken);

        if (!spFiles || spFiles.length === 0) {
          await context.sendActivity('⚠️ Хайлтаар баримт олдсонгүй.');
          return await next();
        }

        // 2) Хэрэв RAG карт унтраалттай бол — хуучин горим: линк жагсаах
        if (!FEATURE_RAG_CARD) {
          const lines = spFiles
            .map((f, i) => `${i + 1}. [${f.name}](${f.webUrl || '#'})`)
            .join('\n');
          await context.sendActivity(lines);
        }
        // 3) Шинэ горим: RAG + (runtime OCR) + Adaptive Card
        else {
          const { answerQuestion } = require('./ai/orchestrator');
          const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');

          // answerQuestion → { ans, docs, extractedTextMap, ocrUsed }
          const res = await answerQuestion(question);

          const card = buildCopilotResponse({
            question,
            extractedTextMap: res.extractedTextMap || {},
            files: res.docs || [],
            ocrUsed: !!res.ocrUsed,
            ans: res.ans
          }).adaptiveCard;

          await context.sendActivity({
            attachments: [
              {
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: card
              }
            ]
          });
        }
      } catch (e) {
        // Алдаа: лог + хэрэглэгчид эелдэг мессеж
        console.error('onMessage error:', e);
        await context.sendActivity('🚨 Дотоод алдаа гарлаа. Дараа дахин оролдоно уу.');
      }

      await next();
    });
  }
}

module.exports = ZAGBot;
