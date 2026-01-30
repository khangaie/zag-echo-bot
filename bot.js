const { ActivityHandler, CardFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/token');
const { processFiles } = require('./graph/fileProcessor');
const { buildCopilotResponse } = require('./ai/copilotResponseBuilder');

class TeamsAIBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const question = (context.activity.text || '').trim();
      if (!question) return;

      await context.sendActivity('🔍 Баримтаас хайж байна...');

      const token = await getGraphToken();
      const files = await searchSharePoint(question, token);

      if (!files.length) {
        await context.sendActivity('📭 Тохирох баримт олдсонгүй.');
        return;
      }

      const { extractedTextMap, ocrUsed } =
        await processFiles(files, token);

      const response = buildCopilotResponse({
        question,
        files,
        extractedTextMap,
        ocrUsed
      });

      await context.sendActivity({
        attachments: [
          CardFactory.adaptiveCard(response.adaptiveCard)
        ]
      });

      await next();
    });

    this.onMembersAdded(async (context) => {
      await context.sendActivity(
        '👋 **ZAG Copilot Bot**\n\n' +
        '📄 SharePoint баримтаас:\n' +
        '• Процесс тайлбарлана\n' +
        '• Summary гаргана\n' +
        '• BPMN diagram үзүүлнэ\n\n' +
        '✍️ Жишээ: **"Гэрээ байгуулах процесс"**'
      );
    });
  }
}

module.exports.TeamsAIBot = TeamsAIBot;
