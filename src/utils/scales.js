export const normalizeScales = (settings = {}) => ({
  xScale: settings?.xScale === "log" ? "log" : "linear",
  yScale: settings?.yScale === "log" ? "log" : "linear",
});

export const hasLogScale = settings => {
  const { xScale, yScale } = normalizeScales(settings);
  return xScale === "log" || yScale === "log";
};

export const axisValue = (value, scale) => {
  if (!Number.isFinite(value) || (scale === "log" && value <= 0)) return null;
  return scale === "log" ? Math.log10(value) : value;
};

export const coordinateDescription = settings => {
  const { xScale, yScale } = normalizeScales(settings);
  return `計算用 x = ${xScale === "log" ? "log₁₀(X)" : "X"}、y = ${yScale === "log" ? "log₁₀(Y)" : "Y"}`;
};
