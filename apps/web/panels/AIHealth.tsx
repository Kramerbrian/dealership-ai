"use client";
import { Card } from "@dealershipai/ui";

export default function AIHealth({ dealerId }: { dealerId: string }) {
  const rows = [
    { platform: "ChatGPT", visible: true, visibility: 91, latencyMs: 620, trend: "+2%" },
    { platform: "Claude", visible: true, visibility: 88, latencyMs: 540, trend: "+1%" },
    { platform: "Perplexity", visible: false, visibility: 48, latencyMs: 700, trend: "–" }
  ];
  return (
    <Card>
      <div className="text-sm font-semibold mb-3">AI Platform Rankings — {dealerId}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left border-b">
            <th className="py-2 pr-4">Platform</th><th className="py-2 pr-4">Visible</th>
            <th className="py-2 pr-4">Visibility</th><th className="py-2 pr-4">Latency</th><th className="py-2 pr-4">Trend</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.platform} className="border-b last:border-0">
                <td className="py-2 pr-4">{r.platform}</td>
                <td className="py-2 pr-4">{r.visible ? "yes" : "no"}</td>
                <td className="py-2 pr-4">{r.visibility}%</td>
                <td className="py-2 pr-4">{r.latencyMs} ms</td>
                <td className="py-2 pr-4">{r.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}