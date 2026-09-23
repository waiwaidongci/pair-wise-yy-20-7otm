/*
 * 口令听辨训练 —— 页面层
 * 负责训练面板渲染、播放声音与交互；规则取自 TrainingRules，
 * 答题记录交给 TrainingStore，本文件不持有跨页面状态。
 */
(function () {
  "use strict";

  const { INSTRUMENTS, TrainingSession, startCheck } = window.TrainingRules;
  const { loadRecords, addRecord, stats } = window.TrainingStore;

  // 与 app.js 中谱面存储键保持一致，训练开始时读取当时的谱面快照。
  const scoreStorageKey = "wxyy-4-luogujing-grid";

  // 各乐器的听辨音色（频率/波形与排练播放一致）
  const soundProfile = [
    { freq: 180, type: "square" },
    { freq: 120, type: "sine" },
    { freq: 360, type: "square" },
    { freq: 520, type: "square" }
  ];

  const startBtn = document.querySelector("#trainStartBtn");
  const body = document.querySelector("#trainBody");
  const messageBox = document.querySelector("#trainMessage");
  const statsBox = document.querySelector("#trainStats");
  const recordList = document.querySelector("#trainRecordList");

  let session = null;
  let audioContext = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showMessage(text, kind) {
    messageBox.textContent = text;
    messageBox.className = `training-message show ${kind || ""}`;
    messageBox.hidden = false;
  }

  function hideMessage() {
    messageBox.hidden = true;
    messageBox.textContent = "";
  }

  function readScore() {
    try {
      return JSON.parse(localStorage.getItem(scoreStorageKey) || "null") || {};
    } catch (error) {
      return {};
    }
  }

  function playSound(rowIndex) {
    audioContext ||= new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();
    const profile = soundProfile[rowIndex];
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.value = profile.freq;
    osc.type = profile.type;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
    osc.connect(gain).connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.09);
  }

  // ---------- 训练流程 ----------

  function startTraining() {
    const score = readScore();
    const pattern = score.pattern || [];
    const check = startCheck(pattern, score.loop || "");
    if (!check.ok) {
      // 小节没有口令时不能开始，并指出是哪一小节
      showMessage(`第${check.emptyMeasures.join("、")}小节没有口令，无法开始。请先在对应小节填入口令。`, "error");
      renderIdle();
      return;
    }
    hideMessage();
    session = new TrainingSession(pattern, score.loop || "", { pieceName: score.pieceName || "" });
    renderQuestion();
  }

  function chooseAnswer(rowIndex) {
    if (!session || session.answered) return;
    const result = session.answer(rowIndex);
    if (!result) return;
    addRecord({
      at: result.at,
      correct: result.correct,
      piece: session.pieceName || "未命名片段",
      measure: result.question.measure,
      beat: result.question.beat,
      asked: INSTRUMENTS[result.question.row].name,
      chosen: INSTRUMENTS[rowIndex].name
    });
    renderQuestion();
    renderRecords();
  }

  function goNext() {
    if (!session) return;
    const hasMore = session.next();
    if (hasMore) {
      renderQuestion();
    } else {
      renderFinished();
    }
  }

  // 训练中改动谱面、速度或循环：本次中断，答过的记录照样保留
  function interruptTraining(reason) {
    if (!session) return;
    const done = session.answers.length;
    session = null;
    showMessage(`${reason}，本次训练已中断。已答的 ${done} 条记录仍保留在训练记录中。`, "warn");
    renderIdle();
  }

  window.addEventListener("score:changed", () => interruptTraining("谱面已改动"));
  window.addEventListener("bpm:changed", () => interruptTraining("速度已调整"));
  window.addEventListener("loop:changed", () => interruptTraining("循环范围已改动"));

  // ---------- 渲染 ----------

  function renderIdle() {
    body.className = "training-body idle";
    body.replaceChildren(
      el("p", "tip", "开始后按当前谱面与循环范围，逐个抽查已填口令；听声音后在大锣、鼓、钹、小锣中选出对应乐器，答完立即显示对错。"),
      el("p", "tip", "同一口令一轮内只出现一次；范围内若有小节没有口令则不能开始。训练中改动谱面、速度或循环会中断本轮，但答题记录不会丢失。")
    );
  }

  function renderQuestion() {
    if (!session) return;
    if (session.finished) {
      renderFinished();
      return;
    }

    const question = session.current;
    body.className = "training-body asking";
    body.replaceChildren();

    const head = el("div", "question-head");
    head.append(
      el("span", "question-index", `第 ${session.index + 1} / ${session.total} 题`),
      el("span", "question-pos", `第${question.measure}小节 · 第${question.beat}拍`)
    );

    const replay = el("button", "btn-secondary", "🔊 重听一遍");
    replay.type = "button";
    replay.dataset.action = "replay";

    const options = el("div", "options");
    INSTRUMENTS.forEach((instrument, rowIndex) => {
      const option = el("button", "option", instrument.name);
      option.type = "button";
      option.dataset.option = rowIndex;
      if (session.answered) {
        option.disabled = true;
        if (rowIndex === question.row) option.classList.add("correct");
        if (rowIndex === session.lastResult.chosenRow && !session.lastResult.correct) {
          option.classList.add("wrong");
        }
      }
      options.append(option);
    });

    body.append(head, replay, options);

    if (session.answered) {
      const result = session.lastResult;
      const answer = INSTRUMENTS[question.row];
      const feedback = el(
        "p",
        `feedback ${result.correct ? "right" : "bad"}`,
        result.correct
          ? `回答正确！这一声是「${answer.name}」（${question.token}）。`
          : `回答错误，正确答案是「${answer.name}」（${question.token}）。`
      );
      const next = el("button", "btn-primary", session.index + 1 >= session.total ? "查看本轮结果" : "下一题");
      next.type = "button";
      next.dataset.action = "next";
      body.append(feedback, next);
    } else {
      // 出题即播放，让注意力集中在听辨上
      playSound(question.row);
    }
  }

  function renderFinished() {
    const doneCount = session ? session.answers.length : 0;
    const correctCount = session ? session.correctCount : 0;
    session = null; // 本轮结束，之后再改谱面不再提示“中断”

    body.className = "training-body summary";
    const accuracy = doneCount ? Math.round((correctCount / doneCount) * 100) : 0;
    const restart = el("button", "btn-primary", "再来一轮");
    restart.type = "button";
    restart.dataset.action = "restart";
    body.replaceChildren(
      el("p", "summary-line", `本轮完成：共 ${doneCount} 题，答对 ${correctCount} 题，正确率 ${accuracy}%。`),
      restart
    );
  }

  function formatTime(iso) {
    const date = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function renderRecords() {
    const records = loadRecords();
    const summary = stats(records);
    statsBox.textContent = summary.total
      ? `共 ${summary.total} 答 · 正确率 ${Math.round(summary.accuracy * 100)}%`
      : "";

    recordList.replaceChildren();
    if (!records.length) {
      recordList.append(el("p", "tip", "还没有训练记录。"));
      return;
    }

    // 全部记录已持久化，列表只展示最近 100 条
    records.slice(0, 100).forEach((record) => {
      const item = el("div", `record-item ${record.correct ? "is-right" : "is-bad"}`);
      item.append(
        el("span", "record-mark", record.correct ? "对" : "错"),
        el("span", "record-text",
          `《${record.piece}》第${record.measure}小节第${record.beat}拍 · ${record.asked}` +
          (record.correct ? "" : `（答成${record.chosen}）`)),
        el("span", "record-time", formatTime(record.at))
      );
      recordList.append(item);
    });
  }

  // ---------- 事件 ----------

  startBtn.addEventListener("click", startTraining);

  body.addEventListener("click", (event) => {
    const option = event.target.closest("[data-option]");
    if (option && session && !session.answered) {
      chooseAnswer(Number(option.dataset.option));
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "replay" && session && session.current) {
      playSound(session.current.row);
    } else if (action === "next") {
      goNext();
    } else if (action === "restart") {
      startTraining();
    }
  });

  renderIdle();
  renderRecords();
})();
