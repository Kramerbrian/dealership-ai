// What-if UGC recovery model lives here; wire later.
export function ugcRecovery(baseRisk: number, responseMin: number, responsePct: number) {
  const baselineTime = 120, baselineRate = 60;
  const timeFactor = Math.min(1, baselineTime / Math.max(15, responseMin));
  const rateFactor = Math.min(1, responsePct / Math.max(10, baselineRate));
  return Math.round(baseRisk * (0.55 * timeFactor + 0.45 * rateFactor));
}