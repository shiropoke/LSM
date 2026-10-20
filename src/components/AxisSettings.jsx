export default function AxisSettings({ value, onChange }) {
  const fields = [["xName", "X軸の名称"], ["xUnit", "X軸の単位"], ["yName", "Y軸の名称"], ["yUnit", "Y軸の単位"]];
  return <details className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
    <summary className="text-sm font-bold cursor-pointer">軸の設定</summary>
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">{fields.map(([key, label]) => <label key={key} className="text-xs">{label}<input aria-label={label} maxLength={60} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} className="mt-1 block w-full border rounded-lg p-2 bg-white dark:bg-slate-800 dark:border-slate-600" /></label>)}</div>
  </details>;
}
