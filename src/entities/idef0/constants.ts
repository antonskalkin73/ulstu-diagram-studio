import type { ArrowType } from '@/types/idef0'

export const FUNCTION_NODE_SIZE = { width: 220, height: 120 }
export const BOUNDARY_NODE_SIZE = { width: 8, height: 8 }
export const SNAP_GRID: [number, number] = [20, 20]

export const FUNCTION_HANDLES = {
  inputTarget: 'target-input',
  controlTarget: 'target-control',
  outputSource: 'source-output',
  mechanismTarget: 'target-mechanism',
} as const

export const BOUNDARY_HANDLES = {
  outputTarget: 'target-output',
  sourceOutput: 'source-output',
} as const

export const ARROW_TYPE_LABELS: Record<ArrowType, string> = {
  input: 'Input',
  control: 'Control',
  output: 'Output',
  mechanism: 'Mechanism',
}

export const ARROW_TYPE_COLORS: Record<ArrowType, string> = {
  input: '#2563eb',
  control: '#7c3aed',
  output: '#059669',
  mechanism: '#ea580c',
}

export const LOCAL_STORAGE_PROJECT_KEY = 'ulstu-idef0:last-project'
export const LOCAL_STORAGE_PENDING_KEY = 'ulstu-idef0:has-pending-draft'
