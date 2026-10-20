import test from "node:test";
import assert from "node:assert/strict";
import { calculateRegression, calculateFromStats, calculateSampleStats, parseNumber, formatNumber, parsePastedPoints, predictY, sum, calculateDatasets, validUncertainty } from "../src/utils/statistics.js";
import { normalizeSnapshot, normalizeSessions } from "../src/utils/session.js";
import { createDataset } from "../src/utils/datasets.js";
import { plotBounds } from "../src/utils/plot.js";

const near = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const points = (pairs) => pairs.map(([x, y], id) => ({ id: String(id), x, y }));

test("known noisy fit: coefficients, residuals, R² and coefficient standard errors", () => {
  const r = calculateRegression(points([[1, 2], [2, 3], [3, 5]]));
  assert.equal(r.errorMsg, "");
  near(r.slope, 1.5);
  near(r.intercept, 1 / 3);
  near(r.sumResidualsCalc, 1 / 6);
  near(r.stdErrA, Math.sqrt(1 / 12));
  near(r.stdErrB, Math.sqrt(7 / 18));
  near(r.rSquared, 27 / 28);
  assert.deepEqual(r.stats, { n: 3, sumX: 6, sumY: 10, sumX2: 14, sumXY: 23, sumY2: 38, sumResiduals: r.sumResidualsCalc });
  near(sum(r.rows.map((p) => p.residual)), 0);
  near(sum(r.rows.map((p) => p.x * p.residual)), 0);
});

test("two distinct points define a line but not its standard errors", () => {
  const r = calculateRegression(points([[0, 0], [2, -4]]));
  assert.equal(r.slope, -2);
  assert.equal(r.intercept, 0);
  near(r.sumResidualsCalc, 0);
  assert.equal(r.stdErrA, null);
  assert.equal(r.stdErrB, null);
});

test("zero slope, zero residuals, and zero errors are valid results", () => {
  const r = calculateRegression(points([[-1, 2], [0, 2], [1, 2]]));
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 2);
  assert.equal(r.stdErrA, 0);
  assert.equal(r.stdErrB, 0);
  near(r.sumResidualsCalc, 0);
  assert.equal(r.rSquared, null); // Constant Y has no defined coefficient of determination.
});

test("negative decimals and repeated observations are retained", () => {
  const r = calculateRegression(points([[-1.5, 4], [-1.5, 4], [0, 1], [0.5, 0]]));
  assert.equal(r.stats.n, 4);
  near(r.slope, -2);
  near(r.intercept, 1);
  near(r.sumResidualsCalc, 0);
});

test("large X offsets do not cancel variance or corrupt graph predictions", () => {
  const data = points([[1e12, 1], [1e12 + 1, 3], [1e12 + 2, 5]]);
  const r = calculateRegression(data);
  assert.equal(r.errorMsg, "");
  near(r.slope, 2);
  assert.equal(r.intercept, 1 - 2e12);
  near(r.sumResidualsCalc, 0);
  for (const p of data) assert.equal(predictY(p.x, r), p.y);
});

test("nonrepresentable means at large offsets still give the correct slope", () => {
  const r = calculateRegression(points([[1e12, 1], [1e12 + 1, 3], [1e12 + 3, 7]]));
  near(r.slope, 2);
  assert.equal(r.intercept, 1 - 2e12);
  near(r.sumResidualsCalc, 0);
});

test("insufficient points, identical X, invalid and overflowing values fail safely", () => {
  assert.equal(calculateRegression([]).slope, null);
  for (const data of [points([[1, 2]]), points([[1, 2], [1, 3]]), points([[0, 0], [Infinity, 1]])]) {
    const r = calculateRegression(data);
    assert.equal(r.slope, null);
    assert.ok(r.errorMsg);
  }
});

test("recalculation after edits and removals uses only current data", () => {
  const data = points([[0, 1], [1, 3], [2, 5]]);
  assert.equal(calculateRegression(data).slope, 2);
  const changed = data.map((p, i) => i === 2 ? { ...p, y: 7 } : p);
  near(calculateRegression(changed).slope, 3);
  assert.equal(calculateRegression(changed.slice(0, 2)).slope, 2);
  assert.equal(calculateRegression(changed.slice(0, 1)).slope, null);
});

test("manual totals agree with raw data and require residuals for errors", () => {
  const input = { n: "3", sumX: "6", sumY: "10", sumX2: "14", sumXY: "23", sumResiduals: "" };
  const r = calculateFromStats(input);
  near(r.slope, 1.5);
  near(r.intercept, 1 / 3);
  assert.equal(r.sumResidualsCalc, null);
  assert.equal(r.stdErrA, null);
  near(calculateFromStats({ ...input, sumResiduals: String(1 / 6) }).stdErrA, Math.sqrt(1 / 12));
  assert.equal(calculateFromStats({ ...input, sumResiduals: "0" }).stdErrA, 0);
});

test("invalid, inconsistent and inadequately precise manual totals are rejected", () => {
  const input = { n: "3", sumX: "6", sumY: "10", sumX2: "14", sumXY: "23", sumResiduals: "" };
  for (const change of [{ n: "1" }, { n: "2.5" }, { n: "-3" }, { sumX: "" }, { sumX2: "-1" }, { sumX2: "1" }, { sumXY: "2bad" }, { sumResiduals: "-1" }, { sumResiduals: "Infinity" }]) {
    const r = calculateFromStats({ ...input, ...change });
    assert.equal(r.slope, null);
    assert.ok(r.errorMsg);
  }
  assert.ok(calculateFromStats({ n: 3, sumX: 3e12, sumX2: 3e24, sumY: 9, sumXY: 9e12 }).errorMsg);
});

test("sample standard deviation uses n−1 and standard error uses √n", () => {
  const r = calculateSampleStats([1, 2, 3]);
  assert.equal(r.mean, 2);
  assert.equal(r.sd, 1);
  near(r.se, 1 / Math.sqrt(3));
  assert.equal(calculateSampleStats([]).mean, null);
  assert.equal(calculateSampleStats([0]).sd, null);
  assert.equal(calculateSampleStats([-2, -2]).se, 0);
  assert.ok(calculateSampleStats([Infinity]).errorMsg);
  assert.ok(calculateSampleStats([-1e308, 1e308]).errorMsg);
  near(calculateSampleStats([1e12, 1e12 + 1, 1e12 + 3]).sd, Math.sqrt(7 / 3));
});

test("strict input accepts zero, signs, decimals and scientific notation", () => {
  for (const text of ["0", "-0.5", "+.5", "1.", "1e-3", " 2 "]) assert.equal(parseNumber(text), Number(text));
  for (const value of ["", " ", "1abc", "Infinity", "1e999", "1e-999", "0x10", "1,2", null, {}, NaN]) assert.equal(parseNumber(value), null);
});

test("formatting extreme finite values does not produce NaN or Infinity", () => {
  assert.equal(formatNumber(1e308, "dec", 4), 1e308);
  assert.equal(formatNumber(5e-324, "sig", 4), 5e-324);
  assert.equal(formatNumber(Number.MAX_VALUE, "sig", 1), "2e+308");
  assert.equal(formatNumber(null), "---");
  assert.equal(formatNumber(1.23456, "dec", 3), 1.235);
  assert.equal(formatNumber(0.012345, "sig", 3), 0.0123);
});

test("compensated totals preserve small contributions", () => assert.equal(sum([1e16, 1, -1e16]), 1));

test("pasting preserves empty cells and rejects partial numbers and extra columns", () => {
  assert.deepEqual(parsePastedPoints("X,Y\n0,-1\n.5,1e2"), { points: [{ x: 0, y: -1 }, { x: 0.5, y: 100 }], invalidRows: [] });
  assert.deepEqual(parsePastedPoints("1,,2\n3\t\t4\n5bad 6\n7 Infinity\n8 9 10").invalidRows, [1, 2, 3, 4, 5]);
  assert.deepEqual(parsePastedPoints("1\t2\n3 4\n"), { points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], invalidRows: [] });
  assert.deepEqual(parsePastedPoints("\nX,Y\n1,2").invalidRows, []);
});

test("scaled calculations handle small and large magnitudes without false zeros", () => {
  for (const scale of [1e-200, 1e-100, 1e100, 1e200]) {
    for (const mode of ["linear", "origin"]) {
      const r = calculateRegression(points([[scale, 2 * scale], [2 * scale, 4 * scale], [3 * scale, 6 * scale]]), mode);
      assert.equal(r.errorMsg, "");
      near(r.slope, 2);
      near(r.rSquared, 1);
      assert.ok(r.stdErrA < 1e-12);
    }
  }
  const r = calculateSampleStats([1e-200, -1e-200]);
  assert.equal(r.errorMsg, "");
  assert.ok(Math.abs(r.sd / 1e-200 - Math.SQRT2) < 1e-12);
});

test("snapshots preserve both screens and repair duplicate IDs and layout entries", () => {
  const r = normalizeSnapshot({ v: 1, ls: { dataPoints: [{ id: "a", x: 0, y: 1 }, { id: "a", x: 2, y: 3 }], sectionOrder: ["analysis", "analysis", "unknown"] }, se: { datasets: [{ id: "tab", name: "test", values: [{ v: 0 }] }] } });
  assert.equal(r.ls.dataPoints.length, 2);
  assert.notEqual(r.ls.dataPoints[0].id, r.ls.dataPoints[1].id);
  assert.deepEqual(r.ls.sectionOrder, ["analysis", "regression"]);
  assert.equal(r.se.activeDatasetId, "tab");
  assert.equal(r.se.datasets[0].values[0].v, 0);
});

test("malformed snapshots cannot inject nonnumeric values or crash session lists", () => {
  for (const value of [null, [], { v: 2 }, { ls: { dataPoints: [null] } }, { ls: { dataPoints: [{ x: "bad", y: 1 }] } }, { se: { datasets: "bad" } }]) assert.throws(() => normalizeSnapshot(value));
  assert.deepEqual(normalizeSessions(null), {});
  assert.deepEqual(Object.keys(normalizeSessions({ bad: { snapshot: null }, good: { snapshot: { ls: {} } } })), ["good"]);
});


test("origin fit uses uncentered R², n−1 degrees of freedom and no intercept uncertainty", () => {
  const r = calculateRegression(points([[1, 2], [2, 3], [3, 5]]), "origin");
  near(r.slope, 23 / 14);
  assert.equal(r.intercept, 0);
  near(r.sumResidualsCalc, 3 / 14);
  near(r.stdErrA, Math.sqrt(3 / 392));
  assert.equal(r.stdErrB, null);
  assert.equal(r.df, 2);
  near(r.rSquared, 529 / 532);
  assert.equal(r.rSquaredDefinition, "uncentered");
});

test("origin fit accepts identical nonzero X and a single nonzero point", () => {
  const same = calculateRegression(points([[2, 3], [2, 5]]), "origin");
  near(same.slope, 2);
  near(same.sumResidualsCalc, 2);
  near(same.stdErrA, 0.5);
  const one = calculateRegression(points([[-2, 4]]), "origin");
  assert.equal(one.slope, -2);
  assert.equal(one.stdErrA, null);
  assert.equal(one.df, 0);
  assert.ok(calculateRegression(points([[0, 1], [0, 2]]), "origin").errorMsg);
  assert.equal(calculateRegression(points([[1, 0], [2, 0]]), "origin").rSquared, null);
});

test("origin summary statistics agree with raw fit", () => {
  const r = calculateFromStats({ n: 3, sumX: 6, sumY: 10, sumX2: 14, sumXY: 23, sumY2: 38, sumResiduals: 3 / 14 }, "origin");
  near(r.slope, 23 / 14);
  near(r.stdErrA, Math.sqrt(3 / 392));
  near(r.rSquared, 529 / 532);
  assert.equal(r.df, 2);
});

test("large manual sums do not require an overflowing nΣx² intermediate", () => {
  for (const fitMode of ["linear", "origin"]) {
    const r = calculateFromStats({ n: 3, sumX: 0, sumY: 0, sumX2: 1e308, sumXY: 1e308, sumResiduals: 1e100 }, fitMode);
    assert.equal(r.errorMsg, "");
    assert.equal(r.slope, 1);
    assert.ok(r.stdErrA > 0 && r.stdErrA < 1e-100);
  }
});

test("unrepresentable slopes fail explicitly rather than becoming zero or infinity", () => {
  for (const [x, y] of [[1e200, 1e-200], [1e-200, 1e200]]) {
    const r = calculateRegression([{ x, y }, { x: 2 * x, y: 2 * y }], "origin");
    assert.equal(r.slope, null);
    assert.ok(r.errorMsg);
  }
});

test("uncertainties are optional, nonnegative and do not weight the fit", () => {
  for (const value of [null, "", 0, "0", 0.1]) assert.ok(validUncertainty(value));
  for (const value of [-1, "-0.1", "bad", Infinity]) assert.equal(validUncertainty(value), false);
  const data = points([[1, 2], [2, 3], [3, 5]]);
  const baseline = calculateRegression(data);
  const bars = calculateRegression(data.map((p, i) => ({ ...p, dx: i, dy: i / 10 })));
  assert.equal(bars.slope, baseline.slope);
  assert.equal(bars.stdErrA, baseline.stdErrA);
  assert.ok(calculateRegression([{ x: 1, y: 2, dx: -1 }]).errorMsg);
});

test("multiple dataset calculations remain independent of edits and visibility", () => {
  const datasets = [
    { id: "a", mode: "raw", fitMode: "linear", dataPoints: points([[0, 1], [1, 3], [2, 5]]) },
    { id: "b", mode: "raw", fitMode: "origin", visible: false, dataPoints: points([[1, -3], [2, -6]]) },
  ];
  const before = calculateDatasets(datasets);
  const edited = calculateDatasets(datasets.map(d => d.id === "a" ? { ...d, dataPoints: points([[0, 0], [1, 10]]) } : d));
  near(before[0].result.slope, 2);
  near(edited[0].result.slope, 10);
  assert.deepEqual(edited[1].result, before[1].result);
});

test("legacy single-dataset snapshots migrate without losing mode, fit or measurements", () => {
  const legacy = { v: 1, ls: { mode: "raw", fitMode: "origin", dataPoints: [{ id: "p", x: -2, y: 3 }] } };
  const restored = normalizeSnapshot(legacy).ls;
  assert.equal(restored.datasets.length, 1);
  assert.equal(restored.datasets[0].fitMode, "origin");
  assert.deepEqual(restored.datasets[0].dataPoints, legacy.ls.dataPoints);
  assert.equal(restored.activeDatasetId, restored.datasets[0].id);
});

test("multiple datasets, visibility, color, uncertainty and axis labels round-trip", () => {
  const datasets = [createDataset(0), createDataset(1)];
  datasets[0].dataPoints = [{ id: "p", x: 1, y: 2, dx: 0, dy: 0.2 }];
  datasets[1].visible = false;
  datasets[1].fitMode = "origin";
  const ls = { datasets, activeDatasetId: datasets[1].id, axisLabels: { xName: "時間", xUnit: "s", yName: "距離", yUnit: "m" } };
  const restored = normalizeSnapshot(JSON.parse(JSON.stringify({ v: 1, ls }))).ls;
  assert.deepEqual(restored.datasets, datasets);
  assert.deepEqual(restored.axisLabels, ls.axisLabels);
  assert.equal(restored.activeDatasetId, datasets[1].id);
  assert.throws(() => normalizeSnapshot({ ls: { dataPoints: [{ x: 1, y: 2, dx: -1 }] } }));
});

test("legacy report settings retain only graph axis labels", () => {
  const report = { title: "物理実験", xName: "時間", xUnit: "s", yName: "距離", yUnit: "m" };
  const restored = normalizeSnapshot({ ls: { report } }).ls;
  assert.deepEqual(restored.axisLabels, { xName: "時間", xUnit: "s", yName: "距離", yUnit: "m" });
  assert.equal(Object.hasOwn(restored, "report"), false);
  assert.equal(Object.hasOwn(restored.axisLabels, "title"), false);
  const axisLabels = { xName: "電流", xUnit: "A", yName: "電圧", yUnit: "V" };
  assert.deepEqual(normalizeSnapshot({ ls: { report, axisLabels } }).ls.axisLabels, axisLabels);
  assert.deepEqual(normalizeSnapshot({ ls: {} }).ls.axisLabels, { xName: "X", xUnit: "", yName: "Y", yUnit: "" });
});

test("error-bar CSV round-trips optional empty cells and rejects negative uncertainty", () => {
  const parsed = parsePastedPoints("X,Y,DeltaX,DeltaY\n1,2,,0.5\n2,4,0.1,0");
  assert.deepEqual(parsed.invalidRows, []);
  assert.deepEqual(parsed.points, [{ x: 1, y: 2, dx: null, dy: 0.5 }, { x: 2, y: 4, dx: 0.1, dy: 0 }]);
  assert.deepEqual(parsePastedPoints("1,2,-0.1,0.2").invalidRows, [1]);
});

test("graph ranges include both directions of uncertainties and exclude hidden series", () => {
  const bounds = plotBounds([{ mode: "raw", visible: true, dataPoints: [{ x: 2, y: 3, dx: 4, dy: 5 }] }, { visible: false, dataPoints: [{ x: 1e10, y: 1e10 }] }]);
  assert.ok(bounds.x[0] < -2 && bounds.x[1] > 6);
  assert.ok(bounds.y[0] < -2 && bounds.y[1] > 8);
  assert.ok(bounds.x[1] < 10);
});
