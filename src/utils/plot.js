import { predictY } from "./statistics.js";

export const plotBounds = (series) => {
  const visible = series.filter(d => d.visible !== false && d.mode !== "stats");
  const points = visible.flatMap(d => d.dataPoints);
  if (!points.length) return null;
  const range = (coordinate, uncertainty) => {
    let min = 0, max = 0;
    for (const point of points) {
      const error = point[uncertainty] || 0;
      min = Math.min(min, point[coordinate] - error);
      max = Math.max(max, point[coordinate] + error);
    }
    const span = max - min;
    const padding = span ? span * 0.1 : 1;
    return [min - padding, max + padding];
  };
  const x = range("x", "dx"), y = range("y", "dy");
  if (![...x, ...y, x[1] - x[0], y[1] - y[0]].every(Number.isFinite)) return { error: "値の範囲が大きすぎるため、グラフを描画できません。" };
  return { x, y };
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
