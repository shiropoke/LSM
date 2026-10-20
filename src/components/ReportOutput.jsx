import { useState } from "react";
import { createPortal } from "react-dom";
import CalculationProcess from "./CalculationProcess.jsx";
import MathFormula from "./MathFormula.jsx";
import ScatterPlot from "./ScatterPlot.jsx";
import { axisLabel } from "../utils/datasets.js";
import { texNumber } from "../utils/latex.js";

export function ReportSettings({ value, onChange }) {
  const fields = [["title", "レポートタイトル"], ["xName", "X軸の名称"], ["xUnit", "X軸の単位"], ["yName", "Y軸の名称"], ["yUnit", "Y軸の単位"]];
  return <details className="mb-5 rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
    <summary className="text-sm font-bold cursor-pointer">レポート・軸の設定</summary>
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">{fields.map(([key, label]) => <label key={key} className="text-xs">{label}<input aria-label={label} maxLength={key === "title" ? 160 : 60} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} className="mt-1 block w-full border rounded-lg p-2 bg-white dark:bg-slate-800 dark:border-slate-600" /></label>)}</div>
  </details>;
}

export function ReportDocument({ report, series, format }) {
  const visible = series.filter(d => d.visible !== false);
  const f = value => texNumber(value, format);
  return <article className="report-document">
    <h1>{report.title || "最小二乗法によるデータ解析"}</h1>
    <p>X：{axisLabel(report.xName, report.xUnit)} ／ Y：{axisLabel(report.yName, report.yUnit)}</p>
    <p>各系列を独立に解析。エラーバーは測定不確かさの表示用であり、回帰計算には重み付けしていません。表示桁のみを丸め、計算には丸め前の値を使用しています。</p>
    {visible.some(d => d.mode !== "stats" && d.dataPoints.length) && <section className="report-chart"><h2>散布図と近似直線</h2><div style={{ height: "85mm" }}><ScatterPlot series={visible} labels={report} format={format} /></div></section>}
    {visible.map(dataset => {
      const r = dataset.result, origin = dataset.fitMode === "origin";
      return <section key={dataset.id} className="report-dataset">
        <h2>{dataset.name || "名称未設定の系列"}：{origin ? "原点固定 y = ax" : "通常 y = ax + b"}</h2>
        {r.errorMsg && <p>計算できません：{r.errorMsg}</p>}
        {r.warningMsg && <p>{r.warningMsg}</p>}
        {dataset.mode === "stats" ? <p>総和入力のため測定点の表と散布図は作成できません。入力された統計量に基づく解析です。</p> : <>
          <h3>測定データ・残差</h3>
          <table><thead><tr>{["No.", "x", "y", "Δx", "Δy", "x²", "xy", "e", "e²"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{dataset.dataPoints.map((p, i) => {
            const row = r.rows[i];
            return <tr key={p.id}>{[i + 1, p.x, p.y, p.dx, p.dy, row?.x2, row?.xy, row?.residual, row?.residualSq].map((value, j) => <td key={j}>{j === 0 ? value : value == null ? "—" : format(value)}</td>)}</tr>;
          })}</tbody></table>
          <p>Δx・Δyの「—」は未入力です。x、Δxの単位：{report.xUnit || "未指定"} ／ y、Δy、eの単位：{report.yUnit || "未指定"}</p>
        </>}
        {r.slope !== null && <>
          <h3>解析結果</h3>
          <MathFormula tex={origin ? `y=(${f(r.slope)})x` : `y=(${f(r.slope)})x+(${f(r.intercept)})`} />
          <MathFormula tex={`a=${f(r.slope)}${r.stdErrA === null ? "" : `\\pm ${f(r.stdErrA)}`}`} />
          <MathFormula tex={origin ? "b=0" : `b=${f(r.intercept)}${r.stdErrB === null ? "" : `\\pm ${f(r.stdErrB)}`}`} />
          <p>データ数 n = {r.stats.n} ／ 自由度 = {r.df} ／ 残差平方和 Q = {format(r.sumResidualsCalc)}</p>
          <p>決定係数 {origin ? "Ru²（非中心化：1 − Q/Σy²）" : "R²（中心化：1 − Q/Σ(y−ȳ)²）"} = {r.rSquared === null ? "定義不能・情報不足" : format(r.rSquared)}</p>
          {r.stdErrA === null && <p>残差自由度が0、または残差平方和が未入力のため、係数の標準誤差は求められません。</p>}
          {origin && <p>切片は0に固定して推定しないため、切片の標準誤差はありません。</p>}
          <p>傾きの単位：{report.yUnit && report.xUnit ? `(${report.yUnit}) / (${report.xUnit})` : "軸の単位指定を参照"} ／ 切片の単位：{report.yUnit || "未指定"}</p>
          <h3>最小二乗法の計算過程</h3>
          <CalculationProcess result={r} mode={dataset.mode} format={format} showTable={false} />
        </>}
      </section>;
    })}
  </article>;
}

export default function ReportOutput({ report, series, format, onClose }) {
  const [printing, setPrinting] = useState(false);
  const print = async () => {
    setPrinting(true);
    const previousTitle = document.title;
    try {
      await document.fonts.ready;
      document.title = report.title || "LSM解析レポート";
      window.print();
    } finally {
      document.title = previousTitle;
      setPrinting(false);
    }
  };
  return createPortal(<div id="lsm-report-root" role="dialog" aria-modal="true" aria-label="PDF出力プレビュー">
    <header className="report-actions"><div><strong>PDF出力プレビュー</strong><p>「PDFとして保存」を押し、印刷画面の保存先でPDFを選択してください。用紙はA4、ヘッダーとフッターはオフにします。</p></div><button onClick={print} disabled={printing}>{printing ? "準備中…" : "PDFとして保存"}</button><button onClick={onClose}>閉じる</button></header>
    <ReportDocument report={report} series={series} format={format} />
  </div>, document.body);
}
