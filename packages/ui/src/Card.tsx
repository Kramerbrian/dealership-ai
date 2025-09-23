import React from "react";
import { theme } from "./tokens";
export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`border ${className}`}
      style={{ borderColor: "#1f2937", background: "#0f172a", borderRadius: theme.radius.lg, padding: 16 }}
    >
      {children}
    </div>
  );
}