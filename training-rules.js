/*
 * 口令听辨训练 —— 规则层
 * 只负责训练规则与判题，不碰 DOM、不发声、不读写存储：
 *  - 当前循环范围如何取
 *  - 范围内哪些小节没有口令
 *  - 按谱面顺序逐个收集已填口令，同一口令一轮只出一次
 *  - 一轮训练的会话状态（出题、答题、对错判定）
 */
(function () {
  "use strict";

  const STEPS_PER_MEASURE = 4;
  const MEASURE_COUNT = 4;

  const INSTRUMENTS = [
    { name: "大锣", token: "仓" },
    { name: "鼓", token: "冬" },
    { name: "钹", token: "才" },
    { name: "小锣", token: "台" }
  ];

  // 循环范围："" 为全段，否则为某个小节的序号（0 起）
  function rangeForLoop(loop) {
    if (loop === "" || loop === null || loop === undefined) {
      return {
        start: 0,
        end: MEASURE_COUNT * STEPS_PER_MEASURE - 1,
        measures: [0, 1, 2, 3]
      };
    }
    const measure = Number(loop);
    return {
      start: measure * STEPS_PER_MEASURE,
      end: measure * STEPS_PER_MEASURE + STEPS_PER_MEASURE - 1,
      measures: [measure]
    };
  }

  function measureHasCommand(pattern, measure) {
    const start = measure * STEPS_PER_MEASURE;
    return pattern.some((row) =>
      row.slice(start, start + STEPS_PER_MEASURE).some(Boolean)
    );
  }

  // 范围内没有任何口令的小节（返回 1 起的小节号，方便直接提示）
  function emptyMeasures(pattern, loop) {
    return rangeForLoop(loop)
      .measures.filter((measure) => !measureHasCommand(pattern, measure))
      .map((measure) => measure + 1);
  }

  // 开始前检查：范围内每一小节都必须至少有一个口令
  function startCheck(pattern, loop) {
    const empty = emptyMeasures(pattern, loop);
    return { ok: empty.length === 0, emptyMeasures: empty };
  }

  // 按当前谱面逐个收集已填口令：先按拍序，再按乐器行。
  // 口令以「乐器行 + 小节-拍」为唯一标识，一轮内同一口令只出现一次。
  function buildQuestions(pattern, loop) {
    const { start, end } = rangeForLoop(loop);
    const seen = new Set();
    const questions = [];
    for (let step = start; step <= end; step += 1) {
      pattern.forEach((row, rowIndex) => {
        const token = row[step];
        if (!token) return;
        const key = `${rowIndex}-${step}`;
        if (seen.has(key)) return;
        seen.add(key);
        questions.push({
          key,
          row: rowIndex,
          step,
          measure: Math.floor(step / STEPS_PER_MEASURE) + 1,
          beat: (step % STEPS_PER_MEASURE) + 1,
          token
        });
      });
    }
    return questions;
  }

  class TrainingSession {
    constructor(pattern, loop, meta) {
      this.pieceName = (meta && meta.pieceName) || "";
      this.questions = buildQuestions(pattern, loop);
      this.index = 0;
      this.answers = [];
      this.answered = false;
      this.lastResult = null;
    }

    get total() {
      return this.questions.length;
    }

    get current() {
      return this.questions[this.index] || null;
    }

    get finished() {
      return this.index >= this.questions.length;
    }

    get correctCount() {
      return this.answers.filter((result) => result.correct).length;
    }

    // 作答：返回判定结果；同一题只能答一次
    answer(rowIndex) {
      if (this.answered || this.finished) return null;
      const question = this.current;
      const result = {
        question,
        chosenRow: rowIndex,
        correct: rowIndex === question.row,
        at: new Date().toISOString()
      };
      this.answers.push(result);
      this.lastResult = result;
      this.answered = true;
      return result;
    }

    // 进入下一题；已到末题后返回 false
    next() {
      if (!this.answered || this.finished) return !this.finished;
      this.index += 1;
      this.answered = false;
      this.lastResult = null;
      return !this.finished;
    }
  }

  window.TrainingRules = {
    STEPS_PER_MEASURE,
    MEASURE_COUNT,
    INSTRUMENTS,
    rangeForLoop,
    emptyMeasures,
    startCheck,
    buildQuestions,
    TrainingSession
  };
})();
