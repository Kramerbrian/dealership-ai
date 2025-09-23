import React from "react";
import Card from "./Card";
export default function Metric({ title, value, sub, progress }: { title: string; value: React.ReactNode; sub?: string; progress?: number }) {
  return (
    <Card>
      <div className="text-gray-400 text-sm">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {typeof progress === "number" && (
        <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </Card>
  );
}