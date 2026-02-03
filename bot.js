const { ActivityHandler, CardFactory } = require('botbuilder');

const { getGraphToken } = require('./token');               // ✅ зөв зам
const { searchSharePoint } = require('./sharepointSearch'); // Graph Search API
const { processFiles } = require('./fileProcessor');        // (сонголттой) OCR
const { buildCopilotResponse } = require('./copilotResponseBuilder');

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      try {
        const question = (context.activity.text || '').trim();
        if (!question) {
          await context.sendActivity('❓ Асуултаа бичнэ үү.');
          return await next();
        }

        await context.sendActivity('🔎 SharePoint баримт хайж байна...');

        const accessToken = await getGraphToken();
        const spFiles = await searchSharePoint(question, accessToken); // [{name,url}...]

        if (!spFiles || spFiles.length === 0) {
          await context.sendActivity('❌ Холбогдох баримт олдсонгүй.');
          return await next();
        }

        const filesForProcessing = spFiles.map(f => ({
          fileName: f.name || f.fileName || 'file',
          url: f.url
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

        const payload = buildCopilotResponse({
          question,
          files: spFiles,
          extractedTextMap,
          ocrUsed
        });

        await context.sendActivity({
          attachments: [CardFactory.adaptiveCard(payload.adaptiveCard)]
        });

      } catch (err) {
        console.error('BOT ERROR:', err);
        await context.sendActivity('⚠️ Алдаа гарлаа. Log stream-ийг шалгана уу.');
      }
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      await context.sendActivity([
        'Сайн байна уу! 👋',
        'Надад дараах байдлаар бичээд туршаарай:',
        '• "Саравч байгуулах норм хай"',
        '• "SharePoint баримт хайж өг"',
        '• "PDF / OCR баримт унш" (хэрэв дэмжсэн бол)',
        '→ Ай харуулъя 🔍'
      ].join('\n'));
      await next();
    });
  }
}

module.exports = ZAGBot; // ✅ default export
