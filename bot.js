// bot.js
const { ActivityHandler } = require('botbuilder');

const FEATURE_RAG_CARD = (process.env.FEATURE_RAG_CARD || '0') === '1';

const historyMap = new Map();
function pushHistory(convId, role, text) {
  const h = historyMap.get(convId) || [];
  h.push({ role, text });
  historyMap.set(convId, h.slice(-6));
}

function extractQuestion(activity) {
  const t = String(activity?.text || '').trim();
  if (t) return t;

  const v = activity?.value;
  if (v && typeof v === 'object') {
    const mt = v.msteams;
    const candidate =
      (mt && (mt.text || mt.messageText || mt.displayText)) ||
      v.text || v.query || v.q;
    if (candidate) return String(candidate).trim();
  }
  return '';
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
      const convId = context.activity.conversation?.id || 'default';
      const question = extractQuestion(context.activity);

      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return next();
      }

      pushHistory(convId, 'user', question);

      try {
        if (FEATURE_RAG_CARD) {
          await context.sendActivity('🔎 Баримтаас хайж байна…');

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
            ans: res.ans,
            needSteps: !!res.needSteps,
            domain: res.domain || 'general',
            folders: res.folders || []
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
