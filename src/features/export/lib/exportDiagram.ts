import { buildERSvg } from '@/features/er/exportER'
import { flowchartHandleInset, flowchartOutline } from '@/features/flowchart/geometry'
import { getArrowLabel, getBoundaryPoint, getDiagramFrame } from '@/features/diagram/lib/diagramGeometry'
import { getSmoothStepPath, Position } from '@xyflow/react'
import type { EditorDiagram, DiagramNode } from '@/types/diagram'
import { ARROW_TYPE_COLORS } from '@/entities/idef0/constants'
import { downloadBlob, downloadTextFile } from '@/utils/idef0'

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
const fontFamily = 'NotoSans'
let fontPromise: Promise<string> | undefined
async function loadFont() {
  fontPromise ??= fetch(`${import.meta.env.BASE_URL}fonts/NotoSans-Regular.ttf`).then(async response => {
    if (!response.ok) throw new Error('Не удалось загрузить шрифт для экспорта')
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    return btoa(binary)
  }).catch(error => { fontPromise = undefined; throw error })
  return fontPromise
}
function endpoint(node: DiagramNode, handle: string, frame: ReturnType<typeof getDiagramFrame>) {
  const side = node.kind === 'boundaryPort' ? (node.boundaryRole === 'output' ? Position.Left : node.boundaryRole === 'control' ? Position.Bottom : node.boundaryRole === 'mechanism' ? Position.Top : Position.Right)
    : node.kind === 'flowchart' ? handle as Position : handle.includes('control') ? Position.Top : handle.includes('mechanism') ? Position.Bottom
    : handle.includes('input') ? Position.Left : Position.Right
  if (node.kind === 'boundaryPort') return { ...getBoundaryPoint(node, frame), side }
  const inset = flowchartHandleInset(node.shape, side)
  return { x: node.position.x + (side === Position.Left ? inset : side === Position.Right ? node.width - inset : node.width / 2),
    y: node.position.y + (side === Position.Top ? 0 : side === Position.Bottom ? node.height : node.height / 2), side }
}
function wrap(text: string, width: number) {
  const max = Math.max(1, Math.floor(width / 7))
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      if (line && line.length + word.length + 1 > max) { lines.push(line); line = '' }
      for (let i = 0; i < word.length; i += max) {
        const part = word.slice(i, i + max)
        if (i > 0 && line) { lines.push(line); line = '' }
        line += (line ? ' ' : '') + part
      }
    }
    lines.push(line)
  }
  return lines
}
export function buildDiagramSvg(diagram: EditorDiagram) {
  if (diagram.type === 'er') return buildERSvg(diagram)
  const nodes = new Map(diagram.nodes.map(n => [n.id, n]))
  const frame = diagram.type === 'flowchart' && diagram.nodes.length ? (() => {
    const x = Math.min(...diagram.nodes.map(n => n.position.x)) - 40, y = Math.min(...diagram.nodes.map(n => n.position.y)) - 40
    return { x, y, width: Math.max(...diagram.nodes.map(n => n.position.x + n.width)) - x + 40, height: Math.max(...diagram.nodes.map(n => n.position.y + n.height)) - y + 40 }
  })() : getDiagramFrame(diagram)
  const geometry: string[] = []
  let minX = frame.x, minY = frame.y
  let maxX = frame.x + frame.width, maxY = frame.y + frame.height
  for (const arrow of diagram.arrows) {
    const from = nodes.get(arrow.source), to = nodes.get(arrow.target)
    if (!from || !to) continue
    const source = endpoint(from, arrow.sourceHandle, frame), target = endpoint(to, arrow.targetHandle, frame)
    const cx = (source.x + target.x) / 2 + (arrow.routeOffset ?? 0), cy = (source.y + target.y) / 2 + (arrow.routeOffset ?? 0)
    const [path, x, y] = getSmoothStepPath({ sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y, sourcePosition: source.side, targetPosition: target.side, borderRadius: 0, offset: 30, centerX: cx, centerY: cy })
    const color = ((arrow.arrowType === 'sequence' || arrow.arrowType === 'relation') ? '#475569' : ARROW_TYPE_COLORS[arrow.arrowType])
    const label = getArrowLabel(arrow, diagram)
    const labelWidth = Math.max(40, label.length * 8)
    minX = Math.min(minX, cx - 60, x - labelWidth / 2); maxX = Math.max(maxX, cx + 60, x + labelWidth / 2)
    minY = Math.min(minY, cy - 60, y - 25); maxY = Math.max(maxY, cy + 60, y + 25)
    const rotation = target.side === Position.Left ? 0 : target.side === Position.Right ? 180 : target.side === Position.Top ? 90 : -90
    geometry.push(`<path d="${path}" fill="none" stroke="${color}" stroke-width="2"/><path d="M 0 0 L -10 -5 L -10 5 Z" fill="${color}" transform="translate(${target.x} ${target.y}) rotate(${rotation})"/>`)
    if (label) geometry.push(`<rect x="${x - labelWidth / 2}" y="${y - 11}" width="${labelWidth}" height="22" fill="white"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12">${escape(label)}</text>`)
  }
  for (const node of diagram.nodes) {
    if (node.kind === 'boundaryPort') continue
    const { x, y } = node.position
    const color = '#334155'
    if (node.kind === 'flowchart') {
      const shape = node.shape ?? 'process'
      const fill = shape === 'start' ? '#f0fdf4' : shape === 'end' ? '#fff1f2' : shape === 'decision' ? '#fffbeb' : 'white'
      geometry.push(`<path d="${flowchartOutline(shape, node.width, node.height)}" transform="translate(${x} ${y})" fill="${fill}" stroke="${color}" stroke-width="1.7"/>`)
      if (shape === 'subprocess') geometry.push(`<path d="M ${x + 14} ${y} V ${y + node.height} M ${x + node.width - 14} ${y} V ${y + node.height}" fill="none" stroke="${color}" stroke-width="1.7"/>`)
    } else {
    geometry.push(`<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="0" fill="white" stroke="${color}" stroke-width="1.5"/>`)
    }
    if (node.nodeNumber) geometry.push(`<text x="${x + node.width - 12}" y="${y + node.height - 10}" text-anchor="end" font-size="11" fill="#64748b">${escape(node.nodeNumber)}</text>`)
    const lines = wrap(node.name, node.width - (node.shape === 'decision' ? 100 : node.kind === 'flowchart' ? 48 : 24))
    const available = Math.max(1, Math.floor((node.height - (node.shape === 'decision' ? 80 : 30)) / 17))
    const visible = lines.slice(0, available)
    if (lines.length > available) visible[available - 1] = visible[available - 1]!.slice(0, -1) + '…'
    visible.forEach((line, i) => geometry.push(`<text x="${x + node.width / 2}" y="${y + node.height / 2 + 5 + (i - (visible.length - 1) / 2) * 17}" text-anchor="middle" font-size="13">${escape(line)}</text>`))
  }
  const width = maxX - minX + 120, height = maxY - minY + 160
  return { width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="${fontFamily}" font-weight="normal" fill="#233047"><text x="60" y="32" font-size="16">${escape((diagram.type === 'flowchart' ? 'Блок-схема' : diagram.nodeNumber) + ' · ' + diagram.title)}</text><g transform="translate(${60 - minX} ${80 - minY})">${geometry.join('')}</g></g></svg>` }
}

export async function exportDiagrams(diagrams: EditorDiagram[], type: 'png' | 'svg' | 'pdf', name: string) {
  if (!diagrams.length) throw new Error('Нет диаграмм для экспорта')
  const filename = name.replace(/[<>:"/\\|?*]/g, '-').trim() || 'project'
  const font = await loadFont()
  const images = diagrams.map(buildDiagramSvg)
  if (type === 'pdf') {
    const { default: jsPDF } = await import('jspdf')
    await import('svg2pdf.js')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    pdf.addFileToVFS('NotoSans-Regular.ttf', font)
    pdf.addFont('NotoSans-Regular.ttf', fontFamily, 'normal')
    pdf.setFont(fontFamily)
    for (let i = 0; i < images.length; i++) {
      if (i > 0) pdf.addPage('a4', 'landscape')
      const page = images[i]!
      const scale = Math.min((pdf.internal.pageSize.getWidth() - 40) / page.width, (pdf.internal.pageSize.getHeight() - 40) / page.height)
      const svg = new DOMParser().parseFromString(page.svg, 'image/svg+xml').documentElement as unknown as SVGSVGElement
      await pdf.svg(svg, { x: 20, y: 20, width: page.width * scale, height: page.height * scale })
    }
    pdf.save(`${filename}.pdf`)
    return
  }
  const first = images[0]!
  const embedded = first.svg.replace('<rect ', `<defs><style>@font-face{font-family:${fontFamily};src:url(data:font/ttf;base64,${font}) format('truetype');}</style></defs><rect `)
  if (type === 'svg') { downloadTextFile(embedded, `${filename}.svg`, 'image/svg+xml'); return }
  const url = URL.createObjectURL(new Blob([embedded], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    const scale = Math.min(2, 8192 / Math.max(first.width, first.height))
    canvas.width = Math.ceil(first.width * scale); canvas.height = Math.ceil(first.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Браузер не поддерживает экспорт PNG')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Ошибка кодирования PNG')), 'image/png'))
    downloadBlob(blob, `${filename}.png`)
  } finally { URL.revokeObjectURL(url) }
}
