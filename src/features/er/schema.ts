import { z } from 'zod'
import { referentialActions } from '@/types/er'
import { postgresTypes } from './postgresTypes'

const id = z.string().min(1)
export const erColumnSchema = z.object({
  id, name: z.string(), dataType: z.string().refine(t => postgresTypes.includes(t)), typeArgs: z.string(),
  arrayDimensions: z.number().int().min(0).max(6), nullable: z.boolean(), primaryKey: z.boolean(), unique: z.boolean(),
  defaultValue: z.string(), identity: z.enum(['', 'ALWAYS', 'BY DEFAULT']), generated: z.enum(['', 'STORED', 'VIRTUAL']),
  expression: z.string(), collation: z.string(), comment: z.string(),
})
export const erTableSchema = z.object({
  schema: z.string(), columns: z.array(erColumnSchema), unlogged: z.boolean(),
  indexes: z.array(z.object({ id, name: z.string(), kind: z.enum(['unique', 'index']), columns: z.array(id), method: z.enum(['btree', 'hash', 'gist', 'spgist', 'gin', 'brin']), unique: z.boolean(), nullsNotDistinct: z.boolean(), predicate: z.string(), include: z.array(id) })),
  checks: z.array(z.object({ id, name: z.string(), expression: z.string() })),
})
export const erForeignKeySchema = z.object({
  columns: z.array(id).min(1), referencedColumns: z.array(id).min(1), onDelete: z.enum(referentialActions), onUpdate: z.enum(referentialActions),
  match: z.enum(['SIMPLE', 'FULL']), deferrable: z.boolean(), initiallyDeferred: z.boolean(),
})
