/**
 * Format an elapsed millisecond span as MM:SS, or H:MM:SS once it passes an hour.
 * Shared by the mix-round timer and the active-run drawer so every process-run
 * timer reads the same way.
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${mm}:${ss}`
  return `${mm}:${ss}`
}
