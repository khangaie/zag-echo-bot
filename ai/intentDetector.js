// ai/intentDetector.js
function detectIntent(question = '') {
  const q = String(question || '').toLowerCase();

  // ✅ Алхам хүссэн эсэх (зөвхөн explicit keyword үед)
  const needSteps = /(\bалхам\b|\bурсгал\b|\bпроцесс\b|\bworkflow\b|\bbpmn\b|\bflowchart\b|\bdiagram\b)/i.test(q);

  // ✅ Домэйн ангилалт (зөвхөн routing/фолдер сонгоход ашиглана)
  let domain = 'general';

  if (/(гэрээ|contract|заалт|нэмэлт|appendix|нөхцөл|торгууль|хугацаа|үнэ)/i.test(q)) {
    domain = 'contract';
  } else if (/(hse|osha|аюулгүй|эрсдэл|осол|ppe|permit|standard|стандарт|журам|заавар)/i.test(q)) {
    domain = 'hse';
  } else if (/(hr|ажилтан|цалин|чөлөө|амралт|ажлын\s*цаг|албан\s*тушаал|сонгон\s*шалгаруулалт|томилгоо)/i.test(q)) {
    domain = 'hr';
  } else if (/(project|төсл(и|ий)|smc|oyutolgoi|ot|scope|schedule|timeline|wbs)/i.test(q)) {
    domain = 'project';
  } else if (/(процесс|урсгал|workflow|алхам)/i.test(q)) {
    domain = 'process';
  }

  return { domain, needSteps };
}

module.exports = { detectIntent };
