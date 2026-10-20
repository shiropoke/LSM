// Numeric substitutions retain internal precision; the table and final answers
// follow the same display precision as the rest of the calculator.
export default function CalculationProcess({ result, mode, format }) {
  const { stats, rows, slope: a, intercept: b, sxx, sxy, meanX, meanY, sumResidualsCalc: q } = result;
  const { n, sumX, sumY, sumX2, sumXY } = stats;
  const term = (value) => `(${value})`;
  const expansion = (values) => values.map(term).join(" + ");
  const answer = (value) => `${format(value)}${String(format(value)) !== String(value) ? ` （内部値: ${value}）` : ""}`;
  return (
    <div className="space-y-5 text-xs leading-relaxed text-left break-words" data-testid="calculation-process">
      <p className="text-slate-400">各点を同じ重みで扱い、y方向の残差平方和を最小化します。数値代入は丸め前の内部値、表と最終結果は表示桁設定を使用します。内部計算では桁落ちを避ける同値の中心化式を使います。</p>
      <section className="space-y-2">
        <h4 className="font-bold text-indigo-300">1. 使用データと総和（n = {n}）</h4>
        {mode === "raw" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right font-mono whitespace-nowrap">
                <thead><tr>{["i", "xᵢ", "yᵢ", "xᵢ²", "xᵢyᵢ"].map((label) => <th key={label} className="px-3 py-2 border-b border-slate-700">{label}</th>)}</tr></thead>
                <tbody>{rows.map((row) => <tr key={row.no}>{[row.no, row.x, row.y, row.x2, row.xy].map((value, i) => <td key={i} className="px-3 py-1 border-b border-slate-800" title={`内部値: ${value}`}>{i === 0 ? value : format(value)}</td>)}</tr>)}</tbody>
                <tfoot><tr>{["Σ", sumX, sumY, sumX2, sumXY].map((value, i) => <td key={i} className="px-3 py-2 font-bold">{i === 0 ? value : format(value)}</td>)}</tr></tfoot>
              </table>
            </div>
            <p>Σx = {expansion(rows.map((p) => p.x))} = {sumX}</p>
            <p>Σy = {expansion(rows.map((p) => p.y))} = {sumY}</p>
            <p>Σx² = {rows.map((p) => `${term(p.x)}²`).join(" + ")} = {expansion(rows.map((p) => p.x2))} = {sumX2}</p>
            <p>Σxy = {rows.map((p) => `${term(p.x)} × ${term(p.y)}`).join(" + ")} = {expansion(rows.map((p) => p.xy))} = {sumXY}</p>
          </>
        ) : (
          <><p>総和入力のため各点のx、y、x²、xyは復元できません。以下は入力された総和を使用します。</p><p>Σx = {sumX}、Σy = {sumY}、Σx² = {sumX2}、Σxy = {sumXY}</p></>
        )}
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-indigo-300">2. 最小化条件と正規方程式</h4>
        <p>Q(a, b) = Σ[yᵢ − (axᵢ + b)]²</p>
        <p>∂Q/∂a = −2Σxᵢ(yᵢ − axᵢ − b) = 0</p>
        <p>∂Q/∂b = −2Σ(yᵢ − axᵢ − b) = 0</p>
        <p>aΣx² + bΣx = Σxy → {term(sumX2)}a + {term(sumX)}b = {sumXY}</p>
        <p>aΣx + nb = Σy → {term(sumX)}a + {n}b = {sumY}</p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-indigo-300">3. 中心化による計算</h4>
        {mode === "raw" ? (
          <>
            <p>x₀ = {result.originX}、y₀ = {result.originY}、uᵢ = xᵢ − x₀、vᵢ = yᵢ − y₀</p>
            <p>ū = Σuᵢ/n = [{rows.map((p) => `${term(p.x)} − ${term(result.originX)}`).map((s) => `(${s})`).join(" + ")}] / {n} = {result.offsetX}</p>
            <p>v̄ = Σvᵢ/n = [{rows.map((p) => `${term(p.y)} − ${term(result.originY)}`).map((s) => `(${s})`).join(" + ")}] / {n} = {result.offsetY}</p>
            <p>x̄ = x₀ + ū = {term(result.originX)} + {term(result.offsetX)} ≈ {answer(meanX)}</p>
            <p>ȳ = y₀ + v̄ = {term(result.originY)} + {term(result.offsetY)} ≈ {answer(meanY)}</p>
            <p>Sxx = Σ(uᵢ − ū)² = {rows.map((p) => `(${term(p.x)} − ${term(result.originX)} − ${term(result.offsetX)})²`).join(" + ")} = {expansion(rows.map((p) => p.dx ** 2))} = {sxx}</p>
            <p>Sxy = Σ(uᵢ − ū)(vᵢ − v̄) = {rows.map((p) => `(${term(p.x)} − ${term(result.originX)} − ${term(result.offsetX)}) × (${term(p.y)} − ${term(result.originY)} − ${term(result.offsetY)})`).join(" + ")} = {expansion(rows.map((p) => p.dx * p.dy))} = {sxy}</p>
          </>
        ) : (
          <><p>x̄ = Σx/n = {term(sumX)} / {n} = {meanX}、ȳ = Σy/n = {term(sumY)} / {n} = {meanY}</p><p>Sxx = Σx² − (Σx)²/n = {term(sumX2)} − {term(sumX)}² / {n} = {sxx}</p><p>Sxy = Σxy − ΣxΣy/n = {term(sumXY)} − {term(sumX)} × {term(sumY)} / {n} = {sxy}</p></>
        )}
        <p>D = nΣx² − (Σx)² = {n} × {term(sumX2)} − {term(sumX)}²</p>
        <p>同値の中心化式で評価: D = nSxx = {n} × {term(sxx)} = {n * sxx} &gt; 0</p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-indigo-300">4. 傾きと切片</h4>
        <p>a = [nΣxy − ΣxΣy] / [nΣx² − (Σx)²]</p>
        <p>a = [{n} × {term(sumXY)} − {term(sumX)} × {term(sumY)}] / [{n} × {term(sumX2)} − {term(sumX)}²]</p>
        <p>a = Sxy/Sxx = {term(sxy)} / {term(sxx)} ≈ <strong className="text-indigo-300">{answer(a)}</strong></p>
        <p>b = (Σy − aΣx)/n = ȳ − ax̄</p>
        <p>b = [{term(sumY)} − {term(a)} × {term(sumX)}] / {n} ≈ <strong className="text-purple-300">{answer(b)}</strong></p>
        {mode === "raw" && <p>中心化式: b = (y₀ − ax₀) + (v̄ − aū) = [{term(result.originY)} − {term(a)} × {term(result.originX)}] + [{term(result.offsetY)} − {term(a)} × {term(result.offsetX)}] ≈ {answer(b)}</p>}
        <p className="font-bold">近似直線: y = {term(format(a))}x + {term(format(b))}</p>
      </section>
      <section className="space-y-2">
        <h4 className="font-bold text-indigo-300">5. 残差と標準誤差</h4>
        <p>eᵢ = yᵢ − (axᵢ + b)、Q = Σeᵢ²</p>
        {mode === "raw" && <>
          <p>数値計算は同値の式 eᵢ = (vᵢ − v̄) − a(uᵢ − ū) を使用します。</p>
          <div className="overflow-x-auto"><table className="w-full text-right font-mono whitespace-nowrap"><thead><tr><th className="px-3">i</th><th className="px-3">eᵢの数値代入</th><th className="px-3">eᵢ</th><th className="px-3">eᵢ²</th></tr></thead><tbody>{rows.map((p) => <tr key={p.no}><td className="px-3 py-1">{p.no}</td><td className="px-3">{term(p.dy)} − {term(a)} × {term(p.dx)}</td><td className="px-3">{p.residual}</td><td className="px-3">{p.residualSq}</td></tr>)}</tbody></table></div>
          <p>Q = {expansion(rows.map((p) => p.residualSq))} ≈ {answer(q)}</p>
          <p>Syy = Σ(yᵢ − ȳ)² = {rows.map((p) => `${term(p.dy)}²`).join(" + ")} = {result.syy}</p>
          {result.rSquared === null ? <p>すべてのY値が等しく、Syy = 0のため決定係数R²は定義できません。</p> : <p>R² = 1 − Q/Syy = 1 − {term(q)} / {term(result.syy)} ≈ {answer(result.rSquared)}</p>}
        </>}
        {mode === "stats" && <p>{q === null ? "残差平方和が未入力のため、標準誤差は計算できません。" : `入力された残差平方和 Q = ${q}` } 総和入力ではYの偏差平方和がないため、R²は計算できません。</p>}
        {n > 2 && q !== null ? <>
          <p>残差の自由度: n − 2 = {n} − 2 = {n - 2}</p>
          <p>s² = Q/(n − 2) = {term(q)} / {n - 2} = {q / (n - 2)}</p>
          <p>SE(a) = √[s²/Sxx] = √[{term(q / (n - 2))} / {term(sxx)}] ≈ {answer(result.stdErrA)}</p>
          <p>SE(b) = √[s²(1/n + x̄²/Sxx)] = √[{term(q / (n - 2))} × (1/{n} + {term(meanX)}² / {term(sxx)})] ≈ {answer(result.stdErrB)}</p>
          <p className="text-slate-400">標準誤差は、各測定のy方向の誤差が独立で分散が等しいという通常の回帰モデルに基づく推定値です。</p>
        </> : n <= 2 ? <p>n = {n}では残差の自由度n − 2が0のため、係数の標準誤差は計算できません。</p> : null}
      </section>
    </div>
  );
}
