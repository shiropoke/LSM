import { useId, useState } from "react";
import { axisLabel } from "../utils/datasets.js";
import { lineSegment, plotBounds } from "../utils/plot.js";
import { formatNumber } from "../utils/statistics.js";

export default function ScatterPlot({ series, labels, isDarkMode = false, format = formatNumber }) {
  const clipId = useId().replace(/:/g, "");
  const [hover, setHover] = useState(null);
  const visible = series.filter(d => d.visible !== false && d.mode !== "stats" && d.dataPoints.length);
  const bounds = plotBounds(visible);
  if (!bounds) return <p className="text-xs text-slate-400">表示できる測定データがありません。</p>;
  if (bounds.error) return <p role="alert" className="text-xs text-red-500">{bounds.error}</p>;
  const width = 600, height = 350, left = 74, right = 22, top = 20, bottom = 60;
  const sx = x => left + (x - bounds.x[0]) / (bounds.x[1] - bounds.x[0]) * (width - left - right);
  const sy = y => height - bottom - (y - bounds.y[0]) / (bounds.y[1] - bounds.y[0]) * (height - top - bottom);
  const axisColor = isDarkMode ? "#94a3b8" : "#64748b";
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";
  const ticks = range => Array.from({ length: 6 }, (_, i) => range[0] * (1 - i / 5) + range[1] * i / 5);
  return <div className="w-full h-full flex flex-col scatter-plot">
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-h-0 flex-1" role="img" aria-label="散布図と近似直線">
      <title>散布図と近似直線。不確かさは重み付けに使用しません。</title>
      <defs><clipPath id={clipId}><rect x={left} y={top} width={width - left - right} height={height - top - bottom} /></clipPath></defs>
      {ticks(bounds.x).map((tick, i) => <g key={`x${i}`}><line x1={sx(tick)} x2={sx(tick)} y1={top} y2={height - bottom} stroke={gridColor} /><text x={sx(tick)} y={height - bottom + 18} fontSize="10" textAnchor="middle" fill={axisColor}>{format(tick)}</text></g>)}
      {ticks(bounds.y).map((tick, i) => <g key={`y${i}`}><line y1={sy(tick)} y2={sy(tick)} x1={left} x2={width - right} stroke={gridColor} /><text x={left - 8} y={sy(tick) + 3} fontSize="10" textAnchor="end" fill={axisColor}>{format(tick)}</text></g>)}
      <rect x={left} y={top} width={width - left - right} height={height - top - bottom} fill="none" stroke={axisColor} />
      <text x={(left + width - right) / 2} y={height - 8} textAnchor="middle" fontSize="12" fill={axisColor}>{axisLabel(labels.xName, labels.xUnit)}</text>
      <text transform={`translate(15 ${(height - bottom + top) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={axisColor}>{axisLabel(labels.yName, labels.yUnit)}</text>
      <g clipPath={`url(#${clipId})`}>
        {visible.map(dataset => {
          const segment = lineSegment(dataset.result, bounds);
          return <g key={dataset.id} data-series={dataset.id}>
            {segment && <line data-fit-line="true" x1={sx(segment[0][0])} y1={sy(segment[0][1])} x2={sx(segment[1][0])} y2={sy(segment[1][1])} stroke={dataset.color} strokeWidth="2" />}
            {dataset.dataPoints.map(point => <g key={point.id}>
              {point.dx > 0 && <g data-error-bar="x" stroke={dataset.color}><line x1={sx(point.x - point.dx)} x2={sx(point.x + point.dx)} y1={sy(point.y)} y2={sy(point.y)} />{[-1, 1].map(sign => <line key={sign} x1={sx(point.x + sign * point.dx)} x2={sx(point.x + sign * point.dx)} y1={sy(point.y) - 4} y2={sy(point.y) + 4} />)}</g>}
              {point.dy > 0 && <g data-error-bar="y" stroke={dataset.color}><line x1={sx(point.x)} x2={sx(point.x)} y1={sy(point.y - point.dy)} y2={sy(point.y + point.dy)} />{[-1, 1].map(sign => <line key={sign} y1={sy(point.y + sign * point.dy)} y2={sy(point.y + sign * point.dy)} x1={sx(point.x) - 4} x2={sx(point.x) + 4} />)}</g>}
              <circle cx={sx(point.x)} cy={sy(point.y)} r="4" fill={dataset.color} stroke="white" onMouseEnter={() => setHover({ dataset: dataset.id, point: point.id })} onMouseLeave={() => setHover(null)}>
                <title>{dataset.name}: ({point.x}, {point.y}){point.dx != null ? ` Δx=${point.dx}` : ""}{point.dy != null ? ` Δy=${point.dy}` : ""}</title>
              </circle>
            </g>)}
          </g>;
        })}
      </g>
      {hover && visible.flatMap(d => d.id === hover.dataset ? d.dataPoints.filter(p => p.id === hover.point) : []).map(p => <text key={p.id} x={Math.max(left, Math.min(width - 140, sx(p.x) + 8))} y={Math.max(top + 12, sy(p.y) - 10)} fill={axisColor} fontSize="11">({format(p.x)}, {format(p.y)})</text>)}
    </svg>
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px]">{visible.map(d => <span key={d.id} style={{ color: d.color }} className="break-all">● {d.name}</span>)}</div>
  </div>;
}
