const { ActivityHandler, MessageFactory } = require('botbuilder');

const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');

const { processFiles } = require('./graph/fileProcessor');
const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');

class TeamsAIBot extends ActivityHandler {
  constructor() {
    super();

    // ===== MESSAGE HANDLER =====
    this.onMessage(async (context, next) => {
      const userText = (context.activity.text || '').trim();

      if (!userText) {
        await context.sendActivity('❗ Асуултаа бичнэ үү.');
        await next();
        return;
      }

      // 1️⃣ Loading message
      await context.sendActivity(
        MessageFactory.text('🔍 Хайж байна...')
      );

      let files = [];
      let accessToken;

      // 2️⃣ SharePoint search
      try {
        accessToken = await getGraphToken();
        files = await searchSharePoint(userText, accessToken);
      } catch (err) {
        console.error('SharePoint error:', err);
        await context.sendActivity(
          '❌ SharePoint-оос баримт хайх үед алдаа гарлаа.'
        );
        await next();
        return;
      }

      if (!files.length) {
        await context.sendActivity(
          '📭 Тохирох баримт олдсонгүй.'
        );
        await next();
        return;
      }

      // 3️⃣ File processing (PDF + OCR)
      let extractedTextMap = {};
      let ocrUsed = false;

      try {
        const result = await processFiles(files, accessToken);
        extractedTextMap = result.extractedTextMap;
        ocrUsed = result.ocrUsed;
      } catch (err) {
        console.error('File processing error:', err);
      }

      // 4️⃣ Copilot-style response
      const response = buildCopilotResponse({
        question: userText,
        files,
        extractedTextMap,
        ocrUsed
      });

      // 5️⃣ Send final answer
      await context.sendActivity(
        MessageFactory.text(response.answer)
      );

      await next();
    });

    // ===== WELCOME MESSAGE =====
    this.onMembersAdded(async (context, next) => {
      await context.sendActivity(
        '👋 Сайн байна уу!\n\n' +
        '🤖 **ZAG AI Bot** танд компанийн SharePoint баримтаас:\n' +
        '• хайлт хийх\n' +
        '• ойлгомжтой summary өгөх\n' +
        '• санал болгох асуулт гаргах\n\n' +
        '👉 Жишээ: **"Гэрээ байгуулах процесс"** гэж бичнэ үү.'
      );
      await next();
    });
  }
}

module.exports.TeamsAIBot = TeamsAIBot;

