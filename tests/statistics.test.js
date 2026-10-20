import test from "node:test";
import assert from "node:assert/strict";
import { calculateRegression, calculateFromStats, calculateSampleStats, parseNumber, formatNumber, parsePastedPoints, predictY, sum } from "../src/utils/statistics.js";
import { normalizeSnapshot, normalizeSessions } from "../src/utils/session.js";

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
  assert.deepEqual(r.stats, { n: 3, sumX: 6, sumY: 10, sumX2: 14, sumXY: 23, sumResiduals: r.sumResidualsCalc });
  near(sum(r.rows.map((p) => p.residual)), 0);
  near(sum(r.rows.map((p) => p.x * p.residual)), 0);
});

test("two distinct points define a line but not its standard errors", () => {
  const r = calculateRegression(points([[0, 0], [2, -4]]));
  assert.equal(r.slope, -2);
  assert.equal(r.intercept, 0);
  assert.equal(r.sumResidualsCalc, 0);
  assert.equal(r.stdErrA, null);
  assert.equal(r.stdErrB, null);
});

test("zero slope, zero residuals, and zero errors are valid results", () => {
  const r = calculateRegression(points([[-1, 2], [0, 2], [1, 2]]));
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 2);
  assert.equal(r.stdErrA, 0);
  assert.equal(r.stdErrB, 0);
  assert.equal(r.sumResidualsCalc, 0);
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
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 1 - 2e12);
  assert.equal(r.sumResidualsCalc, 0);
  for (const p of data) assert.equal(predictY(p.x, r), p.y);
});

test("nonrepresentable means at large offsets still give the correct slope", () => {
  const r = calculateRegression(points([[1e12, 1], [1e12 + 1, 3], [1e12 + 3, 7]]));
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 1 - 2e12);
  assert.equal(r.sumResidualsCalc, 0);
});

test("insufficient points, identical X, invalid and overflowing values fail safely", () => {
  assert.equal(calculateRegression([]).slope, null);
  for (const data of [points([[1, 2]]), points([[1, 2], [1, 3]]), points([[0, 0], [Infinity, 1]]), points([[1e200, 2], [2e200, 3]])]) {
    const r = calculateRegression(data);
    assert.equal(r.slope, null);
    assert.ok(r.errorMsg);
  }
});

test("recalculation after edits and removals uses only current data", () => {
  const data = points([[0, 1], [1, 3], [2, 5]]);
  assert.equal(calculateRegression(data).slope, 2);
  const changed = data.map((p, i) => i === 2 ? { ...p, y: 7 } : p);
  assert.equal(calculateRegression(changed).slope, 3);
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

test("underflow is reported instead of displaying a spurious zero variance", () => {
  assert.ok(calculateSampleStats([1e-200, -1e-200]).errorMsg);
  assert.ok(calculateRegression(points([[0, 0], [1, 1e-200]])).errorMsg);
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
