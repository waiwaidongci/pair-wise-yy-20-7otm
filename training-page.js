/*
 * 口令听辨训练 —— 页面层（DOM 交互与轮次状态）
 * 规则走 TrainingRules，记录走 TrainingRecords，声音用 app.js 暴露的 luoguPlaySound。
 */
(function initTrainingPage() {
  const trainBtn = document.querySelector("#trainStart");
  const scopeHint = document.querySelector("#trainScope");
  const trainStatus = document.querySelector("#trainStatus");
  const questionBox = document.querySelector("#trainQuestion");
  const recordsSummary = document.querySelector("#recordsSummary");
  const recordsList = document.querySelector("#recordsList");

  // session: { questions, index, answered }，null 表示当前不在一轮训练中
  let session = null;

  const abortReasons = {
    pattern: "谱面被改动",
    bpm: "速度被调整",
    loop: "循环范围被切换",
    load: "加载了其他方案"
  };

  function scopeText(loop) {
    return loop === "" ? "全段（第1–4小节）" : `第${Number(loop) + 1}小节`;
  }

  function setStatus(html, type) {
    trainStatus.innerHTML = html;
    trainStatus.className = `train-status${type ? ` ${type}` : ""}`;
  }

  function syncControls() {
    trainBtn.disabled = Boolean(session);
    trainBtn.textContent = session ? "训练进行中…" : "开始听辨训练";
  }

  function startTraining() {
    const range = TrainingRules.getRange(state.loop, steps);
    const emptyMeasures = TrainingRules.findEmptyMeasures(state.pattern, range);
    if (emptyMeasures.length) {
      setStatus(
        `无法开始：${emptyMeasures.map((m) => `第${m}小节`).join("、")}还没有口令，请先在谱面中填写。`,
        "error"
      );
      return;
    }

    const questions = TrainingRules.buildQuestions(state.pattern, range);
    session = { questions, index: 0, answered: false };
    setStatus(`训练范围：${scopeText(state.loop)}，共 ${questions.length} 个口令，每个口令本轮只出现一次。`);
    syncControls();
    renderQuestion();
  }

  function renderQuestion() {
    const question = session.questions[session.index];
    session.answered = false;
    questionBox.innerHTML = `
      <div class="quiz">
        <p class="quiz-pos">第${question.measure}小节 · 第${question.beat}拍
          <span class="quiz-progress">（第 ${session.index + 1} / ${session.questions.length} 题）</span>
        </p>
        <p class="quiz-tip">听声音，判断是哪件乐器的口令：</p>
        <button id="quizReplay" class="replay-btn" type="button">🔊 再听一遍</button>
        <div class="quiz-options">
          ${instruments.map((instrument) =>
            `<button class="option-btn" type="button" data-option="${instrument.name}">${instrument.name}</button>`
          ).join("")}
        </div>
        <p id="quizFeedback" class="quiz-feedback" hidden></p>
        <button id="quizNext" class="next-btn" type="button" hidden>下一题</button>
      </div>
    `;
    window.luoguPlaySound(instruments[question.instrumentIndex]);
  }

  function answer(chosenName) {
    if (!session || session.answered) return;
    const question = session.questions[session.index];
    const correct = TrainingRules.judgeAnswer(question, chosenName);
    session.answered = true;

    questionBox.querySelectorAll(".option-btn").forEach((button) => {
      button.disabled = true;
      if (button.dataset.option === question.instrumentName) button.classList.add("right");
      if (button.dataset.option === chosenName && !correct) button.classList.add("wrong");
    });

    const feedback = questionBox.querySelector("#quizFeedback");
    feedback.hidden = false;
    feedback.textContent = correct
      ? `答对了：这一拍口令是「${question.token}」，属${question.instrumentName}。`
      : `答错了：你选了${chosenName}，应为${question.instrumentName}（口令「${question.token}」）。`;
    feedback.classList.add(correct ? "ok" : "bad");
    questionBox.querySelector("#quizNext").hidden = false;
    questionBox.querySelector("#quizNext").textContent =
      session.index + 1 >= session.questions.length ? "查看本轮结果" : "下一题";

    TrainingRecords.addAnswer({
      piece: state.pieceName || "未命名片段",
      scope: scopeText(state.loop),
      measure: question.measure,
      beat: question.beat,
      token: question.token,
      answer: chosenName,
      correctName: question.instrumentName,
      correct
    });
    renderRecords();
  }

  function advance() {
    if (!session) return;
    const total = session.questions.length;
    const answered = session.index + 1;
    if (answered >= total) {
      session = null;
      questionBox.innerHTML = "";
      setStatus(`本轮训练完成：共 ${total} 个口令，记录已保存。可重新开始下一轮。`);
      syncControls();
      return;
    }
    session.index += 1;
    renderQuestion();
  }

  function abortSession(reason) {
    if (!session) return;
    const total = session.questions.length;
    const done = session.index + (session.answered ? 1 : 0);
    session = null;
    questionBox.innerHTML = "";
    setStatus(
      `训练已中断：${abortReasons[reason] || "排练设置发生变化"}。本轮已答 ${done} / ${total} 题，答题记录仍然保留。`,
      "error"
    );
    syncControls();
  }

  function formatTime(iso) {
    const date = new Date(iso);
    return date.toLocaleString("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
    });
  }

  function renderRecords() {
    const records = TrainingRecords.load();
    const summary = TrainingRecords.stats(records);
    recordsSummary.textContent =
      summary.total ? `累计答题 ${summary.total} 次 · 答对 ${summary.correct} 次 · 正确率 ${summary.accuracy}%`
                    : "还没有答题记录。";

    recordsList.innerHTML = records.length ? [...records].reverse().map((record) => `
      <article class="record-item ${record.correct ? "ok" : "bad"}">
        <div class="record-head">
          <span class="record-verdict">${record.correct ? "✓ 答对" : "✗ 答错"}</span>
          <time>${formatTime(record.at)}</time>
        </div>
        <p>第${record.measure}小节第${record.beat}拍「${record.token}」——你选：${record.answer}
          ${record.correct ? "" : `，应为${record.correctName}`}</p>
        <p class="record-meta">${record.piece} · ${record.scope}</p>
      </article>
    `).join("") : "<p>完成一轮训练后，这里会显示每次答题记录。</p>";
  }

  trainBtn.addEventListener("click", startTraining);

  questionBox.addEventListener("click", (event) => {
    if (event.target.closest("#quizReplay")) {
      if (session) window.luoguPlaySound(instruments[session.questions[session.index].instrumentIndex]);
      return;
    }
    const option = event.target.closest(".option-btn");
    if (option) answer(option.dataset.option);
    if (event.target.closest("#quizNext")) advance();
  });

  // 谱面 / 速度 / 循环 / 加载方案变化：更新范围提示，训练中则中断本轮（记录照留）
  window.addEventListener("luogu:score-change", (event) => {
    scopeHint.textContent = `抽查范围：${scopeText(state.loop)}`;
    abortSession(event.detail?.reason);
  });

  scopeHint.textContent = `抽查范围：${scopeText(state.loop)}`;
  setStatus("准备就绪：按当前循环范围逐个抽查已填口令，每个口令一轮只出现一次。");
  syncControls();
  renderRecords();
})();
