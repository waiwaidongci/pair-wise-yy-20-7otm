/*
 * 口令听辨训练 —— 记录层（只管持久化，不依赖页面 / 规则）
 * 记录独立存储：重开页面、谱面改动、训练中断都不影响历史记录。
 */
(function initTrainingRecords() {
  const recordKey = "wxyy-4-luogujing-training-records";

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(recordKey) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function save(records) {
    localStorage.setItem(recordKey, JSON.stringify(records));
  }

  function addAnswer(entry) {
    const records = load();
    records.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      piece: entry.piece,
      scope: entry.scope,
      measure: entry.measure,
      beat: entry.beat,
      token: entry.token,
      answer: entry.answer,
      correctName: entry.correctName,
      correct: entry.correct
    });
    save(records);
    return records;
  }

  function stats(records = load()) {
    const total = records.length;
    const correct = records.filter((item) => item.correct).length;
    return {
      total,
      correct,
      accuracy: total ? Math.round((correct / total) * 100) : 0
    };
  }

  window.TrainingRecords = { load, addAnswer, stats };
})();
