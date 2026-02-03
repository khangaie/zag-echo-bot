// bot.js
const { ActivityHandler } = require('botbuilder');

// Танай туслах модуль – нэршлийг зурагтай нь таарууллаа.
// Эдгээр файлууд танай репод байгаа гэдгийг урьдчилан үзсэн (graphToken.js, sharepointSearch.js)
const { getGraphToken } = require('./graphToken');
const { searchSharePoint } = require('./graph/sharepointSearch');

class ZAGBot extends ActivityHandler {
  constructor() {
    super();

    // Хэрэглэгч мессеж бичих болгонд SharePoint хайлт хийж хариулах
    this.onMessage(async (context, next) => {
      try {
        const question = (context.activity.text || '').trim();

        if (!question) {
          await context.sendActivity('❓ Асуултаа бичнэ үү.');
          await next();
          return;
        }

        await context.sendActivity('🔎 SharePoint баримт хайж байна...');

        // 1) Graph access token
        const accessToken = await getGraphToken();

        // 2) SharePoint хайлт
        const files = await searchSharePoint(question, accessToken);

        if (!files || files.length === 0) {
          await context.sendActivity('❌ Холбогдох баримт олдсонгүй.');
          await next();
          return;
        }

        // 3) Хариуг форматлах
        let reply = '📄 **Олдсон баримтууд:**\n\n';
        files.forEach((f, i) => {
          // f.name, f.url гэж буцдаг гэж таамаглаж байна — танай searchSharePoint‑ийн буцаах талбартай тааруулна уу
          reply += `${i + 1}. ${f.name}\n${f.url}\n\n`;
        });

        await context.sendActivity(reply);
      } catch (err) {
        console.error('BOT ERROR:', err);
        await context.sendActivity('⚠️ Алдаа гарлаа. Log stream-ийг шалгана уу.');
      }

      await next();
    });

    // Анх орж ирэхэд танилцуулга
    this.onMembersAdded(async (context, next) => {
      await context.sendActivity(
        [
          'Сайн байна уу! 👋',
          'Надад дараах байдлаар бичээд туршаарай:',
          '• "Саравч байгуулах норм хая" гэх мэт',
          '• "SharePoint баримт хайж өг"',
          '• "PDF / OCR баримт унш" (хэрэв дэмжсэн бол)',
          '→ Ай харуулъя 🔍',
        ].join('\n')
      );
      await next();
    });
  }
}

module.exports = { ZAGBot };
