/**
 * Web Speech API helper: reads a math question aloud for dictation practice.
 * Numbers are spoken naturally by the TTS engine ("45" → "forty-five");
 * operators become words wrapped in commas so the voice pauses briefly
 * between terms. Falls back to a no-op where speech is unavailable.
 */

const OP_WORDS = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' };

export function questionToSpeech(q) {
  return q.operands
    .map((n, i) =>
      i === 0
        ? `${n}`
        : `, ${OP_WORDS[q.operators[i - 1]] ?? q.operators[i - 1]}, ${n}`,
    )
    .join(' ');
}

/** Speaks the question slowly; resolves when the utterance finishes. */
export function speakQuestion(q) {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(questionToSpeech(q));
  utterance.rate = 0.85;
  utterance.pitch = 1;
  return new Promise((resolve) => {
    utterance.onend = resolve;
    utterance.onerror = resolve;
    synth.speak(utterance);
  });
}
