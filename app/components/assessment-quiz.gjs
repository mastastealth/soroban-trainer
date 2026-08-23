import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { LinkTo } from '@ember/routing';
import { modifier } from 'ember-modifier';
import { eq } from 'ember-truth-helpers';
import { service } from '@ember/service';
import { ELEMENTS, LEVELS, OP_SIGNS } from '../utils/questions';

/** Two questions per stage, one on Fire. */
const stageQuota = (index) => (index < 17 ? 2 : 1);

/** Walk ends early once this many wrong answers pile up overall. */
const MAX_TOTAL_MISSES = 3;

const autofocus = modifier((el) => el.focus());

/**
 * Placement quiz. Walks up the stage ladder; three wrong answers anywhere
 * end the walk and place the student one stage below where they stand.
 */
export default class AssessmentQuiz extends Component {
  @service progress;

  @tracked phase = 'intro'; // intro | running | done
  @tracked levelIndex = 0;
  @tracked questionNumber = 0;
  @tracked askedInLevel = 0;
  @tracked question = null;
  @tracked answer = '';
  @tracked feedback = null;
  @tracked wrongTotal = 0;
  @tracked placement = null;

  inputTimeout = null;

  willDestroy() {
    super.willDestroy();
    clearTimeout(this.inputTimeout);
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  get placedLevel() {
    return LEVELS[this.placement];
  }

  get currentElementEmoji() {
    return ELEMENTS.find((e) => e.id === this.level.element)?.emoji ?? '';
  }

  get progressLabel() {
    const quota = stageQuota(this.levelIndex);
    return `Stage ${this.levelIndex + 1} of ${LEVELS.length} · Question ${this.askedInLevel + 1} of ${quota}`;
  }

  /** Rows for the vertical (column) problem layout. */
  get stackRows() {
    if (!this.question) return [];
    return this.question.operands.map((value, i) => ({
      value,
      sign: i === 0 ? '' : (OP_SIGNS[this.question.operators[i - 1]] ?? '+'),
    }));
  }

  #nextQuestion() {
    this.question = this.level.gen();
    this.answer = '';
  }

  @action
  begin() {
    this.levelIndex = 0;
    this.questionNumber = 0;
    this.askedInLevel = 0;
    this.wrongTotal = 0;
    this.#nextQuestion();
    this.phase = 'running';
  }

  @action
  updateAnswer(event) {
    this.answer = event.target.value;
  }

  @action
  submitAnswer(event) {
    event.preventDefault();
    if (this.feedback || this.answer === '') return;
    const correct = Number(this.answer) === this.question.answer;
    if (!correct) this.wrongTotal += 1;
    this.feedback = { correct, rightAnswer: this.question.answer };
    window.dispatchEvent(new Event('soroban:reset'));
    this.inputTimeout = setTimeout(() => this.advance(), correct ? 500 : 1600);
  }

  advance() {
    this.feedback = null;
    this.questionNumber += 1;
    this.askedInLevel += 1;
    const quota = stageQuota(this.levelIndex);
    const hitLimit = this.wrongTotal >= MAX_TOTAL_MISSES;
    if (!hitLimit && this.askedInLevel < quota) {
      this.#nextQuestion();
      return;
    }
    if (hitLimit || this.levelIndex + 1 >= LEVELS.length) {
      this.finish(hitLimit);
      return;
    }
    // crossing into a new element washes the slate clean
    const nextStage = LEVELS[this.levelIndex + 1];
    if (nextStage.element !== this.level.element) {
      this.wrongTotal = 0;
    }
    this.askedInLevel = 0;
    this.levelIndex += 1;
    this.#nextQuestion();
  }

  finish(hitLimit) {
    this.placement = hitLimit
      ? Math.max(0, this.levelIndex - 1)
      : LEVELS.length - 1;
    this.progress.completeAssessment(this.placement);
    this.phase = 'done';
  }

  <template>
    <div class="practice">
      {{#if (eq this.phase "intro")}}
        <div class="card center">
          <h1>Placement Quiz</h1>
          <p class="blurb">
            I'll ask you a few abacus questions, starting easy and getting
            harder. Three slips within an element stop the quiz — you'll train
            one stage below where that happens. Make it to the next element and
            the slate wipes clean!
          </p>
          <button
            type="button"
            class="big-start"
            {{on "click" this.begin}}
          >Let's go! 🚀</button>
        </div>
      {{else if (eq this.phase "running")}}
        <div class="hud">
          <span class="hud-item">{{this.currentElementEmoji}}
            {{this.progressLabel}}</span>
        </div>
        <div class="card question-card">
          {{#if this.feedback}}
            {{#if this.feedback.correct}}
              <div class="feedback yes">✓ Correct!</div>
            {{else}}
              <div class="feedback no">✗ The answer is
                {{this.feedback.rightAnswer}}</div>
            {{/if}}
          {{/if}}
          {{#if this.question}}
            <form class="answer-form" {{on "submit" this.submitAnswer}}>
              <div class="question-stack" aria-label="Problem">
                {{#each this.stackRows as |row|}}
                  <div class="stack-row">
                    <span class="stack-op">{{row.sign}}</span>
                    <span class="stack-num">{{row.value}}</span>
                  </div>
                {{/each}}
                <input
                  {{autofocus}}
                  class="stack-input"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  autocomplete="off"
                  aria-label="Your answer"
                  value={{this.answer}}
                  {{on "input" this.updateAnswer}}
                />
                <button
                  type="submit"
                  class="check-btn"
                  disabled={{this.feedback}}
                >Check</button>
              </div>
            </form>
          {{/if}}
        </div>
      {{else}}
        <div class="card center summary">
          <h1>You're placed at…</h1>
          <h2 class="placed-level">{{this.placedLevel.name}}</h2>
          <p class="blurb">{{this.placedLevel.blurb}}</p>
          <p>Start practicing and score 80% or better to unlock the next level.</p>
          <div class="row-gap">
            <LinkTo
              @route="practice"
              @model={{this.placedLevel.id}}
              class="big-start"
            >Start practicing</LinkTo>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
