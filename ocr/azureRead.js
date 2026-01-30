const axios = require('axios');
const endpoint = process.env.VISION_ENDPOINT;
const key = process.env.VISION_KEY;
async function extractTextWithOCR(buffer) {
 const analyzeUrl = `${endpoint}/vision/v3.2/read/analyze`;
 const res = await axios.post(analyzeUrl, buffer, {
   headers: {
     'Ocp-Apim-Subscription-Key': key,
     'Content-Type': 'application/pdf'
   }
 });
 const operationUrl = res.headers['operation-location'];
 // poll result
 let result;
 for (let i = 0; i < 10; i++) {
   await new Promise(r => setTimeout(r, 1500));
   const poll = await axios.get(operationUrl, {
     headers: { 'Ocp-Apim-Subscription-Key': key }
   });
   if (poll.data.status === 'succeeded') {
     result = poll.data;
     break;
   }
 }
 if (!result) return '';
 return result.analyzeResult.readResults
   .flatMap(p => p.lines.map(l => l.text))
   .join('\n');
}
module.exports = { extractTextWithOCR };
