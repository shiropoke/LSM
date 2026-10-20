import MathFormula from "./MathFormula.jsx";
import { calculationSteps } from "../utils/latex.js";

export default function CalculationProcess({ result, mode, format }) {
  return <div className="space-y-5 text-xs leading-relaxed text-left break-words" data-testid="calculation-process">
    {mode === "raw" && <div className="overflow-x-auto"><table className="w-full text-right font-mono whitespace-nowrap">
      <thead><tr>{["i", "xᵢ", "yᵢ", "xᵢ²", "xᵢyᵢ", "eᵢ", "eᵢ²"].map(label => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead>
      <tbody>{result.rows.map(row => <tr key={row.no}>{[row.no, row.x, row.y, row.x2, row.xy, row.residual, row.residualSq].map((v, i) => <td key={i} className="px-2 py-1">{i === 0 ? v : format(v)}</td>)}</tr>)}</tbody>
    </table></div>}
    {calculationSteps(result, mode, format).map(section => <section key={section.title} className="space-y-2">
      <h4 className="font-bold text-indigo-300">{section.title}</h4>
      {section.notes.map(note => <p key={note} className="text-slate-400">{note}</p>)}
      {section.formulas.map((tex, i) => <MathFormula key={i} tex={tex} />)}
    </section>)}
  </div>;
}
