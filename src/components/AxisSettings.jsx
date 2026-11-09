import { coordinateDescription, hasLogScale } from "../utils/scales.js";

export default function AxisSettings({ value, onChange }) {
  const fields = [["xName", "X軸の名称"], ["xUnit", "X軸の単位"], ["yName", "Y軸の名称"], ["yUnit", "Y軸の単位"]];
  return <details className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
    <summary className="text-sm font-bold cursor-pointer">軸の設定</summary>
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">{fields.map(([key, label]) => <label key={key} className="text-xs">{label}<input aria-label={label} maxLength={60} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} className="mt-1 block w-full border rounded-lg p-2 bg-white dark:bg-slate-800 dark:border-slate-600" /></label>)}</div>
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">{[["xScale", "X軸"], ["yScale", "Y軸"]].map(([key, label]) => <label key={key} className="text-xs">{label}の目盛り<select aria-label={`${label}の目盛り`} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} className="mt-1 block w-full border rounded-lg p-2 bg-white dark:bg-slate-800 dark:border-slate-600"><option value="linear">線形</option><option value="log">対数（底10）</option></select></label>)}</div>
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{hasLogScale(value) ? `${coordinateDescription(value)}。選択した座標で全系列を回帰します。対数軸の値は正の値が必要です。原点固定は計算用の座標で切片を0に固定します。` : "片方を対数にすると片対数、両方を対数にすると両対数グラフになります。回帰計算も選択した座標で行います。"}</p>
  </details>;
}
