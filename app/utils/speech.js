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
// Pin ORT's WASM glue to the CDN — Vite's dev-server import analysis
// mangles the library's own dynamic imports of these files otherwise.
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

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

// ─── KittenTTS session + per-session audio cache ────────────────────────────

let ttsPromise = null;
let kittenFailed = false;

function markKittenFailed(e) {
  kittenFailed = true;
  try {
    localStorage.setItem('kitten-error', String(e));
  } catch {
    // ignore
  }
}

const firstHalfCount = (len) => Math.ceil(len / 2);
/** key (question index) -> RawAudio from kitten-tts-js */
const preparedCache = new Map();

function getTTS() {
  ttsPromise ??= KittenTTS.from_pretrained(MODEL, { voice: VOICE });
  return ttsPromise;
}

/** Pre-loads the KittenTTS model so synthesis starts instantly later. */
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

/**
 * Synthesizes the first half of the questions ahead of play — enough for the
 * loader to clear quickly. Returns true when the Kitten voice is usable.
 */
export async function prepareVoiceFirstHalf(questions) {
  preparedCache.clear();
  let tts;
  try {
    tts = await getTTS();
  } catch (e) {
    markKittenFailed(e);
    return false;
  }
  const count = firstHalfCount(questions.length);
  try {
    for (let i = 0; i < count; i++) {
      preparedCache.set(
        i,
        await tts.generate(questionToSpeech(questions[i]), { voice: VOICE }),
      );
    }
    return true;
  } catch (e) {
    markKittenFailed(e);
    return false;
  }
}

/** Lets the browser paint between background synthesis steps. */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Synthesizes the remaining questions in the background, yielding to the UI
 * thread between items. Resolves true when everything is cached.
 */
export async function prepareVoiceRest(questions) {
  if (kittenFailed) return false;
  let tts;
  try {
    tts = await getTTS();
  } catch {
    return false;
  }
  for (let i = 0; i < questions.length; i++) {
    await breathe();
    if (preparedCache.has(i)) continue;
    try {
      preparedCache.set(
        i,
        await tts.generate(questionToSpeech(questions[i]), { voice: VOICE }),
      );
    } catch (e) {
      markKittenFailed(e);
      return false;
    }
  }
  return true;
}

export function hasVoiceAt(index) {
  return preparedCache.has(index);
}

/**
 * Plays the prepared audio for question `index`. When the Kitten cache lacks
 * it (or KittenTTS failed), falls back to browser Web Speech.
 */
export async function playVoiceAt(index, question) {
  if (kittenFailed) {
    await speakWithBrowser(question);
    return;
  }
  let audio = preparedCache.get(index);
  if (!audio) {
    // raced ahead of the background pass — synthesize just this one now
    try {
      const tts = await getTTS();
      audio = await tts.generate(questionToSpeech(question), { voice: VOICE });
      preparedCache.set(index, audio);
    } catch (e) {
      markKittenFailed(e);
      await speakWithBrowser(question);
      return;
    }
  }
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
