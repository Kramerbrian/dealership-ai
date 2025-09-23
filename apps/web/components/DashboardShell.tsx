"use client";
import { useEffect, useMemo, useState } from "react";
import { Gauge, Brain, Search, FileText, Shield, Globe, MessageSquare, X, Star } from "lucide-react";
import { Card, AIAssistant } from "@dealershipai/ui";
import Overview from "../panels/Overview";
import AIHealth from "../panels/AIHealth";
import ZeroClick from "../panels/ZeroClick";
import UGC from "../panels/UGC";
import Schema from "../panels/Schema";
import Premium from "../panels/Premium";

type TabId = "overview" | "ai-health" | "zero-click" | "ugc" | "schema" | "website" | "premium";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "ai-health", label: "AI Health", icon: Brain },
  { id: "zero-click", label: "Zero-Click", icon: Search },
  { id: "ugc", label: "UGC", icon: FileText },
  { id: "schema", label: "Schema", icon: Shield },
  { id: "premium", label: "Premium Dashboard", icon: Star },
  { id: "website", label: "Website", icon: Globe } // stub
];

export default function DashboardShell() {
  const [dealerId, setDealerId] = useState("toyota-naples");
  const [active, setActive] = useState<TabId>("overview");
  const [showAI, setShowAI] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("dai.tab") as TabId | null;
    if (saved && TABS.find(t => t.id === saved)) setActive(saved);
  }, []);
  useEffect(() => void localStorage.setItem("dai.tab", active), [active]);

  const Header = useMemo(
    () => (
      <header style={{ borderBottom: "1px solid #1f2937", position: "sticky", top: 0, backdropFilter: "blur(6px)", background: "rgba(11,11,11,.8)", zIndex: 10 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>DealershipAI</div>
          <div className="ml-auto" />
          <button
            onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
              showAI ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI Assistant
          </button>
          <label className="text-sm">Dealer ID</label>
          <input
            value={dealerId}
            onChange={e => setDealerId(e.target.value)}
            className="border rounded px-2 py-1 h-8"
            placeholder="toyota-naples"
          />
        </div>
        <nav style={{ maxWidth: 1120, margin: "0 auto", padding: "4px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-3 py-2 rounded text-sm flex items-center gap-2 ${active === t.id ? "bg-white text-black" : "bg-black text-white border"}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </nav>
      </header>
    ),
    [active, dealerId, showAI]
  );

  return (
    <div>
      {Header}
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16 }}>
        {active === "overview" && <Overview dealerId={dealerId} />}
        {active === "ai-health" && <AIHealth dealerId={dealerId} />}
        {active === "zero-click" && <ZeroClick dealerId={dealerId} />}
        {active === "ugc" && <UGC dealerId={dealerId} />}
        {active === "schema" && <Schema dealerId={dealerId} />}
        {active === "premium" && <Premium dealerId={dealerId} />}
        {active === "website" && (
          <Card><div className="text-sm">Website panel stub. Wire PageSpeed + Lighthouse later.</div></Card>
        )}
      </main>

      {/* AI Assistant Floating Panel */}
      {showAI && (
        <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-slate-100">AI Assistant</span>
            </div>
            <button
              onClick={() => setShowAI(false)}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <AIAssistant
              dealerId={dealerId}
              userTier={2}
              businessInfo={{}}
              onUpgrade={() => alert('Upgrade to higher tier!')}
            />
          </div>
        </div>
      )}
    </div>
  );
}