const { ActivityHandler, CardFactory } = require('botbuilder');

// ✅ ЗӨВ ЗАМУУД + named export-ууд
const { getGraphToken } = require('./graph/token');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { processFiles } = require('./graph/fileProcessor');
const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      try {
        const question = (context.activity.text || '').trim();
        if (!question) {
          await context.sendActivity('❔ Асуултаа бичнэ үү.');
          return await next();
        }

        await context.sendActivity('🔎 SharePoint баримт хайж байна…');

        // 1) Graph token
        const accessToken = await getGraphToken();

        // 2) SharePoint search
        const spFiles = await searchSharePoint(question, accessToken); // [{ name, url }]
        if (!spFiles || spFiles.length === 0) {
          await context.sendActivity('❌ Хамаарах баримт олдсонгүй.');
          return await next();
        }

        // 3) Файл боловсруулалт (OCR/parse)
        const filesForProcessing = spFiles.map(f => ({
          filename: f.name || f.filename || 'file',
          url: f.url,
        }));

        let extractedTextMap = {};
        let ocrUsed = false;
        try {
          const processed = await processFiles(filesForProcessing, accessToken);
          extractedTextMap = processed.extractedTextMap || {};
          ocrUsed = !!processed.ocrUsed;
        } catch (e) {
          console.warn('processFiles warning:', e.message);
        }

        // 4) Хариу бүтээх (Adaptive Card)
        const payload = buildCopilotResponse({
          question,
          files: spFiles,
          extractedTextMap,
          ocrUsed,
        });

        await context.sendActivity({
          attachments: [CardFactory.adaptiveCard(payload.adaptiveCard)],
        });
      } catch (err) {
        console.error('Bot onMessage error:', err);
        await context.sendActivity('⚠️ Дотоод алдаа гарлаа.');
      }

      await next();
    });
  }
}

module.exports = ZAGBot;
