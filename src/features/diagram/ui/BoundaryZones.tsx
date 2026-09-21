import { useState } from 'react'
import type { ArrowType } from '@/types/idef0'
const labels = { input: 'Вход', control: 'Управление', output: 'Выход', mechanism: 'Механизм' }
export function BoundaryZones({ canvasRef, onConnect }: {
  canvasRef: React.RefObject<HTMLDivElement | null>
  onConnect: (role: ArrowType, nodeId: string, point: { x: number; y: number }) => void
}) {
  const [drag, setDrag] = useState<{ role: ArrowType; x: number; y: number; endX: number; endY: number } | null>(null)
  return <div className="boundary-zones">
    {(['input', 'control', 'output', 'mechanism'] as const).map(role => <button key={role}
      className={`boundary-zone boundary-zone-${role}`} aria-label={`Граница: ${labels[role]}`}
      title="Проведите стрелку между этой областью и функцией"
      onPointerDown={event => {
        event.preventDefault(); event.stopPropagation()
        const rect = canvasRef.current!.getBoundingClientRect()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ role, x: event.clientX - rect.left, y: event.clientY - rect.top, endX: event.clientX - rect.left, endY: event.clientY - rect.top })
      }}
      onPointerMove={event => {
        if (!drag) return
        const rect = canvasRef.current!.getBoundingClientRect()
        setDrag({ ...drag, endX: event.clientX - rect.left, endY: event.clientY - rect.top })
      }}
      onPointerCancel={() => setDrag(null)}
      onPointerUp={event => {
        if (!drag || !canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.react-flow__node-idef0Function')
        const id = target?.getAttribute('data-id')
        if (id) onConnect(drag.role, id, { x: rect.left + drag.x, y: rect.top + drag.y })
        setDrag(null)
      }}><span>{labels[role]}</span></button>)}
    {drag && <svg className="boundary-preview"><path d={`M ${drag.x} ${drag.y} L ${drag.endX} ${drag.endY}`} fill="none" stroke="#315ee8" strokeWidth="2" strokeDasharray="6 4" /></svg>}
  </div>
}
