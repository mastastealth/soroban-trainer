import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

const KEY = 'soroban-mind-mode';

/**
 * Mind Mode: mental-math only. When enabled the virtual abacus hides
 * itself and generators cap operand width / chain length.
 */
export default class MindModeService extends Service {
  @tracked enabled = this.#load();

  #load() {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    try {
      localStorage.setItem(KEY, this.enabled ? '1' : '0');
    } catch {
      // storage unavailable — stays in-memory for this session
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
  }
}
