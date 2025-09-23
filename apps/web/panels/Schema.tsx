"use client";
import { Card, Metric } from "@dealershipai/ui";

export default function Schema({ dealerId }: { dealerId: string }) {
  const coverage = 73, critical = 7, validation = 8.2, rich = 94;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Metric title="Schema Coverage" value={`${coverage}%`} progress={coverage} />
        <Metric title="Critical Errors" value={critical} />
        <Metric title="Validation Score" value={`${validation}/10`} progress={Math.round(validation * 10)} />
        <Metric title="Rich Results" value={`${rich}%`} progress={rich} />
      </div>
      <Card>
        <div className="text-sm">Generate JSON-LD Fix → wire to auto-fix task queue later.</div>
      </Card>
    </div>
  );
}