import Controller from '@ember/controller';
import { service } from '@ember/service';
import { ELEMENTS, LEVELS } from '../utils/questions';

export default class IndexController extends Controller {
  @service progress;

  get currentLevel() {
    return LEVELS[this.progress.unlockedLevel] ?? LEVELS[0];
  }

  /**
   * Stages grouped under their element, each carrying lock state and best
   * time. An element is "graduated" once every one of its stages is unlocked.
   */
  get elementSections() {
    return ELEMENTS.map((element) => {
      const stages = LEVELS.map((level, index) => ({
        ...level,
        index,
        locked: index > this.progress.unlockedLevel,
        bestTime: this.progress.bestTime(level.id),
      })).filter((level) => level.element === element.id);
      const lastIndex = Math.max(...stages.map((s) => s.index));
      return {
        ...element,
        stages,
        graduated: this.progress.unlockedLevel >= lastIndex,
      };
    });
  }

  get recentSessions() {
    return [...this.progress.sessions]
      .reverse()
      .slice(0, 8)
      .map((session) => ({
        ...session,
        levelName:
          LEVELS.find((l) => l.id === session.levelId)?.name ?? session.levelId,
      }));
  }
}
