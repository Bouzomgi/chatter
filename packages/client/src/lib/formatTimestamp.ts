function calendarDaysAgo(d: Date, now: Date): number {
  const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((nowMidnight.getTime() - dMidnight.getTime()) / (1000 * 60 * 60 * 24))
}

// For sidebar conversation heads: time · weekday · short date
export function formatConversationTime(iso: string): string {
  const d = new Date(iso)
  const daysAgo = calendarDaysAgo(d, new Date())
  if (daysAgo === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (daysAgo < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
}

// For message thread timestamp labels: time · weekday+time · abbrev date at time
export function formatMessageTimestamp(iso: string): string {
  const d = new Date(iso)
  const daysAgo = calendarDaysAgo(d, new Date())
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (daysAgo === 0) return time
  if (daysAgo < 7) return `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${time}`
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`
}
