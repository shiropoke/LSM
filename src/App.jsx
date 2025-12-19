import React, { useEffect, useMemo, useRef, useState, useContext, useCallback } from "react";
import { HashRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
  Calculator,
  Database,
  Sigma,
  Table,
  Activity,
  Pencil,
  X as XIcon,
  AlertTriangle,
  LineChart,
  ChevronUp,
  BookOpen,
  Download,
  Clipboard,
  Check,
  FileSpreadsheet,
  Undo,
  Redo,
  Sparkles,
  TrendingUp,
  Menu,
  Moon,
  Sun,
  ArrowUp,
  ArrowDown,
  Layout,
  Trash2,
  Plus,
  Save,
  Link2,
  FolderOpen,
  Copy,
} from "lucide-react";

/* =========================================================
   0) グローバル桁表示（safeRound が参照）
   - 重要：state変更の同一render内で setGlobalNumberFormat を同期的に呼ぶと
     「瞬時に」表示が切り替わる
========================================================= */
const GLOBAL_NUMFMT = { mode: "dec", digits: 4 }; // mode: "dec" | "sig"
const setGlobalNumberFormat = (mode, digits) => {
  GLOBAL_NUMFMT.mode = mode;
  GLOBAL_NUMFMT.digits = digits;
};

const safeRound = (num) => {
  if (num === null || num === undefined || Number.isNaN(num) || !Number.isFinite(num)) return "---";
  const { mode, digits } = GLOBAL_NUMFMT;
  const d = Math.max(1, Math.min(12, parseInt(digits, 10) || 4));

  if (mode === "sig") {
    // 有効数字
    const n = Number(num);
    if (n === 0) return 0;
    const abs = Math.abs(n);
    const exp = Math.floor(Math.log10(abs));
    const factor = Math.pow(10, d - 1 - exp);
    const rounded = Math.round(n * factor) / factor;
    return Number(rounded.toPrecision(d));
  }

  // 小数桁
  const n = Number(num);
  const factor = Math.pow(10, d);
  return Math.round(n * factor) / factor;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/* =========================================================
   1) 共有リンク用：JSONをBase64URL化してURLに埋め込む
========================================================= */
const encodeBase64UrlJson = (obj) => {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const decodeBase64UrlJson = (str) => {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
};

const getShareParamFromUrl = () => {
  // 1) 通常の ?data=
  try {
    const url = new URL(window.location.href);
    const s = url.searchParams.get("data");
    if (s) return s;
  } catch (_) {}

  // 2) HashRouter の #/path?data=...
  const hash = window.location.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex >= 0) {
    const query = hash.slice(qIndex + 1);
    const params = new URLSearchParams(query);
    const s = params.get("data");
    if (s) return s;
  }
  return null;
};

const removeShareParamFromUrl = () => {
  try {
    const url = new URL(window.location.href);

    // search側
    url.searchParams.delete("data");

    // hash側
    if (url.hash.includes("?")) {
      const [path, query] = url.hash.split("?");
      const params = new URLSearchParams(query);
      params.delete("data");
      url.hash = params.toString() ? `${path}?${params.toString()}` : path;
    }

    window.history.replaceState({}, "", url.toString());
  } catch (_) {}
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_) {
      return false;
    }
  }
};

const fmtDateTime = (ts) => {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* =========================================================
   2) セッション保存：localStorage に複数セッションを持つ
========================================================= */
const SESS_KEY = "lsm_sessions_v1";
const ACTIVE_KEY = "lsm_active_session_v1";

const safeLoadJson = (key, fallback) => {
  try {
    const s = localStorage.getItem(key);
    if (!s) return fallback;
    return JSON.parse(s);
  } catch (_) {
    return fallback;
  }
};

const safeSaveJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
};

/* =========================================================
   3) エラー境界
========================================================= */
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

/* =========================================================
   4) 小物UI
========================================================= */
const InputCard = ({ label, symbol, value, onChange, required = false, highlight = false, plClass = "pl-12" }) => (
  <div className="flex flex-col">
    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex justify-between">
      {label}{" "}
      {required && (
        <span className="text-red-500 text-[10px] bg-red-50 dark:bg-red-900/30 px-1 rounded">必須</span>
      )}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span className={`font-mono text-xs font-bold ${highlight ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}>
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
  <div className={`flex flex-col p-2 rounded-lg border ${highlight ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800" : "bg-white dark:bg-slate-700/50 border-slate-100 dark:border-slate-600"}`}>
    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
    <span className={`font-mono text-sm font-bold truncate ${highlight ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"}`}>
      {value}
    </span>
  </div>
);

/* =========================================================
   5) セッション/共有のコンテキスト
========================================================= */
const SessionContext = React.createContext(null);
const useSession = () => useContext(SessionContext);

/* =========================================================
   6) セッション管理モーダル
========================================================= */
const SessionManagerModal = ({ onClose }) => {
  const session = useSession();
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  const sessions = session.sessions;
  const active = session.activeSessionName;

  const sortedNames = Object.keys(sessions).sort((a, b) => (sessions[b]?.updatedAt || 0) - (sessions[a]?.updatedAt || 0));

  const handleSaveAs = async () => {
    const n = name.trim();
    if (!n) return;
    session.saveAs(n);
    setName("");
  };

  const handleCopyActiveShareLink = async () => {
    const ok = await copyToClipboard(session.makeShareLinkFromCurrent());
    setCopied(ok);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> セッション保存・呼び出し
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">セッション名</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='例: 今日の実験 / レポート用'
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white outline-none font-mono text-sm"
              />
            </div>
            <button
              onClick={handleSaveAs}
              disabled={!name.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> この名前で保存（アクティブ）
            </button>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              アクティブ: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{active || "(未設定)"}</span>
              <span className="text-xs text-slate-400 ml-2">（変更は自動保存されます）</span>
            </div>
            <button
              onClick={handleCopyActiveShareLink}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? "共有リンクをコピーしました" : "共有リンクをコピー（現在の状態）"}
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" /> 保存済みセッション
            </div>
            <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {sortedNames.length === 0 ? (
                <div className="p-6 text-center text-slate-400">保存されたセッションはありません</div>
              ) : (
                sortedNames.map((n) => {
                  const it = sessions[n];
                  const isActive = n === active;
                  return (
                    <div key={n} className="p-4 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`font-mono font-bold truncate ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-100"}`}>
                            {n}
                          </div>
                          {isActive && <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">ACTIVE</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">更新: {fmtDateTime(it?.updatedAt || 0)}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => session.loadSession(n)}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          読み込み
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await copyToClipboard(session.makeShareLinkFromSnapshot(it.snapshot));
                            // 軽いフィードバックだけ（UIは簡潔に）
                            if (ok) {
                              // noop
                            }
                          }}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          <Link2 className="w-3.5 h-3.5" /> 共有リンク
                        </button>
                        <button
                          onClick={() => session.deleteSession(n)}
                          className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 text-xs font-bold text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 削除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            ・この機能は <span className="font-mono">localStorage</span> に保存します（サーバ不要）。<br />
            ・共有リンクはURLにデータを埋め込みます。データ量が多いとURLが長くなる点に注意してください。
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold text-sm">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   7) 有効数字/小数桁 UI（メニューから開く想定）
========================================================= */
const PrecisionModal = ({ onClose }) => {
  const session = useSession();
  const [mode, setMode] = useState(session.numberFormatMode);
  const [digits, setDigits] = useState(session.numberFormatDigits);

  useEffect(() => {
    session.setNumberFormatMode(mode);
    session.setNumberFormatDigits(digits);
  }, [mode, digits]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> 表示桁の設定
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setMode("dec")}
              className={`px-3 py-2 rounded-lg text-sm font-bold ${mode === "dec" ? "bg-white dark:bg-slate-900 shadow" : "text-slate-500 dark:text-slate-400"}`}
            >
              小数桁
            </button>
            <button
              onClick={() => setMode("sig")}
              className={`px-3 py-2 rounded-lg text-sm font-bold ${mode === "sig" ? "bg-white dark:bg-slate-900 shadow" : "text-slate-500 dark:text-slate-400"}`}
            >
              有効数字
            </button>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{mode === "dec" ? "小数桁数" : "有効数字の桁数"}</div>
            <input
              type="number"
              min={1}
              max={12}
              value={digits}
              onChange={(e) => setDigits(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white outline-none font-mono"
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">プレビュー</div>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200 space-y-1">
              <div>1234.56789 → <span className="font-bold text-indigo-600 dark:text-indigo-400">{safeRound(1234.56789)}</span></div>
              <div>0.001234567 → <span className="font-bold text-indigo-600 dark:text-indigo-400">{safeRound(0.001234567)}</span></div>
              <div>-98.7654321 → <span className="font-bold text-indigo-600 dark:text-indigo-400">{safeRound(-98.7654321)}</span></div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold text-sm">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   8) 詳細データ表（最小二乗）
========================================================= */
const DetailedDataTable = ({ data, slope, intercept, onRequestDownload }) => {
  const [copied, setCopied] = useState(false);
  if (!data || data.length === 0) return null;

  const rows = data.map((p, index) => {
    const residualSq =
      slope !== null && intercept !== null ? Math.pow(p.y - (slope * p.x + intercept), 2) : null;
    return { no: index + 1, x: p.x, y: p.y, x2: p.x * p.x, xy: p.x * p.y, residualSq };
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
      .map((r) => `${r.no}\t${r.x}\t${r.y}\t${r.x2}\t${r.xy}\t${r.residualSq !== null ? r.residualSq : ""}`)
      .join("\n");
    const footer = `Sum\t${totals.x}\t${totals.y}\t${totals.x2}\t${totals.xy}\t${totals.residualSq !== null ? totals.residualSq : ""}`;

    navigator.clipboard.writeText(header + body + "\n" + footer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDownloadRequest = () => {
    const header = "No,X,Y,X^2,XY,(Y-aX-b)^2\n";
    const body = rows
      .map((r) => `${r.no},${r.x},${r.y},${r.x2},${r.xy},${r.residualSq !== null ? r.residualSq : ""}`)
      .join("\n");
    const footer = `Sum,${totals.x},${totals.y},${totals.x2},${totals.xy},${totals.residualSq !== null ? totals.residualSq : ""}`;
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
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 text-center whitespace-nowrap">No.</th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">X</th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">Y</th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">X²</th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">XY</th>
              <th className="px-4 py-2 font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap text-indigo-600 dark:text-indigo-400">
                (Y - aX - b)²
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800/50">
            {rows.map((row) => (
              <tr key={row.no} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors font-mono text-slate-600 dark:text-slate-300">
                <td className="px-4 py-1.5 text-center text-slate-400 dark:text-slate-500 text-xs">{row.no}</td>
                <td className="px-4 py-1.5">{safeRound(row.x)}</td>
                <td className="px-4 py-1.5">{safeRound(row.y)}</td>
                <td className="px-4 py-1.5">{safeRound(row.x2)}</td>
                <td className="px-4 py-1.5">{safeRound(row.xy)}</td>
                <td className="px-4 py-1.5 text-indigo-600 dark:text-indigo-400 font-medium">{safeRound(row.residualSq)}</td>
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

/* =========================================================
   9) グラフ（簡易SVG）
========================================================= */
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

  const scaleX = (x) => padding + ((x - domainX[0]) / (domainX[1] - domainX[0])) * (width - 2 * padding);
  const scaleY = (y) => height - (padding + ((y - domainY[0]) / (domainY[1] - domainY[0])) * (height - 2 * padding));

  const axisColor = isDarkMode ? "#94a3b8" : "#64748b";
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";
  const zeroColor = isDarkMode ? "#cbd5e1" : "#64748b";

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

  let lineCoords = null;
  if (slope !== null && intercept !== null && Number.isFinite(slope) && Number.isFinite(intercept)) {
    lineCoords = {
      x1: scaleX(domainX[0]),
      y1: scaleY(slope * domainX[0] + intercept),
      x2: scaleX(domainX[1]),
      y2: scaleY(slope * domainX[1] + intercept),
    };
  }

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
            <line x1={xPos} y1={padding} x2={xPos} y2={height - padding} stroke={tick === 0 ? zeroColor : gridColor} strokeWidth={tick === 0 ? 2 : 1} />
            <text x={xPos} y={height - 25} fontSize="10" fill={axisColor} textAnchor="middle">
              {safeRound(tick)}
            </text>
          </g>
        );
      })}

      {yTicks.map((tick) => {
        const yPos = scaleY(tick);
        if (!Number.isFinite(yPos) || yPos < padding || yPos > height - padding) return null;
        return (
          <g key={`y-${tick}`}>
            <line x1={padding} y1={yPos} x2={width - padding} y2={yPos} stroke={tick === 0 ? zeroColor : gridColor} strokeWidth={tick === 0 ? 2 : 1} />
            <text x={padding - 10} y={yPos + 3} fontSize="10" fill={axisColor} textAnchor="end">
              {safeRound(tick)}
            </text>
          </g>
        );
      })}

      <rect x={padding} y={padding} width={width - 2 * padding} height={height - 2 * padding} fill="none" stroke={isDarkMode ? "#475569" : "#cbd5e1"} strokeWidth="1" />

      <g clipPath="url(#chartArea)">
        {lineCoords && Number.isFinite(lineCoords.y1) && Number.isFinite(lineCoords.y2) && (
          <line x1={lineCoords.x1} y1={lineCoords.y1} x2={lineCoords.x2} y2={lineCoords.y2} stroke="#6366f1" strokeWidth="2" />
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
          const w = tooltipText.length * 7 + 10;

          return (
            <g pointerEvents="none">
              <rect
                x={isRight ? x - (w + 20) : x + 10}
                y={y - 25}
                width={w}
                height="20"
                rx="4"
                fill={isDarkMode ? "#1e293b" : "white"}
                stroke={isDarkMode ? "#475569" : "#cbd5e1"}
                strokeWidth="1"
                fillOpacity="0.9"
              />
              <text x={x + xOffset} y={y - 15} fontSize="12" fill={isDarkMode ? "white" : "#1e293b"} alignmentBaseline="middle" textAnchor={textAnchor} fontWeight="bold">
                {tooltipText}
              </text>
            </g>
          );
        })()}
    </svg>
  );
};

/* =========================================================
   10) 最小二乗法ページ
========================================================= */
const LeastSquaresErrorCalc = ({ registerExporter, registerImporter, notifyDirty }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();

  const [mode, setMode] = useState("raw");

  const [dataPoints, setDataPoints] = useState([]);
  const [inputX, setInputX] = useState("");
  const [inputY, setInputY] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const xInputRef = useRef(null);
  const yInputRef = useRef(null);

  const [manualStats, setManualStats] = useState({ n: "", sumX: "", sumY: "", sumX2: "", sumXY: "", sumResiduals: "" });
  const [rawStats, setRawStats] = useState({ n: 0, sumX: 0, sumY: 0, sumX2: 0, sumXY: 0, sumResiduals: 0 });

  const [result, setResult] = useState({ slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "", sumResidualsCalc: 0 });

  // UI
  const [showFormula, setShowFormula] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [showDownloadConfirmModal, setShowDownloadConfirmModal] = useState(false);
  const [downloadConfig, setDownloadConfig] = useState({ content: "", fileName: "" });
  const [sectionOrder, setSectionOrder] = useState(["regression", "analysis"]);
  const [copied, setCopied] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // セッション/共有UI
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPrecisionModal, setShowPrecisionModal] = useState(false);

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

    if (!numN || numN === 0 || Number.isNaN(numN)) return { slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "" };

    const denominator = numN * numSX2 - numSX * numSX;
    if (denominator === 0 || Number.isNaN(denominator)) return { slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "分母が0です（Xの分散が0）" };

    const a = (numN * numSXY - numSX * numSY) / denominator;
    const b = (numSX2 * numSY - numSXY * numSX) / denominator;

    let sRes = 0;
    if (mode === "raw") sRes = dataPoints.reduce((acc, p) => acc + Math.pow(p.y - (a * p.x + b), 2), 0);
    else sRes = sResManual !== null && sResManual !== "" ? parseFloat(sResManual) : 0;

    let seA = null,
      seB = null;
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
      setResult({ slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "", sumResidualsCalc: 0 });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataPoints, mode]);

  useEffect(() => {
    if (mode !== "stats") return;
    const { n, sumX, sumY, sumX2, sumXY, sumResiduals } = manualStats;
    if (n === "" || sumX === "" || sumY === "" || sumX2 === "" || sumXY === "") {
      setResult({ slope: null, intercept: null, stdErrA: null, stdErrB: null, errorMsg: "", sumResidualsCalc: 0 });
      return;
    }
    const calcRes = calculateLeastSquares(n, sumX, sumY, sumX2, sumXY, sumResiduals);
    setResult(calcRes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualStats, mode]);

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
  };

  const handleDeletePoint = (id) => {
    if (editingId === id) handleEditCancel();
    addToHistory(dataPoints.filter((p) => p.id !== id));
  };

  const handleManualChange = (key, val) => setManualStats((prev) => ({ ...prev, [key]: val }));

  const handleRequestDownload = (content, fileName) => {
    setDownloadConfig({ content, fileName });
    setShowDownloadConfirmModal(true);
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

  const handleExportCSV = () => {
    if (dataPoints.length === 0) return;
    const csvContent = "X,Y\n" + dataPoints.map((p) => `${p.x},${p.y}`).join("\n");
    handleRequestDownload(csvContent, "least_squares_data.csv");
  };

  const handleCopyToClipboard = () => {
    if (dataPoints.length === 0) return;
    navigator.clipboard
      .writeText("X\tY\n" + dataPoints.map((p) => `${p.x}\t${p.y}`).join("\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
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

  // ========= autosave 対象が変わったら通知 =========
  useEffect(() => {
    notifyDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dataPoints, manualStats, sectionOrder, isDarkMode]);

  // ========= exporter/importer 登録 =========
  useEffect(() => {
    registerExporter(() => ({
      mode,
      dataPoints,
      manualStats,
      sectionOrder,
      isDarkMode,
    }));

    registerImporter((snap) => {
      if (!snap) return;
      setMode(snap.mode || "raw");
      setDataPoints(Array.isArray(snap.dataPoints) ? snap.dataPoints : []);
      setManualStats(
        snap.manualStats || { n: "", sumX: "", sumY: "", sumX2: "", sumXY: "", sumResiduals: "" }
      );
      setSectionOrder(Array.isArray(snap.sectionOrder) ? snap.sectionOrder : ["regression", "analysis"]);
      setIsDarkMode(!!snap.isDarkMode);

      // historyも自然に再初期化（Undo/Redoの整合性）
      const dp = Array.isArray(snap.dataPoints) ? snap.dataPoints : [];
      setHistory([dp]);
      setHistoryIndex(0);
      setEditingId(null);
      setInputX("");
      setInputY("");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dataPoints, manualStats, sectionOrder, isDarkMode]);

  // ========= 共有リンク：現在の状態をコピー =========
  const handleCopyShareLink = async () => {
    const link = session.makeShareLinkFromCurrent(location.pathname);
    await copyToClipboard(link);
  };

  // ========= セクション描画 =========
  const renderSection = (sectionId) => {
    if (sectionId === "regression") {
      return (
        <div key="regression" className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-700 overflow-hidden relative mb-6 last:mb-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <div className="p-6 md:p-8 text-center">
            <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">近似直線</h2>

            {result.errorMsg ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-full font-medium text-sm border border-red-100 dark:border-red-800">
                <AlertTriangle className="w-4 h-4" /> {result.errorMsg}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="whitespace-nowrap overflow-x-auto py-2 px-1 text-3xl md:text-5xl font-mono font-bold text-slate-800 dark:text-white tracking-tight">
                  {result.slope !== null ? (
                    <>
                      y = <span className="text-indigo-600 dark:text-indigo-400">{safeRound(result.slope)}</span>x{" "}
                      {result.intercept >= 0 ? "+" : "-"}{" "}
                      <span className="text-purple-600 dark:text-purple-400">{safeRound(Math.abs(result.intercept))}</span>
                    </>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">y = ax + b</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                  <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center">
                    <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">傾き a</div>
                    <div className="text-3xl font-mono font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                      {result.slope !== null ? safeRound(result.slope) : "---"}
                    </div>
                    {result.stdErrA && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">誤差</span>
                        <span className="text-base font-mono font-medium">± {safeRound(result.stdErrA)}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center">
                    <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">切片 b</div>
                    <div className="text-3xl font-mono font-bold text-purple-600 dark:text-purple-400 mb-2">
                      {result.intercept !== null ? safeRound(result.intercept) : "---"}
                    </div>
                    {result.stdErrB && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm">
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">誤差</span>
                        <span className="text-base font-mono font-medium">± {safeRound(result.stdErrB)}</span>
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
                  <div className="text-xs text-slate-400">
                    （ここは簡略表示です。必要なら途中式表示を拡張できます）
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (sectionId === "analysis") {
      const stats = getStats();
      return (
        <div key="analysis" className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6 last:mb-0">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-indigo-500" /> データ分析
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
            <StatBadge label="n" value={stats.n} />
            <StatBadge label="ΣX" value={safeRound(stats.sumX)} />
            <StatBadge label="ΣY" value={safeRound(stats.sumY)} />
            <StatBadge label="ΣX²" value={safeRound(stats.sumX2)} />
            <StatBadge label="ΣXY" value={safeRound(stats.sumXY)} />
            <StatBadge label="Σ(Y-aX-b)²" value={result.slope ? safeRound(stats.sumResiduals) : "-"} highlight />
          </div>

          {mode === "raw" && (
            <DetailedDataTable data={dataPoints} slope={result.slope} intercept={result.intercept} onRequestDownload={handleRequestDownload} />
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
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            {/* スマホはみ出し対策：タイトル削除（要望） */}
          </div>

          <div className="flex gap-2 relative">
            <button
              onClick={() => {
                // 全削除
                addToHistory([]);
                setInputX("");
                setInputY("");
                setEditingId(null);
              }}
              className="flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">全削除</span>
            </button>

            {/* Hamburger */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-600 dark:text-slate-300">
              <Menu className="w-6 h-6" />
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-fade-in">
                  <div className="py-1">
                    <div className="px-4 pt-3 pb-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Active Session:{" "}
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {session.activeSessionName || "(未設定)"}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setShowSessionModal(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      セッション保存・呼び出し
                    </button>

                    <button
                      onClick={async () => {
                        await handleCopyShareLink();
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <Link2 className="w-4 h-4" />
                      共有リンクをコピー（現在の状態）
                    </button>

                    <button
                      onClick={() => {
                        setShowPrecisionModal(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      表示桁の設定
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
                        navigate("/stderr");
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <Sigma className="w-4 h-4" />
                      標準誤差カリキュレーター
                    </button>

                    <button
                      onClick={() => {
                        setShowRefModal(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                    >
                      <BookOpen className="w-4 h-4" />
                      最小二乗法の原理・解説
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
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
          {/* Left */}
          <div className="lg:col-span-5 space-y-6">
            {mode === "raw" && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 flex justify-between items-center">
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Table className="w-4 h-4 text-indigo-500" /> データ入力
                  </h2>
                  <div className="flex gap-1">
                    <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 text-slate-600 dark:text-slate-400">
                      <Undo className="w-4 h-4" />
                    </button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 text-slate-600 dark:text-slate-400">
                      <Redo className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <form onSubmit={handleUpsertPoint} className={`p-4 rounded-xl border-2 transition-colors ${editingId !== null ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-700/50 border-transparent"}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={`text-xs font-bold uppercase ${editingId !== null ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                        {editingId !== null ? "編集中" : "新規追加"}
                      </span>
                      <button type="button" onClick={() => setShowImportModal(true)} className="text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel貼り付け（簡略）
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 pl-1">X</label>
                        <input
                          ref={xInputRef}
                          type="number"
                          step="any"
                          inputMode="decimal"
                          placeholder="0.0"
                          value={inputX}
                          onChange={(e) => setInputX(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (inputX !== "") yInputRef.current?.focus();
                            }
                          }}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none font-mono text-lg bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 pl-1">Y</label>
                        <input
                          ref={yInputRef}
                          type="number"
                          step="any"
                          inputMode="decimal"
                          placeholder="0.0"
                          value={inputY}
                          onChange={(e) => setInputY(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleUpsertPoint();
                            }
                          }}
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none font-mono text-lg bg-white dark:bg-slate-800 dark:text-white"
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
                              <tr key={p.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 group ${editingId === p.id ? "bg-amber-50 dark:bg-amber-900/10" : ""}`}>
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
                  <InputCard label="残差平方和" symbol="Σ(Y-aX-b)²" value={manualStats.sumResiduals} onChange={(v) => handleManualChange("sumResiduals", v)} highlight plClass="pl-28" />
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="lg:col-span-7 space-y-6">{sectionOrder.map((sectionId) => renderSection(sectionId))}</div>
        </div>
      </div>

      {/* Modals */}
      {showRefModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowRefModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> 最小二乗法の原理・解説
              </div>
              <button onClick={() => setShowRefModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-3">
              <div className="font-bold">最小二乗法</div>
              <div>「点と直線のズレ（残差）」の二乗和が最小になるように、傾き a と切片 b を決めます。</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">（必要ならここに式や導出をさらに追加できます）</div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-right">
              <button onClick={() => setShowRefModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowImportModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" /> Excelデータ貼り付け（X Y）
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <ImportPasteBox
              onImport={(parsed) => {
                addToHistory([...dataPoints, ...parsed.map((p) => ({ id: generateId(), x: p.x, y: p.y }))]);
                setShowImportModal(false);
              }}
            />
          </div>
        </div>
      )}

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

      {showSessionModal && <SessionManagerModal onClose={() => setShowSessionModal(false)} />}
      {showPrecisionModal && <PrecisionModal onClose={() => setShowPrecisionModal(false)} />}
    </div>
  );
};

/* ====== Import helper ====== */
const ImportPasteBox = ({ onImport }) => {
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
    <div className="p-5 space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-40 p-4 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 dark:text-white font-mono text-xs"
        placeholder={`例:\n1.5\t2.3\n2.0\t3.1\n...`}
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
  );
};

/* ====== Layout Edit Modal ====== */
const LayoutEditModal = ({ currentOrder, onSave, onClose }) => {
  const [order, setOrder] = useState(currentOrder);

  const moveItem = (index, direction) => {
    const newOrder = [...order];
    if (direction === "up" && index > 0) [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    else if (direction === "down" && index < newOrder.length - 1) [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrder(newOrder);
  };

  const getLabel = (id) => (id === "regression" ? "近似直線 (結果表示)" : id === "analysis" ? "データ分析 (表・グラフ)" : id);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
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
                  <button onClick={() => moveItem(index, "up")} disabled={index === 0} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 transition-colors">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveItem(index, "down")} disabled={index === order.length - 1} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 transition-colors">
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

/* ====== Download Confirm ====== */
const DownloadConfirmModal = ({ onClose, onConfirm, fileName }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
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
            データをCSVファイルとしてダウンロードします。
            <br />
            よろしいですか？
          </p>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">ファイル名: {fileName}</p>
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

/* =========================================================
   11) 標準誤差ページ（複数タブ + 編集 + decimal OK）
   - 「計算式ボックス」削除済み
   - step="any" で Enter 小数エラー対策
   - 追加後も入力にフォーカスを戻し、ボタン押下でフォーカスが奪われにくい
   - 「sとnを入力」タブは廃止し、代わりに「+」でデータセットタブ追加
   - ヘッダーの「戻る」「リセット」順入れ替え（リセット→戻る）
========================================================= */
const StandardErrorCalculator = ({ registerExporter, registerImporter, notifyDirty }) => {
  const navigate = useNavigate();
  const session = useSession();

  // datasets: [{id,name,values:[{id,v}]}]
  const [datasets, setDatasets] = useState(() => [{ id: generateId(), name: "値を入力 1", values: [] }]);
  const [activeDatasetId, setActiveDatasetId] = useState(() => (datasets[0] ? datasets[0].id : null));

  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  // 編集
  const [editingValueId, setEditingValueId] = useState(null);
  const [editStr, setEditStr] = useState("");

  // メニュー
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPrecisionModal, setShowPrecisionModal] = useState(false);

  const active = datasets.find((d) => d.id === activeDatasetId) || datasets[0];

  useEffect(() => {
    if (active && !activeDatasetId) setActiveDatasetId(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveValues = (updater) => {
    setDatasets((prev) =>
      prev.map((d) => {
        if (d.id !== activeDatasetId) return d;
        const nextValues = updater(d.values);
        return { ...d, values: nextValues };
      })
    );
  };

  const addValue = (e) => {
    if (e) e.preventDefault();
    const v = parseFloat(inputVal);
    if (inputVal === "" || Number.isNaN(v)) return;

    setActiveValues((vals) => [...vals, { id: generateId(), v }]);
    setInputVal("");

    // フォーカス維持（スマホのキーボード対策）
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const deleteValue = (id) => setActiveValues((vals) => vals.filter((x) => x.id !== id));

  const startEdit = (row) => {
    setEditingValueId(row.id);
    setEditStr(String(row.v));
  };

  const cancelEdit = () => {
    setEditingValueId(null);
    setEditStr("");
  };

  const saveEdit = () => {
    const v = parseFloat(editStr);
    if (Number.isNaN(v)) return;
    setActiveValues((vals) => vals.map((x) => (x.id === editingValueId ? { ...x, v } : x)));
    cancelEdit();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const resetActive = () => {
    setActiveValues(() => []);
    setInputVal("");
    cancelEdit();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const addDataset = () => {
    setDatasets((prev) => {
      const nextIndex = prev.length + 1;
      const nd = { id: generateId(), name: `値を入力 ${nextIndex}`, values: [] };
      return [...prev, nd];
    });
    requestAnimationFrame(() => {
      // active は後で effect せずにここで切替
      setTimeout(() => {
        setActiveDatasetId((_) => {
          const last = datasets[datasets.length - 1];
          return last ? last.id : activeDatasetId;
        });
      }, 0);
    });
  };

  // 計算
  const values = active?.values || [];
  const n = values.length;
  const sum = values.reduce((acc, x) => acc + x.v, 0);
  const mean = n > 0 ? sum / n : null;
  const s = n >= 2 ? Math.sqrt(values.reduce((acc, x) => acc + Math.pow(x.v - mean, 2), 0) / (n - 1)) : null;
  const se = n >= 2 && s !== null ? s / Math.sqrt(n) : null;

  // autosave notify
  useEffect(() => {
    notifyDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, activeDatasetId]);

  // exporter/importer
  useEffect(() => {
    registerExporter(() => ({ datasets, activeDatasetId }));
    registerImporter((snap) => {
      if (!snap) return;
      const ds = Array.isArray(snap.datasets) && snap.datasets.length > 0 ? snap.datasets : [{ id: generateId(), name: "値を入力 1", values: [] }];
      setDatasets(ds);
      setActiveDatasetId(snap.activeDatasetId && ds.some((d) => d.id === snap.activeDatasetId) ? snap.activeDatasetId : ds[0].id);
      setInputVal("");
      cancelEdit();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, activeDatasetId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <Sigma className="w-5 h-5" />
            </div>
            {/* タイトル削除（要望） */}
          </div>

          <div className="flex items-center gap-2 relative">
            {/* ボタン順入れ替え：リセット → 戻る */}
            <button
              onClick={resetActive}
              className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-sm font-bold text-red-600"
            >
              リセット
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold"
            >
              戻る
            </button>

            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
              <Menu className="w-6 h-6" />
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-fade-in">
                  <div className="py-1">
                    <div className="px-4 pt-3 pb-2 text-[11px] text-slate-500">
                      Active Session: <span className="font-mono font-bold text-indigo-600">{session.activeSessionName || "(未設定)"}</span>
                    </div>

                    <button
                      onClick={() => {
                        setShowSessionModal(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      セッション保存・呼び出し
                    </button>

                    <button
                      onClick={async () => {
                        await copyToClipboard(session.makeShareLinkFromCurrent());
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    >
                      <Link2 className="w-4 h-4" />
                      共有リンクをコピー（現在の状態）
                    </button>

                    <button
                      onClick={() => {
                        setShowPrecisionModal(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      表示桁の設定
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs row + "+" */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 overflow-x-auto">
            <div className="inline-flex bg-white rounded-xl border border-slate-200 p-1 gap-1">
              {datasets.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveDatasetId(d.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                    d.id === activeDatasetId ? "bg-indigo-600 text-white shadow" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              const nextIndex = datasets.length + 1;
              const nd = { id: generateId(), name: `値を入力 ${nextIndex}`, values: [] };
              setDatasets((prev) => [...prev, nd]);
              setActiveDatasetId(nd.id);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="p-3 rounded-xl bg-indigo-600 text-white font-bold shadow hover:bg-indigo-700 flex items-center justify-center"
            title="タブを追加"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Input + Table + Result */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4">
            <form onSubmit={addValue} className="flex gap-2">
              <input
                ref={inputRef}
                type="number"
                step="any"
                inputMode="decimal"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="例: 12.3"
                className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 outline-none font-mono"
              />
              <button
                type="submit"
                disabled={!inputVal}
                onPointerDown={(e) => {
                  // ボタン押下でフォーカスが奪われにくくする（スマホのキーボード対策）
                  e.preventDefault();
                }}
                onClick={(e) => {
                  // onPointerDown preventDefault しても submit が動くように
                  e.preventDefault();
                  addValue();
                }}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50"
              >
                追加
              </button>
            </form>

            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">No.</th>
                      <th className="px-3 py-2 font-mono">値</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {values.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-3 py-10 text-center text-slate-400">
                          データがありません
                        </td>
                      </tr>
                    ) : (
                      values.map((x, i) => (
                        <tr key={x.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-center text-slate-400 text-xs">{i + 1}</td>

                          <td className="px-3 py-2 font-mono">
                            {editingValueId === x.id ? (
                              <input
                                type="number"
                                step="any"
                                inputMode="decimal"
                                value={editStr}
                                onChange={(e) => setEditStr(e.target.value)}
                                className="w-full px-2 py-1 rounded border border-slate-200 font-mono"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    saveEdit();
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelEdit();
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              x.v
                            )}
                          </td>

                          <td className="px-3 py-2 text-right">
                            {editingValueId === x.id ? (
                              <div className="inline-flex gap-1">
                                <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:text-slate-700">
                                  <XIcon className="w-4 h-4" />
                                </button>
                                <button onClick={saveEdit} className="p-1.5 text-indigo-600 hover:text-indigo-800">
                                  <Check className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex gap-1">
                                <button onClick={() => startEdit(x)} className="p-1.5 text-slate-400 hover:text-amber-600">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteValue(x.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatBadge label="n" value={n} />
                <StatBadge label="平均" value={mean !== null ? safeRound(mean) : "---"} />
                <StatBadge label="標本標準偏差 s" value={s !== null ? safeRound(s) : "---"} />
              </div>

              <div className="mt-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">標準誤差 SE = s / √n</div>
                <div className="font-mono text-2xl font-bold text-indigo-700">{se !== null ? safeRound(se) : "---"}</div>
                {n < 2 && <div className="text-xs text-slate-500 mt-1">n ≥ 2 のとき計算できます。</div>}
              </div>
            </div>

            <div className="text-xs text-slate-500 leading-relaxed">
              メモ：このページの入力はセッション（localStorage）に自動保存されます。共有リンクを使うと、同じ状態を他人に再現できます。
            </div>
          </div>
        </div>
      </div>

      {showSessionModal && <SessionManagerModal onClose={() => setShowSessionModal(false)} />}
      {showPrecisionModal && <PrecisionModal onClose={() => setShowPrecisionModal(false)} />}
    </div>
  );
};

/* =========================================================
   12) ルータ上位：セッション保存 + 共有リンク読込（自動復元）
========================================================= */
const AppWithBoundary = () => {
  // 表示桁（共通）
  const [numberFormatMode, setNumberFormatMode] = useState(() => safeLoadJson("lsm_numfmt_mode_v1", "dec"));
  const [numberFormatDigits, setNumberFormatDigits] = useState(() => safeLoadJson("lsm_numfmt_digits_v1", 4));

  // 同一render内で反映（瞬時切替）
  useMemo(() => {
    setGlobalNumberFormat(numberFormatMode, numberFormatDigits);
  }, [numberFormatMode, numberFormatDigits]);

  useEffect(() => {
    safeSaveJson("lsm_numfmt_mode_v1", numberFormatMode);
    safeSaveJson("lsm_numfmt_digits_v1", numberFormatDigits);
  }, [numberFormatMode, numberFormatDigits]);

  // セッションストア
  const [sessions, setSessions] = useState(() => safeLoadJson(SESS_KEY, {}));
  const [activeSessionName, setActiveSessionName] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) || "";
    } catch (_) {
      return "";
    }
  });

  // LS/SE の exporter/importer を受け取る
  const lsExporterRef = useRef(() => ({}));
  const seExporterRef = useRef(() => ({}));
  const lsImporterRef = useRef((_) => {});
  const seImporterRef = useRef((_) => {});

  const [dirtyTick, setDirtyTick] = useState(0);
  const notifyDirty = useCallback(() => setDirtyTick((t) => t + 1), []);

  const getCurrentSnapshot = useCallback(() => {
    return {
      v: 1,
      updatedAt: Date.now(),
      fmt: { mode: numberFormatMode, digits: numberFormatDigits },
      ls: lsExporterRef.current ? lsExporterRef.current() : {},
      se: seExporterRef.current ? seExporterRef.current() : {},
    };
  }, [numberFormatMode, numberFormatDigits]);

  const applySnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    if (snapshot.fmt) {
      if (snapshot.fmt.mode) setNumberFormatMode(snapshot.fmt.mode);
      if (snapshot.fmt.digits !== undefined) setNumberFormatDigits(snapshot.fmt.digits);
    }
    if (snapshot.ls && lsImporterRef.current) lsImporterRef.current(snapshot.ls);
    if (snapshot.se && seImporterRef.current) seImporterRef.current(snapshot.se);
  }, []);

  // autosave（アクティブセッションにデバウンス保存）
  useEffect(() => {
    if (!activeSessionName) return;

    const t = setTimeout(() => {
      const snap = getCurrentSnapshot();
      setSessions((prev) => {
        const next = { ...prev, [activeSessionName]: { updatedAt: Date.now(), snapshot: snap } };
        safeSaveJson(SESS_KEY, next);
        return next;
      });
    }, 250);

    return () => clearTimeout(t);
  }, [dirtyTick, activeSessionName, getCurrentSnapshot]);

  // 共有リンクから自動復元（初回のみ）
  useEffect(() => {
    const s = getShareParamFromUrl();
    if (!s) return;

    try {
      const snap = decodeBase64UrlJson(s);

      // 共有リンクを開いたら、そのまま復元（要件）
      applySnapshot(snap);

      // セッションとしても保存（便利）
      const name = `共有リンク ${fmtDateTime(Date.now())}`;
      setActiveSessionName(name);
      try {
        localStorage.setItem(ACTIVE_KEY, name);
      } catch (_) {}

      setSessions((prev) => {
        const next = { ...prev, [name]: { updatedAt: Date.now(), snapshot: snap } };
        safeSaveJson(SESS_KEY, next);
        return next;
      });

      // URLからdataを消して二重読み込み回避
      removeShareParamFromUrl();
    } catch (_) {
      // decode失敗は何もしない
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // セッション操作
  const saveAs = (name) => {
    const n = (name || "").trim();
    if (!n) return;

    const snap = getCurrentSnapshot();
    setActiveSessionName(n);
    try {
      localStorage.setItem(ACTIVE_KEY, n);
    } catch (_) {}

    setSessions((prev) => {
      const next = { ...prev, [n]: { updatedAt: Date.now(), snapshot: snap } };
      safeSaveJson(SESS_KEY, next);
      return next;
    });
  };

  const loadSession = (name) => {
    const it = sessions[name];
    if (!it?.snapshot) return;

    applySnapshot(it.snapshot);
    setActiveSessionName(name);
    try {
      localStorage.setItem(ACTIVE_KEY, name);
    } catch (_) {}
  };

  const deleteSession = (name) => {
    setSessions((prev) => {
      const next = { ...prev };
      delete next[name];
      safeSaveJson(SESS_KEY, next);
      return next;
    });

    if (name === activeSessionName) {
      setActiveSessionName("");
      try {
        localStorage.removeItem(ACTIVE_KEY);
      } catch (_) {}
    }
  };

  const makeShareLinkFromSnapshot = (snapshot) => {
    const data = encodeBase64UrlJson(snapshot);
    const base = `${window.location.origin}${window.location.pathname}`;
    const hashPath = (window.location.hash || "#/").split("?")[0] || "#/";
    return `${base}${hashPath}?data=${data}`;
  };

  const makeShareLinkFromCurrent = () => makeShareLinkFromSnapshot(getCurrentSnapshot());

  const sessionCtxValue = {
    sessions,
    activeSessionName,
    saveAs,
    loadSession,
    deleteSession,

    numberFormatMode,
    numberFormatDigits,
    setNumberFormatMode,
    setNumberFormatDigits,

    getCurrentSnapshot,
    makeShareLinkFromSnapshot,
    makeShareLinkFromCurrent,
  };

  return (
    <ErrorBoundary>
      <SessionContext.Provider value={sessionCtxValue}>
        <HashRouter>
          <Routes>
            <Route
              path="/"
              element={
                <LeastSquaresErrorCalc
                  notifyDirty={notifyDirty}
                  registerExporter={(fn) => (lsExporterRef.current = fn)}
                  registerImporter={(fn) => (lsImporterRef.current = fn)}
                />
              }
            />
            <Route
              path="/stderr"
              element={
                <StandardErrorCalculator
                  notifyDirty={notifyDirty}
                  registerExporter={(fn) => (seExporterRef.current = fn)}
                  registerImporter={(fn) => (seImporterRef.current = fn)}
                />
              }
            />
          </Routes>
        </HashRouter>
      </SessionContext.Provider>
    </ErrorBoundary>
  );
};

export default AppWithBoundary;
