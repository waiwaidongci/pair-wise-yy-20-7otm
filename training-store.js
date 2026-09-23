/*
 * 口令听辨训练 —— 记录层
 * 只管答题记录的持久化与统计，键独立于排练谱面，
 * 因此关掉再重开页面（即使未保存谱面），训练记录照样可查。
 */
(function () {
  "use strict";

  const recordKey = "wxyy-4-luogujing-training-records";
  const MAX_RECORDS = 300;

  function loadRecords() {
    try {
      const data = JSON.parse(localStorage.getItem(recordKey) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function persist(records) {
    try {
      localStorage.setItem(recordKey, JSON.stringify(records));
    } catch (error) {
      // 存储不可用（隐私模式等）时不影响本次训练。
    }
  }

  // 保存一次答题；新记录在前，超过上限丢弃最旧的
  function addRecord(entry) {
    const records = loadRecords();
    records.unshift({ id: crypto.randomUUID(), ...entry });
    persist(records.slice(0, MAX_RECORDS));
    return records[0];
  }

  function stats(records = loadRecords()) {
    const total = records.length;
    const correct = records.filter((item) => item.correct).length;
    return { total, correct, accuracy: total ? correct / total : 0 };
  }

  window.TrainingStore = { recordKey, loadRecords, addRecord, stats };
})();
