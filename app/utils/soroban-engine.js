/**
 * Soroban state simulator and formula-forcing problem builder.
 *
 * A rod column in canonical form is just its digit d (0..9):
 *   heaven bead up  ⇔ d >= 5,  earth beads up ⇔ d % 5.
 *
 * Move classification for ADDING u to column digit d:
 *   plain        — beads fit directly
 *   small        — small friend of 5: +u = +5 −(5−u)  (u ≤ 4, heaven free, earth short)
 *   big          — big friend of 10: +u = −(10−u) +10, fix removes plainly
 *   big-combined — the fix itself needs a small-friend move
 * SUBTRACTING u mirrors this: plain / small / borrow / borrow-combined.
 *
 * The builders here construct operand chains where every step provably uses
 * the stage's target formula at least once, verified by simulating the rods.
 */

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// ---- single-column predicates -------------------------------------------

export function canAddPlain(d, n) {
  if (n === 0) return true;
  const heaven = d >= 5;
  const earth = d % 5;
  if (heaven) return earth + n <= 4;
  return earth + (n >= 5 ? n - 5 : n) <= 4;
}

export function canRemovePlain(d, f) {
  if (f === 0) return true;
  const h = Math.floor(f / 5);
  const e = f % 5;
  return (h === 0 || d >= 5) && d % 5 >= e;
}

/** +n via the heaven bead: +n = +5 −(5−n). */
export function isSmallFriendAdd(d, n) {
  return n >= 1 && n <= 4 && d < 5 && d + n > 4;
}

/** −n via dropping the heaven bead: −n = −5 +(5−n). */
export function isSmallFriendSub(d, n) {
  return n >= 1 && n <= 4 && d >= 5 && d % 5 < n;
}

// ---- single-column moves -------------------------------------------------

/**
 * Add u to column d. Returns {carry, kind, next} — `next` is this column's
 * new digit; when `carry` is true one ten propagates to the left column.
 * `kind` names the technique the student must apply on this column.
 */
export function addMove(d, u) {
  if (d + u <= 9) {
    const kind = isSmallFriendAdd(d, u) ? 'small' : 'plain';
    return { carry: false, kind, next: d + u };
  }
  const fix = 10 - u;
  const kind = canRemovePlain(d, fix) ? 'big' : 'big-combined';
  return { carry: true, kind, next: d - fix };
}

/** Subtract u from column d; mirrors addMove with borrows to the left. */
export function subMove(d, u) {
  if (d >= u) {
    const kind = isSmallFriendSub(d, u) ? 'small' : 'plain';
    return { borrow: false, kind, next: d - u };
  }
  // borrow a ten from the left rod: this rod becomes d + 10, then take u
  const fix = 10 - u;
  const kind = canAddPlain(d, fix) ? 'borrow' : 'borrow-combined';
  return { borrow: true, kind, next: d + fix };
}

// ---- chain simulation ----------------------------------------------------

/**
 * Simulate adding every digit of `num` (ones-first array) onto `total`
 * (ones-first digits). Returns {digits, kinds} where kinds lists each move
 * applied, including cascade carries into new columns.
 */
export function simulateAdd(totalDigits, numDigits) {
  const cols = [...totalDigits];
  const kinds = [];
  let carry = 0;
  for (let j = 0; j < numDigits.length; j++) {
    while (cols.length <= j) cols.push(0);
    const r = addMove(cols[j], numDigits[j]);
    cols[j] = r.next;
    kinds.push(r.kind);
    carry = r.carry ? 1 : 0;
    let k = j;
    while (carry) {
      k++;
      while (cols.length <= k) cols.push(0);
      const up = addMove(cols[k], 1);
      cols[k] = up.next;
      kinds.push(`cascade:${up.kind}`);
      carry = up.carry ? 1 : 0;
    }
  }
  return { digits: cols, kinds };
}

/**
 * Simulate subtracting `num` from `total` (ones-first). Returns
 * {digits, kinds} or null when the subtraction would go negative.
 */
export function simulateSub(totalDigits, numDigits) {
  const cols = [...totalDigits];
  const kinds = [];
  let owe = 0;
  for (let j = 0; j < numDigits.length; j++) {
    const avail = cols[j] - owe;
    if (avail < 0) return null;
    const r = subMove(avail, numDigits[j]);
    cols[j] = r.next;
    kinds.push(r.kind);
    owe = r.borrow ? 1 : 0;
    let k = j;
    while (owe) {
      k++;
      if (k >= cols.length) return null; // borrowed past the top: negative
      const dn = subMove(cols[k], 1);
      cols[k] = dn.next;
      kinds.push(`cascade:${dn.kind}`);
      owe = dn.borrow ? 1 : 0;
    }
  }
  // strip leading zeros but keep at least one digit
  while (cols.length > 1 && cols[cols.length - 1] === 0) cols.pop();
  return { digits: cols, kinds };
}

const fromDigits = (cols) => Number(cols.slice().reverse().join('')) || 0;

// ---- stage builders -------------------------------------------------------

const tryTimes = (fn, times = 80) => {
  for (let i = 0; i < times; i++) {
    const v = fn();
    if (v !== null) return v;
  }
  return null;
};

/**
 * Build one addition step on top of `total` that forces the target digit's
 * big-friend carry somewhere (guaranteed), plus optional spice columns.
 * pickDigit(j) returns the forced digit for column j or null for spice.
 * Returns ones-first digits, or null on failure.
 */
export function buildCarryOperand(totalDigits, pickDigit, spiceProb = 0.3) {
  return tryTimes(() => {
    const b = [];
    let carry = 0;
    let forced = false;
    const L = totalDigits.length;
    for (let j = 0; j < L; j++) {
      const c = totalDigits[j] + carry;
      const want = j === L - 1 ? null : pickDigit(j); // never force top column
      if (want !== null && c + want >= 10) {
        b.push(want);
        forced = true;
      } else {
        b.push(Math.random() < spiceProb ? rand(0, Math.max(0, 9 - c)) : 0);
      }
      carry = c + b[j] >= 10 ? 1 : 0;
    }
    if (!forced || fromDigits(b) === 0) return null;
    return b;
  });
}

/**
 * Build one subtraction step against `current` forcing the target digit's
 * borrow somewhere. Returns ones-first digits (top column always 0 so the
 * result stays non-negative), or null on failure.
 */
export function buildBorrowOperand(currentDigits, pickDigit, spiceProb = 0.3) {
  return tryTimes(() => {
    const b = [];
    let owe = 0;
    let forced = false;
    const L = currentDigits.length;
    for (let j = 0; j < L; j++) {
      const avail = currentDigits[j] - owe;
      const want = j === L - 1 ? null : pickDigit(j); // never force top column
      if (want !== null && avail < want) {
        b.push(want);
        forced = true;
      } else {
        b.push(Math.random() < spiceProb ? rand(0, Math.max(0, avail)) : 0);
      }
      owe = avail - b[j] < 0 ? 1 : 0;
    }
    if (!forced || fromDigits(b) === 0) return null;
    return b;
  });
}
