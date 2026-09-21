import type { ArrowType } from '@/types/idef0'
export function boundaryRoleAtPoint(x: number, y: number, width: number, height: number): ArrowType | null {
  if (x < 0 || y < 0 || x > width || y > height) return null
  const zones: [ArrowType, number][] = [['input', x], ['output', width - x], ['control', y], ['mechanism', height - y]]
  const nearest = zones.sort((a, b) => a[1] - b[1])[0]!
  return nearest[1] <= 36 ? nearest[0] : null
}
