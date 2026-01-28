const { ActivityHandler } = require("botbuilder");
const { searchSharePoint } = require("./sharepoint");
const { askAI } = require("./aiClient");

class TeamsAIBot extends ActivityHandler {
    constructor() {
        super();

        // Message received
        this.onMessage(async (context, next) => {
            const userText = context.activity.text;

            await context.sendActivity("⏳ Хайж байна...");

            // GRAPH TOKEN
            const graphToken = process.env.GRAPH_TOKEN;

            // SharePoint дээрээс хайна
            let spResults = "";
            try {
                const result = await searchSharePoint(graphToken, userText);

                if (result?.value?.[0]?.hitsContainers?.[0]?.hits) {
                    result.value[0].hitsContainers[0].hits.forEach(hit => {
                        spResults += (hit.summary || "") + "\n";
                    });
                } else {
                    spResults = "Тохирох контент олдсонгүй.";
                }
            } catch (err) {
                console.error("SharePoint Error:", err);
                spResults = "SharePoint хайлт ажиллахад алдаа гарлаа.";
            }

            // AI-аас хариу авах
            const finalAnswer = await askAI(userText, spResults);

            await context.sendActivity(finalAnswer);

            await next();
        });

        // User added to chat → Welcome
        this.onMembersAdded(async (context, next) => {
            const welcome = "Сайн байна уу! 😊 Би байгууллагын дүрэм, журам, стандартуудаас мэдээлэл хайж өгдөг AI бот.";
            await context.sendActivity(welcome);
            await next();
        });
    }
}

module.exports.TeamsAIBot = TeamsAIBot;
