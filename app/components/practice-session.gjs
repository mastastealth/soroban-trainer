import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { modifier } from 'ember-modifier';
import { eq, gt } from 'ember-truth-helpers';
import { service } from '@ember/service';
import { LinkTo } from '@ember/routing';
import { formatMs } from '../utils/format';
import { formatQuestion, OP_SIGNS } from '../utils/questions';
import {
  prepareVoice,
  playVoiceAt,
  preloadDictationVoice,
} from '../utils/speech';

const COUNT_OPTIONS = [10, 20, 30];

// Re-focus the answer box whenever it (re)mounts so kids can just keep typing.
const autofocus = modifier((el) => el.focus());

/**
 * One timed practice round: pick a question count, press Start, answer each
 * question with instant right/wrong feedback, and get a session summary with
 * streaks. Sessions feed the persistent progress service.
 */
export default class PracticeSession extends Component {
  @service progress;
  @service mindMode;

  @tracked phase = 'setup'; // setup | running | done
  @tracked count = 10;

  @tracked index = 0;
  @tracked question = null;
  @tracked answer = '';
  @tracked result = null;
  @tracked totalMs = 0;
  @tracked correctCount = 0;
  @tracked streak = 0;
  @tracked bestStreak = 0;
  @tracked review = [];
  @tracked elapsed = 0;
  timerId = null;
  startedAt = 0;
  #mind = false;
  questionsList = [];
  kittenVoiceFailed = false;

  @tracked dictation =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('soroban-dictation') === '1';
  @tracked voiceReady = !this.dictation;
  @tracked speaking = false;

  countOptions = COUNT_OPTIONS;

  willDestroy() {
    super.willDestroy();
    this.#stopTimer();
  }

  get level() {
    return this.args.level;
  }

  get progressLabel() {
    return `${this.index + 1} / ${this.count}`;
  }

  get segments() {
    return Array.from({ length: this.count }, (_, i) => {
      if (i < this.review.length)
        return this.review[i].correct ? 'correct' : 'wrong';
      if (i === this.review.length) return 'current';
      return '';
    });
  }
  /** Rows for the vertical (column) problem layout. */
  get stackRows() {
    if (!this.question) return [];
    return this.question.operands.map((value, i) => ({
      value,
      sign: i === 0 ? '' : (OP_SIGNS[this.question.operators[i - 1]] ?? '+'),
    }));
  }

  get accuracy() {
    return Math.round((this.correctCount / this.count) * 100);
  }

  #startTimer() {
    this.startedAt = performance.now();
    this.timerId = setInterval(() => {
      this.elapsed = performance.now() - this.startedAt;
    }, 100);
  }

  #stopTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
  }

  @action
  setCount(event) {
    this.count = Number(event.target.value);
  }

  @action
  setMind(event) {
    this.mindMode.setEnabled(event.target.checked);
  }

  @action
  setDictation(event) {
    this.dictation = event.target.checked;
    if (this.dictation) {
      preloadDictationVoice();
    }
    try {
      localStorage.setItem('soroban-dictation', this.dictation ? '1' : '0');
    } catch {
      // private mode — preference stays in-memory
    }
  }

  playQuestion = async () => {
    if (this.speaking || !this.question) return;
    this.speaking = true;
    try {
      await playVoiceAt(this.index, this.question);
    } finally {
      this.speaking = false;
    }
  };

  @action
  start() {
    this.index = 0;
    this.correctCount = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.review = [];
    this.elapsed = 0;
    this.answer = '';
    this.#mind = this.mindMode.enabled;
    this.questionsList = Array.from({ length: this.count }, () =>
      this.level.gen({ mind: this.#mind }),
    );
    this.question = this.questionsList[0];
    this.phase = 'running';
    if (this.dictation) {
      this.voiceReady = false;
      prepareVoice(this.questionsList).then((ok) => {
        this.kittenVoiceFailed = !ok;
        this.voiceReady = true;
      });
    } else {
      this.voiceReady = true;
    }
    this.#startTimer();
  }

  @action
  submitAnswer(event) {
    event.preventDefault();
    if (this.phase !== 'running' || this.answer === '') return;
    const q = this.question;
    const given = Number(this.answer);
    const correct = given === q.answer;
    this.correctCount += correct ? 1 : 0;
    this.streak = correct ? this.streak + 1 : 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.review = [
      ...this.review,
      {
        prompt: formatQuestion(q),
        given,
        rightAnswer: q.answer,
        correct,
      },
    ];
    this.answer = '';
    window.dispatchEvent(new Event('soroban:reset'));
    const next = this.index + 1;
    if (next >= this.count) {
      this.finish();
      return;
    }
    this.index = next;
    this.question = this.questionsList[next];
  }

  @action
  updateAnswer(event) {
    this.answer = event.target.value;
  }

  finish() {
    this.#stopTimer();
    const ms = Math.round(performance.now() - this.startedAt);
    this.totalMs = ms;
    this.result = this.progress.recordSession({
      levelId: this.level.id,
      levelIndex: this.args.levelIndex,
      total: this.count,
      correct: this.correctCount,
      bestStreak: this.bestStreak,
      ms,
    });
    this.phase = 'done';
  }

  @action
  again() {
    this.phase = 'setup';
  }

  <template>
    <div class="practice">
      {{#if (eq this.phase "setup")}}
        <div class="card center">
          <p class="level-kicker">Level</p>
          <h1>{{this.level.name}}</h1>
          <p class="blurb">{{this.level.blurb}}</p>
          <fieldset class="count-picker">
            <legend>How many questions?</legend>
            {{#each this.countOptions as |option|}}
              <label
                class="count-option {{if (eq this.count option) 'selected'}}"
              >
                <input
                  type="radio"
                  name="count"
                  value={{option}}
                  checked={{eq this.count option}}
                  {{on "change" this.setCount}}
                />
                {{option}}
              </label>
            {{/each}}
          </fieldset>
          <label class="mind-toggle">
            <input
              type="checkbox"
              checked={{this.mindMode.enabled}}
              {{on "change" this.setMind}}
            />
            🧠 Mind Mode — no abacus, mental only
          </label>
          <p class="mind-hint">
            {{#if this.mindMode.enabled}}
              Abacus hidden · smaller numbers
            {{else}}
              Use the on-screen soroban to work the answers out
            {{/if}}
          </p>
          <label class="mind-toggle">
            <input
              type="checkbox"
              checked={{this.dictation}}
              {{on "change" this.setDictation}}
            />
            🔊 Dictation — listen, don't look
          </label>
          <p class="mind-hint">
            {{#if this.dictation}}
              Questions are spoken aloud · press the button to hear them again
            {{else}}
              Problems are shown on screen
            {{/if}}
          </p>
          <button type="button" class="big-start" {{on "click" this.start}}>▶
            Start!</button>
        </div>
      {{else if (eq this.phase "running")}}
        <div class="hud">
          <span class="hud-item">⏱ {{formatMs this.elapsed}}</span>
          <span class="hud-item">🔥 Streak: {{this.streak}}</span>
          <span class="hud-item">⭐ Best: {{this.bestStreak}}</span>
          <span class="hud-item">{{this.progressLabel}}</span>
        </div>

        <div class="progress-track" aria-label="Progress">
          {{#each this.segments as |seg|}}
            <span class="progress-seg {{seg}}"></span>
          {{/each}}
        </div>

        <div class="card question-card">
          {{#if this.question}}
            <form class="answer-form" {{on "submit" this.submitAnswer}}>
              {{#if this.dictation}}
                {{#if this.voiceReady}}
                  <div class="dictation-box">
                    <button
                      type="button"
                      class="speak-btn"
                      {{on "click" this.playQuestion}}
                      disabled={{this.speaking}}
                    >
                      {{#if this.speaking}}
                        <span class="btn-spinner"></span>
                        Speaking…
                      {{else}}
                        🔊 Play math question
                      {{/if}}
                    </button>
                  </div>
                {{else}}
                  <div class="voice-loading">
                    <span class="spinner"></span>
                    🎙 Preparing voice…
                  </div>
                {{/if}}
                {{#if this.voiceReady}}
                  <input
                    {{autofocus}}
                    class="stack-input dictation-input"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    autocomplete="off"
                    aria-label="Your answer"
                    value={{this.answer}}
                    {{on "input" this.updateAnswer}}
                  />
                  <button type="submit" class="check-btn">Check</button>
                {{/if}}
              {{else}}
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
                  <button type="submit" class="check-btn">Check</button>
                </div>
              {{/if}}
            </form>
            {{#if this.question.note}}
              <p class="technique-hint">💡 {{this.question.note}}</p>
            {{/if}}
          {{/if}}
        </div>
      {{else}}
        <div class="card center summary">
          <h1>Session complete!</h1>
          <div class="summary-grid">
            <div><span class="stat-num">{{formatMs this.totalMs}}</span><span
                class="stat-label"
              >time</span></div>
            <div><span class="stat-num">{{this.accuracy}}%</span><span
                class="stat-label"
              >accuracy</span></div>
            <div><span class="stat-num">{{this.bestStreak}}</span><span
                class="stat-label"
              >best streak</span></div>

          </div>
          <ul class="review-list">
            {{#each this.review as |r|}}
              <li class="review-item {{if r.correct 'good' 'bad'}}">
                <span class="review-q">{{r.prompt}} = {{r.rightAnswer}}</span>
                <span class="review-a">
                  {{#if r.correct}}
                    ✓
                  {{else}}
                    ✗ you:
                    {{r.given}}
                  {{/if}}
                </span>
              </li>
            {{/each}}
          </ul>

          {{#if this.result.perfect}}
            <p class="perfect-banner">🌟 PERFECT! That's
              {{this.progress.perfectSessions}}
              perfect session{{if (gt this.progress.perfectSessions 1) "s"}}
              all-time!</p>
          {{/if}}
          {{#if this.result.unlockedNext}}
            <p class="unlock-banner">🔓 New level unlocked!</p>
          {{/if}}

          <div class="row-gap">
            <button type="button" class="big-start" {{on "click" this.again}}>Go
              again</button>
            <LinkTo @route="index" class="ghost-btn">Home</LinkTo>
          </div>
        </div>
      {{/if}}
    </div>
  </template>
}
