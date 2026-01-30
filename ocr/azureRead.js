const { FormRecognizerClient, AzureKeyCredential } =
  require("@azure/ai-form-recognizer");

async function readWithOCR(fileUrl) {
  const endpoint = process.env.AZURE_FORM_ENDPOINT;
  const key = process.env.AZURE_FORM_KEY;

  if (!endpoint || !key) {
    return { text: "", confidence: 0 };
  }

  const client = new FormRecognizerClient(
    endpoint,
    new AzureKeyCredential(key)
  );

  const poller = await client.beginRecognizeContentFromUrl(fileUrl);
  const pages = await poller.pollUntilDone();

  let text = "";
  pages.forEach(p =>
    p.lines.forEach(l => (text += l.text + "\n"))
  );

  return {
    text,
    confidence: 0.95
  };
}

module.exports = { readWithOCR };
