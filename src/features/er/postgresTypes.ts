import type { ERColumn } from '@/types/er'

// PostgreSQL 18, chapter 8. Aliases are deliberately normalized to SQL names.
// Pseudo-types cannot be table column types and are not offered here.
export const postgresTypeGroups = {
  'Числа': ['smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision', 'money'],
  'Строки и двоичные данные': ['text', 'character varying', 'character', 'bytea', 'bit', 'bit varying'],
  'Дата и время': ['date', 'time without time zone', 'time with time zone', 'timestamp without time zone', 'timestamp with time zone', 'interval'],
  'Логика и идентификаторы': ['boolean', 'uuid'],
  'JSON и XML': ['json', 'jsonb', 'jsonpath', 'xml'],
  'Сеть': ['inet', 'cidr', 'macaddr', 'macaddr8'],
  'Геометрия': ['point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle'],
  'Полнотекстовый поиск': ['tsvector', 'tsquery'],
  'Диапазоны': ['int4range', 'int8range', 'numrange', 'tsrange', 'tstzrange', 'daterange'],
  'Мультидиапазоны': ['int4multirange', 'int8multirange', 'nummultirange', 'tsmultirange', 'tstzmultirange', 'datemultirange'],
  'Системные': ['oid', 'regclass', 'regcollation', 'regconfig', 'regdictionary', 'regnamespace', 'regoper', 'regoperator', 'regproc', 'regprocedure', 'regrole', 'regtype', 'pg_lsn', 'pg_snapshot', 'txid_snapshot'],
  'Serial (сокращения для последовательностей)': ['smallserial', 'serial', 'bigserial'],
} as const
export const postgresTypes: string[] = Object.values(postgresTypeGroups).flat()
export function typeParameters(type: string): string {
  if (type === 'numeric') return 'precision[, scale], например 12,2'
  if (['character', 'character varying', 'bit', 'bit varying'].includes(type)) return 'длина, например 255'
  if (/^(time|timestamp) /.test(type) || type === 'interval') return 'точность секунд: 0–6'
  return ''
}
export function formatDataType(column: ERColumn): string {
  const args = column.typeArgs.trim() ? `(${column.typeArgs.trim()})` : ''
  const base = /^(time|timestamp) /.test(column.dataType) ? column.dataType.replace(/^(timestamp|time)/, `$1${args}`) : column.dataType + args
  return base + '[]'.repeat(column.arrayDimensions)
}
export function typeError(column: ERColumn): string | undefined {
  if (!postgresTypes.includes(column.dataType)) return 'Неизвестный тип PostgreSQL 18.'
  const args = column.typeArgs.trim()
  if (args) {
    if (!typeParameters(column.dataType)) return 'Этот тип не принимает параметры.'
    if (column.dataType === 'numeric') {
      if (!/^\d+\s*(,\s*-?\d+)?$/.test(args)) return 'Ожидается precision[, scale].'
      const [p, s = 0] = args.split(',').map(Number)
      if (!p || p > 1000 || Math.abs(s) > 1000) return 'Precision: 1–1000; scale: −1000…1000.'
    } else if (/^(time|timestamp) /.test(column.dataType) || column.dataType === 'interval') {
      if (!/^[0-6]$/.test(args)) return 'Точность секунд должна быть от 0 до 6.'
    } else if (!/^\d+$/.test(args) || Number(args) < 1 || Number(args) > 10485760) return 'Длина должна быть целым числом 1–10485760.'
  }
  if (column.arrayDimensions && /serial$/.test(column.dataType)) return 'Serial не поддерживает массивы; используйте целочисленный тип.'
}
