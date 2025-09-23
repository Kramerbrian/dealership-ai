import React from "react";
export default function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-300 border border-gray-700 ${className}`}>
      {children}
    </span>
  );
}