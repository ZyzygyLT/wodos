/** Returns true only for the first defeated transition recorded for a unit in this combat scope. */
export function markUnitDefeated(processedUnitIds: Set<string>, unitId: string, isDefeated: boolean): boolean {
  if (!isDefeated || processedUnitIds.has(unitId)) return false
  processedUnitIds.add(unitId)
  return true
}
