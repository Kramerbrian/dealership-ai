"use client";
import { Card, Metric } from "@dealershipai/ui";

export default function UGC({ dealerId }: { dealerId: string }) {
  const mentions = { total: 1243, last7d: 92 };
  const sentiment = { pos: 68, neu: 22, neg: 10 };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric title="Total Mentions" value={mentions.total} />
        <Metric title="Mentions (7d)" value={mentions.last7d} />
        <Metric title="Pos/Neu/Neg" value={`${sentiment.pos}/${sentiment.neu}/${sentiment.neg}`} />
      </div>
      <Card>
        <div className="text-sm">Live UGC feed stub for <b>{dealerId}</b>. Wire platforms later.</div>
      </Card>
    </div>
  );
}