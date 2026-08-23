import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import { playBeadClick, playReset } from '../utils/sounds';

const RODS = 4;
const EARTH_BEADS = 4;

/**
 * Interactive digital soroban. Floating panel, draggable anywhere in the
 * viewport, collapsible to a small round button. Beads are tapped up/down to
 * let the student work calculations on-screen.
 */
export default class Soroban extends Component {
  @tracked heavenDown = Array(RODS).fill(false);
  @tracked earthUp = Array(RODS).fill(0);
  @tracked visible = true;
  // null position = default CSS anchoring (bottom-right)
  @tracked pos = null;

  dragState = null;
  #onExternalReset = null;

  constructor(owner, args) {
    super(owner, args);
    this.#onExternalReset = () => this.#clearBeads();
    window.addEventListener('soroban:reset', this.#onExternalReset);
  }

  willDestroy() {
    window.removeEventListener('soroban:reset', this.#onExternalReset);
    super.willDestroy();
  }

  #clearBeads() {
    this.heavenDown = Array(RODS).fill(false);
    this.earthUp = Array(RODS).fill(0);
  }

  // layout constants (px)
  // heaven zone 32 tall; earth zone 96 tall. Earth beads slide one full slot
  // (bead height + 1px gap) between raised and resting, so a raised stack and
  // the remaining resting beads never collide.
  static HEAVEN_REST = 2;
  static HEAVEN_DOWN = 13; // rests against the beam (32 - 18 - 1)
  static EARTH_BEAD_H = 18;
  static EARTH_PAD = 1;
  static EARTH_STEP = 19; // 18px bead + 1px gap
  static EARTH_ZONE = 96;

  /**
   * Per-rod view model. Rods render right-to-left: ones on the right,
   * tens to their left, and so on. Earth bead tops are computed so beads
   * can never overlap, in any raised/resting combination.
   */
  get rods() {
    return Array.from({ length: RODS }, (_, i) => i)
      .reverse()
      .map((index) => {
        const heavenDown = this.heavenDown[index];
        const up = this.earthUp[index];
        const { EARTH_BEAD_H, EARTH_PAD, EARTH_STEP, EARTH_ZONE } = Soroban;
        const earthBeads = Array.from({ length: EARTH_BEADS }, (_, bead) => {
          const raised = bead < up;
          const top = raised
            ? EARTH_PAD + bead * EARTH_STEP
            : EARTH_ZONE -
              EARTH_PAD -
              EARTH_BEAD_H -
              (EARTH_BEADS - 1 - bead) * EARTH_STEP;
          return { index: bead, style: `top:${top}px;` };
        });
        return {
          index,
          heavenStyle: `top:${heavenDown ? Soroban.HEAVEN_DOWN : Soroban.HEAVEN_REST}px;`,
          earthBeads,
        };
      });
  }

  get value() {
    let total = 0;
    for (let rod = 0; rod < RODS; rod++) {
      total +=
        (this.heavenDown[rod] ? 5 : 0) * 10 ** rod +
        this.earthUp[rod] * 10 ** rod;
    }
    return total;
  }

  get panelStyle() {
    if (!this.pos) return '';
    return `left:${this.pos.x}px;top:${this.pos.y}px;right:auto;bottom:auto;`;
  }
  @action
  toggleHeaven(rod) {
    playBeadClick();
    this.heavenDown = this.heavenDown.map((down, i) =>
      i === rod ? !down : down,
    );
  }

  /**
   * Clicking earth bead j raises beads 0..j; clicking an already-raised bead
   * lowers that bead and everything above it.
   */
  @action
  tapEarth(rod, bead) {
    playBeadClick();
    const current = this.earthUp[rod];
    const next = bead < current ? bead : bead + 1;
    this.earthUp = this.earthUp.map((up, i) => (i === rod ? next : up));
  }

  @action
  reset() {
    playReset();
    this.#clearBeads();
  }

  @action
  hide() {
    this.visible = false;
  }

  @action
  show() {
    this.visible = true;
  }

  @action
  startDrag(event) {
    // let the header buttons keep their clicks; only the bare bar drags
    if (event.target.closest('button')) return;
    event.preventDefault();
    const rect = event.currentTarget
      .closest('.soroban')
      .getBoundingClientRect();
    this.dragState = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  @action
  onDrag(event) {
    if (!this.dragState) return;
    const x = Math.min(
      Math.max(event.clientX - this.dragState.dx, 0),
      window.innerWidth - 60,
    );
    const y = Math.min(
      Math.max(event.clientY - this.dragState.dy, 0),
      window.innerHeight - 40,
    );
    this.pos = { x, y };
  }

  @action
  endDrag() {
    this.dragState = null;
  }

  <template>
    {{! collapsed pill — tap to reopen }}
    {{#unless this.visible}}
      <button
        type="button"
        class="soroban-launcher"
        {{on "click" this.show}}
        aria-label="Show soroban"
      >🧮</button>
    {{/unless}}

    {{#if this.visible}}
      <div
        class="soroban"
        style={{this.panelStyle}}
        role="group"
        aria-label="Digital soroban"
      >
        {{! template-lint-disable no-pointer-down-event-binding }}
        <div
          class="soroban-drag"
          {{on "pointerdown" this.startDrag}}
          {{on "pointermove" this.onDrag}}
          {{on "pointerup" this.endDrag}}
          {{on "pointercancel" this.endDrag}}
        >
          <span class="soroban-value">{{this.value}}</span>
          <button
            type="button"
            class="soroban-btn"
            {{on "click" this.reset}}
            aria-label="Reset beads"
          >↺</button>
          <button
            type="button"
            class="soroban-btn"
            {{on "click" this.hide}}
            aria-label="Hide soroban"
          >✕</button>
        </div>

        <div class="soroban-frame">
          {{#each this.rods as |rod|}}
            <div class="soroban-rod">
              <div class="soroban-heaven">
                <button
                  type="button"
                  style={{rod.heavenStyle}}
                  class="bead heaven"
                  {{on "click" (fn this.toggleHeaven rod.index)}}
                  aria-label="Heaven bead, rod {{rod.index}}"
                ></button>
              </div>
              <div class="soroban-beam"></div>
              <div class="soroban-earth">
                {{#each rod.earthBeads as |bead|}}
                  <button
                    type="button"
                    style={{bead.style}}
                    class="bead earth"
                    {{on "click" (fn this.tapEarth rod.index bead.index)}}
                    aria-label="Earth bead {{bead.index}}, rod {{rod.index}}"
                  ></button>
                {{/each}}
              </div>
            </div>
          {{/each}}
        </div>
        <div class="soroban-hint">Tap beads to count • drag by the top bar</div>
      </div>
    {{/if}}
  </template>
}
