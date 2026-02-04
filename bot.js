const { ActivityHandler, CardFactory } = require('botbuilder');
const { searchSharePoint } = require('./graph/sharepointSearch');
const { getGraphToken } = require('./graph/tokens');   // <-- танай токен авах файл

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    // 👋 Анх холбогдсон хэрэглэгчдэд танилцуулга өгөх хэсэг
    this.onMembersAdded(async (context, next) => {
      const welcome = 
        "👋 Сайн байна уу?\n\n" +
        "Би **Заг Инженеринг ХХК**‑ийн хиймэл оюун ухааны туслах бот байна.\n" +
        "📚 Манай байгууллагын мэдлэгийн сан, SharePoint‑ийн баримтуудаас хайлт хийж танд шаардлагатай мэдээллийг олж өгдөг.\n\n" +
        "Та асуултаа бичээрэй, би туслахад бэлэн байна 😊";

      await context.sendActivity(welcome);
      await next();
    });

    // ✉️ Хэрэглэгч мессеж бичих үед
    this.onMessage(async (context, next) => {
      const question = (context.activity.text || '').trim();

      // Хоосон мессеж хамгаалах
      if (!question) {
        await context.sendActivity('❓ Асуултаа бичнэ үү.');
        return await next();
      }

      await context.sendActivity('🔎 SharePoint баримт хайж байна…');

      try {
        // Token
        const accessToken = await getGraphToken();

        // Хайлт
        const spFiles = await searchSharePoint(question, accessToken);

        if (!spFiles || spFiles.length === 0) {
          await context.sendActivity('⚠️ Хайлтаар баримт олдсонгүй.');
          return await next();
        }

        // Үр дүнгийн жагсаалт
        const lines = spFiles
          .map((f, i) => `${i + 1}. [${f.name}](${f.webUrl || '#'})`)
          .join('\n');

        await context.sendActivity(lines);

      } catch (e) {
        console.error('onMessage error:', e);
        await context.sendActivity('🚨 Дотоод алдаа гарлаа. Дараа дахин оролдоно уу.');
      }

      await next();
    });
  }
}

module.exports = ZAGBot;
