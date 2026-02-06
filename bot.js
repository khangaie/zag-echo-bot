// bot.js
const { ActivityHandler } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');

// Feature flag: ENV байхгүй үед унтраалт
const FEATURE_RAG_CARD = (process.env.FEATURE_RAG_CARD || '0') === '1';

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    this.onMembersAdded(async (context, next) => {
      const welcome =
        "👋 Сайн байна уу?\n\n" +
        "Би **Заг Инженеринг ХХК**‑ийн хиймэл оюун ухааны туслах бот байна.\n" +
        "📚 Манай байгууллагын SharePoint мэдлэгийн сангаас хайлт хийж, танд шаардлагатай мэдээллийг олж өгнө.\n\n" +
        "Та асуултаа бичээрэй 😊";
      await context.sendActivity(welcome);
      await next();
    });

    this.onMessage(async (context, next) => {
      const question = (context.activity.text || "").trim();

      if (!question) {
        await context.sendActivity("❓ Асуултаа бичнэ үү.");
        return await next();
      }

      await context.sendActivity("🔎 SharePoint баримт хайж байна…");

      try {
        // SharePoint хайлт
        const accessToken = await getGraphToken();
        const spFiles = await searchSharePoint(question, accessToken);

        if (!spFiles || spFiles.length === 0) {
          await context.sendActivity("⚠️ Хайлтаар баримт олдсонгүй.");
          return await next();
        }

        // --- Хуучин зан төлөв (линк жагсаалт) ---
        if (!FEATURE_RAG_CARD) {
          const lines = spFiles
            .map((f, i) => `${i + 1}. [${f.name}](${f.webUrl || "#"})`)
            .join("\n");

          await context.sendActivity(lines);
        }

        // --- Шинэ RAG + Adaptive Card ---
        else {
          const { answerQuestion } = require("./ai/orchestrator");
          const { buildCopilotResponse } = require("./ai/copilotResponseBuilder");

          const res = await answerQuestion(question); // { ans, docs }

          const card = buildCopilotResponse({
            question,
            extractedTextMap: Object.fromEntries(
              (res.docs || []).map((d) => [d.fileName, d.content || ""])
            ),
            files: res.docs,
            ocrUsed: false,
            ans: res.ans
          }).adaptiveCard;

          await context.sendActivity({
            attachments: [
              {
                contentType: "application/vnd.microsoft.card.adaptive",
                content: card,
              },
            ],
          });
        }

      } catch (e) {
        console.error("onMessage error:", e);
        await context.sendActivity(
          "🚨 Дотоод алдаа гарлаа. Дараа дахин оролдоно уу."
        );
      }

      await next();
    });
  }
}

module.exports = ZAGBot;
