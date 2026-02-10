// ai/folderRouter.js
function resolveFolders(domain = 'general') {
  switch (domain) {
    case 'contract':
      return ['CONTRACT-AI', 'PROJECT-AI']; // гэрээ + төслөөр хавсарсан баримт байж болно
    case 'process':
      return ['PROCESS-AI', 'CONTRACT-AI']; // "гэрээ ... процесс" үед хамт хэрэгтэй
    case 'project':
      return ['PROJECT-AI', 'PROCESS-AI', 'CONTRACT-AI'];
    case 'hse':
      return ['HSE-AI'];
    case 'hr':
      return ['HR-AI'];
    default:
      return ['PROCESS-AI', 'HSE-AI', 'HR-AI', 'CONTRACT-AI', 'PROJECT-AI'];
  }
}

module.exports = { resolveFolders };
