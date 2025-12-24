import type { TableWidget } from '@/types'
import { MM_TO_PX } from '@/types'

type TableBorderSide =
  | 'tableBorderTop'
  | 'tableBorderRight'
  | 'tableBorderBottom'
  | 'tableBorderLeft'

function normalizeFractions(values: number[] | undefined, length: number): number[] {
  if (length <= 0) return []
  const candidate = values?.length === length ? values : Array(length).fill(1 / length)
  const total = candidate.reduce((sum, v) => sum + v, 0)
  if (!total) return Array(length).fill(1 / length)
  return candidate.map(v => v / total)
}

function resolveTableBorderSideWidthPx(table: TableWidget, side: TableBorderSide): number {
  const sideBorder = table[side]
  if (sideBorder) {
    if (sideBorder.style === 'none' || sideBorder.width <= 0) return 0
    return sideBorder.width
  }

  const defaultWidth = table.tableBorderWidth ?? table.borderWidth ?? 0
  return defaultWidth > 0 ? defaultWidth : 0
}

export function getTableOuterBorderMm(table: TableWidget): { x: number; y: number } {
  const topPx = resolveTableBorderSideWidthPx(table, 'tableBorderTop')
  const rightPx = resolveTableBorderSideWidthPx(table, 'tableBorderRight')
  const bottomPx = resolveTableBorderSideWidthPx(table, 'tableBorderBottom')
  const leftPx = resolveTableBorderSideWidthPx(table, 'tableBorderLeft')

  return {
    x: (leftPx + rightPx) / MM_TO_PX,
    y: (topPx + bottomPx) / MM_TO_PX
  }
}

export function getTableInnerSizeMm(table: TableWidget): { width: number; height: number } {
  const border = getTableOuterBorderMm(table)
  return {
    width: Math.max((table.width ?? 0) - border.x, 0),
    height: Math.max((table.height ?? 0) - border.y, 0)
  }
}

export function getTableRowHeightsMm(table: TableWidget): number[] {
  const inner = getTableInnerSizeMm(table)
  const fractions = normalizeFractions(table.rowHeights, table.rows)
  return fractions.map(frac => inner.height * frac)
}

export function getTableColumnWidthsMm(table: TableWidget): number[] {
  const inner = getTableInnerSizeMm(table)
  const fractions = normalizeFractions(table.columnWidths, table.cols)
  return fractions.map(frac => inner.width * frac)
}

export function fractionsFromAbsoluteMm(valuesMm: number[]): number[] {
  const total = valuesMm.reduce((sum, v) => sum + v, 0)
  if (!total) {
    const len = valuesMm.length
    return len > 0 ? Array(len).fill(1 / len) : []
  }
  return valuesMm.map(v => v / total)
}

export function outerHeightFromRowHeightsMm(table: TableWidget, rowHeightsMm: number[]): number {
  const border = getTableOuterBorderMm(table)
  const innerHeight = rowHeightsMm.reduce((sum, v) => sum + v, 0)
  return innerHeight + border.y
}

export function outerWidthFromColumnWidthsMm(table: TableWidget, columnWidthsMm: number[]): number {
  const border = getTableOuterBorderMm(table)
  const innerWidth = columnWidthsMm.reduce((sum, v) => sum + v, 0)
  return innerWidth + border.x
}
