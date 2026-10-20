// All calculations use unrounded values. Rounding is confined to presentation.
export const parseNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const number = Number(value);
  if (number === 0 && /[1-9]/.test(value.trim().split(/e/i)[0])) return null;
  return Number.isFinite(number) ? number : null;
};

export const formatNumber = (value, mode = "dec", digits = 4) => {
  if (!Number.isFinite(value)) return "---";
  const precision = Math.max(1, Math.min(12, parseInt(digits, 10) || 4));
  const text = mode === "sig" ? value.toPrecision(precision) : value.toFixed(precision);
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
};

// Neumaier summation retains small contributions alongside much larger terms.
export const sum = (values) => {
  let total = 0;
  let correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
};

const blankResult = (errorMsg = "") => ({
  slope: null, intercept: null, stdErrA: null, stdErrB: null,
  sumResidualsCalc: null, rSquared: null, errorMsg,
});
const rangeError = "数値が計算可能な範囲を超えています。値の単位や桁数を調整してください。";

const coefficientErrors = (n, meanX, sxx, residuals) => {
  if (n <= 2 || residuals === null) return { stdErrA: null, stdErrB: null };
  const sigma = Math.sqrt(residuals) / Math.sqrt(n - 2);
  return {
    stdErrA: sigma / Math.sqrt(sxx),
    stdErrB: sigma * Math.hypot(1 / Math.sqrt(n), meanX / Math.sqrt(sxx)),
  };
};

export const validUncertainty = (value) => value === "" || value == null || (parseNumber(value) !== null && parseNumber(value) >= 0);
const finiteProduct = (a, b) => {
  const product = a * b;
  return Number.isFinite(product) && (a === 0 || b === 0 || product !== 0) ? product : null;
};
const finiteSquare = value => finiteProduct(value, value);
const scaledSquareSum = (scale, total) => {
  if (total === 0) return 0;
  const magnitude = scale * Math.sqrt(total);
  return magnitude === 0 ? null : finiteSquare(magnitude);
};
const maxAbs = (values) => values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
const ratioProduct = (value, top, bottom) => {
  const first = value * (top / bottom);
  if (Number.isFinite(first) && (first !== 0 || value === 0 || top === 0)) return first;
  const second = (value * top) / bottom;
  if (Number.isFinite(second) && (second !== 0 || value === 0 || top === 0)) return second;
  return Math.sign(value) * Math.exp(Math.log(Math.abs(value)) + Math.log(top) - Math.log(bottom));
};

export const calculateRegression = (data, fitMode = "linear") => {
  const throughOrigin = fitMode === "origin";
  const n = data.length;
  const df = n - (throughOrigin ? 1 : 2);
  const stats = { n, sumX: 0, sumY: 0, sumX2: 0, sumXY: 0, sumY2: 0, sumResiduals: null };
  const fail = (message, rows = []) => ({ ...blankResult(message), stats, rows, fitMode, df });
  if (!n) return fail("");
  if (data.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !validUncertainty(p.dx) || !validUncertainty(p.dy))) return fail("X・Yは有限の数値、不確かさΔx・Δyは0以上の有限の数値にしてください。");
  const rows = data.map((p, index) => ({ no: index + 1, x: p.x, y: p.y, x2: finiteSquare(p.x), xy: finiteProduct(p.x, p.y), residualSq: null }));
  for (const [key, values] of [["sumX", data.map(p => p.x)], ["sumY", data.map(p => p.y)], ["sumX2", rows.map(p => p.x2)], ["sumXY", rows.map(p => p.xy)], ["sumY2", data.map(p => finiteSquare(p.y))]]) {
    const total = values.includes(null) ? null : sum(values);
    stats[key] = Number.isFinite(total) ? total : null;
  }
  if (!throughOrigin && n < 2) return fail("近似直線には、異なるX値を含む2点以上のデータが必要です。", rows);
  const originX = throughOrigin ? 0 : data[0].x;
  const originY = throughOrigin ? 0 : data[0].y;
  const offsetsX = data.map(p => p.x - originX);
  const offsetsY = data.map(p => p.y - originY);
  if (![...offsetsX, ...offsetsY].every(Number.isFinite)) return fail(rangeError, rows);
  const offsetX = throughOrigin ? 0 : sum(offsetsX.map(x => x / n));
  const offsetY = throughOrigin ? 0 : sum(offsetsY.map(y => y / n));
  const dx = offsetsX.map(x => x - offsetX);
  const dy = offsetsY.map(y => y - offsetY);
  const scaleX = maxAbs(dx);
  const scaleY = maxAbs(dy) || 1;
  if (!scaleX) return fail(throughOrigin ? "Σx²が0のため、原点固定の傾きを求められません。" : "Xの分散が0のため、傾きを求められません。", rows);
  const nx = dx.map(x => x / scaleX);
  const ny = dy.map(y => y / scaleY);
  const sxxScaled = sum(nx.map(x => x * x));
  const sxyScaled = sum(nx.map((x, i) => x * ny[i]));
  const syyScaled = sum(ny.map(y => y * y));
  const slopeScaled = sxyScaled / sxxScaled;
  const slope = ratioProduct(slopeScaled, scaleY, scaleX);
  const meanX = originX + offsetX;
  const meanY = originY + offsetY;
  const intercept = throughOrigin ? 0 : (originY - slope * originX) + (offsetY - slope * offsetX);
  const residualsScaled = ny.map((y, i) => y - slopeScaled * nx[i]);
  const sseScaled = sum(residualsScaled.map(e => e * e));
  const sse = scaledSquareSum(scaleY, sseScaled);
  const sigma = df > 0 ? scaleY * Math.sqrt(sseScaled / df) : null;
  const stdErrA = df > 0 ? ratioProduct(Math.sqrt(sseScaled / df / sxxScaled), scaleY, scaleX) : null;
  const stdErrB = !throughOrigin && df > 0 ? Math.hypot(sigma / Math.sqrt(n), stdErrA * meanX) : null;
  if ((slope === 0 && slopeScaled !== 0) || (stdErrA === 0 && sseScaled !== 0) || ![slope, intercept, stdErrA, stdErrB].filter(v => v !== null).every(Number.isFinite)) return fail(rangeError, rows);
  const rSquared = syyScaled === 0 ? null : 1 - sseScaled / syyScaled;
  const sxx = scaledSquareSum(scaleX, sxxScaled);
  const sxyProduct = sxyScaled === 0 ? 0 : sxyScaled * (scaleX * scaleY);
  return {
    slope, intercept, stdErrA, stdErrB, errorMsg: "", fitMode, df,
    sumResidualsCalc: sse, rSquared,
    rSquaredDefinition: throughOrigin ? "uncentered" : "centered",
    warningMsg: [sxx, sse, stats.sumX2, stats.sumXY].includes(null) ? "一部の平方和は数値表現の範囲外です。係数・標準誤差・R²はスケーリングした値から計算しています。" : "",
    stats: { ...stats, sumResiduals: sse },
    rows: rows.map((row, i) => ({ ...row, dx: dx[i], dy: dy[i], residual: residualsScaled[i] * scaleY, residualSq: finiteSquare(residualsScaled[i] * scaleY) })),
    meanX, meanY, originX, originY, offsetX, offsetY, sxx,
    sxy: Number.isFinite(sxyProduct) && (sxyProduct !== 0 || sxyScaled === 0) ? sxyProduct : null,
    syy: scaledSquareSum(scaleY, syyScaled),
    scaleX, scaleY, sxxScaled, sxyScaled, syyScaled, sseScaled,
  };
};

export const calculateDatasets = (datasets) => datasets.map(dataset => ({
  ...dataset,
  result: dataset.mode === "stats" ? calculateFromStats(dataset.manualStats, dataset.fitMode) : calculateRegression(dataset.dataPoints, dataset.fitMode),
}));

export const calculateFromStats = (input, fitMode = "linear") => {
  const throughOrigin = fitMode === "origin";
  const keys = ["n", "sumX", "sumY", "sumX2", "sumXY"];
  const stats = Object.fromEntries(keys.map((key) => [key, parseNumber(input[key])]));
  const sse = input.sumResiduals === "" || input.sumResiduals == null ? null : parseNumber(input.sumResiduals);
  const fail = (message) => ({ ...blankResult(message), stats: { ...stats, sumResiduals: sse }, rows: [], fitMode, df: stats.n - (throughOrigin ? 1 : 2) });
  if (keys.every((key) => input[key] === "" || input[key] == null) && sse === null) return fail("");
  if (Object.values(stats).some((value) => value === null)) return fail("n、ΣX、ΣY、ΣX²、ΣXYのすべてに有限の数値を入力してください。");
  const { n, sumX, sumY, sumX2, sumXY } = stats;
  if (!Number.isSafeInteger(n) || n < (throughOrigin ? 1 : 2)) return fail("データ数nにはモデルの係数数以上の整数を入力してください。");
  if (sumX2 < 0) return fail("ΣX²は0以上である必要があります。");
  if (input.sumResiduals !== "" && input.sumResiduals != null && (sse === null || sse < 0)) return fail("残差平方和には0以上の有限の数値を入力してください。");
  if (n === (throughOrigin ? 1 : 2) && sse > 0) return fail(throughOrigin ? "原点と1点を通る直線の残差平方和は0です。入力値を確認してください。" : "異なるX値の2点を通る直線の残差平方和は0です。入力値を確認してください。");
  const meanX = sumX / n;
  const meanY = sumY / n;
  const sxx = throughOrigin ? sumX2 : sumX2 - meanX * sumX;
  const sxy = throughOrigin ? sumXY : sumXY - meanX * sumY;
  if (![sxx, sxy].every(Number.isFinite)) return fail(rangeError);
  if (sxx <= 0) return fail("Xの分散が0、または総和に矛盾があります。入力値を確認してください。");
  if (!throughOrigin && sxx <= Number.EPSILON * 8 * Math.max(sumX2, Math.abs(meanX * sumX))) return fail("総和の有効桁数が不足しています。生データ入力で計算してください。");
  const slope = sxy / sxx;
  const intercept = throughOrigin ? 0 : meanY - slope * meanX;
  const errors = throughOrigin ? { stdErrA: n > 1 && sse !== null ? Math.sqrt(sse) / Math.sqrt(n - 1) / Math.sqrt(sxx) : null, stdErrB: null } : coefficientErrors(n, meanX, sxx, sse);
  if (![slope, intercept, ...Object.values(errors).filter((v) => v !== null)].every(Number.isFinite)) return fail(rangeError);
  const sumY2 = parseNumber(input.sumY2);
  if (input.sumY2 != null && input.sumY2 !== "" && sumY2 === null) return fail("ΣY²には0以上の有限の数値を入力してください。");
  const syy = sumY2 === null ? null : throughOrigin ? sumY2 : sumY2 - sumY * meanY;
  if (sumY2 !== null && (sumY2 < 0 || syy < 0 || (sse !== null && sse > syy + Number.EPSILON * 16 * Math.max(1, sumY2)))) return fail("ΣY²と残差平方和に矛盾があります。");
  return { ...blankResult(), slope, intercept, ...errors, fitMode, df: n - (throughOrigin ? 1 : 2), syy, rSquared: syy > 0 && sse !== null ? 1 - sse / syy : null, rSquaredDefinition: throughOrigin ? "uncentered" : "centered", sumResidualsCalc: sse, stats: { ...stats, sumY2, sumResiduals: sse }, rows: [], meanX, meanY, sxx, sxy };
};

export const predictY = (x, result) => result.originX !== undefined
  ? result.originY + (result.offsetY + result.slope * ((x - result.originX) - result.offsetX))
  : result.slope * x + result.intercept;

export const calculateSampleStats = (values) => {
  const n = values.length;
  const empty = { n, sum: null, mean: null, sd: null, se: null, errorMsg: "" };
  if (!n) return { ...empty, sum: 0 };
  if (!values.every(Number.isFinite)) return { ...empty, errorMsg: "有限の数値を入力してください。" };
  const total = sum(values);
  const origin = values[0];
  const offset = sum(values.map((value) => value - origin)) / n;
  const mean = origin + offset;
  const deviations = values.map(value => (value - origin) - offset);
  const scale = maxAbs(deviations) || 1;
  const scaledSS = sum(deviations.map(value => (value / scale) ** 2));
  const sd = n >= 2 ? scale * Math.sqrt(scaledSS / (n - 1)) : null;
  const se = sd === null ? null : sd / Math.sqrt(n);
  if (![mean, sd, se].filter((v) => v !== null).every(Number.isFinite)) return { ...empty, errorMsg: rangeError };
  return { n, sum: Number.isFinite(total) ? total : null, mean, sd, se, errorMsg: "" };
};

export const parsePastedPoints = (text) => {
  const points = [];
  const invalidRows = [];
  let hasContent = false;
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parts = /[,\t]/.test(line) ? line.split(/[,\t]/).map((v) => v.trim()) : line.trim().split(/\s+/);
    const isHeader = !hasContent && [2, 4].includes(parts.length) && /^x$/i.test(parts[0]) && /^y$/i.test(parts[1]);
    hasContent = true;
    if (isHeader) return;
    const x = parseNumber(parts[0]);
    const y = parseNumber(parts[1]);
    if (![2, 4].includes(parts.length) || x === null || y === null || (parts.length === 4 && (!validUncertainty(parts[2]) || !validUncertainty(parts[3])))) invalidRows.push(index + 1);
    else points.push(parts.length === 2 ? { x, y } : { x, y, dx: parts[2] === "" ? null : parseNumber(parts[2]), dy: parts[3] === "" ? null : parseNumber(parts[3]) });
  });
  return { points, invalidRows };
};
