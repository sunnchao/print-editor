import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Widget,
  PaperSize,
  SnapLine,
  TableSelection,
  TableWidget,
  TableCell,
  BatchPrintConfig
} from '@/types'
import { cloneDeep } from 'lodash-es'
import { normalizeBatchPrintConfig } from '@/utils/batchPrint'

interface MasterCell {
  row: number
  col: number
  rowSpan: number
  colSpan: number
  content: string
  dataSource?: string
}

function createDefaultCell(): TableCell {
  return {
    content: '',
    rowSpan: 1,
    colSpan: 1
  }
}

function extractMasterCells(table: TableWidget): MasterCell[] {
  const masters: MasterCell[] = []
  for (let r = 0; r < table.rows; r++) {
    for (let c = 0; c < table.cols; c++) {
      const cell = table.cells[r][c]
      if (!cell) continue
      const rowSpan = cell.rowSpan ?? 1
      const colSpan = cell.colSpan ?? 1
      if (rowSpan === 0 || colSpan === 0) continue
      masters.push({
        row: r,
        col: c,
        rowSpan,
        colSpan,
        content: cell.content,
        dataSource: cell.dataSource
      })
    }
  }
  return masters
}

function buildCellsFromMasters(rows: number, cols: number, masters: MasterCell[]): TableCell[][] {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => createDefaultCell())
  )

  const sortedMasters = [...masters].sort((a, b) => a.row - b.row || a.col - b.col)

  for (const master of sortedMasters) {
    if (master.row < 0 || master.col < 0 || master.row >= rows || master.col >= cols) continue
    const availableRowSpan = Math.min(master.rowSpan, rows - master.row)
    const availableColSpan = Math.min(master.colSpan, cols - master.col)
    const cell = cells[master.row][master.col]
    cell.content = master.content
    cell.rowSpan = availableRowSpan
    cell.colSpan = availableColSpan
    if (master.dataSource) {
      cell.dataSource = master.dataSource
    } else if (cell.dataSource) {
      delete cell.dataSource
    }

    for (let r = 0; r < availableRowSpan; r++) {
      for (let c = 0; c < availableColSpan; c++) {
        if (r === 0 && c === 0) continue
        const targetRow = master.row + r
        const targetCol = master.col + c
        if (targetRow >= rows || targetCol >= cols) continue
        cells[targetRow][targetCol] = {
          content: '',
          rowSpan: 0,
          colSpan: 0
        }
      }
    }
  }

  return cells
}

function countOverlap(startA: number, endA: number, startB: number, endB: number): number {
  const start = Math.max(startA, startB)
  const end = Math.min(endA, endB)
  return start <= end ? end - start + 1 : 0
}

function countRemovedBefore(index: number, removeStart: number, removeEnd: number): number {
  if (index <= removeStart) return 0
  if (index > removeEnd) return removeEnd - removeStart + 1
  return index - removeStart
}

function createFractionArray(length: number): number[] {
  if (length <= 0) return []
  const value = 1 / length
  return Array(length).fill(value)
}

function normalizeFractionArray(values: number[] | undefined, length: number): number[] {
  if (length <= 0) return []
  if (!values || values.length !== length) {
    return createFractionArray(length)
  }
  const total = values.reduce((sum, val) => sum + val, 0)
  if (!total) {
    return createFractionArray(length)
  }
  return values.map(val => val / total)
}

function insertFraction(values: number[], insertIndex: number): number[] {
  if (values.length === 0) {
    return createFractionArray(1)
  }
  const normalized = normalizeFractionArray(values, values.length)
  const safeIndex = Math.max(0, Math.min(insertIndex, normalized.length))
  const targetIndex = safeIndex > 0 ? Math.min(safeIndex - 1, normalized.length - 1) : 0
  const base = normalized[targetIndex]
  const newValue = base / 2
  normalized[targetIndex] = base / 2
  normalized.splice(safeIndex, 0, newValue)
  return normalizeFractionArray(normalized, normalized.length)
}

function removeFractionRange(values: number[], start: number, end: number): number[] {
  if (values.length === 0) return []
  const normalized = normalizeFractionArray(values, values.length)
  const safeStart = Math.max(0, Math.min(start, normalized.length - 1))
  const safeEnd = Math.max(safeStart, Math.min(end, normalized.length - 1))
  const removed = normalized.splice(safeStart, safeEnd - safeStart + 1)
  const removedSum = removed.reduce((sum, val) => sum + val, 0)
  if (normalized.length === 0) return []
  const distributeIndex = Math.min(safeStart, normalized.length - 1)
  normalized[distributeIndex] = (normalized[distributeIndex] ?? 0) + removedSum
  return normalizeFractionArray(normalized, normalized.length)
}

function getColumnFractions(table: TableWidget): number[] {
  return normalizeFractionArray(table.columnWidths, table.cols)
}

function getRowFractions(table: TableWidget): number[] {
  return normalizeFractionArray(table.rowHeights, table.rows)
}

export const useEditorStore = defineStore('editor', () => {
  const widgets = ref<Widget[]>([])
  const selectedWidgetId = ref<string | null>(null)
  const paperSize = ref<PaperSize | null>(null)
  const scale = ref(1)
  const globalForcePageBreak = ref(false) // 全局强制分页设置

  // 批量打印配置：用于将模板与数据源结合，生成 N 份打印内容
  const batchPrint = ref<BatchPrintConfig>(normalizeBatchPrintConfig())

  const history = ref<Widget[][]>([])
  const historyIndex = ref(-1)
  const clipboard = ref<Widget | null>(null)
  const snapLines = ref<SnapLine[]>([])
  const tableSelection = ref<TableSelection | null>(null)

  const selectedWidget = computed(() => {
    if (!selectedWidgetId.value) return null
    return widgets.value.find(w => w.id === selectedWidgetId.value) || null
  })

  const maxZIndex = computed(() => {
    if (widgets.value.length === 0) return 0
    return Math.max(...widgets.value.map(w => w.zIndex))
  })

  function generateId(): string {
    return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  function saveHistory() {
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(cloneDeep(widgets.value))
    historyIndex.value++
    if (history.value.length > 50) {
      history.value.shift()
      historyIndex.value--
    }
  }

  function addWidget(widget: Omit<Widget, 'id' | 'zIndex'>) {
    const newWidget = {
      ...widget,
      id: generateId(),
      zIndex: maxZIndex.value + 1
    } as Widget
    widgets.value.push(newWidget)
    selectedWidgetId.value = newWidget.id
    saveHistory()
  }

  function updateWidget(id: string, updates: Partial<Widget>) {
    const index = widgets.value.findIndex(w => w.id === id)
    if (index !== -1) {
      widgets.value[index] = { ...widgets.value[index], ...updates } as Widget
      saveHistory()
    }
  }

  function deleteWidget(id: string) {
    const index = widgets.value.findIndex(w => w.id === id)
    if (index !== -1) {
      widgets.value.splice(index, 1)
      if (selectedWidgetId.value === id) {
        selectedWidgetId.value = null
        tableSelection.value = null
      }
      saveHistory()
    }
  }

  function selectWidget(id: string | null) {
    // 如果切换到不同的组件，总是先清除表格选区
    if (id !== selectedWidgetId.value) {
      tableSelection.value = null
    }

    selectedWidgetId.value = id
    if (!id) {
      tableSelection.value = null
      return
    }

    // 如果选中的不是表格组件，确保表格选区被清除
    const widget = widgets.value.find(w => w.id === id)
    if (!widget || widget.type !== 'table') {
      tableSelection.value = null
    }
  }

  function copyWidget(id: string) {
    const widget = widgets.value.find(w => w.id === id)
    if (widget) {
      clipboard.value = cloneDeep(widget)
    }
  }

  function pasteWidget() {
    if (clipboard.value) {
      addWidget({
        ...clipboard.value,
        x: clipboard.value.x + 20,
        y: clipboard.value.y + 20
      })
    }
  }

  function bringToFront(id: string) {
    const widget = widgets.value.find(w => w.id === id)
    if (widget) {
      widget.zIndex = maxZIndex.value + 1
      saveHistory()
    }
  }

  function sendToBack(id: string) {
    const widget = widgets.value.find(w => w.id === id)
    if (widget) {
      const minZIndex = Math.min(...widgets.value.map(w => w.zIndex))
      widget.zIndex = minZIndex - 1
      saveHistory()
    }
  }

  function undo() {
    if (historyIndex.value > 0) {
      historyIndex.value--
      widgets.value = cloneDeep(history.value[historyIndex.value])
    }
  }

  function redo() {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++
      widgets.value = cloneDeep(history.value[historyIndex.value])
    }
  }

  function setPaperSize(size: PaperSize | null) {
    paperSize.value = size
  }

  function setScale(newScale: number) {
    scale.value = Math.max(0.25, Math.min(3, newScale))
  }

  function setGlobalForcePageBreak(value: boolean) {
    globalForcePageBreak.value = value
  }

  /**
   * 设置批量打印配置
   * @param config 批量打印配置（部分更新）
   */
  function setBatchPrint(config: Partial<BatchPrintConfig>) {
    batchPrint.value = normalizeBatchPrintConfig({ ...batchPrint.value, ...config })
  }

  /**
   * 重置批量打印配置为默认值
   */
  function resetBatchPrint() {
    batchPrint.value = normalizeBatchPrintConfig()
  }

  function exportTemplate(): string {
    return JSON.stringify(
      {
        paperSize: paperSize.value,
        widgets: widgets.value,
        globalForcePageBreak: globalForcePageBreak.value
      },
      null,
      2
    )
  }

  function importTemplate(json: string) {
    try {
      const data = JSON.parse(json)
      if (data.paperSize) paperSize.value = data.paperSize
      if (data.widgets) widgets.value = data.widgets
      if (data.globalForcePageBreak !== undefined)
        globalForcePageBreak.value = data.globalForcePageBreak
      saveHistory()
    } catch (e) {
      console.error('导入模板失败:', e)
    }
  }

  function loadWidgets(newWidgets: Widget[]) {
    widgets.value = cloneDeep(newWidgets)
    selectedWidgetId.value = null
    history.value = []
    historyIndex.value = -1
    saveHistory()
  }

  function clearWidgets() {
    widgets.value = []
    selectedWidgetId.value = null
    history.value = []
    historyIndex.value = -1
  }

  function setSnapLines(lines: SnapLine[]) {
    snapLines.value = lines
  }

  function clearSnapLines() {
    snapLines.value = []
  }

  function setTableSelection(selection: TableSelection | null) {
    tableSelection.value = selection
  }

  function getSelectedTable(): TableWidget | null {
    if (!selectedWidgetId.value) return null
    const widget = widgets.value.find(w => w.id === selectedWidgetId.value)
    if (widget?.type !== 'table') return null
    return widget as TableWidget
  }

  function mergeTableCells() {
    const table = getSelectedTable()
    if (!table || !tableSelection.value) return

    const { startRow, startCol, endRow, endCol } = tableSelection.value
    if (startRow === endRow && startCol === endCol) return

    const newCells = cloneDeep(table.cells)

    // 设置主单元格
    newCells[startRow][startCol].rowSpan = endRow - startRow + 1
    newCells[startRow][startCol].colSpan = endCol - startCol + 1

    // 清空其他单元格
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r === startRow && c === startCol) continue
        newCells[r][c].rowSpan = 0
        newCells[r][c].colSpan = 0
      }
    }

    updateWidget(table.id, { cells: newCells })
    tableSelection.value = null
  }

  function splitTableCells() {
    const table = getSelectedTable()
    if (!table || !tableSelection.value) return

    const { startRow, startCol } = tableSelection.value
    const cell = table.cells[startRow][startCol]

    if ((cell.rowSpan || 1) === 1 && (cell.colSpan || 1) === 1) return

    const newCells = cloneDeep(table.cells)
    const rowSpan = cell.rowSpan || 1
    const colSpan = cell.colSpan || 1

    // 恢复所有单元格
    for (let r = startRow; r < startRow + rowSpan; r++) {
      for (let c = startCol; c < startCol + colSpan; c++) {
        newCells[r][c].rowSpan = 1
        newCells[r][c].colSpan = 1
      }
    }

    updateWidget(table.id, { cells: newCells })
    tableSelection.value = null
  }

  function insertTableRow(rowIndex: number, position: 'before' | 'after') {
    const table = getSelectedTable()
    if (!table) return

    const selection = tableSelection.value
    const previousSelection = selection ? { ...selection } : null
    const rowHeight = table.rows > 0 ? table.height / table.rows : 0
    const referenceRow = selection
      ? position === 'before'
        ? selection.startRow
        : selection.endRow
      : rowIndex
    const insertIndex = position === 'before' ? referenceRow : referenceRow + 1
    const rowFractions = getRowFractions(table)
    const masters = extractMasterCells(table).map(cell => {
      const withinSpan = insertIndex >= cell.row && insertIndex <= cell.row + cell.rowSpan - 1
      return {
        ...cell,
        row: cell.row >= insertIndex ? cell.row + 1 : cell.row,
        rowSpan: cell.rowSpan + (withinSpan ? 1 : 0)
      }
    })

    const newRows = table.rows + 1
    const newCells = buildCellsFromMasters(newRows, table.cols, masters)
    const newHeight = rowHeight > 0 ? table.height + rowHeight : table.height
    const rowHeights = insertFraction(rowFractions, insertIndex)

    updateWidget(table.id, {
      cells: newCells,
      rows: newRows,
      height: Math.max(newHeight, 20),
      rowHeights
    })

    const colStart = previousSelection ? previousSelection.startCol : 0
    const colEnd = previousSelection ? previousSelection.endCol : table.cols - 1
    tableSelection.value = {
      startRow: Math.min(insertIndex, newRows - 1),
      endRow: Math.min(insertIndex, newRows - 1),
      startCol: Math.max(0, colStart),
      endCol: Math.max(0, Math.min(colEnd, table.cols - 1))
    }
  }

  function insertTableCol(colIndex: number, position: 'before' | 'after') {
    const table = getSelectedTable()
    if (!table) return

    const selection = tableSelection.value
    const previousSelection = selection ? { ...selection } : null
    const colWidth = table.cols > 0 ? table.width / table.cols : 0
    const referenceCol = selection
      ? position === 'before'
        ? selection.startCol
        : selection.endCol
      : colIndex
    const insertIndex = position === 'before' ? referenceCol : referenceCol + 1

    const bindings = { ...(table.columnBindings || {}) }
    const updatedBindings: Record<number, string> = {}
    Object.keys(bindings).forEach(key => {
      const col = Number(key)
      const newCol = col >= insertIndex ? col + 1 : col
      updatedBindings[newCol] = bindings[col]
    })

    const columnFractions = getColumnFractions(table)
    const masters = extractMasterCells(table).map(cell => {
      const withinSpan = insertIndex >= cell.col && insertIndex <= cell.col + cell.colSpan - 1
      return {
        ...cell,
        col: cell.col >= insertIndex ? cell.col + 1 : cell.col,
        colSpan: cell.colSpan + (withinSpan ? 1 : 0)
      }
    })

    const newCols = table.cols + 1
    const newCells = buildCellsFromMasters(table.rows, newCols, masters)
    const newWidth = colWidth > 0 ? table.width + colWidth : table.width
    const columnWidths = insertFraction(columnFractions, insertIndex)

    updateWidget(table.id, {
      cells: newCells,
      cols: newCols,
      width: Math.max(newWidth, 20),
      columnBindings: updatedBindings,
      columnWidths
    })

    const rowStart = previousSelection ? previousSelection.startRow : 0
    const rowEnd = previousSelection ? previousSelection.endRow : table.rows - 1
    tableSelection.value = {
      startRow: Math.max(0, Math.min(rowStart, table.rows - 1)),
      endRow: Math.max(0, Math.min(rowEnd, table.rows - 1)),
      startCol: Math.min(insertIndex, newCols - 1),
      endCol: Math.min(insertIndex, newCols - 1)
    }
  }

  function deleteTableRow(rowIndex: number) {
    const table = getSelectedTable()
    if (!table || table.rows <= 1) return

    const selection = tableSelection.value
    const start = selection ? selection.startRow : rowIndex
    const end = selection ? selection.endRow : rowIndex
    const deleteStart = Math.max(0, Math.min(start, end))
    const deleteEnd = Math.min(table.rows - 1, Math.max(start, end))
    const removeCount = deleteEnd - deleteStart + 1
    if (table.rows - removeCount < 1) return

    const rowHeight = table.rows > 0 ? table.height / table.rows : 0

    const masters = extractMasterCells(table)
      .map(cell => {
        const overlap = countOverlap(cell.row, cell.row + cell.rowSpan - 1, deleteStart, deleteEnd)
        const rowSpan = cell.rowSpan - overlap
        if (rowSpan <= 0) {
          return null
        }
        const shift = countRemovedBefore(cell.row, deleteStart, deleteEnd)
        return {
          ...cell,
          row: cell.row - shift,
          rowSpan
        }
      })
      .filter((cell): cell is MasterCell => cell !== null)

    const rowFractions = getRowFractions(table)
    const newRows = table.rows - removeCount
    const newCells = buildCellsFromMasters(newRows, table.cols, masters)
    const newHeight = newRows > 0 ? table.height - rowHeight * removeCount : table.height
    const rowHeights = removeFractionRange(rowFractions, deleteStart, deleteEnd)

    updateWidget(table.id, {
      cells: newCells,
      rows: newRows,
      headerRows: Math.min(table.headerRows, newRows),
      height: Math.max(newHeight, 20),
      rowHeights
    })
    tableSelection.value = null
  }

  function deleteTableCol(colIndex: number) {
    const table = getSelectedTable()
    if (!table || table.cols <= 1) return

    const selection = tableSelection.value
    const start = selection ? selection.startCol : colIndex
    const end = selection ? selection.endCol : colIndex
    const deleteStart = Math.max(0, Math.min(start, end))
    const deleteEnd = Math.min(table.cols - 1, Math.max(start, end))
    const removeCount = deleteEnd - deleteStart + 1
    if (table.cols - removeCount < 1) return

    const colWidth = table.cols > 0 ? table.width / table.cols : 0

    const bindings = { ...(table.columnBindings || {}) }
    const updatedBindings: Record<number, string> = {}
    Object.keys(bindings).forEach(key => {
      const col = Number(key)
      if (col >= deleteStart && col <= deleteEnd) {
        return
      }
      const newCol = col > deleteEnd ? col - removeCount : col
      updatedBindings[newCol] = bindings[col]
    })

    const masters = extractMasterCells(table)
      .map(cell => {
        const overlap = countOverlap(cell.col, cell.col + cell.colSpan - 1, deleteStart, deleteEnd)
        const colSpan = cell.colSpan - overlap
        if (colSpan <= 0) {
          return null
        }
        const shift = countRemovedBefore(cell.col, deleteStart, deleteEnd)
        return {
          ...cell,
          col: cell.col - shift,
          colSpan
        }
      })
      .filter((cell): cell is MasterCell => cell !== null)

    const columnFractions = getColumnFractions(table)
    const newCols = table.cols - removeCount
    const newCells = buildCellsFromMasters(table.rows, newCols, masters)
    const newWidth = newCols > 0 ? table.width - colWidth * removeCount : table.width
    const columnWidths = removeFractionRange(columnFractions, deleteStart, deleteEnd)

    updateWidget(table.id, {
      cells: newCells,
      cols: newCols,
      width: Math.max(newWidth, 20),
      columnBindings: updatedBindings,
      columnWidths
    })
    tableSelection.value = null
  }

  return {
    widgets,
    selectedWidgetId,
    selectedWidget,
    paperSize,
    scale,
    globalForcePageBreak,
    batchPrint, // 批量打印配置
    clipboard,
    addWidget,
    updateWidget,
    deleteWidget,
    selectWidget,
    copyWidget,
    pasteWidget,
    bringToFront,
    sendToBack,
    undo,
    redo,
    setPaperSize,
    setScale,
    setGlobalForcePageBreak,
    setBatchPrint, // 设置批量打印配置
    resetBatchPrint, // 重置批量打印配置
    exportTemplate,
    importTemplate,
    loadWidgets,
    clearWidgets,
    snapLines,
    setSnapLines,
    clearSnapLines,
    tableSelection,
    setTableSelection,
    mergeTableCells,
    splitTableCells,
    insertTableRow,
    insertTableCol,
    deleteTableRow,
    deleteTableCol
  }
})
