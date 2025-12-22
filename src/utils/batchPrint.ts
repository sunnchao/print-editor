import type { BatchPrintConfig } from '@/types'

export function normalizeBatchPrintConfig(input?: Partial<BatchPrintConfig> | null): BatchPrintConfig {
  const enabled = input?.enabled ?? true
  const printRange: BatchPrintConfig['printRange'] = input?.printRange ?? 'range'
  const dataSourceFile = input?.dataSourceFile

  if (printRange === 'range') {
    const start = Math.max(0, input?.rangeStart ?? 0)
    const end = Math.max(start, input?.rangeEnd ?? start)
    return { enabled, dataSourceFile, printRange, rangeStart: start, rangeEnd: end }
  }

  return { enabled, dataSourceFile, printRange }
}

