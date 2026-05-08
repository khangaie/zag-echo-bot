// bot.js (2-step reply version)
const { ActivityHandler } = require('botbuilder');

const FEATURE_RAG_CARD = (process.env.FEATURE_RAG_CARD || '1') === '1';
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
    return String(
      v?.msteams?.text ||
      v?.msteams?.messageText ||
      v?.text ||
      v?.query ||
      v?.q ||
      ''
    ).trim();
  }
  return '';
}

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const convId = context.activity.conversation?.id || 'default';
      const question = extractQuestion(context.activity);

      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return next();
      }

      pushHistory(convId, 'user', question);

      // ✅ STEP 1: Шууд эхний reply (5 сек‑ээс өмнө)
      await context.sendActivity(
        '🔍 **Хайж байна...**\nБаримтуудаас шалгаж байна, удахгүй хариу илгээнэ.'
      );

      // ✅ STEP 2: RAG‑ийг background‑д ажиллуулна
      this.runRagPipeline(context, convId, question)
        .catch(err => console.error('[RAG background error]', err));

      return next();
    });
  }

  async runRagPipeline(context, convId, question) {
    if (!FEATURE_RAG_CARD) {
      await context.sendActivity('ℹ️ RAG унтраалттай байна.');
      return;
    }

    const { answerQuestion } = require('./ai/orchestrator');
    const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');

    // ✅ 25 секунд hard timeout (GatewayTimeout‑оос хамгаална)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const res = await answerQuestion(question, {
        threadId: convId,
        history: historyMap.get(convId) || [],
        signal: controller.signal
      });

      clearTimeout(timeout);

      const card = buildCopilotResponse({
        question,
        extractedTextMap: res.extractedTextMap || {},
        files: (res.docs || []).slice(0, 5), // ✅ card‑ыг хөнгөн
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

      if (res?.ans?.tldr) {
        pushHistory(convId, 'assistant', res.ans.tldr);
      }

    } catch (err) {
      clearTimeout(timeout);

      if (err.name === 'AbortError') {
        await context.sendActivity(
          '⏱️ Хайлт удааширлаа.\n👉 Асуултаа арай тодорхой болгож асуугаарай.'
        );
        return;
      }

      console.error('[RAG error]', err);
      await context.sendActivity('🚨 Дотоод алдаа гарлаа.');
    }
  }
}

module.exports = ZAGBot;
