/**
 * Soroban curriculum: four elements (Water / Earth / Air / Fire) split into
 * twenty ordered stages. Each stage drills exactly one technique, mirroring
 * the "Abacus Mind Math" progression — one formula family at a time.
 *
 * A question is { operands: number[], operators: ('+'|'-'|'*'|'/')[], answer, note }.
 * `note` names the soroban technique the question exercises.
 *
 * Generators accept { mind }: Mind Mode caps operand width and chain length
 * so problems stay mental-math sized, and the practice UI hides the abacus.
 */

import {
  buildBorrowOperand,
  buildCarryOperand,
  simulateAdd,
  simulateSub,
} from './soroban-engine';

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[rand(0, arr.length - 1)];

function evaluate(operands, operators) {
  let answer = operands[0];
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];
    if (op === '+') answer += operands[i + 1];
    else if (op === '-') answer -= operands[i + 1];
    else if (op === '*') answer *= operands[i + 1];
    else if (op === '/') answer /= operands[i + 1];
  }
  return answer;
}

function question(operands, operators, note) {
  return { operands, operators, answer: evaluate(operands, operators), note };
}

const nDigits = (n, min = 1) => rand(min, 10 ** n - 1);
const toDigits = (n) => String(n).split('').reverse().map(Number);
const fromDigits = (cols) => Number(cols.slice().reverse().join(''));

// ---- Water ----------------------------------------------------------------

/** Two one-digit numbers whose sum stays on one rod (no friend needed). */
function genSingleAdd() {
  return question(
    [rand(1, 4), rand(1, 9 - 5)],
    ['+'],
    'Simple addition — push earth beads up.',
  );
}

/** Small friend of 5, addition side: +n = +5 −(5−n). */
function genSmallFriendAdd() {
  const a = rand(1, 4);
  const b = rand(Math.max(1, 5 - a), 4);
  return question(
    [a, b],
    ['+'],
    'Small friend of 5 — set the heaven bead, take the complement back.',
  );
}

/** Small friend of 5, subtraction side: −n = −5 +(5−n). */
function genSmallFriendSub() {
  const earth = rand(0, 3); // heaven up plus this much earth
  const a = 5 + earth;
  const b = rand(earth + 1, 4); // more than the earth beads alone can give
  return question(
    [a, b],
    ['-'],
    'Small friend of 5 — drop the heaven bead, add the complement.',
  );
}

/** Two or three two-digit numbers, no column exceeds 9 (pure earth-bead work). */
function genTwoDigitNoCarry() {
  const terms = rand(2, 3);
  const ones = Array.from({ length: terms }, () =>
    rand(0, Math.floor(8 / terms)),
  );
  const tens = Array.from({ length: terms }, () =>
    rand(1, Math.floor(8 / terms)),
  );
  const operands = tens.map((t, i) => t * 10 + ones[i]);
  return question(
    operands,
    Array.from({ length: terms - 1 }, () => '+'),
    'No carries — each rod holds its own.',
  );
}

// ---- Earth & Air: formula-forcing stages ----------------------------------

/**
 * Addition stage forcing big-friend carries of the given digit(s).
 * Every added operand provably triggers the target carry somewhere
 * (verified by simulating the rods), other columns get light spice.
 */
function genCarryStage(digits, opts = {}) {
  const mind = !!opts.mind;
  const L = mind ? 2 : rand(2, 3);
  const extraOperands = mind ? rand(1, 3) : rand(2, 4); // total ≤ 4 / ≤ 5 numbers
  const targets = Array.isArray(digits) ? digits : [digits];

  let total = toDigits(nDigits(L, 10 ** (L - 1)));
  const firstOperand = fromDigits(total);
  const operands = [];
  for (let s = 0; s < extraOperands; s++) {
    if (total.length > L) break; // keep every operand within stage width
    const b = buildCarryOperand(total, () => pick(targets));
    if (!b) break;
    total = simulateAdd(total, b).digits;
    operands.push(fromDigits(b));
  }
  if (operands.length === 0) {
    // guaranteed fallback: single-column pure drill
    const d = pick(targets);
    const a = rand(10 - d, 9);
    return question([a, d], ['+'], noteFor(digits));
  }
  return question(
    [firstOperand, ...operands],
    operands.map(() => '+'),
    noteFor(digits),
  );
}

function noteFor(digits) {
  if (Array.isArray(digits)) {
    return 'Big friend of 10 — trade a ten to the left rod.';
  }
  const fix = 10 - digits;
  return `Big friend of 10: +${digits} = −${fix} +10.`;
}

/**
 * Subtraction stage forcing borrows of the given digit(s).
 * Mirrors genCarryStage on the borrow side.
 */
function genBorrowStage(digits, opts = {}) {
  const mind = !!opts.mind;
  const L = mind ? rand(2, 3) : rand(3, 3);
  const extraOperands = mind ? rand(1, 4) : rand(2, 5); // total ≤ 5 / ≤ 6 numbers
  const targets = Array.isArray(digits) ? digits : [digits];

  let current = toDigits(nDigits(L, 10 ** (L - 1)));
  const firstOperand = fromDigits(current);
  const operands = [];
  for (let s = 0; s < extraOperands; s++) {
    const b = buildBorrowOperand(current, () => pick(targets));
    if (!b) break;
    const result = simulateSub(current, b);
    if (!result) break;
    current = result.digits;
    operands.push(fromDigits(b));
  }
  if (operands.length === 0) {
    const d = pick(targets);
    const ones = rand(0, d - 1);
    const a = rand(d, 9) * 10 + ones;
    return question([a, d], ['-'], borrowNote(digits));
  }
  return question(
    [firstOperand, ...operands],
    operands.map(() => '-'),
    borrowNote(digits),
  );
}

function borrowNote(digits) {
  if (Array.isArray(digits)) {
    return 'Not enough beads — borrow a ten from the left.';
  }
  const fix = 10 - digits;
  return `Borrow a ten: −${digits} = −10 +${fix}.`;
}

/** Subtraction whose borrows cascade across ≥ 2 columns (e.g. 302 − 154). */
function genCascadeBorrow(opts = {}) {
  const L = opts.mind ? 3 : rand(3, 4);
  for (let attempt = 0; attempt < 400; attempt++) {
    const a = nDigits(L, 10 ** (L - 1));
    const b = nDigits(a - 1 >= 10 ** (L - 1) ? L - 1 : 1, 1);
    if (b < 10 ** (L - 2)) continue; // keep both operands same-ish width
    // measure the longest consecutive borrow run
    const da = toDigits(a);
    const db = toDigits(b);
    let owe = 0;
    let run = 0;
    let best = 0;
    let ok = true;
    for (let j = 0; j < L; j++) {
      const avail = da[j] - owe;
      if (avail < db[j]) {
        run++;
        best = Math.max(best, run);
        owe = 1;
      } else {
        run = 0;
        owe = 0;
      }
      if (j === L - 1 && owe) ok = false; // would go negative overall
    }
    if (ok && best >= 2 && a - b > 0) {
      return question(
        [a, b],
        ['-'],
        'Cascade borrow — the ten you borrow may itself need another.',
      );
    }
  }
  // deterministic fallback with a known cascade
  return question(
    [opts.mind ? 103 : 1003, opts.mind ? 58 : 558],
    ['-'],
    'Cascade borrow — the ten you borrow may itself need another.',
  );
}

// ---- longer chains --------------------------------------------------------

/** Three to five two-/three-digit numbers added together. */
function genLongAddition(opts = {}) {
  const mind = !!opts.mind;
  const terms = mind ? rand(3, 4) : rand(3, 5);
  const digits = mind ? 2 : terms <= 3 ? rand(2, 3) : 2;
  const operands = Array.from({ length: terms }, () =>
    nDigits(digits, 10 ** (digits - 1)),
  );
  return question(
    operands,
    Array.from({ length: terms - 1 }, () => '+'),
    'Chain addition — keep your place value.',
  );
}

/** Two-digit subtrahend whose every digit fits under the minuend's (no borrow). */
function genSubNoBorrow() {
  const a = nDigits(2, 10);
  let b;
  do {
    const ones = rand(0, Math.min(a % 10, 9));
    const tens = rand(0, Math.floor(a / 10));
    b = tens * 10 + ones;
  } while (b < 1);
  return question(
    [a, b],
    ['-'],
    'No borrowing — take beads straight back down.',
  );
}

/** Mixed chain of 3–5 additions/subtractions, running total never negative. */
function genMixedChain(opts = {}) {
  const mind = !!opts.mind;
  const terms = mind ? rand(3, 4) : rand(3, 5);
  const operators = [];
  const operands = [nDigits(2, 10)];
  let running = operands[0];
  for (let i = 1; i < terms; i++) {
    const canSubtract = running > 15;
    const op = canSubtract ? pick(['+', '-']) : '+';
    let v;
    do {
      v = nDigits(2, 10);
    } while (op === '-' && running - v < 0);
    operators.push(op);
    operands.push(v);
    running += op === '+' ? v : -v;
  }
  return question(
    operands,
    operators,
    'Mixed chain — track the running total in your head.',
  );
}

// ---- Fire: multiplication & division -------------------------------------

/** Abacus-style long multiplication: multi-digit × one digit. */
function genMultiply(opts = {}) {
  const mind = !!opts.mind;
  const a = mind ? rand(12, 49) : rand(12, 99);
  const b = rand(2, 9);
  return question(
    [a, b],
    ['*'],
    'Multiplication — add partial products left to right.',
  );
}

/** Exact division: dividend ÷ divisor with a whole-number quotient. */
function genDivide(opts = {}) {
  const mind = !!opts.mind;
  const divisor = rand(2, 9);
  const quotient = mind ? rand(11, 49) : rand(11, 99);
  return question(
    [divisor * quotient, divisor],
    ['/'],
    'Division — subtract the divisor in chunks.',
  );
}

// ---- curriculum -----------------------------------------------------------

export const ELEMENTS = [
  {
    id: 'water',
    name: 'Water',
    emoji: '💧',
    tagline: 'Flow — smooth beads, no formulas yet',
  },
  {
    id: 'earth',
    name: 'Earth',
    emoji: '🌍',
    tagline: 'Building — big-friend carries',
  },
  {
    id: 'air',
    name: 'Air',
    emoji: '🌬️',
    tagline: 'Letting go — big-friend borrows',
  },
  {
    id: 'fire',
    name: 'Fire',
    emoji: '🔥',
    tagline: 'Mastery — everything at once',
  },
];

export const LEVELS = [
  // 💧 Water — book level 1
  {
    id: 'single-add',
    element: 'water',
    name: 'Single-Digit Addition',
    blurb: 'Two one-digit numbers, plain bead pushes.',
    gen: genSingleAdd,
  },
  {
    id: 'sf-add',
    element: 'water',
    name: 'Small Friends · Addition',
    blurb: 'Every sum needs +n = +5 −(5−n).',
    gen: genSmallFriendAdd,
  },
  {
    id: 'sf-sub',
    element: 'water',
    name: 'Small Friends · Subtraction',
    blurb: 'Every take-away needs −n = −5 +(5−n).',
    gen: genSmallFriendSub,
  },
  {
    id: 'add-2d-plain',
    element: 'water',
    name: 'Two-Digit, No Carries',
    blurb: 'Column work where every rod stays calm.',
    gen: genTwoDigitNoCarry,
  },
  // 🌍 Earth — book level 2
  {
    id: 'carry-9',
    element: 'earth',
    name: 'Carries · +9',
    blurb: 'Big friend: +9 = −1 +10.',
    gen: (o) => genCarryStage(9, o),
  },
  {
    id: 'carry-8',
    element: 'earth',
    name: 'Carries · +8',
    blurb: 'Big friend: +8 = −2 +10.',
    gen: (o) => genCarryStage(8, o),
  },
  {
    id: 'carry-7',
    element: 'earth',
    name: 'Carries · +7',
    blurb: 'Big friend: +7 = −3 +10, plain or combined.',
    gen: (o) => genCarryStage(7, o),
  },
  {
    id: 'carry-6',
    element: 'earth',
    name: 'Carries · +6',
    blurb: 'Big friend: +6 = −4 +10, plain or combined.',
    gen: (o) => genCarryStage(6, o),
  },
  {
    id: 'carry-easy',
    element: 'earth',
    name: 'Carries · +5…+1',
    blurb: 'Pure big-friend carries, all five easy digits.',
    gen: (o) => genCarryStage([5, 4, 3, 2, 1], o),
  },
  {
    id: 'long-add',
    element: 'earth',
    name: 'Long Addition',
    blurb: 'Three-plus numbers chained together.',
    gen: genLongAddition,
  },
  {
    id: 'sub-plain',
    element: 'earth',
    name: 'Subtraction, No Borrowing',
    blurb: 'Take beads straight back down.',
    gen: genSubNoBorrow,
  },
  // 🌬️ Air — book level 3
  {
    id: 'borrow-9',
    element: 'air',
    name: 'Borrows · −9',
    blurb: 'Borrow a ten: −9 = −10 +1.',
    gen: (o) => genBorrowStage(9, o),
  },
  {
    id: 'borrow-8',
    element: 'air',
    name: 'Borrows · −8',
    blurb: 'Borrow a ten: −8 = −10 +2.',
    gen: (o) => genBorrowStage(8, o),
  },
  {
    id: 'borrow-7',
    element: 'air',
    name: 'Borrows · −7',
    blurb: '−7 = −10 +3, concept and small-friend forms.',
    gen: (o) => genBorrowStage(7, o),
  },
  {
    id: 'borrow-6',
    element: 'air',
    name: 'Borrows · −6',
    blurb: '−6 = −10 +4, concept and small-friend forms.',
    gen: (o) => genBorrowStage(6, o),
  },
  {
    id: 'borrow-easy',
    element: 'air',
    name: 'Borrows · −5…−1',
    blurb: 'Pure borrows across all five easy digits.',
    gen: (o) => genBorrowStage([5, 4, 3, 2, 1], o),
  },
  {
    id: 'borrow-multi',
    element: 'air',
    name: 'Multi-Place Borrowing',
    blurb: 'Cascades that roll from ones toward hundreds.',
    gen: genCascadeBorrow,
  },
  // 🔥 Fire — mastery tier
  {
    id: 'mixed-chain',
    element: 'fire',
    name: 'Mixed Chains',
    blurb: 'Adds and takes-aways interleaved.',
    gen: genMixedChain,
  },
  {
    id: 'multiply',
    element: 'fire',
    name: 'Multiplication',
    blurb: 'Partial products, stacked on the rods.',
    gen: genMultiply,
  },
  {
    id: 'divide',
    element: 'fire',
    name: 'Division',
    blurb: 'Chunked subtraction until nothing remains.',
    gen: genDivide,
  },
];

export function levelById(id) {
  return LEVELS.find((l) => l.id === id);
}

export function levelIndex(levelId) {
  return LEVELS.findIndex((l) => l.id === levelId);
}

export const OP_SIGNS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** Renders a question as a compact string, e.g. "34 + 27 − 8" or "6 × 7". */
export function formatQuestion(q) {
  return q.operands
    .map(String)
    .reduce(
      (str, operand, i) =>
        i === 0
          ? operand
          : `${str} ${OP_SIGNS[q.operators[i - 1]] ?? q.operators[i - 1]} ${operand}`,
      '',
    );
}
