import { formatNumber } from "./statistics.js";

export const texNumber = (value, format = formatNumber) => {
  if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) return "\\mathrm{undefined}";
  const text = String(format(value));
  const match = text.match(/^([+-]?[\d.]+)e([+-]?\d+)$/i);
  return match ? `${match[1]}\\times10^{${Number(match[2])}}` : text;
};

// Each expression is a short independent block so long calculations can paginate.
const sumSteps = (symbol, values, format) => {
  if (values.some(v => v === null)) return [];
  const formulas = [];
  const prefixes = [];
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
    prefixes.push(total + correction);
  }
  const number = v => `\\left(${texNumber(v, format)}\\right)`;
  for (let start = 0; start < values.length; start += 3) {
    const end = Math.min(start + 3, values.length);
    const previous = start ? `${number(prefixes[start - 1])}+` : "";
    formulas.push(`\\sum_{i=1}^{${end}}${symbol}=${previous}${values.slice(start, end).map(number).join("+")}\\approx ${texNumber(prefixes[end - 1], format)}`);
  }
  return formulas;
};

export const calculationSteps = (r, mode = "raw", format = formatNumber) => {
  if (r.slope === null) return [];
  const origin = r.fitMode === "origin";
  const { n, sumX, sumY, sumX2, sumXY } = r.stats;
  const f = v => texNumber(v, format);
  const p = v => `\\left(${f(v)}\\right)`;
  const q = r.sumResidualsCalc;
  const sections = [];
  const add = (title, formulas, notes = []) => sections.push({ title, formulas, notes });
  add("1. 使用データと総和", [
    `n=${n}`, `\\sum x_i\\approx ${f(sumX)},\\quad\\sum y_i\\approx ${f(sumY)}`,
    `\\sum x_i^2\\approx ${f(sumX2)},\\quad\\sum x_i y_i\\approx ${f(sumXY)}`,
    ...(mode === "raw" ? [
      ...sumSteps("x_i", r.rows.map(p => p.x), format),
      ...sumSteps("y_i", r.rows.map(p => p.y), format),
      ...sumSteps("x_i^2", r.rows.map(p => p.x2), format),
      ...sumSteps("x_i y_i", r.rows.map(p => p.xy), format),
    ] : []),
  ], mode === "stats" ? ["総和入力のため測定点は復元できません。入力された総和を使用します。"] : ["全測定点はデータ表に記載しています。不確かさは表示用であり、回帰に重み付けしていません。"]);
  add("2. 最小化条件・正規方程式", origin ? [
    "Q(a)=\\sum_{i=1}^n(y_i-ax_i)^2",
    "\\frac{\\partial Q}{\\partial a}=-2\\sum x_i(y_i-ax_i)=0",
    "a\\sum x_i^2=\\sum x_i y_i",
    `${p(sumX2)}a=${f(sumXY)}`,
  ] : [
    "Q(a,b)=\\sum_{i=1}^n[y_i-(ax_i+b)]^2",
    "\\frac{\\partial Q}{\\partial a}=-2\\sum x_i(y_i-ax_i-b)=0",
    "\\frac{\\partial Q}{\\partial b}=-2\\sum(y_i-ax_i-b)=0",
    "a\\sum x_i^2+b\\sum x_i=\\sum x_i y_i",
    `${p(sumX2)}a+${p(sumX)}b=${f(sumXY)}`,
    "a\\sum x_i+nb=\\sum y_i",
    `${p(sumX)}a+${n}b=${f(sumY)}`,
  ]);
  if (!origin) add("3. 中心化・数値安定化", [
    `\\bar{x}=\\frac{\\sum x_i}{n}\\approx ${f(r.meanX)}`,
    `\\bar{y}=\\frac{\\sum y_i}{n}\\approx ${f(r.meanY)}`,
    "S_{xx}=\\sum(x_i-\\bar{x})^2=\\sum x_i^2-\\frac{(\\sum x_i)^2}{n}",
    `S_{xx}\\approx ${f(r.sxx)}`,
    "S_{xy}=\\sum(x_i-\\bar{x})(y_i-\\bar{y})=\\sum x_i y_i-\\frac{\\sum x_i\\sum y_i}{n}",
    `S_{xy}\\approx ${f(r.sxy)}`,
  ], ["内部では基準値を差し引いてから中心化し、大きい総和同士の減算による桁落ちを避けています。"]);
  const slopeFormulas = origin ? [
    "a=\\frac{\\sum x_i y_i}{\\sum x_i^2}",
    `a=\\frac{${f(sumXY)}}{${f(sumX2)}}\\approx ${f(r.slope)}`,
    "b=0",
  ] : [
    "a=\\frac{n\\sum x_i y_i-\\sum x_i\\sum y_i}{n\\sum x_i^2-(\\sum x_i)^2}=\\frac{S_{xy}}{S_{xx}}",
    `N=${n}\\times${p(sumXY)}-${p(sumX)}\\times${p(sumY)}`,
    `D=${n}\\times${p(sumX2)}-${p(sumX)}^2=nS_{xx}`,
    `a=\\frac{N}{D}=\\frac{${f(r.sxy)}}{${f(r.sxx)}}\\approx ${f(r.slope)}`,
    "b=\\frac{\\sum y_i-a\\sum x_i}{n}=\\bar{y}-a\\bar{x}",
    `b=\\frac{${p(sumY)}-${p(r.slope)}\\times${p(sumX)}}{${n}}\\approx ${f(r.intercept)}`,
  ];
  if (mode === "raw") slopeFormulas.push(
    origin ? "u_i=x_i/s_x,\\quad v_i=y_i/s_y" : "u_i=\\frac{(x_i-x_0)-\\overline{x-x_0}}{s_x},\\quad v_i=\\frac{(y_i-y_0)-\\overline{y-y_0}}{s_y}",
    `s_x=${f(r.scaleX)},\\quad s_y=${f(r.scaleY)}`,
    `A=\\sum u_i^2\\approx ${f(r.sxxScaled)},\\quad B=\\sum u_i v_i\\approx ${f(r.sxyScaled)}`,
    `a=\\frac{s_y}{s_x}\\frac{B}{A}=\\frac{${f(r.scaleY)}}{${f(r.scaleX)}}\\frac{${f(r.sxyScaled)}}{${f(r.sxxScaled)}}\\approx ${f(r.slope)}`,
    ...(!origin ? [`b=(y_0-ax_0)+(\\overline{y-y_0}-a\\overline{x-x_0})`, `b=(${p(r.originY)}-${p(r.slope)}${p(r.originX)})+(${p(r.offsetY)}-${p(r.slope)}${p(r.offsetX)})\\approx ${f(r.intercept)}`] : []),
  );
  slopeFormulas.push(origin ? `y=${p(r.slope)}x` : `y=${p(r.slope)}x+${p(r.intercept)}`);
  add("4. 公式・数値代入・近似直線", slopeFormulas, ["表と式は表示桁設定で丸めています。係数、残差、標準誤差の計算には丸め前の値を使います。数値範囲外の総和はundefinedとし、スケーリング式を併記します。"]);
  const residualFormulas = [origin ? "e_i=y_i-ax_i" : "e_i=y_i-(ax_i+b)", "Q=\\sum e_i^2", ...sumSteps("e_i^2", r.rows.map(row => row.residualSq), format)];
  if (mode === "raw") residualFormulas.push(`Q=s_y^2 Q',\\quad Q'=\\sum(v_i-(B/A)u_i)^2\\approx ${f(r.sseScaled)}`);
  residualFormulas.push(`Q\\approx ${f(q)}`);
  if (r.rSquared !== null) residualFormulas.push(
    origin ? "R_u^2=1-\\frac{Q}{\\sum y_i^2}" : "R^2=1-\\frac{Q}{\\sum(y_i-\\bar y)^2}",
    origin ? `\\sum y_i^2\\approx ${f(r.syy)}` : `S_{yy}=\\sum(y_i-\\bar y)^2\\approx ${f(r.syy)}`,
    `${origin ? "R_u^2" : "R^2"}=1-\\frac{${f(q)}}{${f(r.syy)}}\\approx ${f(r.rSquared)}`,
    ...(mode === "raw" ? [`${origin ? "R_u^2" : "R^2"}=1-\\frac{Q'}{\\sum v_i^2}=1-\\frac{${f(r.sseScaled)}}{${f(r.syyScaled)}}\\approx ${f(r.rSquared)}`] : []),
  );
  add("5. 残差平方和・決定係数", residualFormulas, [origin ? "原点固定では非中心化決定係数 Ru² = 1 − Q/Σy²を使用します。通常モデルの中心化R²とは定義が異なります。" : "通常モデルは中心化決定係数 R² = 1 − Q/Σ(y−ȳ)²を使用します。", ...(r.rSquared === null ? ["Yの平方和が0、または総和入力の情報不足のため決定係数を定義・計算できません。"] : [])]);
  const seFormulas = [`\\nu=n-${origin ? 1 : 2}=${n}-${origin ? 1 : 2}=${r.df}`];
  if (r.stdErrA !== null) {
    seFormulas.push("s^2=Q/\\nu", `s^2=\\frac{${f(q)}}{${r.df}}`, origin ? "\\operatorname{SE}(a)=\\sqrt{\\frac{s^2}{\\sum x_i^2}}" : "\\operatorname{SE}(a)=\\sqrt{\\frac{s^2}{S_{xx}}}", `\\operatorname{SE}(a)=\\sqrt{\\frac{${f(q)}}{${r.df}\\times${p(origin ? sumX2 : r.sxx)}}}\\approx ${f(r.stdErrA)}`);
    if (mode === "raw") seFormulas.push(`\\operatorname{SE}(a)=\\frac{s_y}{s_x}\\sqrt{\\frac{Q'}{\\nu A}}=\\frac{${f(r.scaleY)}}{${f(r.scaleX)}}\\sqrt{\\frac{${f(r.sseScaled)}}{${r.df}\\times${p(r.sxxScaled)}}}\\approx ${f(r.stdErrA)}`);
    if (!origin) seFormulas.push("\\operatorname{SE}(b)=s\\sqrt{\\frac1n+\\frac{\\bar x^2}{S_{xx}}}", `\\operatorname{SE}(b)=\\sqrt{\\frac{${f(q)}}{${r.df}}\\left(\\frac1{${n}}+\\frac{${p(r.meanX)}^2}{${f(r.sxx)}}\\right)}\\approx ${f(r.stdErrB)}`);
    seFormulas.push(`a=${f(r.slope)}\\pm ${f(r.stdErrA)}`);
    if (!origin) seFormulas.push(`b=${f(r.intercept)}\\pm ${f(r.stdErrB)}`);
  }
  add("6. 自由度・係数の標準誤差", seFormulas, [r.stdErrA === null ? "自由度が0、または残差平方和が未入力のため標準誤差を計算できません。" : "独立・等分散のy方向誤差を仮定した標準誤差です。", ...(origin ? ["切片は0に固定して推定しないため、切片の標準誤差はありません。"] : [])]);
  return sections;
};

export const resultLatex = (result, mode, format) => calculationSteps(result, mode, format)
  .map(section => `% ${section.title}\n${section.notes.map(note => `% ${note}`).join("\n")}\n${section.formulas.map(tex => `\\[\n${tex}\n\\]`).join("\n")}`).join("\n\n");
