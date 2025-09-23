// Basic schema scoring placeholders.
export function schemaCoverage(valid: number, total: number) {
  return total ? Math.round((valid / total) * 100) : 0;
}