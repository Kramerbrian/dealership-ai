// From your improved dashboard math; replace with real inputs later.
export function estimateRevenueAtRisk(aiVisibilityPct: number, monthlyOpportunities = 450, avgDealValue = 1200) {
  const invis = Math.max(0, 100 - aiVisibilityPct);
  const lostLeads = monthlyOpportunities * (invis / 100);
  return Math.round(lostLeads * avgDealValue);
}