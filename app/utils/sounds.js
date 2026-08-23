/**
 * Abacus sound effects via howler.js — sounds are preloaded once at module
 * init, pooled by Howler (rapid bead taps overlap cleanly), and unlocked
 * automatically on the first user gesture. MP3 fallbacks ship alongside the
 * OGG sources for Safari.
 */
import { Howl } from 'howler';

const beadClick = new Howl({
  src: ['/sounds/bead-click.ogg', '/sounds/bead-click.mp3'],
  volume: 0.5,
});

const resetSweep = new Howl({
  src: ['/sounds/reset.ogg', '/sounds/reset.mp3'],
  volume: 0.5,
});

/** Short wooden clack for bead movement. */
export function playBeadClick() {
  beadClick.play();
}

/** Rising-then-falling triple clack for the reset button. */
export function playReset() {
  resetSweep.play();
}
