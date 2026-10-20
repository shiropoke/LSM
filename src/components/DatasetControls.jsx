export default function DatasetControls({ datasets, activeId, onSelect, onAdd, onUpdate, onDelete }) {
  const active = datasets.find(d => d.id === activeId) || datasets[0];
  return <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4 space-y-3">
    <div className="flex flex-wrap gap-2 items-center">
      {datasets.map(d => <div key={d.id} className="flex items-center gap-1">
        <input type="checkbox" aria-label={`${d.name}をグラフに表示`} checked={d.visible} onChange={e => onUpdate(d.id, { visible: e.target.checked })} />
        <button type="button" onClick={() => onSelect(d.id)} className={`px-3 py-2 text-xs font-bold rounded-lg border ${d.id === active.id ? "bg-indigo-50 dark:bg-slate-700" : ""}`} style={{ borderColor: d.color }} aria-pressed={d.id === active.id}>{d.name}</button>
      </div>)}
      <button type="button" onClick={onAdd} className="text-xs font-bold px-3 py-2 rounded-lg bg-indigo-600 text-white">系列を追加</button>
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      <label className="text-xs">系列名 <input aria-label="系列名" maxLength={80} value={active.name} onChange={e => onUpdate(active.id, { name: e.target.value })} className="ml-1 px-2 py-1 border rounded bg-white dark:bg-slate-800 dark:border-slate-600 max-w-[180px]" /></label>
      <label className="text-xs flex items-center gap-1">色 <input type="color" aria-label="系列の色" value={active.color} onChange={e => onUpdate(active.id, { color: e.target.value })} className="w-9 h-7" /></label>
      <button type="button" disabled={datasets.length === 1} onClick={() => onDelete(active.id)} className="text-xs text-red-500 disabled:opacity-40">この系列を削除</button>
    </div>
  </div>;
}
