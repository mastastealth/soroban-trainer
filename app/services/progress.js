import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { LEVELS } from 'soroban-trainer/utils/questions';

const KEY = 'soroban-progress-v1';

/**
 * Persistent student progress, backed by localStorage.
 *
 * shape:
 * {
 *   placed: boolean,            // assessment completed?
 *   unlockedLevel: number,      // index into LEVELS
 *   perfectSessions: number,    // lifetime count of 100% sessions
 *   bestTimes: { [levelId]: ms },
 *   sessions: [{ levelId, total, correct, bestStreak, ms, perfect, at }]
 * }
 */
export default class ProgressService extends Service {
  @tracked data = this.#load();

  #load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // corrupted storage — fall through to defaults
    }
    return {
      placed: false,
      unlockedLevel: 0,
      perfectSessions: 0,
      bestTimes: {},
      sessions: [],
    };
  }

  #persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // storage unavailable (private mode) — progress stays in-memory
    }
  }

  get placed() {
    return this.data.placed;
  }

  get unlockedLevel() {
    return this.data.unlockedLevel;
  }

  get perfectSessions() {
    return this.data.perfectSessions;
  }

  get sessions() {
    return this.data.sessions;
  }

  bestTime(levelId) {
    return this.data.bestTimes[levelId];
  }

  completeAssessment(unlockedLevel) {
    this.data = { ...this.data, placed: true, unlockedLevel };
    this.#persist();
  }

  /**
   * Records a finished practice session.
   * @param levelIndex index of the practiced level in LEVELS — scoring >=80%
   *        unlocks levelIndex+1.
   * @returns {{perfect: boolean, unlockedNext: boolean}} unlockedNext is true
   *          when this session raised the unlock frontier.
   */
  recordSession({ levelId, levelIndex, total, correct, bestStreak, ms }) {
    const perfect = correct === total && total > 0;
    const bestTimes = { ...this.data.bestTimes };
    if (
      perfect &&
      (bestTimes[levelId] === undefined || ms < bestTimes[levelId])
    ) {
      bestTimes[levelId] = ms;
    }
    const before = this.data.unlockedLevel;
    const unlockedLevel =
      correct / Math.max(total, 1) >= 0.8
        ? Math.min(Math.max(before, levelIndex + 1), LEVELS.length - 1)
        : before;
    const session = {
      levelId,
      total,
      correct,
      bestStreak,
      ms,
      perfect,
      at: Date.now(),
    };
    this.data = {
      ...this.data,
      bestTimes,
      perfectSessions: this.data.perfectSessions + (perfect ? 1 : 0),
      sessions: [...this.data.sessions.slice(-49), session],
      unlockedLevel,
    };
    this.#persist();
    return { perfect, unlockedNext: unlockedLevel > before };
  }

  reset() {
    this.data = {
      placed: false,
      unlockedLevel: 0,
      perfectSessions: 0,
      bestTimes: {},
      sessions: [],
    };
    this.#persist();
  }
}
