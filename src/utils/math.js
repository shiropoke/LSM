import katex from "katex";

export const renderMath = (tex) => {
  try {
    return katex.renderToString(tex, { throwOnError: true, trust: false, strict: "error", output: "htmlAndMathml", maxExpand: 1000 });
  } catch {
    return null;
  }
};
