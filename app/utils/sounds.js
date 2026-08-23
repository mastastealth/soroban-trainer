// CC0 sounds from OpenGameArt (qubodup, "Button Click Sound Effect").
let beadSound;
let resetSound;

function clone(sound) {
  const instance = sound.cloneNode();
  instance.volume = 0.5;
  instance.play().catch(() => {
    // autoplay restrictions — ignore silently
  });
}

/** Short wooden clack for bead movement. */
export function playBeadClick() {
  if (typeof Audio === 'undefined') return;
  if (!beadSound) beadSound = new Audio('/sounds/bead-click.ogg');
  clone(beadSound);
}

/** Rising-then-falling triple clack for the reset button. */
export function playReset() {
  if (typeof Audio === 'undefined') return;
  if (!resetSound) resetSound = new Audio('/sounds/reset.ogg');
  clone(resetSound);
}
