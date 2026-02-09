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

    this.onMembersAdded(async (context, next) => {
      const welcome =
        "👋 Сайн байна уу?\n\n" +
        "Би **Заг Инженеринг ХХК**‑ийн хиймэл оюун ухааны туслах бот байна.\n" +
        "📚 SharePoint мэдлэгийн сангаас хайлт хийж, баримтад тулгуурлан хариулна.\n\n" +
        "Та асуултаа бичээрэй 😊";
      await context.sendActivity(welcome);
      await next();
    });

    this.onMessage(async (context, next) => {
      const question = (context.activity.text || '').trim();
      const convId = context.activity.conversation?.id || 'default';

      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return next();
      }

      pushHistory(convId, 'user', question);

      try {
        if (FEATURE_RAG_CARD) {
          await context.sendActivity('🔎 Баримтаас хайж байна…');

          // ✅ Require‑ууд алдахад сервис унахгүй (deploy restart loop тасална)
          let answerQuestion, buildCopilotResponse;
          try {
            ({ answerQuestion } = require('./ai/orchestrator'));
            ({ buildCopilotResponse } = require('./ai/copilotResponseBuilder'));
          } catch (e) {
            console.error('[Require error]', e);
            await context.sendActivity('⚠️ Server тохиргооны алдаа байна (module load failed).');
            return next();
          }

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
          return next();
        }

        // RAG унтраалттай үед (танайд бол асаалттай)
        await context.sendActivity('ℹ️ RAG унтраалттай байна.');
        return next();

      } catch (e) {
        console.error('[onMessage error]', e);
        await context.sendActivity('🚨 Дотоод алдаа гарлаа. Дараа дахин оролдоно уу.');
        return next();
      }
    });
  }
}

module.exports = ZAGBot;
