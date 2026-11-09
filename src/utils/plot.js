import { predictY } from "./statistics.js";
import { axisValue, normalizeScales } from "./scales.js";

export const plotBounds = (series, settings = {}) => {
  const scales = normalizeScales(settings);
  const visible = series.filter(d => d.visible !== false && d.mode !== "stats");
  const points = visible.flatMap(d => d.dataPoints);
  if (!points.length) return null;
  for (const axis of ["x", "y"]) {
    if (points.some(p => axisValue(p[axis], scales[`${axis}Scale`]) === null)) return { error: `${axis.toUpperCase()}軸に表示できない値があります。対数軸には正の有限の値が必要です。` };
  }
  const clipped = new Set();
  const range = (coordinate, uncertainty) => {
    const scale = scales[`${coordinate}Scale`];
    let min = scale === "log" ? Infinity : 0, max = scale === "log" ? -Infinity : 0;
    for (const point of points) {
      const error = point[uncertainty] || 0;
      const low = point[coordinate] - error, high = point[coordinate] + error;
      if (!Number.isFinite(low) || !Number.isFinite(high)) return [NaN, NaN];
      if (scale === "log" && low <= 0) clipped.add(coordinate.toUpperCase());
      min = Math.min(min, axisValue(scale === "log" && low <= 0 ? point[coordinate] : low, scale));
      max = Math.max(max, axisValue(high, scale));
    }
    const span = max - min;
    const padding = span ? span * 0.1 : scale === "log" ? 0.5 : 1;
    return [min - padding, max + padding];
  };
  const x = range("x", "dx"), y = range("y", "dy");
  if (![...x, ...y, x[1] - x[0], y[1] - y[0]].every(Number.isFinite)) return { error: "値の範囲が大きすぎるため、グラフを描画できません。" };
  return { x, y, warning: clipped.size ? `${[...clipped].join("・")}方向のエラーバーが0以下に達するため、その下端を描画範囲で切っています。測定値と回帰計算は変更していません。` : "" };
};

// Tick coordinates use the same transformed space as the regression.
export const plotTicks = (range, scale = "linear") => {
  if (scale !== "log") return Array.from({ length: 6 }, (_, i) => range[0] * (1 - i / 5) + range[1] * i / 5);
  const span = range[1] - range[0];
  const step = Math.max(1, Math.ceil(span / 6));
  const ticks = [];
  for (let exponent = Math.floor(range[0]); exponent <= Math.ceil(range[1]); exponent += 1) {
    for (const factor of span < 2 ? [1, 2, 5] : [1]) {
      const value = exponent + Math.log10(factor);
      if (value >= range[0] && value <= range[1] && (span < 2 || exponent % step === 0)) ticks.push(value);
    }
  }
  return ticks.length >= 2 ? ticks : Array.from({ length: 4 }, (_, i) => range[0] * (1 - i / 3) + range[1] * i / 3);
};

export const logTickLabel = value => {
  const raw = 10 ** value;
  if (Number.isFinite(raw) && raw > 0) return Number(raw.toPrecision(8)).toString();
  return `10^${Number(value.toPrecision(6))}`;
};

// Intersect with the plot rectangle before converting to SVG pixels. This also
// avoids huge off-canvas line coordinates for datasets with very different units.
export const lineSegment = (result, bounds) => {
  if (result.slope === null || bounds.error) return null;
  const [xmin, xmax] = bounds.x, [ymin, ymax] = bounds.y;
  const candidates = [xmin, xmax].map(x => [x, predictY(x, result)]);
  if (result.slope !== 0) {
    for (const y of [ymin, ymax]) candidates.push([
      result.originX !== undefined ? result.originX + (result.offsetX + ((y - result.originY) - result.offsetY) / result.slope) : (y - result.intercept) / result.slope,
      y,
    ]);
  }
  const valid = candidates.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= xmin && x <= xmax && y >= ymin && y <= ymax);
  return valid.length >= 2 ? [valid[0], valid[valid.length - 1]] : null;
};
