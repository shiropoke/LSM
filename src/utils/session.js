import { parseNumber } from "./statistics.js";

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const withIds = (rows, convert) => {
  if (!Array.isArray(rows)) throw new Error("データ配列が不正です。");
  const ids = new Set();
  return rows.map((row) => {
    if (!isRecord(row)) throw new Error("データの形式が不正です。");
    const id = typeof row.id === "string" && row.id && !ids.has(row.id) ? row.id : makeId();
    ids.add(id);
    return { ...convert(row), id };
  });
};
const number = (value) => {
  const parsed = parseNumber(value);
  if (parsed === null) throw new Error("保存データに不正な数値が含まれています。");
  return parsed;
};

export const normalizeSnapshot = (snapshot) => {
  if (!isRecord(snapshot) || (snapshot.v !== undefined && snapshot.v !== 1)) throw new Error("対応していない保存データです。");
  const result = { v: 1 };
  if (snapshot.fmt) {
    result.fmt = { mode: snapshot.fmt.mode === "sig" ? "sig" : "dec", digits: Math.max(1, Math.min(12, parseInt(snapshot.fmt.digits, 10) || 4)) };
  }
  if (snapshot.ls !== undefined) {
    if (!isRecord(snapshot.ls)) throw new Error("近似直線の保存データが不正です。");
    const ls = snapshot.ls;
    const manualStats = {};
    for (const key of ["n", "sumX", "sumY", "sumX2", "sumXY", "sumResiduals"]) {
      const value = ls.manualStats?.[key];
      manualStats[key] = value == null || value === "" ? "" : String(number(value));
    }
    const order = Array.isArray(ls.sectionOrder) ? ls.sectionOrder : [];
    result.ls = {
      mode: ls.mode === "stats" ? "stats" : "raw",
      dataPoints: withIds(ls.dataPoints ?? [], (p) => ({ x: number(p.x), y: number(p.y) })),
      manualStats,
      sectionOrder: [...new Set([...order.filter((id) => ["regression", "analysis"].includes(id)), "regression", "analysis"])],
      isDarkMode: !!ls.isDarkMode,
    };
  }
  if (snapshot.se !== undefined) {
    if (!isRecord(snapshot.se)) throw new Error("標準誤差の保存データが不正です。");
    const se = snapshot.se;
    const datasets = withIds(se.datasets ?? [], (d) => ({
      name: typeof d.name === "string" ? d.name : "値を入力",
      values: withIds(d.values ?? [], (v) => ({ v: number(v.v) })),
    }));
    if (!datasets.length) datasets.push({ id: makeId(), name: "値を入力 1", values: [] });
    result.se = { datasets, activeDatasetId: datasets.some((d) => d.id === se.activeDatasetId) ? se.activeDatasetId : datasets[0].id };
  }
  return result;
};

export const normalizeSessions = (value) => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([name, entry]) => {
    try {
      return [[name, { updatedAt: Number(entry.updatedAt) || 0, snapshot: normalizeSnapshot(entry.snapshot) }]];
    } catch {
      return []; // One damaged entry must not prevent other sessions from loading.
    }
  }));
};
