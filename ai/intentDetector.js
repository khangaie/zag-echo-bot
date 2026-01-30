function detectIntent(question) {
 const q = question.toLowerCase();
 if (q.includes('яаж') || q.includes('алхам') || q.includes('процесс')) {
   return 'process';
 }
 if (
   q.includes('журам') ||
   q.includes('дүрэм') ||
   q.includes('standard') ||
   q.includes('hse')
 ) {
   return 'policy';
 }
 if (
   q.includes('гэрээ') ||
   q.includes('contract') ||
   q.includes('заалт')
 ) {
   return 'contract';
 }
 return 'general';
}
module.exports = { detectIntent };
