// bot.js — Final (2-step reply + proactive final send, no revoked proxy)
const { ActivityHandler, TurnContext } = require('botbuilder');

const FEATURE_RAG_CARD = (process.env.FEATURE_RAG_CARD || '1') === '1';

// Conversation history (simple in-memory)
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
      v.text ||
      v.query ||
      v.q;
    if (candidate) return String(candidate).trim();
  }
  return '';
}

async function continueConversation(adapter, conversationReference, logic) {
  // CloudAdapter: continueConversationAsync(appId, conversationReference, logic)
  if (typeof adapter.continueConversationAsync === 'function') {
    const appId = process.env.MicrosoftAppId || process.env.MicrosoftAppID || '';
    return adapter.continueConversationAsync(appId, conversationReference, logic);
  }

  // BotFrameworkAdapter (хуучин): continueConversation(conversationReference, logic)
  if (typeof adapter.continueConversation === 'function') {
    return adapter.continueConversation(conversationReference, logic);
  }

  throw new Error('Adapter does not support proactive continueConversation.');
}

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    this.onMembersAdded(async (context, next) => {
      const welcome =
        "👋 Сайн байна уу?\n\n" +
        "Би **Заг Инженеринг ХХК**‑ийн хиймэл оюун ухааны туслах бот байна.\n" +
        "📚 SharePoint мэдлэгийн сангаас хайлт хийж, баримтад тулгуурлан хариулна.\n\n" +
        "Асуултаа бичээрэй 😊";
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

      // ✅ STEP 1: Шууд reply (504‑өөс хамгаална)
      await context.sendActivity('🔍 **Хайж байна...** Түр хүлээнэ үү.');

      // ✅ STEP 2: Background RAG (context proxy-г ашиглахгүй!)
      const adapter = context.adapter;
      const conversationReference = TurnContext.getConversationReference(context.activity);

      // background async — turn дууссаны дараа proactive-аар явуулна
      this.runRagProactive({
        adapter,
        conversationReference,
        convId,
        question
      }).catch((e) => console.error('[runRagProactive error]', e));

      await next();
    });
  }

  async runRagProactive({ adapter, conversationReference, convId, question }) {
    if (!FEATURE_RAG_CARD) {
      await continueConversation(adapter, conversationReference, async (turnContext) => {
        await turnContext.sendActivity('ℹ️ RAG унтраалттай байна.');
      });
      return;
    }

    // 25 секунд hard timeout (gateway timeout эрсдэлийг багасгана)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    try {
      const { answerQuestion } = require('./ai/orchestrator');
      const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');

      const res = await answerQuestion(question, {
        threadId: convId,
        history: historyMap.get(convId) || [],
        signal: controller.signal
      });

      clearTimeout(timer);

      const card = buildCopilotResponse({
        question,
        extractedTextMap: res.extractedTextMap || {},
        files: (res.docs || []).slice(0, 4), // card хэт томрохоос сэргийлнэ
        ocrUsed: !!res.ocrUsed,
        ans: res.ans,
        needSteps: !!res.needSteps,
        domain: res.domain || 'general',
        folders: res.folders || []
      }).adaptiveCard;

      // ✅ Proactive final send
      await continueConversation(adapter, conversationReference, async (turnContext) => {
        await turnContext.sendActivity({
          attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: card
          }]
        });
      });

      if (res?.ans?.tldr) pushHistory(convId, 'assistant', res.ans.tldr);

    } catch (e) {
      clearTimeout(timer);

      // Abort болсон үед user-friendly мессеж
      if (e?.name === 'AbortError') {
        await continueConversation(adapter, conversationReference, async (turnContext) => {
          await turnContext.sendActivity(
            '⏱️ Хайлт удааширлаа. Асуултаа арай тодорхой/товч болгож дахин асуугаарай.'
          );
        });
        return;
      }

      console.error('[RAG ERROR]', e);
      await continueConversation(adapter, conversationReference, async (turnContext) => {
        await turnContext.sendActivity('🚨 Дотоод алдаа гарлаа. Дараа дахин оролдоно уу.');
      });
    }
  }
}

module.exports = ZAGBot;
