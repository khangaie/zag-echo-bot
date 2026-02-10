// ai/folderRouter.js
function resolveFolders(domain = 'general', question = '') {
  const q = String(question || '').toLowerCase();
  const hasContractWord = /(гэрээ|contract|заалт|нөхцөл)/i.test(q);

  switch (domain) {
    case 'process':
      // ✅ "гэрээ ... процесс" бол PROCESS + CONTRACT хоёрыг зэрэг хай
      return hasContractWord
        ? ['PROCESS-AI', 'CONTRACT-AI']
        : ['PROCESS-AI'];

    case 'hse':
      return ['HSE-AI'];

    case 'hr':
      return ['HR-AI'];

    case 'contract':
      // ✅ SMC гэрээ ихэвчлэн PROJECT-тай холбоотой байж болох тул project-ийг 2 дахь болгож нэмэж болно
      return ['CONTRACT-AI', 'PROJECT-AI'];

    case 'project':
      return ['PROJECT-AI', 'PROCESS-AI', 'CONTRACT-AI'];

    default:
      return ['PROCESS-AI', 'HSE-AI', 'HR-AI', 'CONTRACT-AI', 'PROJECT-AI'];
  }
}

module.exports = { resolveFolders };
