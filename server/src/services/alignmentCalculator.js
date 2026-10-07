export function calculateAlignment(originalText, timestamps, totalDuration) {
  const sentences = splitIntoSentences(originalText);
  const alignment = [];
  
  let timestampIndex = 0;
  let currentSentenceStart = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceWords = sentence.trim().split(/\s+/).filter(w => w.length > 0);
    let sentenceEndTime = 0;
    let wordCount = 0;
    
    while (timestampIndex < timestamps.length && wordCount < sentenceWords.length) {
      const ts = timestamps[timestampIndex];
      const word = ts.word.toLowerCase().replace(/[^\w]/g, '');
      const expectedWord = sentenceWords[wordCount]?.toLowerCase().replace(/[^\w]/g, '');
      
      if (word === expectedWord || wordCount === 0) {
        if (wordCount === 0) {
          currentSentenceStart = ts.start;
        }
        sentenceEndTime = ts.end;
        wordCount++;
      }
      timestampIndex++;
    }
    
    if (wordCount === 0 && timestamps.length > 0) {
      currentSentenceStart = timestamps[0].start;
      sentenceEndTime = timestamps[0].end;
    }
    
    alignment.push({
      sentenceIndex: i,
      text: sentence.trim(),
      startTime: currentSentenceStart,
      endTime: sentenceEndTime,
    });
  }
  
  if (alignment.length > 0) {
    alignment[alignment.length - 1].endTime = totalDuration;
  }
  
  return alignment;
}

function splitIntoSentences(text) {
  return text
    .replace(/[#*`_\[\]]/g, '')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);
}