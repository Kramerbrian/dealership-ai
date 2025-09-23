// Inclusion rate and sampling helpers.
export function inclusionRate(included: number, tested: number) {
  return tested ? Math.round((included / tested) * 100) : 0;
}