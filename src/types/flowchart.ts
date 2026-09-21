export const flowchartShapes = {
  start: { title: 'Начало', width: 160, height: 64 },
  end: { title: 'Конец', width: 160, height: 64 },
  process: { title: 'Процесс', width: 200, height: 90 },
  decision: { title: 'Условие', width: 220, height: 140 },
  inputOutput: { title: 'Ввод / вывод', width: 220, height: 90 },
  subprocess: { title: 'Подпроцесс', width: 220, height: 90 },
} as const

export type FlowchartShape = keyof typeof flowchartShapes
export const flowchartSides = ['top', 'right', 'bottom', 'left'] as const
