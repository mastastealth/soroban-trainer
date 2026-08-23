import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { LinkTo } from '@ember/routing';
import { modifier } from 'ember-modifier';
import { eq } from 'ember-truth-helpers';
import { service } from '@ember/service';
import { LEVELS } from '../utils/questions';

const QUESTIONS_PER_LEVEL = 2;

const autofocus = modifier((el) => el.focus());

/**
 * Placement quiz. Walks up the level ladder, two questions per level; a level
 * is passed only with both answers right, and the walk stops at the first
 * missed level. The highest fully-passed level becomes the student's
 * unlocked starting point.
 */
export default class AssessmentQuiz extends Component {
  @service progress;

  @tracked phase = 'intro'; // intro | running | done
  @tracked levelIndex = 0;
  @tracked questionNumber = 0;
  @tracked question = null;
  @tracked answer = '';
  @tracked feedback = null;
  @tracked missedThisLevel = false;
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

  get progressLabel() {
    const within = (this.questionNumber % QUESTIONS_PER_LEVEL) + 1;
    return `Level ${this.levelIndex + 1} of ${LEVELS.length} · question ${within} of ${QUESTIONS_PER_LEVEL}`;
  }

  /** Rows for the vertical (column) problem layout. */
  get stackRows() {
    if (!this.question) return [];
    return this.question.operands.map((value, i) => ({
      value,
      sign: i === 0 ? '' : this.question.operators[i - 1] === '-' ? '−' : '+',
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
    this.missedThisLevel = false;
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
    if (!correct) this.missedThisLevel = true;
    this.feedback = { correct, rightAnswer: this.question.answer };
    window.dispatchEvent(new Event('soroban:reset'));
    this.inputTimeout = setTimeout(() => this.advance(), correct ? 500 : 1600);
  }

  advance() {
    this.feedback = null;
    this.questionNumber += 1;
    const levelComplete = this.questionNumber % QUESTIONS_PER_LEVEL === 0;
    if (!levelComplete) {
      this.#nextQuestion();
      return;
    }
    if (this.missedThisLevel || this.levelIndex + 1 >= LEVELS.length) {
      this.finish();
      return;
    }
    this.missedThisLevel = false;
    this.levelIndex += 1;
    this.#nextQuestion();
  }

  finish() {
    this.placement = this.missedThisLevel
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
            harder. Get both questions right in a row to climb to the next level
            — the quiz stops when a level trips you up, and that's where your
            training begins!
          </p>
          <button
            type="button"
            class="big-start"
            {{on "click" this.begin}}
          >Let's go! 🚀</button>
        </div>
      {{else if (eq this.phase "running")}}
        <div class="hud">
          <span class="hud-item">{{this.progressLabel}}</span>
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
                <div class="stack-rule"></div>
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
