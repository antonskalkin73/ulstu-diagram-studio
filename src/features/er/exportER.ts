import { Position } from '@xyflow/react'
import type { EditorDiagram } from '@/types/diagram'
import { columnDetails, erTables, ER_HEADER, ER_ROW, handleColumn, relationshipCardinality, tableFooter, type ERTableNode } from './model'
import { formatDataType } from './postgresTypes'
import { erRelationPath } from './geometry'

const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
const clip = (text: string, max: number) => esc(text.length > max ? text.slice(0, max - 1) + '…' : text)
function endpoint(node: ERTableNode, handle: string) {
  const side = handle.endsWith(':left') ? Position.Left : Position.Right
  const index = Math.max(0, node.table.columns.findIndex(c => c.id === handleColumn(handle)))
  return { x: node.position.x + (side === Position.Right ? node.width : 0), y: node.position.y + ER_HEADER + ER_ROW * (index + 0.5), side }
}
export function buildERSvg(diagram: EditorDiagram) {
  const tables = erTables(diagram), body: string[] = []
  let minX = Math.min(0, ...tables.map(n => n.position.x)), minY = Math.min(0, ...tables.map(n => n.position.y))
  let maxX = Math.max(500, ...tables.map(n => n.position.x + n.width)), maxY = Math.max(200, ...tables.map(n => n.position.y + n.height))
  const caption = (text: string, x: number, y: number, limit = 200) => {
    const chars = Math.max(5, Math.floor((limit - 8) / 7))
    const lines = text.match(new RegExp(`.{1,${chars}}`, 'g')) ?? ['']
    const width = Math.max(20, Math.min(limit, text.length * 7 + 8)), height = lines.length * 13 + 5
    body.push(`<rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" fill="white"/>`)
    lines.forEach((line, i) => body.push(`<text x="${x}" y="${y + 4 + (i - (lines.length - 1) / 2) * 13}" text-anchor="middle" fill="#6d28d9" font-size="10">${esc(line)}</text>`))
  }
  for (const arrow of diagram.arrows) {
    const from = tables.find(n => n.id === arrow.source), to = tables.find(n => n.id === arrow.target)
    if (!from || !to || !arrow.foreignKey) continue
    const s = endpoint(from, arrow.sourceHandle), t = endpoint(to, arrow.targetHandle), offset = arrow.routeOffset ?? 0
    const [path, x, y] = erRelationPath(s.x, s.y, t.x, t.y, from.id === to.id, offset, s.side, t.side)
    minX = Math.min(minX, s.x - 60, t.x - 60, x - 120); maxX = Math.max(maxX, s.x + 60, t.x + 60, x + 120)
    minY = Math.min(minY, y - 25); maxY = Math.max(maxY, y + 25)
    body.push(`<path d="${path}" fill="none" stroke="#7c3aed" stroke-width="1.8"/>`)
    const cardinality = relationshipCardinality(from, arrow)
    caption(arrow.label || 'FK', x, y, Math.abs(s.x - t.x) > 40 ? Math.min(200, Math.abs(s.x - t.x) - 16) : 200)
    caption(cardinality.child, s.x + (s.side === Position.Left ? -22 : 22), s.y - 12)
    caption(cardinality.parent, t.x + (t.side === Position.Left ? -22 : 22), t.y - 12)
  }
  for (const n of tables) {
    const { x, y } = n.position
    body.push(`<rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" rx="8" fill="white" stroke="#cbd5e1"/><path d="M ${x + 8} ${y} H ${x + n.width - 8} Q ${x + n.width} ${y} ${x + n.width} ${y + 8} V ${y + ER_HEADER} H ${x} V ${y + 8} Q ${x} ${y} ${x + 8} ${y}" fill="#eef2ff"/>`)
    body.push(`<text x="${x + 12}" y="${y + 19}" font-size="10" fill="#64748b">${clip(n.table.schema + ' · PostgreSQL 18' + (n.table.unlogged ? ' · UNLOGGED' : ''), 57)}</text><text x="${x + 12}" y="${y + 41}" font-size="15" fill="#312e81">${clip(n.name, 42)}</text>`)
    n.table.columns.forEach((c, index) => {
      const top = y + ER_HEADER + index * ER_ROW
      const fk = diagram.arrows.some(a => a.source === n.id && a.foreignKey?.columns.includes(c.id))
      const badges = [c.primaryKey ? 'PK' : '', fk ? 'FK' : '', c.unique ? 'UQ' : ''].filter(Boolean).join(' ')
      body.push(`<text x="${x + 10}" y="${top + 19}" font-size="8" fill="#7c3aed">${badges}</text><text x="${x + 58}" y="${top + 19}" font-size="12">${clip(c.name, 20)}</text><text x="${x + n.width - 12}" y="${top + 19}" text-anchor="end" font-size="10" fill="#475569">${clip(formatDataType(c), 25)}</text><text x="${x + 12}" y="${top + 37}" font-size="9" fill="#64748b">${clip(columnDetails(c), 68)}</text><path d="M ${x} ${top + ER_ROW} H ${x + n.width}" stroke="#edf0f5"/>`)
    })
    tableFooter(n).forEach((line, i) => body.push(`<text x="${x + 12}" y="${y + ER_HEADER + Math.max(1, n.table.columns.length) * ER_ROW + 23 + i * 24}" font-size="10" fill="#64748b">${clip(line, 62)}</text>`))
  }
  const width = maxX - minX + 120, height = maxY - minY + 140
  return { width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="NotoSans" font-weight="normal" fill="#233047"><text x="40" y="30" font-size="16">${esc(diagram.title)} · PostgreSQL 18</text><g transform="translate(${60 - minX} ${70 - minY})">${body.join('')}</g></g></svg>` }
}
