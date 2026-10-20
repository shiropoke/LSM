import test from "node:test";
import assert from "node:assert/strict";
import { calculationSteps, resultLatex, texNumber } from "../src/utils/latex.js";
import { renderMath } from "../src/utils/math.js";
import { calculateRegression, calculateFromStats, formatNumber } from "../src/utils/statistics.js";

const format = value => formatNumber(value, "sig", 6);
test("all normal, origin, manual and extreme-value formulas typeset without errors", () => {
  const cases = [];
  for (const fitMode of ["linear", "origin"]) {
    for (const scale of [1, 1e-200, 1e200]) {
      cases.push([calculateRegression([{ x: scale, y: 2 * scale }, { x: 2 * scale, y: 3 * scale }, { x: 3 * scale, y: 5 * scale }], fitMode), "raw"]);
    }
    cases.push([calculateFromStats({ n: 3, sumX: 6, sumY: 10, sumX2: 14, sumXY: 23, sumResiduals: "" }, fitMode), "stats"]);
  }
  for (const [result, mode] of cases) {
    assert.equal(result.errorMsg, "");
    for (const section of calculationSteps(result, mode, format)) for (const tex of section.formulas) {
      assert.doesNotMatch(tex, /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
      assert.notEqual(renderMath(tex), null, tex);
    }
  }
});

test("LaTeX export separates prose and equations and respects precision", () => {
  const result = calculateRegression([{ x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 5 }]);
  const text = resultLatex(result, "raw", value => formatNumber(value, "dec", 3));
  assert.ok(text.includes("\\pm"));
  assert.ok(text.includes("0.333"));
  assert.ok(text.includes("\\frac"));
  assert.ok(text.includes("\\sqrt"));
  assert.equal(texNumber(1e-30, format), "1\\times10^{-30}");
  assert.ok(text.split("\n").filter(line => /[\p{Script=Han}]/u.test(line)).every(line => line.startsWith("%")));
});

test("math parse errors and unsafe commands do not break the page", () => {
  assert.equal(renderMath("\\frac{"), null);
  assert.equal(renderMath("\\htmlClass{bad}{x}"), null);
  assert.notEqual(renderMath("a=1\\pm 0.1"), null);
});
