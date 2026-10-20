import { createDataset, defaultAxisLabels, emptyManualStats } from "./datasets.js";
import { parseNumber, validUncertainty } from "./statistics.js";

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
    const normalizeDataset = (d, index) => {
      const defaults = createDataset(index);
      const manualStats = emptyManualStats();
      for (const key of Object.keys(manualStats)) {
        const value = d.manualStats?.[key];
        manualStats[key] = value == null || value === "" ? "" : String(number(value));
      }
      return {
        name: typeof d.name === "string" ? d.name : defaults.name,
        color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : defaults.color,
        visible: d.visible !== false,
        mode: d.mode === "stats" ? "stats" : "raw",
        fitMode: d.fitMode === "origin" ? "origin" : "linear",
        manualStats,
        dataPoints: withIds(d.dataPoints ?? [], p => {
          if (!validUncertainty(p.dx) || !validUncertainty(p.dy)) throw new Error("不確かさは0以上の数値にしてください。");
          const point = { x: number(p.x), y: number(p.y) };
          if (p.dx != null && p.dx !== "") point.dx = number(p.dx);
          if (p.dy != null && p.dy !== "") point.dy = number(p.dy);
          return point;
        }),
      };
    };
    let index = 0;
    const datasets = withIds(ls.datasets ?? [ls], d => normalizeDataset(d, index++));
    if (!datasets.length) datasets.push(createDataset());
    const activeDatasetId = datasets.some(d => d.id === ls.activeDatasetId) ? ls.activeDatasetId : datasets[0].id;
    const active = datasets.find(d => d.id === activeDatasetId);
    const axisLabels = defaultAxisLabels();
    // Keep axis names and units from older sessions without retaining report-only settings.
    const savedLabels = ls.axisLabels ?? ls.report;
    for (const key of Object.keys(axisLabels)) if (typeof savedLabels?.[key] === "string") axisLabels[key] = savedLabels[key];
    const order = Array.isArray(ls.sectionOrder) ? ls.sectionOrder : [];
    result.ls = {
      ...active, datasets, activeDatasetId, axisLabels,
      sectionOrder: [...new Set([...order.filter(id => ["regression", "analysis"].includes(id)), "regression", "analysis"])],
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
