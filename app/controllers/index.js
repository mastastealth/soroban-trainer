import Controller from '@ember/controller';
import { service } from '@ember/service';
import { LEVELS } from '../utils/questions';

export default class IndexController extends Controller {
  @service progress;

  get currentLevel() {
    return LEVELS[this.progress.unlockedLevel] ?? LEVELS[0];
  }

  get levelCards() {
    return LEVELS.map((level, index) => ({
      ...level,
      index,
      locked: index > this.progress.unlockedLevel,
      bestTime: this.progress.bestTime(level.id),
    }));
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
