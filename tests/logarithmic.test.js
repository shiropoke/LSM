import test from "node:test";
import assert from "node:assert/strict";
import { calculateDatasets, calculateRegression, predictY } from "../src/utils/statistics.js";
import { axisValue } from "../src/utils/scales.js";
import { lineSegment, logTickLabel, plotBounds, plotTicks } from "../src/utils/plot.js";
import { calculationSteps, originalModelEquation, resultLatex } from "../src/utils/latex.js";
import { normalizeSnapshot } from "../src/utils/session.js";
import { renderMath } from "../src/utils/math.js";

const near = (actual, expected, tolerance = 1e-12) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const dataset = (pairs, fitMode = "linear") => ({ id: "a", name: "測定A", mode: "raw", fitMode, dataPoints: pairs.map(([x, y], i) => ({ id: String(i), x, y })) });
const fit = (pairs, scales, fitMode) => calculateDatasets([dataset(pairs, fitMode)], scales)[0].result;

test("linear scales preserve all original regression statistics", () => {
  const d = dataset([[0, -1], [1, 3], [2, 4]]);
  const { scales, ...result } = calculateDatasets([d])[0].result;
  assert.deepEqual(result, calculateRegression(d.dataPoints));
  assert.deepEqual(scales, { xScale: "linear", yScale: "linear" });
});

test("semi-log Y recovers an exponential, including negative and zero X", () => {
  const r = fit([[-1, 0.01], [0, 1], [1, 100]], { yScale: "log" });
  near(r.slope, 2); near(r.intercept, 0); near(r.rSquared, 1);
  near(r.sumResidualsCalc, 0); near(r.stdErrA, 0); near(r.stdErrB, 0);
  near(10 ** predictY(2, r), 10000);
  assert.equal(r.df, 1);
});

test("semi-log X recovers a logarithmic model and permits nonpositive Y", () => {
  const r = fit([[1, -1], [10, 1], [100, 3]], { xScale: "log" });
  near(r.slope, 2); near(r.intercept, -1); near(r.rSquared, 1);
  near(predictY(Math.log10(1000), r), 5);
});

test("log-log recovers a power law in original coordinates", () => {
  const r = fit([[1, 10], [10, 1000], [100, 100000]], { xScale: "log", yScale: "log" });
  near(r.slope, 2); near(r.intercept, 1); near(r.sumResidualsCalc, 0);
  near(10 ** predictY(Math.log10(1000), r), 1e7);
  assert.equal(r.rows[1].originalX, 10);
  assert.equal(r.rows[1].originalY, 1000);
  assert.equal(r.rows[1].x, 1);
  assert.equal(r.rows[1].y, 3);
});

test("residuals, R² and standard errors use transformed, unrounded coordinates", () => {
  for (const scales of [{ yScale: "log" }, { xScale: "log", yScale: "log" }]) {
    const r = fit(scales.xScale ? [[10, 100], [100, 1000], [1000, 100000]] : [[1, 100], [2, 1000], [3, 100000]], scales);
    near(r.slope, 1.5); near(r.intercept, 1 / 3);
    near(r.sumResidualsCalc, 1 / 6); near(r.rSquared, 27 / 28);
    near(r.stdErrA, Math.sqrt(1 / 12)); near(r.stdErrB, Math.sqrt(7 / 18));
    near(r.rows[0].residual, 1 / 6);
  }
});

test("origin constraint, degrees of freedom and uncentered R² apply after transformation", () => {
  const r = fit([[10, 100], [100, 1000], [1000, 100000]], { xScale: "log", yScale: "log" }, "origin");
  near(r.slope, 23 / 14); near(r.intercept, 0);
  near(r.sumResidualsCalc, 3 / 14); near(r.rSquared, 1 - (3 / 14) / 38);
  near(r.stdErrA, Math.sqrt((3 / 14) / 2 / 14));
  assert.equal(r.stdErrB, null); assert.equal(r.df, 2);
  assert.ok(fit([[1, 10], [1, 100]], { xScale: "log" }, "origin").errorMsg);
});

test("logarithmic domains reject zero and negative measurements without discarding rows", () => {
  for (const axis of ["x", "y"]) for (const value of [0, -1]) {
    const pairs = axis === "x" ? [[value, 1], [1, 2]] : [[1, value], [2, 2]];
    const r = fit(pairs, { [`${axis}Scale`]: "log" });
    assert.equal(r.slope, null);
    assert.equal(r.stats.n, 2);
    assert.match(r.errorMsg, /正の値/);
  }
  assert.equal(fit([], { yScale: "log" }).slope, null);
  assert.ok(fit([[2, 10]], { yScale: "log" }).errorMsg);
  assert.ok(fit([[2, 10], [2, 100]], { yScale: "log" }).errorMsg);
});

test("log regression supports extremely large and small positive measurements", () => {
  const r = fit([1e-300, 1e-150, 1, 1e150, 1e300].map(x => [x, x]), { xScale: "log", yScale: "log" });
  assert.equal(r.errorMsg, "");
  near(r.slope, 1); near(r.intercept, 0); near(r.rSquared, 1);
  assert.ok(Number.isFinite(axisValue(Number.MIN_VALUE, "log")));
});

test("error bars are transformed by their endpoints, with zero-crossing lower ends clipped", () => {
  const d = dataset([[1, 10], [10, 100], [100, 1000]]);
  d.dataPoints[0] = { ...d.dataPoints[0], dx: 2, dy: 1 };
  const original = JSON.stringify(d);
  const series = calculateDatasets([d], { xScale: "log", yScale: "log" });
  const bounds = plotBounds(series, { xScale: "log", yScale: "log" });
  assert.equal(bounds.error, undefined);
  assert.match(bounds.warning, /X方向/);
  assert.ok(bounds.x.every(Number.isFinite));
  assert.ok(bounds.y[0] < Math.log10(9));
  assert.ok(Math.log10(10) - Math.log10(9) > Math.log10(11) - Math.log10(10));
  near(series[0].result.slope, 1);
  assert.equal(JSON.stringify(d), original);
});

test("transformed points, grid ticks and fit line share the same plot coordinates", () => {
  const scales = { xScale: "log", yScale: "log" };
  const series = calculateDatasets([dataset([[1, 10], [10, 100], [100, 1000]])], scales);
  const bounds = plotBounds(series, scales);
  const segment = lineSegment(series[0].result, bounds);
  assert.ok(segment);
  for (const [x, y] of segment) near(y, x + 1);
  assert.ok(bounds.x[0] < 0 && bounds.x[1] > 2);
  assert.ok(bounds.y[0] < 1 && bounds.y[1] > 3);
  assert.deepEqual(plotTicks([0, 3], "log"), [0, 1, 2, 3]);
  assert.deepEqual(plotTicks([0, 3], "log").map(logTickLabel), ["1", "10", "100", "1000"]);
  assert.notEqual(logTickLabel(-200), "0");
  assert.equal(logTickLabel(400), "10^400");
  for (const range of [[-350, 350], [0.01, 0.02], [1, 1.001]]) {
    const ticks = plotTicks(range, "log");
    assert.ok(ticks.length >= 2 && ticks.length <= 12);
    assert.ok(ticks.every(tick => Number.isFinite(tick) && tick >= range[0] && tick <= range[1]));
  }
});

test("datasets remain independent and hidden invalid points do not block the plot", () => {
  const a = dataset([[1, 10], [10, 100], [100, 1000]]);
  const b = { ...dataset([[0, 1], [1, 2]]), id: "b", visible: false };
  const scales = { xScale: "log", yScale: "log" };
  const series = calculateDatasets([a, b], scales);
  near(series[0].result.slope, 1);
  assert.ok(series[1].result.errorMsg);
  assert.equal(plotBounds(series, scales).error, undefined);
  assert.ok(plotBounds(series.map(d => ({ ...d, visible: true })), scales).error);
  assert.equal(plotBounds([], scales), null);
});

test("aggregate input cannot be silently reinterpreted as logarithmic sums", () => {
  const d = { id: "s", mode: "stats", fitMode: "linear", manualStats: { n: 3, sumX: 6, sumY: 10, sumX2: 14, sumXY: 23 } };
  near(calculateDatasets([d])[0].result.slope, 1.5);
  const r = calculateDatasets([d], { yScale: "log" })[0].result;
  assert.equal(r.slope, null);
  assert.equal(r.stats.n, 3);
  assert.equal(r.stats.sumX, undefined);
  assert.match(r.errorMsg, /データ個別入力/);
});

test("logarithmic scales survive session/share serialization and old sessions default to linear", () => {
  const snapshot = { v: 1, ls: { datasets: [dataset([[1, 10], [10, 100]])], activeDatasetId: "a", axisLabels: { xScale: "log", yScale: "log", xName: "時間", xUnit: "s" } } };
  const restored = normalizeSnapshot(JSON.parse(JSON.stringify(snapshot))).ls;
  assert.equal(restored.axisLabels.xScale, "log");
  assert.equal(restored.axisLabels.yScale, "log");
  assert.equal(restored.axisLabels.xUnit, "s");
  near(calculateDatasets(restored.datasets, restored.axisLabels)[0].result.slope, 1);
  for (const axisLabels of [undefined, { xScale: "invalid", yScale: null }]) {
    const labels = normalizeSnapshot({ ls: { axisLabels } }).ls.axisLabels;
    assert.equal(labels.xScale, "linear"); assert.equal(labels.yScale, "linear");
  }
});

test("all logarithmic models and derivations render and export valid LaTeX", () => {
  for (const scales of [{ xScale: "log" }, { yScale: "log" }, { xScale: "log", yScale: "log" }]) for (const fitMode of ["linear", "origin"]) {
    const r = fit([[1, 10], [10, 100], [100, 1000]], scales, fitMode);
    assert.equal(r.errorMsg, "");
    assert.notEqual(renderMath(originalModelEquation(r)), null);
    const sections = calculationSteps(r);
    assert.match(sections[0].title, /対数変換/);
    assert.ok(sections[0].formulas.length > r.rows.length);
    for (const section of sections) for (const tex of section.formulas) {
      assert.notEqual(renderMath(tex), null, tex);
      assert.doesNotMatch(tex, /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
    }
    assert.ok(resultLatex(r, "raw").includes(originalModelEquation(r)));
  }
});
