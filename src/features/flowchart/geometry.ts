import type { FlowchartShape } from '@/types/flowchart'

/** The editor and exports use the same outlines and connection points. */
export function flowchartOutline(shape: FlowchartShape, w: number, h: number): string {
  if (shape === 'decision') return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`
  if (shape === 'inputOutput') return `M 24 0 H ${w} L ${w - 24} ${h} H 0 Z`
  if (shape === 'start' || shape === 'end') {
    const r = h / 2
    return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
  }
  return `M 0 0 H ${w} V ${h} H 0 Z`
}

export function flowchartHandleInset(shape: FlowchartShape | undefined, side: string): number {
  return shape === 'inputOutput' && (side === 'left' || side === 'right') ? 12 : 0
}
