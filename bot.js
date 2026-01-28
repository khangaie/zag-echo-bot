const { ActivityHandler, MessageFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepoint');
const { askAI } = require('./aiClient');

class TeamsAIBot extends ActivityHandler {
    constructor() {
        super();

        this.onMessage(async (context, next) => {
            const userText = (context.activity.text || '').trim();

            await context.sendActivity(
                MessageFactory.text('🔍 Хайж байна...')
            );

            let spSummary = '';

            try {
                const graphToken = process.env.GRAPH_TOKEN;
                const result = await searchSharePoint(graphToken, userText);

                if (
                    result?.hitsContainers?.[0]?.hits?.length > 0
                ) {
                    result.hitsContainers[0].hits.forEach(hit => {
                        spSummary += `• ${hit.resource?.name}\n`;
                    });
                } else {
                    spSummary = 'Холбогдох файл олдсонгүй.';
                }
            } catch (err) {
                console.error('Graph error:', err);
                spSummary = 'SharePoint хайлт хийхэд алдаа гарлаа.';
            }

            const finalAnswer = await askAI(userText, spSummary);

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

