const { ActivityHandler, MessageFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepoint');
const { askAI } = require('./graph/aiClient');

class TeamsAIBot extends ActivityHandler {
    constructor() {
        super();

        this.onMessage(async (context, next) => {
            const userText = (context.activity.text || '').trim();

            // Түр хариу
            await context.sendActivity(
                MessageFactory.text('🔍 Хайж байна...')
            );

            let spSummary = '';

            try {
                const result = await searchSharePoint(userText);

                // ✅ ЗӨВ Graph search response parse
                const hits =
                    result?.value?.[0]?.hitsContainers?.[0]?.hits || [];

                if (hits.length > 0) {
                    hits.forEach(hit => {
                        spSummary += `• ${hit.resource?.name || 'Нэргүй файл'}\n`;
                    });
                } else {
                    spSummary = 'Холбогдох файл олдсонгүй.';
                }
            } catch (err) {
                console.error('Graph error:', err);
                spSummary = 'SharePoint хайлт хийхэд алдаа гарлаа.';
            }

            // ✅ askAI унасан ч bot дуугүй болохоос сэргийлнэ
            let finalAnswer = spSummary;
            try {
                finalAnswer = await askAI(userText, spSummary);
            } catch (err) {
                console.error('askAI error:', err);
            }

            await context.sendActivity(finalAnswer);
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            await context.sendActivity(
                '👋 Сайн байна уу! Би ZAG AI Bot. SharePoint дээрх баримтаас хайж өгнө.'
            );
            await next();
        });
    }
}

module.exports.TeamsAIBot = TeamsAIBot;


