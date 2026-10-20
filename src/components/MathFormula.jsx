import { useMemo } from "react";
import { renderMath } from "../utils/math.js";
import "katex/dist/katex.min.css";

export default function MathFormula({ tex }) {
  const html = useMemo(() => renderMath(tex), [tex]);
  return html === null
    ? <code className="math-block math-fallback" role="status">{tex}</code>
    : <div className="math-block" dangerouslySetInnerHTML={{ __html: html }} />;
}
