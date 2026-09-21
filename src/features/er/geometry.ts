import { getSmoothStepPath } from '@xyflow/react'

export function erRelationPath(sourceX: number, sourceY: number, targetX: number, targetY: number, self: boolean, offset: number, sourcePosition: Parameters<typeof getSmoothStepPath>[0]['sourcePosition'], targetPosition: Parameters<typeof getSmoothStepPath>[0]['targetPosition']): [string, number, number] {
  if (self) {
    const top = Math.min(sourceY, targetY) - 85 - Math.abs(offset)
    const left = Math.min(sourceX, targetX) - 55, right = Math.max(sourceX, targetX) + 55
    return [`M ${sourceX} ${sourceY} H ${sourcePosition === 'left' ? left : right} V ${top} H ${targetPosition === 'left' ? left : right} V ${targetY} H ${targetX}`, (left + right) / 2, top]
  }
  const [path, x, y] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 0, offset: 35, centerX: (sourceX + targetX) / 2 + offset, centerY: (sourceY + targetY) / 2 + offset })
  return [path, x, y]
}
