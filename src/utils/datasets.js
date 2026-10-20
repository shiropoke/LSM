export const datasetColors = ["#6366f1", "#e11d48", "#059669", "#d97706", "#9333ea", "#0891b2"];
export const emptyManualStats = () => ({ n: "", sumX: "", sumY: "", sumX2: "", sumXY: "", sumY2: "", sumResiduals: "" });
export const defaultAxisLabels = () => ({ xName: "X", xUnit: "", yName: "Y", yUnit: "" });
export const createDataset = (index = 0) => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2),
  name: `データセット ${index + 1}`, color: datasetColors[index % datasetColors.length], visible: true,
  dataPoints: [], mode: "raw", fitMode: "linear", manualStats: emptyManualStats(),
});
export const axisLabel = (name, unit) => `${name}${unit ? ` [${unit}]` : ""}`;
