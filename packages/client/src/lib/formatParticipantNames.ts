export function formatParticipantNames(names: string[]): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return sorted[0]
  return sorted.slice(0, -1).join(', ') + ' & ' + sorted[sorted.length - 1]
}
