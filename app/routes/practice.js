import Route from '@ember/routing/route';
import { service } from '@ember/service';
import { LEVELS, levelById, levelIndex } from 'soroban-trainer/utils/questions';

export default class PracticeRoute extends Route {
  @service progress;
  @service router;

  model({ level_id }) {
    const level = levelById(level_id) ?? LEVELS[0];
    const index = levelIndex(level.id);
    // unplaced students must take the assessment first; locked levels bounce home
    if (!this.progress.placed || index > this.progress.unlockedLevel) {
      this.router.transitionTo('index');
      return null;
    }
    return { level, index };
  }
}
