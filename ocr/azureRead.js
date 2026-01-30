const axios = require('axios');
const VISION_ENDPOINT = process.env.VISION_ENDPOINT;
const VISION_KEY = process.env.VISION_KEY;
async function extractTextWithOCR(buffer) {
 // 1. Submit OCR job
 const submitRes = await axios.post(
   `${VISION_ENDPOINT}/vision/v3.2/read/analyze`,
   buffer,
   {
     headers: {
       'Ocp-Apim-Subscription-Key': VISION_KEY,
       'Content-Type': 'application/pdf'
     }
   }
 );
 const operationLocation = submitRes.headers['operation-location'];
 if (!operationLocation) {
   throw new Error('OCR operation-location not returned');
 }
 // 2. Poll result
 let result;
 for (let i = 0; i < 10; i++) {
   await new Promise(r => setTimeout(r, 1500));
   const res = await axios.get(operationLocation, {
     headers: {
       'Ocp-Apim-Subscription-Key': VISION_KEY
     }
   });
   if (res.data.status === 'succeeded') {
     result = res.data;
     break;
   }
 }
 if (!result) {
   throw new Error('OCR processing timeout');
 }
 // 3. Extract text
 const lines =
   result.analyzeResult.readResults
     .flatMap(p => p.lines.map(l => l.text));
 return lines.join('\n');
}
module.exports = { extractTextWithOCR };
