function buildCopilotResponse({
  question,
  files,
  extractedTextMap, // { fileId: text }
  ocrUsed
}) {
  // --- SUMMARY ---
  const summaries = files.map(f => {
    const text = extractedTextMap[f.id];
    if (!text) {
      return `📄 **${f.name}** — scanned файл тул бүрэн текст унших боломжгүй.`;
    }
    return `📄 **${f.name}** — ${text.slice(0, 500)}...`;
  });

  // --- CONFIDENCE ---
  let confidence = 30;
  if (files.length > 0) confidence += 30;
  if (Object.keys(extractedTextMap).length > 0) confidence += 20;
  if (ocrUsed) confidence += 10;
  if (confidence > 95) confidence = 95;

  // --- SUGGESTED QUESTIONS ---
  const suggestedQuestions = generateSuggestedQuestions(extractedTextMap);

  return {
    answer: `
🧠 **Товч тайлбар (Copilot summary)**  
${summaries.join("\n\n")}

📎 **Ашигласан баримтууд**
${files.map(f => `• ${f.name}`).join("\n")}

💡 **Санал болгох асуултууд**
${suggestedQuestions.map(q => `• ${q}`).join("\n")}

📊 **Confidence score: ${confidence}%**
${ocrUsed ? "⚠️ OCR ашигласан тул зарим хэсэг алдаатай байж магадгүй." : ""}
`
  };
}

function generateSuggestedQuestions(extractedTextMap) {
  const text = Object.values(extractedTextMap).join(" ").toLowerCase();

  const questions = [];

  if (text.includes("гэрээ")) {
    questions.push("Гэрээ байгуулах процессын алхмуудыг жагсааж өгөөч");
    questions.push("Гэрээнд аль алба хариуцдаг вэ?");
  }
  if (text.includes("баталгааж")) {
    questions.push("Гэрээ баталгаажуулалт хэдэн шаттай вэ?");
  }
  if (text.includes("санхүү")) {
    questions.push("Санхүүгийн алба аль шатанд оролцдог вэ?");
  }

  questions.push("Энэ процессын чеклист гаргаж өгөөч");
  questions.push("Энэ процесс ISO / PMBOK-той нийцэж байна уу?");

  return [...new Set(questions)];
}

module.exports = { buildCopilotResponse };
