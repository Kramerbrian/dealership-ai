"use client";
import { Card } from "@dealershipai/ui";
export default function ZeroClick({ dealerId }: { dealerId: string }) {
  const details = [
    { intent: "oil change naples fl", included: true, lastSeen: new Date().toISOString() },
    { intent: "toyota service naples", included: false, lastSeen: new Date().toISOString() }
  ];
  const included = details.filter(d => d.included).length;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>Dealer: <b>{dealerId}</b></div>
          <div>Inclusion Rate: <b>{Math.round((included / details.length) * 100)}%</b> ({included}/{details.length})</div>
          <div>Sampled: {new Date().toLocaleString()}</div>
        </div>
      </Card>
      <Card>
        <div className="text-sm font-semibold mb-2">Intents</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left border-b">
              <th className="py-2 pr-4">Intent</th><th className="py-2 pr-4">Included</th><th className="py-2 pr-4">Last Seen</th>
            </tr></thead>
            <tbody>
              {details.map(d => (
                <tr key={d.intent} className="border-b last:border-0">
                  <td className="py-2 pr-4">{d.intent}</td>
                  <td className="py-2 pr-4">{d.included ? "yes" : "no"}</td>
                  <td className="py-2 pr-4">{new Date(d.lastSeen).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}