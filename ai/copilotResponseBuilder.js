function buildCopilotResponse(data) {
 const text = Object.values(data.extractedTextMap).join('\n');
 const intent = data.intent;
 let steps = [];
 let bpmn = null;
 if (intent === 'process') {
   steps = extractProcessSteps(text);
   bpmn = buildBPMN(data.question, steps);
 }
 const summary =
   text.length > 0
     ? `${intent.toUpperCase()} баримтаас тайлбарлав`
     : 'Мэдээлэл олдсонгүй';
 return {
   adaptiveCard: buildCopilotAdaptiveCard({
     question: data.question,
     intent,
     summary,
     steps,
     bpmn,
     files: data.files,
     confidence: data.ocrUsed ? 92 : 98
   })
 };
}
