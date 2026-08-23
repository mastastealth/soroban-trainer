/**
 * Dictation audio for math questions.
 *
 * Primary: KittenTTS (kitten-tts-js) — the official nano ONNX model running
 * fully client-side via onnxruntime-web, no server or Python. The model
 * (~25 MB) is fetched from HuggingFace on first use and cached by the
 * browser's Cache API.
 *
 * Fallback: browser Web Speech API if the model cannot load.
 */

import { KittenTTS } from 'kitten-tts-js';
// Serve ORT's WASM glue from vendored files inside the module graph — the
// dev server's import-analysis breaks dynamic imports of public-dir assets.
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = '/vendor/ort/';

const MODEL = 'KittenML/kitten-tts-nano-0.8';
const VOICE = 'Luna';
const OP_WORDS = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' };

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS_PREFIX = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

/** English words for whole numbers 0..9999 — matches our stage ranges. */
export function numberToWords(n) {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100)
    return TENS_PREFIX[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) {
    const head = `${ONES[Math.floor(n / 100)]} hundred`;
    return n % 100 ? `${head} and ${numberToWords(n % 100)}` : head;
  }
  const head = `${ONES[Math.floor(n / 1000)]} thousand`;
  return n % 1000 ? `${head} ${numberToWords(n % 1000)}` : head;
}

export function questionToSpeech(q) {
  return q.operands
    .map((n, i) => {
      if (i === 0) return numberToWords(n);
      const word = OP_WORDS[q.operators[i - 1]] ?? q.operators[i - 1];
      return `, ${word} ${numberToWords(n)}`;
    })
    .join('');
}

function getAudioContext() {
  const ctx = new AudioContext({ sampleRate: 24000 });
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function speakWithBrowser(q) {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve();
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(questionToSpeech(q));
  utterance.rate = 0.85;
  return new Promise((resolve) => {
    utterance.onend = resolve;
    utterance.onerror = resolve;
    synth.speak(utterance);
  });
}

let ttsPromise = null;
let kittenFailed = false;

function getTTS() {
  ttsPromise ??= KittenTTS.from_pretrained(MODEL, { voice: VOICE });
  return ttsPromise;
}

/** Pre-loads the KittenTTS model so the first Play click speaks quickly. */
export function preloadDictationVoice() {
  return getTTS().catch((e) => {
    kittenFailed = true;
    try {
      localStorage.setItem('kitten-error', String(e));
    } catch {
      // ignore
    }
  });
}

async function speakWithKitten(q) {
  const tts = await getTTS();
  const text = questionToSpeech(q);
  const audio = await tts.generate(text, { voice: VOICE });
  const ctx = getAudioContext();
  const buffer = audio.toAudioBuffer(ctx);
  await new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.onended = resolve;
    source.connect(ctx.destination);
    source.start();
  });
}

/** Speaks the question aloud; resolves when playback finishes. */
export async function speakQuestion(q) {
  if (!kittenFailed) {
    try {
      await speakWithKitten(q);
      return;
    } catch (e) {
      kittenFailed = true;
      try {
        localStorage.setItem('kitten-error', String(e));
      } catch {
        // ignore
      }
    }
  }
  await speakWithBrowser(q);
}
