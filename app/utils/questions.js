/**
 * Soroban curriculum: ordered levels and deterministic-shape question generators.
 *
 * A question is { operands: number[], operators: ('+'|'-')[], answer, note }.
 * `note` names the soroban technique the question exercises (shown after answering).
 */

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[rand(0, arr.length - 1)];

function evaluate(operands, operators) {
  let answer = operands[0];
  for (let i = 0; i < operators.length; i++) {
    answer += operators[i] === '+' ? operands[i + 1] : -operands[i + 1];
  }
  return answer;
}

function question(operands, operators, note) {
  return { operands, operators, answer: evaluate(operands, operators), note };
}

const nDigits = (n, min = 1) => rand(min, 10 ** n - 1);

/** Two one-digit numbers whose sum stays on one rod (no friend needed). */
function genSingleAdd() {
  return question(
    [rand(1, 4), rand(1, 9 - 5)],
    ['+'],
    'Simple addition — push earth beads up.',
  );
}

/** Two one-digit numbers needing a small friend (of 5) or big friend (of 10). */
function genFriendsAdd() {
  const kind = rand(0, 2);
  let a;
  let b;
  if (kind === 0) {
    // small friend: sum between 6 and 9 (earth beads alone can't hold it)
    a = rand(2, 4);
    b = rand(6 - a, 9 - a);
  } else if (kind === 1) {
    // big friend: sum between 11 and 18 (crosses the tens rod)
    a = rand(2, 9);
    b = rand(Math.max(2, 11 - a), 18 - a);
  } else {
    // free mix, but still guaranteed to need a friend
    do {
      a = rand(1, 9);
      b = rand(1, 9);
    } while (a + b < 5);
  }
  const sum = a + b;
  return question(
    [a, b],
    ['+'],
    sum >= 10
      ? 'Big friend of 10 — set the carry.'
      : 'Small friend of 5 — use the heaven bead.',
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

/** Two-digit addition guaranteeing at least one carry (big friend). */
function genTwoDigitCarry() {
  const a = nDigits(2, 10);
  const b = nDigits(2, 10);
  return question(
    [a, b],
    ['+'],
    (a % 10) + (b % 10) >= 10
      ? 'Ones rod overflows — big friend of 10.'
      : 'Tens rod overflows — carry into hundreds.',
  );
}

/** Three to five two-/three-digit numbers added together. */
function genLongAddition() {
  const terms = rand(3, 5);
  const digits = terms <= 3 ? rand(2, 3) : 2;
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

/** Subtraction guaranteed to need a borrow (big friend backwards). */
function genSubBorrow() {
  const tensA = rand(2, 9);
  const onesA = rand(0, 4);
  const a = tensA * 10 + onesA;
  const onesB = rand(onesA + 1, 9);
  const tensB = rand(0, tensA - 1);
  const b = tensB * 10 + onesB;
  return question(
    [a, b],
    ['-'],
    'Not enough ones — borrow a ten (big friend).',
  );
}

/** Mixed chain of 3–5 additions/subtractions, running total never negative. */
function genMixedChain() {
  const terms = rand(3, 5);
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
    'Mixed chain — track the running total on your soroban.',
  );
}

export const LEVELS = [
  {
    id: 'single-add',
    name: 'Single-Digit Addition',
    blurb: 'Two one-digit numbers, no friends needed yet.',
    gen: genSingleAdd,
  },
  {
    id: 'friends',
    name: 'Friends of 5 & 10',
    blurb: 'One-digit pairs that need small and big friends.',
    gen: genFriendsAdd,
  },
  {
    id: 'add-2d-plain',
    name: 'Two-Digit Addition (no carries)',
    blurb: 'Two or three two-digit numbers, every rod stays in range.',
    gen: genTwoDigitNoCarry,
  },
  {
    id: 'add-2d-carry',
    name: 'Two-Digit Addition (carries)',
    blurb: 'Two-digit sums that force big-friend carries.',
    gen: genTwoDigitCarry,
  },
  {
    id: 'long-add',
    name: 'Long Addition',
    blurb: 'Three to five numbers chained together.',
    gen: genLongAddition,
  },
  {
    id: 'sub-plain',
    name: 'Subtraction (no borrowing)',
    blurb: 'Take beads straight back down, no borrowing.',
    gen: genSubNoBorrow,
  },
  {
    id: 'sub-borrow',
    name: 'Subtraction (borrowing)',
    blurb: 'Borrowing tens via the big friend.',
    gen: genSubBorrow,
  },
  {
    id: 'mixed-chain',
    name: 'Mixed Chains',
    blurb: 'Three to five numbers mixing + and −.',
    gen: genMixedChain,
  },
];

export function levelById(id) {
  return LEVELS.find((l) => l.id === id);
}

export function levelIndex(levelId) {
  return LEVELS.findIndex((l) => l.id === levelId);
}

/** Renders a question as a compact string, e.g. "34 + 27 − 8". */
export function formatQuestion(q) {
  return q.operands
    .map(String)
    .reduce(
      (str, operand, i) =>
        i === 0
          ? operand
          : `${str} ${q.operators[i - 1] === '-' ? '−' : '+'} ${operand}`,
      '',
    );
}
