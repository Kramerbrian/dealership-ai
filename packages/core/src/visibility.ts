// Platform weights and scoring logic for AI visibility
export type PlatformScore = { chatgpt: number; claude: number; perplexity: number; gemini: number };

export function overallVisibility(p: PlatformScore) {
  const w = { chatgpt: 0.35, claude: 0.3, perplexity: 0.2, gemini: 0.15 };
  return Math.round(p.chatgpt * w.chatgpt + p.claude * w.claude + p.perplexity * w.perplexity + p.gemini * w.gemini);
}

// Basic schema scoring placeholders
export function schemaCoverage(valid: number, total: number) {
  return total ? Math.round((valid / total) * 100) : 0;
}