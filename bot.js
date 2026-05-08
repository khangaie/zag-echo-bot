const { ActivityHandler } = require('botbuilder');

const FEATURE_RAG_CARD =
  (process.env.FEATURE_RAG_CARD || '1') === '1';

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const question = (context.activity.text || '').trim();

      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return next();
      }

      // ✅ STEP 1 — шууд reply (504‑өөс аврана)
      await context.sendActivity(
        '🔍 Хайж байна... түр хүлээнэ үү.'
      );

      // ✅ STEP 2 — background RAG
      this.runRag(context, question)
        .catch(e => console.error('[RAG ERROR]', e));

      await next();
    });
  }

  async runRag(context, question) {
    if (!FEATURE_RAG_CARD) {
      await context.sendActivity('ℹ️ RAG унтраалттай байна.');
      return;
    }

    const { answerQuestion } = require('./ai/orchestrator');
    const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    try {
      const res = await answerQuestion(question, {
        signal: controller.signal
      });

      clearTimeout(timer);

      const card =
        buildCopilotResponse({
          question,
          ans: res.ans,
          files: (res.docs || []).slice(0, 4),
          domain: res.domain || 'general',
          folders: res.folders || []
        }).adaptiveCard;

      await context.sendActivity({
        attachments: [{
          contentType:
            'application/vnd.microsoft.card.adaptive',
          content: card
        }]
      });

    } catch (e) {
      clearTimeout(timer);

      if (e.name === 'AbortError') {
        await context.sendActivity(
          '⏱️ Хайлт удааширлаа. Асуултаа арай товчхон асуугаарай.'
        );
        return;
      }

      await context.sendActivity('🚨 Дотоод алдаа гарлаа.');
    }
  }
}

module.exports = ZAGBot;
