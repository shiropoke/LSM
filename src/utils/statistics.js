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

export const calculateRegression = (data) => {
  const stats = { n: data.length, sumX: 0, sumY: 0, sumX2: 0, sumXY: 0, sumResiduals: null };
  const fail = (message) => ({ ...blankResult(message), stats, rows: [] });
  if (!data.length) return fail("");
  if (data.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return fail("XとYには有限の数値を入力してください。");
  const rows = data.map((p, index) => ({ no: index + 1, x: p.x, y: p.y, x2: p.x * p.x, xy: p.x * p.y, residualSq: null }));
  for (const [key, column] of [["sumX", "x"], ["sumY", "y"], ["sumX2", "x2"], ["sumXY", "xy"]]) {
    stats[key] = sum(rows.map((p) => p[column]));
  }
  if (![stats.sumX, stats.sumY, stats.sumX2, stats.sumXY].every(Number.isFinite)) return fail(rangeError);
  if (data.length < 2) return { ...fail("近似直線には、異なるX値を含む2点以上のデータが必要です。"), rows };

  // Shift before centering: nΣx²−(Σx)² loses all precision for large offsets.
  const n = data.length;
  const originX = data[0].x;
  const originY = data[0].y;
  const offsetX = sum(data.map((p) => p.x - originX)) / n;
  const offsetY = sum(data.map((p) => p.y - originY)) / n;
  const dx = data.map((p) => (p.x - originX) - offsetX);
  const dy = data.map((p) => (p.y - originY) - offsetY);
  const sxx = sum(dx.map((x) => x * x));
  const sxy = sum(dx.map((x, i) => x * dy[i]));
  const syy = sum(dy.map((y) => y * y));
  if (![sxx, sxy, syy, n * sxx].every(Number.isFinite)) return fail(rangeError);
  if (syy === 0 && dy.some((value) => value !== 0)) return fail(rangeError);
  if (sxx <= 0) return { ...fail("Xの分散が0、または数値範囲が小さすぎるため、傾きを求められません。"), rows };
  const meanX = originX + offsetX;
  const meanY = originY + offsetY;
  const slope = sxy / sxx;
  const intercept = (originY - slope * originX) + (offsetY - slope * offsetX);
  const residuals = dy.map((y, i) => y - slope * dx[i]);
  const residualSquares = residuals.map((e) => e * e);
  if (residualSquares.some((square, i) => square === 0 && residuals[i] !== 0)) return fail(rangeError);
  const sse = sum(residualSquares);
  const errors = coefficientErrors(n, meanX, sxx, sse);
  if (![slope, intercept, sse, ...Object.values(errors).filter((v) => v !== null)].every(Number.isFinite)) return fail(rangeError);
  return {
    slope, intercept, ...errors, errorMsg: "", sumResidualsCalc: sse,
    rSquared: syy === 0 ? null : Math.max(0, Math.min(1, 1 - sse / syy)),
    stats: { ...stats, sumResiduals: sse },
    rows: rows.map((row, i) => ({ ...row, dx: dx[i], dy: dy[i], residual: residuals[i], residualSq: residualSquares[i] })),
    meanX, meanY, originX, originY, offsetX, offsetY, sxx, sxy, syy,
  };
};

export const calculateFromStats = (input) => {
  const keys = ["n", "sumX", "sumY", "sumX2", "sumXY"];
  const stats = Object.fromEntries(keys.map((key) => [key, parseNumber(input[key])]));
  const sse = input.sumResiduals === "" || input.sumResiduals == null ? null : parseNumber(input.sumResiduals);
  const fail = (message) => ({ ...blankResult(message), stats: { ...stats, sumResiduals: sse }, rows: [] });
  if (keys.every((key) => input[key] === "" || input[key] == null) && sse === null) return fail("");
  if (Object.values(stats).some((value) => value === null)) return fail("n、ΣX、ΣY、ΣX²、ΣXYのすべてに有限の数値を入力してください。");
  const { n, sumX, sumY, sumX2, sumXY } = stats;
  if (!Number.isSafeInteger(n) || n < 2) return fail("データ数nには2以上の整数を入力してください。");
  if (sumX2 < 0) return fail("ΣX²は0以上である必要があります。");
  if (input.sumResiduals !== "" && input.sumResiduals != null && (sse === null || sse < 0)) return fail("残差平方和には0以上の有限の数値を入力してください。");
  if (n === 2 && sse > 0) return fail("異なるX値の2点を通る直線の残差平方和は0です。入力値を確認してください。");
  const meanX = sumX / n;
  const meanY = sumY / n;
  const sxx = sumX2 - meanX * sumX;
  const sxy = sumXY - meanX * sumY;
  if (![sxx, sxy, n * sxx].every(Number.isFinite)) return fail(rangeError);
  if (sxx <= 0) return fail("Xの分散が0、または総和に矛盾があります。入力値を確認してください。");
  if (sxx <= Number.EPSILON * 8 * Math.max(sumX2, Math.abs(meanX * sumX))) return fail("総和の有効桁数が不足しています。生データ入力で計算してください。");
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const errors = coefficientErrors(n, meanX, sxx, sse);
  if (![slope, intercept, ...Object.values(errors).filter((v) => v !== null)].every(Number.isFinite)) return fail(rangeError);
  return { ...blankResult(), slope, intercept, ...errors, sumResidualsCalc: sse, stats: { ...stats, sumResiduals: sse }, rows: [], meanX, meanY, sxx, sxy };
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
  const ss = sum(values.map((value) => ((value - origin) - offset) ** 2));
  const sd = n >= 2 ? Math.sqrt(ss) / Math.sqrt(n - 1) : null;
  const se = sd === null ? null : sd / Math.sqrt(n);
  if (![total, mean, ss, sd, se].filter((v) => v !== null).every(Number.isFinite)) return { ...empty, errorMsg: rangeError };
  if (ss === 0 && values.some((value) => value !== origin)) return { ...empty, errorMsg: rangeError };
  return { n, sum: total, mean, sd, se, errorMsg: "" };
};

export const parsePastedPoints = (text) => {
  const points = [];
  const invalidRows = [];
  let hasContent = false;
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parts = /[,\t]/.test(line) ? line.split(/[,\t]/).map((v) => v.trim()) : line.trim().split(/\s+/);
    const isHeader = !hasContent && parts.length === 2 && /^x$/i.test(parts[0]) && /^y$/i.test(parts[1]);
    hasContent = true;
    if (isHeader) return;
    const x = parseNumber(parts[0]);
    const y = parseNumber(parts[1]);
    if (parts.length !== 2 || x === null || y === null) invalidRows.push(index + 1);
    else points.push({ x, y });
  });
  return { points, invalidRows };
};
