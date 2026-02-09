// bot.js
const { ActivityHandler } = require('botbuilder');

// Feature flag: RAG + OCR карт асаах/унтраах
const FEATURE_RAG_CARD = (process.env.FEATURE_RAG_CARD || '0') === '1';

// conversation history хадгалах (follow-up query rewrite хийхэд)
const historyMap = new Map(); // conversation.id -> [{role,text}]

function pushHistory(convId, role, text) {
  const h = historyMap.get(convId) || [];
  h.push({ role, text });
  historyMap.set(convId, h.slice(-6));
}

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
      const convId = context.activity.conversation?.id || 'default';

      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return await next();
      }

      // history-д user асуултаа хадгална
      pushHistory(convId, 'user', question);

      try {
        // ✅ RAG асаалттай бол — оркестратор өөрөө SP+fallback+sticky контекстээр хариулна
        if (FEATURE_RAG_CARD) {
          await context.sendActivity('🔎 Баримт хайж байна…');

          const { answerQuestion } = require('./ai/orchestrator');
          const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');

          const res = await answerQuestion(question, {
            threadId: convId,
            history: historyMap.get(convId) || []
          });

          const card = buildCopilotResponse({
            question,
            extractedTextMap: res.extractedTextMap || {},
            files: res.docs || [],
            ocrUsed: !!res.ocrUsed,
            ans: res.ans
          }).adaptiveCard;

          await context.sendActivity({
            attachments: [{
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: card
            }]
          });

          if (res?.ans?.tldr) pushHistory(convId, 'assistant', res.ans.tldr);
          return await next();
        }

        // ❎ RAG унтраалттай бол — зөвхөн SP линк жагсаана
        await context.sendActivity('🔎 SharePoint баримт хайж байна…');

        const { searchSharePoint } = require('./graph/sharepointSearch');
        const { getGraphToken } = require('./graph/token');

        const accessToken = await getGraphToken();
        const spFiles = await searchSharePoint(question, accessToken);

        if (!spFiles || spFiles.length === 0) {
          await context.sendActivity('⚠️ Хайлтаар баримт олдсонгүй.');
          return await next();
        }

        const lines = spFiles
          .map((f, i) => `${i + 1}. ${f.webUrl || '#'}`)
          .join('\n');

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
