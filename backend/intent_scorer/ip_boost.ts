export function calculateIpRepeatBoost(
  priorEvents: number,
  ipBoostEnabled: boolean,
  ipRepeatBoostPoints: number
): number {
  if (!ipBoostEnabled || ipRepeatBoostPoints <= 0) {
    return 0;
  }
  if (priorEvents <= 0) {
    return 0;
  }
  return ipRepeatBoostPoints;
}
