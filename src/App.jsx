// src/App.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
  useInRouterContext,
} from "react-router-dom";
import {
  Calculator,
  RotateCcw,
  Plus,
  Trash2,
  Database,
  Sigma,
  Table,
  Activity,
  Pencil,
  X as XIcon,
  AlertTriangle,
  LineChart,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Menu,
  Moon,
  Sun,
  ArrowUp,
  ArrowDown,
  Layout,
  BookOpen,
  Download,
  Clipboard,
  Check,
  FileSpreadsheet,
  Undo,
  Redo,
} from "lucide-react";

// ==========================================
// 1) Utils
// ==========================================

// ▼ 有効数字のグローバル設定（アプリ全体で共通）
let __NUMBER_FORMAT_MODE__ = "sig"; // "sig"（有効数字）/ "dec"（小数桁）
let __NUMBER_FORMAT_DIGITS__ = 4;   // 既定の有効数字（または小数桁）

const setGlobalNumberFormat = (mode, digits) => {
  if (mode === "sig" || mode === "dec") __NUMBER_FORMAT_MODE__ = mode;
  if (Number.isFinite(digits) && digits > 0) __NUMBER_FORMAT_DIGITS__ = Math.floor(digits);
};

const getGlobalNumberDigits = () => __NUMBER_FORMAT_DIGITS__;
const getGlobalNumberMode = () => __NUMBER_FORMAT_MODE__;

// ▼ 有効数字で丸める（significant figures）
const roundToSignificantDigits = (num, sigDigits) => {
  if (!Number.isFinite(num)) return num;
  if (num === 0) return 0;
  // toPrecision は文字列を返すので Number に戻す
  return Number(Number(num).toPrecision(sigDigits));
};

// ▼ 小数桁で丸める（decimal places）
const roundToDecimalPlaces = (num, decimals) => {
  if (!Number.isFinite(num)) return num;
  return Number(Math.round(num + "e+" + decimals) + "e-" + decimals);
};

// ▼ 既存コードの safeRound を「設定に従って」動くようにする
//    safeRound(value, 4) の「4」は、モードが "sig" なら「有効数字4桁」,
//    モードが "dec" なら「小数4桁」になります。
const safeRound = (num, digits = null) => {
  if (num === null || num === undefined || Number.isNaN(num) || !Number.isFinite(num)) return "---";

  const mode = getGlobalNumberMode();
  const d = Number.isFinite(digits) && digits !== null ? Math.floor(digits) : getGlobalNumberDigits();

  if (mode === "sig") return roundToSignificantDigits(num, d);
  return roundToDecimalPlaces(num, d);
};

const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 11);


// ==========================================
// 2) Error Boundary
// ==========================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900/20 p-6 text-red-900 dark:text-red-200">
          <div className="max-w-md bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl border border-red-200 dark:border-red-800">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              アプリでエラーが発生しました
            </h2>
            <div className="bg-slate-900 text-white p-3 rounded text-xs font-mono mb-4 overflow-auto max-h-40">
              {this.state.error?.toString()}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition-colors"
            >
              再読み込みして復帰
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// 3) Shared UI Components
// ==========================================
const InputCard = ({
  label,
  symbol,
  value,
  onChange,
  required = false,
  isResultRelated = false,
  highlight = false,
  plClass = "pl-12",
}) => (
  <div className={`flex flex-col group ${isResultRelated && !highlight ? "opacity-70" : ""}`}>
    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex justify-between">
      {label}{" "}
      {required && (
        <span className="text-red-500 text-[10px] bg-red-50 dark:bg-red-900/30 px-1 rounded">
          必須
        </span>
      )}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span
          className={`font-mono text-xs font-bold ${
            highlight ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {symbol}
        </span>
      </div>
      <input
        type="number"
        step="any"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full ${plClass} pr-3 py-2.5 rounded-lg border font-mono transition-all text-sm focus:outline-none focus:ring-2
          ${
            highlight
              ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
              : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:ring-indigo-100 dark:focus:ring-indigo-900"
          }`}
        placeholder="-"
      />
    </div>
  </div>
);

const StatBadge = ({ label, value, highlight = false }) => (
  <div
    className={`flex flex-col p-2 rounded-lg border ${
      highlight
        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800"
        : "bg-white dark:bg-slate-700/50 border-slate-100 dark:border-slate-600"
    }`}
  >
    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
      {label}
    </span>
    <span
      className={`font-mono text-sm font-bold truncate ${
        highlight ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"
      }`}
    >
      {value}
    </span>
  </div>
);

const PrecisionSelector = ({ digits, onChange, mode = "sig", onModeChange }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
        表示
      </span>

      {/* モード切替（必要なければ消してもOK：有効数字だけで良いなら "sig" 固定でもOK） */}
      <select
        value={mode}
        onChange={(e) => onModeChange?.(e.target.value)}
        className="text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        title="表示モード"
      >
        <option value="sig">有効数字</option>
        <option value="dec">小数桁</option>
      </select>

      <select
        value={digits}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        title="桁数"
      >
        {/* 2〜10桁 */}
        {Array.from({ length: 9 }, (_, i) => i + 2).map((d) => (
          <option key={d} value={d}>
            {mode === "sig" ? `${d}桁` : `${d}桁`}
          </option>
        ))}
      </select>
    </div>
  );
};


// ==========================================
// 4) Least Squares - Detailed Table
// ==========================================
const DetailedDataTable = ({ data, slope, intercept, onRequestDownload }) => {
  const [copied, setCopied] = useState(false);
  if (!data || data.length === 0) return null;

  const rows = data.map((p, index) => {
    const residualSq =
      slope !== null && intercept !== null ? Math.pow(p.y - (slope * p.x + intercept), 2) : null;
    return {
      no: index + 1,
      x: p.x,
      y: p.y,
      x2: p.x * p.x,
      xy: p.x * p.y,
      residualSq,
    };
  });

  const totals = rows.reduce(
    (acc, curr) => ({
      x: acc.x + curr.x,
      y: acc.y + curr.y,
      x2: acc.x2 + curr.x2,
      xy: acc.xy + curr.xy,
      residualSq:
        acc.residualSq !== null && curr.residualSq !== null ? acc.residualSq + curr.residualSq : null,
    }),
    { x: 0, y: 0, x2: 0, xy: 0, residualSq: 0 }
  );

  if (slope === null || intercept === null) totals.residualSq = null;

  const handleCopy = () => {
    const header = "No\tX\tY\tX^2\tXY\t(Y-aX-b)^2\n";
    const body = rows
      .map(
        (r) =>
          `${r.no}\t${r.x}\t${r.y}\t${r.x2}\t${r.xy}\t${r.residualSq !== null ? r.residualSq : ""}`
      )
      .join("\n");
    const footer = `Sum\t${totals.x}\t${totals.y}\t${totals.x2}\t${totals.xy}\t${
      totals.residualSq !== null ? totals.residualSq : ""
    }`;

    navigator.clipboard.writeText(header + body + "\n" + footer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadRequest = () => {
    const header = "No,X,Y,X^2,XY,(Y-aX-b)^2\n";
    const body = rows
      .map(
        (r) =>
          `${r.no},${r.x},${r.y},${r.x2},${r.xy},${r.residualSq !== null ? r.residualSq : ""}`
      )
      .join("\n");
    const footer = `Sum,${totals.x},${totals.y},${totals.x2},${totals.xy},${
      totals.residualSq !== null ? totals.residualSq : ""
    }`;

    onRequestDownload(header + body + "\n" + footer, "least_squares_detailed_data.csv");
  };

  return (
    <div className="w-full overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl mb-6">
      <div className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex justify-between items-center flex-wrap gap-2">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Table className="w-3.5 h-3.5" /> 計算データ表
        </h4>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="text-[10px] flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:text-indigo-600 dark:hover:text-indigo-400 dark:text-slate-300 transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
            {copied ? "コピー完了" : "コピー"}
          </button>
          <button
            onClick={handleDownloadRequest}
            className="text-[10px] flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:text-indigo-600 dark:hover:text-indigo-400 dark:text-slate-300 transition-colors"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-sm text-right border-collapse">
          <thead className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 text-center whitespace-nowrap">
                No.
              </th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                X
              </th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                Y
              </th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                X²
              </th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                XY
              </th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap text-indigo-600 dark:text-indigo-400">
                (Y - aX - b)²
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800/50">
            {rows.map((row) => (
              <tr
                key={row.no}
                className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors font-mono text-slate-600 dark:text-slate-300"
              >
                <td className="px-4 py-1.5 text-center text-slate-400 dark:text-slate-500 text-xs">
                  {row.no}
                </td>
                <td className="px-4 py-1.5">{safeRound(row.x)}</td>
                <td className="px-4 py-1.5">{safeRound(row.y)}</td>
                <td className="px-4 py-1.5">{safeRound(row.x2)}</td>
                <td className="px-4 py-1.5">{safeRound(row.xy)}</td>
                <td className="px-4 py-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                  {safeRound(row.residualSq)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-indigo-50 dark:bg-slate-800 font-bold text-indigo-900 dark:text-indigo-100 sticky bottom-0 z-10 border-t border-indigo-100 dark:border-slate-700">
            <tr>
              <td className="px-4 py-2 text-center text-xs">Σ</td>
              <td className="px-4 py-2 font-mono">{safeRound(totals.x)}</td>
              <td className="px-4 py-2 font-mono">{safeRound(totals.y)}</td>
              <td className="px-4 py-2 font-mono">{safeRound(totals.x2)}</td>
              <td className="px-4 py-2 font-mono">{safeRound(totals.xy)}</td>
              <td className="px-4 py-2 font-mono">{safeRound(totals.residualSq)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ==========================================
// 5) Least Squares - Plot
// ==========================================
const SimpleScatterPlot = ({ data, slope, intercept, isDarkMode }) => {
  if (!data || data.length === 0) return null;
  const validData = data.filter((d) => !Number.isNaN(d.x) && !Number.isNaN(d.y));
  if (validData.length === 0) return null;

  const xValues = validData.map((d) => d.x);
  const yValues = validData.map((d) => d.y);

  const minX = Math.min(0, ...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(0, ...yValues);
  const maxY = Math.max(...yValues);

  let xPadding = (maxX - minX) * 0.1;
  if (xPadding === 0) xPadding = 1;
  let yPadding = (maxY - minY) * 0.1;
  if (yPadding === 0) yPadding = 1;

  const domainX = [minX - xPadding, maxX + xPadding];
  const domainY = [minY - yPadding, maxY + yPadding];

  const width = 600;
  const height = 350;
  const padding = 50;

  const scaleX = (x) =>
    padding + ((x - domainX[0]) / (domainX[1] - domainX[0])) * (width - 2 * padding);
  const scaleY = (y) =>
    height - (padding + ((y - domainY[0]) / (domainY[1] - domainY[0])) * (height - 2 * padding));

  const generateTicks = (min, max) => {
    const range = max - min;
    if (range <= 0 || !Number.isFinite(range)) return [min];
    const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
    let step = magnitude;
    if (range / magnitude > 5) step = magnitude;
    else if (range / magnitude > 2) step = magnitude / 2;
    else step = magnitude / 5;
    if (step <= 0 || !Number.isFinite(step)) step = 1;

    const ticks = [];
    let safeGuard = 0;
    const startTick = Math.ceil(min / step) * step;
    for (let i = startTick; i <= max; i += step) {
      ticks.push(parseFloat(i.toPrecision(10)));
      safeGuard++;
      if (safeGuard > 100) break;
    }
    return ticks;
  };

  const xTicks = generateTicks(domainX[0], domainX[1]);
  const yTicks = generateTicks(domainY[0], domainY[1]);

  const rG = (num) => {
  const d = getGlobalNumberDigits();
  if (Math.abs(num) > 1000) return Number(num).toExponential(Math.max(1, d - 1));
  // 有効数字モードのときは toPrecision、dec モードなら safeRound で
  if (getGlobalNumberMode() === "sig") return parseFloat(Number(num).toPrecision(d));
  return safeRound(num, d);
};


  let lineCoords = null;
  if (slope !== null && intercept !== null && Number.isFinite(slope) && Number.isFinite(intercept)) {
    lineCoords = {
      x1: scaleX(domainX[0]),
      y1: scaleY(slope * domainX[0] + intercept),
      x2: scaleX(domainX[1]),
      y2: scaleY(slope * domainX[1] + intercept),
    };
  }

  const axisColor = isDarkMode ? "#94a3b8" : "#64748b";
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";
  const zeroColor = isDarkMode ? "#cbd5e1" : "#64748b";

  const [hoveredPoint, setHoveredPoint] = useState(null);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <clipPath id="chartArea">
          <rect x={padding} y={padding} width={width - 2 * padding} height={height - 2 * padding} />
        </clipPath>
      </defs>

      {xTicks.map((tick) => {
        const xPos = scaleX(tick);
        if (!Number.isFinite(xPos) || xPos < padding || xPos > width - padding) return null;
        return (
          <g key={`x-${tick}`}>
            <line
              x1={xPos}
              y1={padding}
              x2={xPos}
              y2={height - padding}
              stroke={tick === 0 ? zeroColor : gridColor}
              strokeWidth={tick === 0 ? 2 : 1}
            />
            <text x={xPos} y={height - 25} fontSize="10" fill={axisColor} textAnchor="middle">
              {rG(tick)}
            </text>
          </g>
        );
      })}

      {yTicks.map((tick) => {
        const yPos = scaleY(tick);
        if (!Number.isFinite(yPos) || yPos < padding || yPos > height - padding) return null;
        return (
          <g key={`y-${tick}`}>
            <line
              x1={padding}
              y1={yPos}
              x2={width - padding}
              y2={yPos}
              stroke={tick === 0 ? zeroColor : gridColor}
              strokeWidth={tick === 0 ? 2 : 1}
            />
            <text x={padding - 10} y={yPos + 3} fontSize="10" fill={axisColor} textAnchor="end">
              {rG(tick)}
            </text>
          </g>
        );
      })}

      <rect
        x={padding}
        y={padding}
        width={width - 2 * padding}
        height={height - 2 * padding}
        fill="none"
        stroke={isDarkMode ? "#475569" : "#cbd5e1"}
        strokeWidth="1"
      />

      <g clipPath="url(#chartArea)">
        {lineCoords && Number.isFinite(lineCoords.y1) && Number.isFinite(lineCoords.y2) && (
          <line
            x1={lineCoords.x1}
            y1={lineCoords.y1}
            x2={lineCoords.x2}
            y2={lineCoords.y2}
            stroke="#6366f1"
            strokeWidth="2"
          />
        )}

        {validData.map((p) => (
          <circle
            key={p.id}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r="6"
            fill="#8b5cf6"
            fillOpacity="0.8"
            stroke="white"
            strokeWidth="2"
            onMouseEnter={() => setHoveredPoint(p)}
            onMouseLeave={() => setHoveredPoint(null)}
            className="cursor-pointer hover:opacity-100 transition-opacity"
          />
        ))}
      </g>

      {hoveredPoint &&
        (() => {
          const x = scaleX(hoveredPoint.x);
          const y = scaleY(hoveredPoint.y);
          const tooltipText = `(${hoveredPoint.x}, ${hoveredPoint.y})`;
          const isRight = x > width / 2;
          const xOffset = isRight ? -10 : 10;
          const textAnchor = isRight ? "end" : "start";

          return (
            <g pointerEvents="none">
              <rect
                x={isRight ? x - (tooltipText.length * 7 + 20) : x + 10}
                y={y - 25}
                width={tooltipText.length * 7 + 10}
                height="20"
                rx="4"
                fill={isDarkMode ? "#1e293b" : "white"}
                stroke={isDarkMode ? "#475569" : "#cbd5e1"}
                strokeWidth="1"
                fillOpacity="0.9"
              />
              <text
                x={x + xOffset}
                y={y - 15}
                fontSize="12"
                fill={isDarkMode ? "white" : "#1e293b"}
                alignmentBaseline="middle"
                textAnchor={textAnchor}
                fontWeight="bold"
              >
                {tooltipText}
              </text>
            </g>
          );
        })()}
    </svg>
  );
};

// ==========================================
// 6) Least Squares - Formula display (existing style)
// ==========================================
const FormulaDisplay = ({ stats, slope, intercept, stdErrA, stdErrB }) => {
  const { n, sumX, sumY, sumX2, sumXY, sumResiduals } = stats;
  if (!n || n === 0)
    return <div className="text-xs text-slate-500 dark:text-slate-400">データを入力すると計算プロセスが表示されます。</div>;

  const denominator = n * sumX2 - sumX * sumX;
  const fN = (num) => safeRound(num);
  const Ve = n > 2 && sumResiduals !== undefined ? sumResiduals / (n - 2) : 0;
  const Sxx = n > 0 ? denominator / n : 0;

  const FractionLayout = ({ num, den }) => (
    <div className="inline-flex flex-col items-center align-middle mx-1 text-center">
      <div className="border-b border-current px-1 mb-0.5 w-full">{num}</div>
      <div className="px-1 w-full">{den}</div>
    </div>
  );

  const BigSqrt = ({ children }) => (
    <div className="inline-flex items-stretch mx-1 align-middle">
      <div
        className="flex items-center text-lg leading-none transform scale-y-125 origin-center select-none"
        style={{ fontFamily: "serif" }}
      >
        √
      </div>
      <div className="border-t border-current mt-[0.6em] px-1 pt-0.5">{children}</div>
    </div>
  );

  return (
    <div className="font-mono text-sm space-y-8 text-slate-300">
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700 pb-1 mb-2">
          パラメータの計算
        </h4>

        <div>
          <p className="text-indigo-400 mb-2 font-bold">1. 共通の分母 D</p>
          <div className="pl-4 border-l-2 border-indigo-900 flex items-center flex-wrap gap-2 text-xs md:text-sm">
            <span>D = nΣx² - (Σx)² = </span>
            <span>
              {n} × {fN(sumX2)} - ({fN(sumX)})²
            </span>
            <span>=</span>
            <span className="text-yellow-400 font-bold">{fN(denominator)}</span>
          </div>
        </div>

        <div>
          <p className="text-indigo-400 mb-2 font-bold">2. 傾き a</p>
          <div className="pl-4 border-l-2 border-indigo-900 flex items-center flex-wrap gap-2 text-xs md:text-sm">
            <span>a = </span>
            <FractionLayout num={<span>nΣxy - ΣxΣy</span>} den="D" />
            <span> = </span>
            <FractionLayout
              num={
                <span>
                  {n}×{fN(sumXY)} - {fN(sumX)}×{fN(sumY)}
                </span>
              }
              den={fN(denominator)}
            />
            <span> = </span>
            <span className="text-green-400 font-bold">{fN(slope)}</span>
          </div>
        </div>

        <div>
          <p className="text-indigo-400 mb-2 font-bold">3. 切片 b</p>
          <div className="pl-4 border-l-2 border-indigo-900 flex items-center flex-wrap gap-2 text-xs md:text-sm">
            <span>b = </span>
            <FractionLayout num={<span>Σx²Σy - ΣxyΣx</span>} den="D" />
            <span> = </span>
            <FractionLayout
              num={
                <span>
                  {fN(sumX2)}×{fN(sumY)} - {fN(sumXY)}×{fN(sumX)}
                </span>
              }
              den={fN(denominator)}
            />
            <span> = </span>
            <span className="text-purple-400 font-bold">{fN(intercept)}</span>
          </div>
        </div>
      </div>

      {n > 2 && stdErrA !== null && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700 pb-1 mb-2">
            誤差の計算
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-indigo-300 mb-1 font-bold text-xs">残差分散 Ve</p>
              <div className="pl-3 border-l-2 border-slate-700 text-xs flex items-center gap-2 flex-wrap">
                <span>Ve = </span>
                <FractionLayout num={<span>Σ(Y - aX - b)²</span>} den="n - 2" />
                <span> = </span>
                <FractionLayout num={fN(sumResiduals)} den={n - 2} />
                <span> = </span>
                <span className="text-blue-300">{fN(Ve)}</span>
              </div>
            </div>

            <div>
              <p className="text-indigo-300 mb-1 font-bold text-xs">偏差平方和 Sxx</p>
              <div className="pl-3 border-l-2 border-slate-700 text-xs flex items-center gap-2 flex-wrap">
                <span>Sxx = </span>
                <FractionLayout num="D" den="n" />
                <span> = </span>
                <FractionLayout num={fN(denominator)} den={n} />
                <span> = </span>
                <span className="text-blue-300">{fN(Sxx)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-slate-400 mb-2 font-bold text-xs">4. 傾きaの標準誤差 Δa</p>
            <div className="pl-4 border-l-2 border-slate-700 flex items-center flex-wrap gap-2 text-xs md:text-sm">
              <span>Δa = </span>
              <BigSqrt>
                <FractionLayout num="Ve" den="Sxx" />
              </BigSqrt>
              <span> = </span>
              <BigSqrt>
                <FractionLayout num={fN(Ve)} den={fN(Sxx)} />
              </BigSqrt>
              <span> = </span>
              <span className="text-slate-200 font-bold">{fN(stdErrA)}</span>
            </div>
          </div>

          <div>
            <p className="text-slate-400 mb-2 font-bold text-xs">5. 切片bの標準誤差 Δb</p>
            <div className="pl-4 border-l-2 border-slate-700 flex items-center flex-wrap gap-2 text-xs md:text-sm">
              <span>Δb = </span>
              <BigSqrt>
                <FractionLayout num="Ve · Σx²" den="n · Sxx" />
              </BigSqrt>
              <span> = </span>
              <BigSqrt>
                <FractionLayout num={<span>{fN(Ve)}×{fN(sumX2)}</span>} den={<span>{n}×{fN(Sxx)}</span>} />
              </BigSqrt>
              <span> = </span>
              <span className="text-slate-200 font-bold">{fN(stdErrB)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 7) Least Squares - Simple Modals
// ==========================================
const LayoutEditModal = ({ currentOrder, onSave, onClose }) => {
  const [order, setOrder] = useState(currentOrder);

  const moveItem = (index, direction) => {
    const newOrder = [...order];
    if (direction === "up" && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === "down" && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setOrder(newOrder);
  };

  const getLabel = (id) => {
    if (id === "regression") return "近似直線 (結果表示)";
    if (id === "analysis") return "データ分析 (表・グラフ)";
    return id;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layout className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> レイアウト編集
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">表示順序を並び替えます。</p>
          <div className="space-y-2">
            {order.map((item, index) => (
              <div key={item} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{getLabel(item)}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveItem(index, "up")}
                    disabled={index === 0}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveItem(index, "down")}
                    disabled={index === order.length - 1}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors">
            キャンセル
          </button>
          <button onClick={() => onSave(order)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 transition-all">
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

const PasteImportModal = ({ onClose, onImport }) => {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState([]);

  useEffect(() => {
    if (!text.trim()) {
      setPreview([]);
      return;
    }
    const lines = text.trim().split(/\r?\n/);
    const parsed = [];
    for (const line of lines) {
      const parts = line.split(/[,\t\s]+/).filter((s) => s !== "");
      if (parts.length >= 2) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        if (!Number.isNaN(x) && !Number.isNaN(y)) parsed.push({ x, y });
      }
    }
    setPreview(parsed);
  }, [text]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" /> Excelデータ貼り付け
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-40 p-4 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 dark:text-white font-mono text-xs"
            placeholder={`1.5\t2.3\n...`}
          />
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold text-slate-400">{preview.length}件</span>
            <button
              onClick={() => onImport(preview)}
              disabled={preview.length === 0}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-bold shadow-md disabled:opacity-50"
            >
              インポート
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DownloadConfirmModal = ({ onClose, onConfirm, fileName }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> ダウンロード確認
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            データをCSVファイルとしてダウンロードします。<br />
            よろしいですか？
          </p>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
              ファイル名: {fileName}
            </p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors">
            キャンセル
          </button>
          <button onClick={onConfirm} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 transition-all">
            ダウンロード
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 8) Standard Error Calculator (Requested fixes)
//   - 計算式ボックス削除 ✅
//   - 小数Enterエラー対策(step="any", form submit排除) ✅
//   - 値の編集 ✅
//   - 「sとn」タブ削除 ✅
//   - 「値を入力」タブ増設（＋）✅
//   - 戻る/リセット入替 ✅
//   - 追加後も入力にフォーカス維持（モバイルキーボード対策）✅
// ==========================================
const StandardErrorCalculator = () => {
  const navigate = useNavigate();

  // ▼ 表示桁（有効数字/小数桁）設定（最小二乗法ページと共通）
  const [numberFormatMode, setNumberFormatMode] = useState(() => localStorage.getItem("numberFormatMode") || "sig");
  const [numberFormatDigits, setNumberFormatDigits] = useState(() => {
    const v = Number(localStorage.getItem("numberFormatDigits"));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 4;
  });

  useMemo(() => {
  setGlobalNumberFormat(numberFormatMode, numberFormatDigits);
}, [numberFormatMode, numberFormatDigits]);


  const inputRef = useRef(null);

  const [tabs, setTabs] = useState(() => [
    { id: generateId(), name: "値を入力 1", values: [], draft: "", editingId: null },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);

  const activeTab = tabs[activeIdx] ?? tabs[0];

  const updateActiveTab = (patch) => {
    setTabs((prev) =>
      prev.map((t, i) => (i === activeIdx ? { ...t, ...patch } : t))
    );
  };

  const focusInput = () => {
    // iOS/Android でクリック後にフォーカスが外れやすいので、タイミング調整
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const addOrUpdateValue = () => {
    const raw = (activeTab?.draft ?? "").trim();
    if (raw === "") return;

    const v = parseFloat(raw);
    if (Number.isNaN(v)) return;

    if (activeTab.editingId) {
      updateActiveTab({
        values: activeTab.values.map((x) =>
          x.id === activeTab.editingId ? { ...x, v } : x
        ),
        draft: "",
        editingId: null,
      });
    } else {
      updateActiveTab({
        values: [...activeTab.values, { id: generateId(), v }],
        draft: "",
      });
    }

    focusInput();
  };

  const startEdit = (id) => {
    const item = activeTab.values.find((x) => x.id === id);
    if (!item) return;
    updateActiveTab({ draft: String(item.v), editingId: id });
    focusInput();
  };

  const cancelEdit = () => {
    updateActiveTab({ draft: "", editingId: null });
    focusInput();
  };

  const deleteValue = (id) => {
    updateActiveTab({
      values: activeTab.values.filter((x) => x.id !== id),
      ...(activeTab.editingId === id ? { draft: "", editingId: null } : {}),
    });
    focusInput();
  };

  const addTab = () => {
    setTabs((prev) => {
      const next = [...prev, { id: generateId(), name: `値を入力 ${prev.length + 1}`, values: [], draft: "", editingId: null }];
      return next;
    });
    setActiveIdx(tabs.length); // 追加される次のインデックス
    focusInput();
  };

  const resetAll = () => {
    setTabs([{ id: generateId(), name: "値を入力 1", values: [], draft: "", editingId: null }]);
    setActiveIdx(0);
    focusInput();
  };

  const n = activeTab?.values.length ?? 0;
  const sum = (activeTab?.values ?? []).reduce((acc, x) => acc + x.v, 0);
  const mean = n > 0 ? sum / n : null;

  const s =
    n >= 2
      ? Math.sqrt((activeTab.values ?? []).reduce((acc, x) => acc + Math.pow(x.v - mean, 2), 0) / (n - 1))
      : null;

  const se = n >= 2 && s !== null ? s / Math.sqrt(n) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12 dark:bg-slate-900 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <Sigma className="w-5 h-5" />
            </div>
          </div>

          <PrecisionSelector
            mode={numberFormatMode}
            onModeChange={(m) => setNumberFormatMode(m)}
            digits={numberFormatDigits}
            onChange={(d) => setNumberFormatDigits(d)}
          />

          {/* ★ リセット / 戻る を入れ替え */}
          <div className="flex gap-2">
            <button
              onClick={resetAll}
              className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-sm font-bold text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:hover:bg-red-900/30"
            >
              リセット
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              戻る
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* タブ行（＋ボタン付き） */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {tabs.map((t, idx) => {
              const active = idx === activeIdx;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`shrink-0 px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addTab}
            className="shrink-0 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            aria-label="タブ追加"
            title="タブ追加"
          >
            <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 入力＋一覧 */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="number"
                step="any"
                inputMode="decimal"
                value={activeTab?.draft ?? ""}
                onChange={(e) => updateActiveTab({ draft: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOrUpdateValue();
                  }
                }}
                placeholder="例: 12.3"
                className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 outline-none font-mono bg-white dark:bg-slate-900"
              />

              {/* モバイルでボタンがフォーカス奪ってキーボード閉じるのを抑制 */}
              {activeTab?.editingId ? (
                <>
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={cancelEdit}
                    className="px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                    title="編集キャンセル"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={addOrUpdateValue}
                    disabled={!activeTab?.draft}
                    className="px-4 py-2.5 rounded-lg bg-amber-500 text-white font-bold disabled:opacity-50"
                    title="更新"
                  >
                    更新
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={addOrUpdateValue}
                  disabled={!activeTab?.draft}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50"
                >
                  追加
                </button>
              )}
            </div>

            <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">No.</th>
                      <th className="px-3 py-2 font-mono text-left">値</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {n === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-3 py-10 text-center text-slate-400">
                          データがありません
                        </td>
                      </tr>
                    ) : (
                      (activeTab.values ?? []).map((x, i) => (
                        <tr key={x.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                          <td className="px-3 py-2 text-center text-slate-400 text-xs">{i + 1}</td>
                          <td className="px-3 py-2 font-mono text-left">{x.v}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(x.id)}
                                className="p-1.5 text-slate-400 hover:text-amber-600"
                                title="編集"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteValue(x.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 結果 */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatBadge label="n" value={n} />
                <StatBadge label="平均" value={mean !== null ? safeRound(mean, 6) : "---"} />
                <StatBadge label="標本標準偏差 s" value={s !== null ? safeRound(s, 6) : "---"} />
              </div>

              <div className="mt-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  標準誤差 SE = s / √n
                </div>
                <div className="font-mono text-2xl font-bold text-indigo-700 dark:text-indigo-200">
                  {se !== null ? safeRound(se, 6) : "---"}
                </div>
                {n < 2 && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">n ≥ 2 のとき計算できます。</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 9) Least Squares Main App
// ==========================================
const LeastSquaresErrorCalc = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState("raw");
  const [result, setResult] = useState({
    slope: null,
    intercept: null,
    stdErrA: null,
    stdErrB: null,
    errorMsg: "",
    sumResidualsCalc: 0,
  });

  const [dataPoints, setDataPoints] = useState([]);
  const [inputX, setInputX] = useState("");
  const [inputY, setInputY] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const xInputRef = useRef(null);
  const yInputRef = useRef(null);

  const [rawStats, setRawStats] = useState({
    n: 0,
    sumX: 0,
    sumY: 0,
    sumX2: 0,
    sumXY: 0,
    sumResiduals: 0,
  });

  const [manualStats, setManualStats] = useState({
    n: "",
    sumX: "",
    sumY: "",
    sumX2: "",
    sumXY: "",
    sumResiduals: "",
  });

  // UI
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [showDownloadConfirmModal, setShowDownloadConfirmModal] = useState(false);
  const [downloadConfig, setDownloadConfig] = useState({ content: "", fileName: "" });
  const [sectionOrder, setSectionOrder] = useState(["regression", "analysis"]);
  const [copied, setCopied] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // ▼ 表示桁（有効数字/小数桁）設定
  const [numberFormatMode, setNumberFormatMode] = useState(() => localStorage.getItem("numberFormatMode") || "sig");
  const [numberFormatDigits, setNumberFormatDigits] = useState(() => {
    const v = Number(localStorage.getItem("numberFormatDigits"));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 4;
  });

  // ▼ ここがポイント：render 中に同期的にグローバル値を更新する（＝その render で safeRound が即反映される）
useMemo(() => {
  setGlobalNumberFormat(numberFormatMode, numberFormatDigits);
}, [numberFormatMode, numberFormatDigits]);

// ▼ 保存は副作用なので useEffect でOK
useEffect(() => {
  localStorage.setItem("numberFormatMode", numberFormatMode);
  localStorage.setItem("numberFormatDigits", String(numberFormatDigits));
}, [numberFormatMode, numberFormatDigits]);



  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [isDarkMode]);

  const addToHistory = (newDataPoints) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newDataPoints);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setDataPoints(newDataPoints);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setDataPoints(history[historyIndex - 1]);
    }
  };
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setDataPoints(history[historyIndex + 1]);
    }
  };

  const calculateLeastSquares = (n, sX, sY, sX2, sXY, sResManual = null) => {
    const numN = parseFloat(n);
    const numSX = parseFloat(sX);
    const numSY = parseFloat(sY);
    const numSX2 = parseFloat(sX2);
    const numSXY = parseFloat(sXY);

    if (!numN || numN === 0 || Number.isNaN(numN)) {
      return { slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "" };
    }

    const denominator = numN * numSX2 - numSX * numSX;
    if (denominator === 0 || Number.isNaN(denominator)) {
      return { slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "分母が0です（Xの分散が0）" };
    }

    const a = (numN * numSXY - numSX * numSY) / denominator;
    const b = (numSX2 * numSY - numSXY * numSX) / denominator;

    let sRes = 0;
    if (mode === "raw") {
      sRes = dataPoints.reduce((acc, p) => acc + Math.pow(p.y - (a * p.x + b), 2), 0);
    } else {
      sRes = sResManual !== null && sResManual !== "" ? parseFloat(sResManual) : 0;
    }

    let seA = null;
    let seB = null;
    if (numN > 2) {
      const Ve = sRes / (numN - 2);
      const Sxx = denominator / numN;
      if (Sxx > 0 && Ve >= 0) {
        seA = Math.sqrt(Ve / Sxx);
        seB = Math.sqrt((Ve * numSX2) / (numN * Sxx));
      }
    }

    return { slope: a, intercept: b, stdErrA: seA, stdErrB: seB, sumResidualsCalc: sRes, errorMsg: "" };
  };

  useEffect(() => {
    if (mode !== "raw") return;

    const n = dataPoints.length;
    if (n === 0) {
      setRawStats({ n: 0, sumX: 0, sumY: 0, sumX2: 0, sumXY: 0, sumResiduals: 0 });
      setResult({ slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "" });
      return;
    }

    let sX = 0,
      sY = 0,
      sX2 = 0,
      sXY = 0;
    dataPoints.forEach((p) => {
      sX += p.x;
      sY += p.y;
      sX2 += p.x * p.x;
      sXY += p.x * p.y;
    });

    const calcRes = calculateLeastSquares(n, sX, sY, sX2, sXY);
    setRawStats({ n, sumX: sX, sumY: sY, sumX2: sX2, sumXY: sXY, sumResiduals: calcRes.sumResidualsCalc });
    setResult(calcRes);
  }, [dataPoints, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== "stats") return;

    const { n, sumX, sumY, sumX2, sumXY, sumResiduals } = manualStats;
    if (n === "" || sumX === "" || sumY === "" || sumX2 === "" || sumXY === "") {
      setResult({ slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "" });
      return;
    }
    const calcRes = calculateLeastSquares(n, sumX, sumY, sumX2, sumXY, sumResiduals);
    setResult(calcRes);
  }, [manualStats, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpsertPoint = (e) => {
    if (e) e.preventDefault();
    if (inputX === "" || inputY === "") return;

    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    if (Number.isNaN(x) || Number.isNaN(y)) return;

    let newData;
    if (editingId !== null) {
      newData = dataPoints.map((p) => (p.id === editingId ? { ...p, x, y } : p));
      setEditingId(null);
    } else {
      newData = [...dataPoints, { id: generateId(), x, y }];
    }

    addToHistory(newData);
    setInputX("");
    setInputY("");
    xInputRef.current?.focus();
  };

  const handleEditStart = (point) => {
    setInputX(String(point.x));
    setInputY(String(point.y));
    setEditingId(point.id);
    xInputRef.current?.focus();
  };

  const handleEditCancel = () => {
    setInputX("");
    setInputY("");
    setEditingId(null);
    xInputRef.current?.focus();
  };

  const handleDeletePoint = (id) => {
    if (editingId === id) handleEditCancel();
    addToHistory(dataPoints.filter((p) => p.id !== id));
  };

  const handleManualChange = (key, val) => setManualStats((prev) => ({ ...prev, [key]: val }));

  const handleResetRequest = () => {
    const hasData =
      mode === "raw" ? dataPoints.length > 0 || inputX || inputY : Object.values(manualStats).some((val) => val !== "");
    if (hasData) setShowConfirmModal(true);
    else handleResetExecute();
  };

  const handleResetExecute = () => {
    if (mode === "raw") {
      addToHistory([]);
      setInputX("");
      setInputY("");
      setEditingId(null);
    } else {
      setManualStats({ n: "", sumX: "", sumY: "", sumX2: "", sumXY: "", sumResiduals: "" });
      setResult({ slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "" });
    }
    setShowConfirmModal(false);
  };

  const handleKeyDownX = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputX !== "") yInputRef.current?.focus();
    }
  };
  const handleKeyDownY = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleUpsertPoint();
    }
  };

  const handleRequestDownload = (content, fileName) => {
    setDownloadConfig({ content, fileName });
    setShowDownloadConfirmModal(true);
  };

  const handleExportCSV = () => {
    if (dataPoints.length === 0) return;
    const csvContent = "X,Y\n" + dataPoints.map((p) => `${p.x},${p.y}`).join("\n");
    handleRequestDownload(csvContent, "least_squares_data.csv");
  };

  const executeDownload = () => {
    const { content, fileName } = downloadConfig;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowDownloadConfirmModal(false);
  };

  const handleCopyToClipboard = () => {
    if (dataPoints.length === 0) return;
    navigator.clipboard
      .writeText("X\tY\n" + dataPoints.map((p) => `${p.x}\t${p.y}`).join("\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const handleImportData = (parsed) => {
    addToHistory([...dataPoints, ...parsed.map((p) => ({ id: generateId(), x: p.x, y: p.y }))]);
    setShowImportModal(false);
  };

  const getStats = () =>
    mode === "raw"
      ? rawStats
      : {
          n: parseFloat(manualStats.n) || 0,
          sumX: parseFloat(manualStats.sumX) || 0,
          sumY: parseFloat(manualStats.sumY) || 0,
          sumX2: parseFloat(manualStats.sumX2) || 0,
          sumXY: parseFloat(manualStats.sumXY) || 0,
          sumResiduals: parseFloat(manualStats.sumResiduals) || 0,
        };

  const renderSection = (sectionId) => {
    if (sectionId === "regression") {
      return (
        <div
          key="regression"
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-700 overflow-hidden relative mb-6 last:mb-0"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <div className="p-6 md:p-8 text-center">
            <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              近似直線
            </h2>

            {result.errorMsg ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-full font-medium text-sm border border-red-100 dark:border-red-800">
                <AlertTriangle className="w-4 h-4" /> {result.errorMsg}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="whitespace-nowrap overflow-x-auto py-2 px-1 text-3xl md:text-5xl font-mono font-bold text-slate-800 dark:text-white tracking-tight">
                  {result.slope !== null ? (
                    <>
                      y ={" "}
                      <span className="text-indigo-600 dark:text-indigo-400">{safeRound(result.slope, 3)}</span>x{" "}
                      {result.intercept >= 0 ? "+" : "-"}{" "}
                      <span className="text-purple-600 dark:text-purple-400">
                        {Math.abs(safeRound(result.intercept, 3))}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">y = ax + b</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                  <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center">
                    <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">傾き a</div>
                    <div className="text-3xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                      {result.slope !== null ? safeRound(result.slope, 5) : "---"}
                    </div>
                    {result.stdErrA && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">
                          誤差
                        </span>
                        <span className="text-base font-mono font-medium">± {safeRound(result.stdErrA, 4)}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center">
                    <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">切片 b</div>
                    <div className="text-3xl font-mono font-bold text-purple-600 dark:text-purple-400 mb-2">
                      {result.intercept !== null ? safeRound(result.intercept, 5) : "---"}
                    </div>
                    {result.stdErrB && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">
                          誤差
                        </span>
                        <span className="text-base font-mono font-medium">± {safeRound(result.stdErrB, 4)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {result.slope !== null && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setShowFormula(!showFormula)}
                className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {showFormula ? <ChevronUp className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}{" "}
                {showFormula ? "途中式を隠す" : "計算プロセスを見る"}
              </button>

              {showFormula && (
                <div className="bg-slate-900 dark:bg-black text-slate-300 p-6 animate-fade-in border-t border-slate-800">
                  <FormulaDisplay
                    stats={getStats()}
                    slope={result.slope}
                    intercept={result.intercept}
                    stdErrA={result.stdErrA}
                    stdErrB={result.stdErrB}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (sectionId === "analysis") {
      return (
        <div
          key="analysis"
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6 last:mb-0"
        >
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-indigo-500" /> データ分析
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
            <StatBadge label="n" value={getStats().n} />
            <StatBadge label="ΣX" value={safeRound(getStats().sumX)} />
            <StatBadge label="ΣY" value={safeRound(getStats().sumY)} />
            <StatBadge label="ΣX²" value={safeRound(getStats().sumX2)} />
            <StatBadge label="ΣXY" value={safeRound(getStats().sumXY)} />
            <StatBadge
              label="Σ(Y-aX-b)²"
              value={result.slope ? safeRound(getStats().sumResiduals, 2) : "-"}
              highlight
            />
          </div>

          {mode === "raw" && (
            <DetailedDataTable
              data={dataPoints}
              slope={result.slope}
              intercept={result.intercept}
              onRequestDownload={handleRequestDownload}
            />
          )}

          <div className="w-full aspect-[16/9] bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden flex items-center justify-center">
            {dataPoints.length > 0 ? (
              <div className="w-full h-full p-4">
                <SimpleScatterPlot data={dataPoints} slope={result.slope} intercept={result.intercept} isDarkMode={isDarkMode} />
              </div>
            ) : (
              <div className="text-slate-300 dark:text-slate-600 flex flex-col items-center gap-2">
                <LineChart className="w-10 h-10" />
                <span className="text-sm">データを入力するとグラフが表示されます</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${isDarkMode ? "dark bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-800"} pb-12`}>
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <PrecisionSelector
            mode={numberFormatMode}
            onModeChange={(m) => setNumberFormatMode(m)}
            digits={numberFormatDigits}
            onChange={(d) => setNumberFormatDigits(d)}
          />

          <div className="flex gap-2 relative">
            <button
              onClick={handleResetRequest}
              className="flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">全削除</span>
            </button>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-6 h-6" />
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowLayoutModal(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <Layout className="w-4 h-4" />
                      レイアウト編集
                    </button>

                    <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>

                    <button
                      onClick={() => {
                        setIsDarkMode(!isDarkMode);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      {isDarkMode ? "ライトモード" : "ダークモード"}
                    </button>

                    <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>

                    <button
                      onClick={() => {
                        setShowFormula(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <BookOpen className="w-4 h-4" />
                      最小二乗法の原理・解説
                    </button>

                    {/* ★ 標準誤差（URLは /stderr に統一） */}
                    <button
                      onClick={() => {
                        navigate("/stderr");
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <Sigma className="w-4 h-4" />
                      標準誤差カリキュレーター
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-center mb-8">
          <div className="bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 inline-flex">
            <button
              onClick={() => setMode("raw")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === "raw" ? "bg-indigo-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Database className="w-4 h-4" /> データ個別入力
            </button>

            <button
              onClick={() => setMode("stats")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === "stats" ? "bg-indigo-600 text-white shadow" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Sigma className="w-4 h-4" /> 統計量直接入力
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-6">
            {mode === "raw" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 flex justify-between items-center">
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Table className="w-4 h-4 text-indigo-500" /> データ入力
                  </h2>
                  <div className="flex gap-1">
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 text-slate-600 dark:text-slate-400"
                    >
                      <Undo className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                      className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 text-slate-600 dark:text-slate-400"
                    >
                      <Redo className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <form
                    onSubmit={handleUpsertPoint}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      editingId !== null
                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                        : "bg-slate-50 dark:bg-slate-700/50 border-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-xs font-bold uppercase ${editingId !== null ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                        {editingId !== null ? "編集中" : "新規追加"}
                      </span>
                      {editingId === null && (
                        <button
                          type="button"
                          onClick={() => setShowImportModal(true)}
                          className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel貼り付け
                        </button>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 pl-1">X</label>
                        <input
                          ref={xInputRef}
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={inputX}
                          onChange={(e) => setInputX(e.target.value)}
                          onKeyDown={handleKeyDownX}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none font-mono text-lg bg-white dark:bg-slate-800 dark:text-white"
                          inputMode="decimal"
                        />
                      </div>

                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 pl-1">Y</label>
                        <input
                          ref={yInputRef}
                          type="number"
                          step="any"
                          placeholder="0.0"
                          value={inputY}
                          onChange={(e) => setInputY(e.target.value)}
                          onKeyDown={handleKeyDownY}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none font-mono text-lg bg-white dark:bg-slate-800 dark:text-white"
                          inputMode="decimal"
                        />
                      </div>

                      <div className="flex items-end pb-0.5">
                        {editingId !== null ? (
                          <div className="flex gap-1">
                            <button type="button" onClick={handleEditCancel} className="p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded-lg">
                              <XIcon className="w-5 h-5" />
                            </button>
                            <button type="submit" className="p-3 bg-amber-500 text-white rounded-lg shadow-md">
                              <Check className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <button type="submit" disabled={!inputX || !inputY} className="p-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50">
                            <Plus className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </form>

                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                    <div className="overflow-y-auto max-h-[300px]">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-600">
                          <tr>
                            <th className="px-4 py-2 w-12 text-center">No.</th>
                            <th className="px-4 py-2 font-mono">X</th>
                            <th className="px-4 py-2 font-mono">Y</th>
                            <th className="px-4 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {dataPoints.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                                データがありません
                              </td>
                            </tr>
                          ) : (
                            dataPoints.map((p, i) => (
                              <tr
                                key={p.id}
                                className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 group ${
                                  editingId === p.id ? "bg-amber-50 dark:bg-amber-900/10" : ""
                                }`}
                              >
                                <td className="px-4 py-2 text-center text-slate-400 dark:text-slate-500 text-xs">{i + 1}</td>
                                <td className="px-4 py-2 font-mono dark:text-slate-300">{p.x}</td>
                                <td className="px-4 py-2 font-mono dark:text-slate-300">{p.y}</td>
                                <td className="px-4 py-2 text-right">
                                  <div className="flex justify-end gap-1">
                                    <button onClick={() => handleEditStart(p)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 rounded">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeletePoint(p.id)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {dataPoints.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 p-2 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                        <button onClick={handleCopyToClipboard} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:text-indigo-600 dark:hover:text-indigo-400 dark:text-slate-300">
                          {copied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />} {copied ? "コピー完了" : "コピー"}
                        </button>
                        <button onClick={handleExportCSV} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:text-indigo-600 dark:hover:text-indigo-400 dark:text-slate-300">
                          <Download className="w-3 h-3" /> CSV
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {mode === "stats" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputCard label="データ個数 (n)" symbol="n" value={manualStats.n} onChange={(v) => handleManualChange("n", v)} required />
                  <InputCard label="Xの総和" symbol="ΣX" value={manualStats.sumX} onChange={(v) => handleManualChange("sumX", v)} />
                  <InputCard label="Yの総和" symbol="ΣY" value={manualStats.sumY} onChange={(v) => handleManualChange("sumY", v)} />
                  <InputCard label="Xの二乗和" symbol="ΣX²" value={manualStats.sumX2} onChange={(v) => handleManualChange("sumX2", v)} />
                  <InputCard label="XとYの積和" symbol="ΣXY" value={manualStats.sumXY} onChange={(v) => handleManualChange("sumXY", v)} />
                  <InputCard label="残差平方和" symbol="Σ(Y-aX-b)²" value={manualStats.sumResiduals} onChange={(v) => handleManualChange("sumResiduals", v)} isResultRelated highlight plClass="pl-28" />
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-6">
            {sectionOrder.map((sectionId) => renderSection(sectionId))}
          </div>
        </div>
      </div>

      {/* Confirm reset */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">全削除しますか？</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">現在の入力データがすべて消去されます。</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm font-bold">
                キャンセル
              </button>
              <button onClick={handleResetExecute} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-red-500/30">
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && <PasteImportModal onClose={() => setShowImportModal(false)} onImport={handleImportData} />}
      {showLayoutModal && (
        <LayoutEditModal
          currentOrder={sectionOrder}
          onSave={(newOrder) => {
            setSectionOrder(newOrder);
            setShowLayoutModal(false);
          }}
          onClose={() => setShowLayoutModal(false)}
        />
      )}
      {showDownloadConfirmModal && (
        <DownloadConfirmModal onClose={() => setShowDownloadConfirmModal(false)} onConfirm={executeDownload} fileName={downloadConfig.fileName} />
      )}
    </div>
  );
};

// ==========================================
// 10) Router wrapper (prevents nested Router error)
// ==========================================
const RouterWrapper = ({ children }) => {
  const inRouter = useInRouterContext();
  return inRouter ? children : <HashRouter>{children}</HashRouter>;
};

// ==========================================
// 11) App Export
// ==========================================
const App = () => (
  <ErrorBoundary>
    <RouterWrapper>
      <Routes>
        <Route path="/" element={<LeastSquaresErrorCalc />} />
        <Route path="/stderr" element={<StandardErrorCalculator />} />
      </Routes>
    </RouterWrapper>
  </ErrorBoundary>
);

export default App;
