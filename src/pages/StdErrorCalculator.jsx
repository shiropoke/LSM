import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, Plus, Trash2, Pencil, Check, X, RotateCcw, ArrowLeft } from "lucide-react";

const safeRound = (num, decimals = 6) => {
  if (num === null || num === undefined || Number.isNaN(num) || !Number.isFinite(num)) return "---";
  return +(Math.round(num + "e+" + decimals) + "e-" + decimals);
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const makeNewTab = (index) => ({
  id: generateId(),
  title: `値を入力 ${index}`,
  values: [], // {id, v}
});

export default function StdErrorCalculator() {
  const navigate = useNavigate();

  // 「値を入力」タブのみ（sとn入力タブは無し）
  const [tabs, setTabs] = useState([makeNewTab(1)]);
  const [activeId, setActiveId] = useState(tabs[0].id);

  // 入力欄（タブ共通ではなく “現在タブ用” として管理）
  const [inputValue, setInputValue] = useState("");
  const [editing, setEditing] = useState(null); // {rowId, draft} or null

  const activeIndex = useMemo(() => tabs.findIndex(t => t.id === activeId), [tabs, activeId]);
  const activeTab = tabs[activeIndex] ?? tabs[0];

  const stats = useMemo(() => {
    const arr = (activeTab?.values ?? []).map(x => x.v).filter(v => Number.isFinite(v));
    const n = arr.length;
    if (n === 0) return { n: 0, mean: null, sd: null, se: null, sum: 0 };

    const sum = arr.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    // 標本標準偏差（n-1）
    let sd = null;
    if (n >= 2) {
      const ss = arr.reduce((acc, v) => acc + (v - mean) ** 2, 0);
      sd = Math.sqrt(ss / (n - 1));
    }

    // 標準誤差（SE = SD / sqrt(n)）: n>=2 のとき計算可能
    const se = (sd !== null) ? sd / Math.sqrt(n) : null;

    return { n, mean, sd, se, sum };
  }, [activeTab]);

  const updateActiveTab = (updater) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === activeId);
      if (idx < 0) return prev;
      const copy = [...prev];
      copy[idx] = updater(copy[idx]);
      return copy;
    });
  };

  // 小数 Enter で “有効な値…” が出る原因は step 不一致 + submit/validation が多いので
  // - input に step="any"
  // - form に noValidate
  // - Enter は submit に依存せず手動追加
  const addValue = () => {
    const v = parseFloat(inputValue);
    if (!Number.isFinite(v)) return;
    updateActiveTab(tab => ({
      ...tab,
      values: [...tab.values, { id: generateId(), v }],
    }));
    setInputValue("");
  };

  const startEdit = (row) => {
    setEditing({ rowId: row.id, draft: String(row.v) });
  };

  const cancelEdit = () => setEditing(null);

  const commitEdit = () => {
    if (!editing) return;
    const v = parseFloat(editing.draft);
    if (!Number.isFinite(v)) return;

    updateActiveTab(tab => ({
      ...tab,
      values: tab.values.map(r => (r.id === editing.rowId ? { ...r, v } : r)),
    }));
    setEditing(null);
  };

  const deleteRow = (rowId) => {
    if (editing?.rowId === rowId) setEditing(null);
    updateActiveTab(tab => ({
      ...tab,
      values: tab.values.filter(r => r.id !== rowId),
    }));
  };

  const resetActive = () => {
    setEditing(null);
    setInputValue("");
    updateActiveTab(tab => ({ ...tab, values: [] }));
  };

  const addTab = () => {
    setTabs(prev => {
      const next = [...prev, makeNewTab(prev.length + 1)];
      return next;
    });
    // state更新直後に activeId を新タブにしたいので、次tickで
    setTimeout(() => {
      setTabs(prev => {
        const last = prev[prev.length - 1];
        if (last) setActiveId(last.id);
        return prev;
      });
    }, 0);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">標準誤差カリキュレーター</h1>
          </div>

          {/* 要望：右側の「戻る」と「リセット」を入れ替え → リセット→戻る */}
          <div className="flex items-center gap-2">
            <button
              onClick={resetActive}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold
                         bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600
                         hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="リセット"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">リセット</span>
            </button>

            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold
                         bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              title="戻る"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">戻る</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs: 「値を入力」タブ + 右側に + ボタン */}
        <div className="flex items-center gap-2">
          <div className="flex-1 overflow-x-auto">
            <div className="inline-flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 gap-1">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setActiveId(t.id); setEditing(null); setInputValue(""); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                    ${t.id === activeId
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={addTab}
            className="shrink-0 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                       hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="タブを追加"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">n</div>
            <div className="font-mono text-2xl font-bold">{stats.n}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">平均</div>
            <div className="font-mono text-2xl font-bold">{stats.mean !== null ? safeRound(stats.mean) : "---"}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">標準偏差 (SD)</div>
            <div className="font-mono text-2xl font-bold">{stats.sd !== null ? safeRound(stats.sd) : "---"}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">標準誤差 (SE)</div>
            <div className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {stats.se !== null ? safeRound(stats.se) : "---"}
            </div>
          </div>
        </div>

        {/* Input + Table */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 flex items-center justify-between">
            <h2 className="text-sm font-bold">データ入力</h2>
            <button
              onClick={resetActive}
              className="text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
              title="全削除"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">全削除</span>
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* noValidate でブラウザの “有効な値…” を出しにくくする */}
            <form
              noValidate
              onSubmit={(e) => { e.preventDefault(); addValue(); }}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-400 pl-1">値</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"              // 重要：小数OK
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();  // submit に任せない
                        addValue();
                      }
                    }}
                    placeholder="例: 1.234"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600
                               focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900
                               outline-none font-mono text-lg bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={addValue}
                  disabled={!inputValue || !Number.isFinite(parseFloat(inputValue))}
                  className="p-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50"
                  title="追加"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </form>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-y-auto max-h-[360px]">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-600">
                    <tr>
                      <th className="px-4 py-2 w-12 text-center">No.</th>
                      <th className="px-4 py-2 font-mono">値</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {activeTab.values.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                          データがありません
                        </td>
                      </tr>
                    ) : (
                      activeTab.values.map((row, i) => {
                        const isEditing = editing?.rowId === row.id;
                        return (
                          <tr key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 ${isEditing ? "bg-amber-50 dark:bg-amber-900/15" : ""}`}>
                            <td className="px-4 py-2 text-center text-slate-400 dark:text-slate-500 text-xs">
                              {i + 1}
                            </td>

                            <td className="px-4 py-2 font-mono">
                              {isEditing ? (
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"  // 編集も小数OK
                                  value={editing.draft}
                                  onChange={(e) => setEditing(prev => ({ ...prev, draft: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                                    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                                  }}
                                  className="w-full max-w-[240px] px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-700
                                             focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900
                                             outline-none bg-white dark:bg-slate-800"
                                />
                              ) : (
                                safeRound(row.v)
                              )}
                            </td>

                            <td className="px-4 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={cancelEdit}
                                      className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                                      title="キャンセル"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={commitEdit}
                                      className="p-2 text-amber-600 hover:text-amber-700 rounded"
                                      title="確定"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEdit(row)}
                                      className="p-2 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded"
                                      title="編集"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteRow(row.id)}
                                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                                      title="削除"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 計算式ボックスは表示しない（要望どおり削除） */}
          </div>
        </div>
      </div>
    </div>
  );
}
