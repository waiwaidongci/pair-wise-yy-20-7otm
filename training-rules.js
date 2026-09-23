/*
 * 口令听辨训练 —— 规则层（纯逻辑，不依赖 DOM / 存储）
 * 依赖全局 instruments（来自 app.js）：{ name, token, freq }
 */
(function initTrainingRules() {
  const STEPS_PER_MEASURE = 4;

  // 当前循环选择对应的抽查范围（按步进序号）
  function getRange(loop, totalSteps) {
    if (loop === "") return { start: 0, end: totalSteps - 1 };
    const start = Number(loop) * STEPS_PER_MEASURE;
    return { start, end: start + STEPS_PER_MEASURE - 1 };
  }

  // 找出范围内一个口令都没有的小节
  function findEmptyMeasures(pattern, range) {
    const measureCount = pattern[0]?.length / STEPS_PER_MEASURE || 0;
    const empty = [];
    for (let measure = 0; measure < measureCount; measure += 1) {
      const start = measure * STEPS_PER_MEASURE;
      const end = start + STEPS_PER_MEASURE - 1;
      if (end < range.start || start > range.end) continue;
      const hasToken = pattern.some((row) =>
        row.slice(start, start + STEPS_PER_MEASURE).some(Boolean)
      );
      if (!hasToken) empty.push(measure + 1);
    }
    return empty;
  }

  function shuffle(list) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // 收集范围内所有已填口令；每个格子一轮只出现一次，出题顺序随机
  function buildQuestions(pattern, range) {
    const questions = [];
    pattern.forEach((row, instrumentIndex) => {
      row.forEach((token, step) => {
        if (!token) return;
        if (step < range.start || step > range.end) return;
        questions.push({
          instrumentIndex,
          instrumentName: instruments[instrumentIndex].name,
          token,
          step,
          measure: Math.floor(step / STEPS_PER_MEASURE) + 1,
          beat: (step % STEPS_PER_MEASURE) + 1
        });
      });
    });
    return shuffle(questions);
  }

  function judgeAnswer(question, chosenInstrumentName) {
    return chosenInstrumentName === question.instrumentName;
  }

  window.TrainingRules = {
    getRange,
    findEmptyMeasures,
    buildQuestions,
    judgeAnswer
  };
})();
