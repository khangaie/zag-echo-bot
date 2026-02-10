// ai/intentDetector.js
function detectIntent(question = '') {
  const q = String(question || '').toLowerCase();

  // 1) хэрэглэгч алхам/процесс хүссэн эсэх (explicit)
  const needSteps = /(\bалхам\b|\bурсгал\b|\bпроцесс\b|\bworkflow\b|\bbpmn\b|\bflowchart\b|\bdiagram\b)/i.test(q);

  // 2) домэйн түлхүүрүүд
  const isContract = /(гэрээ|contract|заалт|нэмэлт|appendix|нөхцөл|торгууль|хугацаа|үнэ)/i.test(q);
  const isHSE = /(hse|osha|аюулгүй|эрсдэл|осол|ppe|permit|standard|стандарт|журам|заавар)/i.test(q);
  const isHR = /(hr|ажилтан|цалин|чөлөө|амралт|ажлын\s*цаг|албан\s*тушаал|сонгон\s*шалгаруулалт|томилгоо)/i.test(q);
  const isProject = /(project|төсл(и|ий)|smc|oyutolgoi|ot|scope|schedule|timeline|wbs)/i.test(q);

  // ✅ Чухал өөрчлөлт:
  // "процесс/алхам" гэж орсон бол domain-ийг process болгоно (гэрээ байсан ч process route хэрэгтэй)
  let domain = 'general';
  if (needSteps) {
    domain = 'process';
  } else if (isContract) {
    domain = 'contract';
  } else if (isHSE) {
    domain = 'hse';
  } else if (isHR) {
    domain = 'hr';
  } else if (isProject) {
    domain = 'project';
  } else if (/(процесс|урсгал|workflow)/i.test(q)) {
    domain = 'process';
  }

  return { domain, needSteps, isContract, isProject };
}

module.exports = { detectIntent };
