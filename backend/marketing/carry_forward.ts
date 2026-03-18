export function computeCarryForwardScore(currentScore: number, anonymousScore: number): number {
  const normalizedCurrent = Math.max(0, Math.round(currentScore || 0));
  const normalizedAnonymous = Math.max(0, Math.round(anonymousScore || 0));
  return normalizedCurrent + normalizedAnonymous;
}
