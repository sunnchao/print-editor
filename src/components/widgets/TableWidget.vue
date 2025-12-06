<script setup lang="ts">
import { computed, ref, watch, inject, onBeforeUnmount, onMounted, nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { TableWidget } from '@/types'

const props = defineProps<{
  widget: TableWidget
}>()

const emit = defineEmits<{
  heightChange: [actualHeight: number]
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()
const renderMode = inject<'editor' | 'preview'>('renderMode', 'editor')
const isPreview = computed(() => renderMode === 'preview')

const MIN_COLUMN_PX = 20
const MIN_ROW_PX = 16

const isWidgetSelected = computed(() => editorStore.selectedWidgetId === props.widget.id)

const tableBorder = computed(() => {
  const width = props.widget.tableBorderWidth ?? props.widget.borderWidth ?? 1
  const color = props.widget.tableBorderColor ?? props.widget.borderColor ?? '#000000'
  const style = props.widget.tableBorderStyle ?? props.widget.borderStyle ?? 'solid'
  return { width, color, style }
})

const cellBorder = computed(() => {
  const width = props.widget.cellBorderWidth ?? props.widget.borderWidth ?? 1
  const color = props.widget.cellBorderColor ?? props.widget.borderColor ?? '#000000'
  const style = props.widget.cellBorderStyle ?? props.widget.borderStyle ?? 'solid'
  return { width, color, style }
})

const normalizedColumnWidths = computed(() => {
  if (props.widget.cols <= 0) return []
  const widths = props.widget.columnWidths?.length === props.widget.cols
    ? props.widget.columnWidths
    : Array(props.widget.cols).fill(1 / props.widget.cols)
  const total = widths.reduce((sum, val) => sum + val, 0)
  if (!total) {
    return Array(props.widget.cols).fill(1 / props.widget.cols)
  }
  return widths.map(val => val / total)
})

const normalizedRowHeights = computed(() => {
  if (props.widget.rows <= 0) return []
  const heights = props.widget.rowHeights?.length === props.widget.rows
    ? props.widget.rowHeights
    : Array(props.widget.rows).fill(1 / props.widget.rows)
  const total = heights.reduce((sum, val) => sum + val, 0)
  if (!total) {
    return Array(props.widget.rows).fill(1 / props.widget.rows)
  }
  return heights.map(val => val / total)
})

const columnHandlePositions = computed(() => {
  const positions: number[] = []
  let acc = 0
  normalizedColumnWidths.value.forEach((width, index, arr) => {
    if (index === arr.length - 1) return
    acc += width
    positions.push(acc)
  })
  return positions
})

const rowHandleConfigs = computed(() => {
  const configs: { position: number; topIndex: number; bottomIndex: number }[] = []
  const fractions = renderRowFractions.value
  let acc = 0
  for (let i = 0; i < fractions.length - 1; i++) {
    acc += fractions[i]
    configs.push({
      position: acc,
      topIndex: getActualRowIndex(i),
      bottomIndex: getActualRowIndex(i + 1)
    })
  }
  return configs
})

const editingCell = ref<{ renderRow: number; actualRow: number; col: number } | null>(null)
const editContent = ref('')
const isSelecting = ref(false)
const selectionStart = ref<{ row: number; col: number } | null>(null)
const isRowSelecting = ref(false)
const rowSelectionStart = ref<number | null>(null)
const isColSelecting = ref(false)
const colSelectionStart = ref<number | null>(null)

const columnBindings = computed(() => props.widget.columnBindings || {})
const tableMode = computed<"simple" | "complex" | "legacy">(() => props.widget.tableMode ?? "legacy")
const isSimpleTable = computed(() => tableMode.value === "simple")
const isComplexTable = computed(() => tableMode.value === "complex")
const hasColumnBindings = computed(() => Object.keys(columnBindings.value).length > 0)
const isAutoFillTable = computed(() => isComplexTable.value || hasColumnBindings.value)
const headerRowCount = computed(() => {
  if (isSimpleTable.value) return 0
  const rows = props.widget.rows
  const headerRows = props.widget.headerRows
  if (rows <= 0) return 0
  return Math.max(0, Math.min(headerRows, rows))
})
const isHeaderHidden = computed(() => !isComplexTable.value && props.widget.showHeader === false && headerRowCount.value > 0)

const columnResizeState = ref<{ index: number; startX: number; initialWidths: number[] } | null>(null)
const rowResizeState = ref<{ topIndex: number; bottomIndex: number; startY: number; initialHeights: number[] } | null>(null)
const defaultRowHeight = computed(() => (props.widget.rows > 0 ? 1 / props.widget.rows : 0))

const isSelected = computed(() => (row: number, col: number) => {
  if (editorStore.selectedWidgetId !== props.widget.id) return false
  if (!editorStore.tableSelection) return false
  const { startRow, startCol, endRow, endCol } = editorStore.tableSelection
  return row >= startRow && row <= endRow && col >= startCol && col <= endCol
})

const renderRows = computed(() => {
  let rows = isPreview.value ? buildPreviewRows() : props.widget.cells
  if (isHeaderHidden.value) {
    rows = rows.slice(headerRowCount.value)
  }
  return rows
})

const renderRowFractions = computed(() => {
  const fractions: number[] = []
  let total = 0
  renderRows.value.forEach((_row, renderIndex) => {
    const actualIndex = getActualRowIndex(renderIndex)
    const fraction = normalizedRowHeights.value[actualIndex] ?? defaultRowHeight.value
    fractions[renderIndex] = fraction
    total += fraction
  })
  if (!total) return fractions
  return fractions.map(value => value / total)
})

// 获取实际行索引（考虑表头是否隐藏）
const getActualRowIndex = (renderRowIndex: number): number => {
  if (isHeaderHidden.value) {
    return renderRowIndex + headerRowCount.value
  }
  return renderRowIndex
}

const isEditingCell = (renderRowIndex: number, colIndex: number) => {
  return (
    editingCell.value?.renderRow === renderRowIndex &&
    editingCell.value?.col === colIndex
  )
}

watch(
  () => editorStore.selectedWidgetId,
  (newId) => {
    if (
      !isPreview.value &&
      newId === props.widget.id &&
      !editorStore.tableSelection &&
      props.widget.rows > 0 &&
      props.widget.cols > 0
    ) {
      editorStore.setTableSelection({
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0
      })
    }
  }
)

function ensureWidgetSelected() {
  if (isPreview.value) return
  if (editorStore.selectedWidgetId !== props.widget.id) {
    editorStore.selectWidget(props.widget.id)
  }
}

function ensureCellSelection(row: number, col: number) {
  const selection = editorStore.tableSelection
  const alreadySelected = selection &&
    row >= selection.startRow && row <= selection.endRow &&
    col >= selection.startCol && col <= selection.endCol
  if (alreadySelected) return
  editorStore.setTableSelection({
    startRow: row,
    endRow: row,
    startCol: col,
    endCol: col
  })
}

function ensureRowSelection(row: number) {
  const selection = editorStore.tableSelection
  const fullWidth = selection && selection.startCol === 0 && selection.endCol === props.widget.cols - 1
  const alreadySelected = fullWidth && selection && row >= selection.startRow && row <= selection.endRow
  if (alreadySelected) return
  editorStore.setTableSelection({
    startRow: row,
    endRow: row,
    startCol: 0,
    endCol: props.widget.cols - 1
  })
}

function ensureColSelection(col: number) {
  const selection = editorStore.tableSelection
  const fullHeight = selection && selection.startRow === 0 && selection.endRow === props.widget.rows - 1
  const alreadySelected = fullHeight && selection && col >= selection.startCol && col <= selection.endCol
  if (alreadySelected) return
  editorStore.setTableSelection({
    startRow: 0,
    endRow: props.widget.rows - 1,
    startCol: col,
    endCol: col
  })
}

function getColumnBindingLength(binding: string): number {
  const data = dataSourceStore.getColumnData(binding)
  return data.length
}

function getClampedColumnValue(column: string, rowIndex: number): string {
  const data = dataSourceStore.getColumnData(column)
  if (!data.length) return ''
  const safeIndex = Math.min(Math.max(rowIndex, 0), data.length - 1)
  const value = data[safeIndex]
  if (value === undefined || value === null) return ''
  return String(value)
}

function getPreviewDataRowCount(): number {
  const bindings = columnBindings.value
  const bindingKeys = Object.keys(bindings)
  const bodyRowCount = Math.max(props.widget.rows - headerRowCount.value, 0)
  if (bindingKeys.length === 0) {
    return bodyRowCount
  }
  let maxLen = 0
  bindingKeys.forEach(key => {
    const len = getColumnBindingLength(bindings[Number(key)])
    if (len > maxLen) maxLen = len
  })
  if (!maxLen) {
    return bodyRowCount
  }
  return Math.max(maxLen, bodyRowCount)
}

function getPreferredBinding(colIndex: number, cell?: { dataSource?: string | null } | null) {
  if (cell?.dataSource) {
    return cell.dataSource
  }
  if (isSimpleTable.value) {
    return null
  }
  return columnBindings.value[colIndex] || null
}

function cloneCell(cell: any) {
  return {
    content: cell?.content ?? '',
    rowSpan: cell?.rowSpan,
    colSpan: cell?.colSpan,
    dataSource: cell?.dataSource,
    // 复制单元格样式属性
    fontSize: cell?.fontSize,
    fontFamily: cell?.fontFamily,
    fontWeight: cell?.fontWeight,
    color: cell?.color,
    textAlign: cell?.textAlign,
    backgroundColor: cell?.backgroundColor
  }
}

function buildPreviewRows() {
  const headerCount = headerRowCount.value
  const headerRows = props.widget.cells.slice(0, headerCount).map(row => row.map(cell => cloneCell(cell)))
  const bodyTemplate = props.widget.cells.slice(headerCount)
  const dataRowCount = getPreviewDataRowCount()

  if (Object.keys(columnBindings.value).length === 0 || dataRowCount <= 0) {
    return props.widget.cells
  }

  const templateRows = bodyTemplate.length > 0
    ? bodyTemplate
    : [Array(props.widget.cols).fill(null).map(() => cloneCell({}))]
  const previewBody: any[] = []
  for (let i = 0; i < dataRowCount; i++) {
    const templateRow = templateRows[i % templateRows.length]
    previewBody.push(templateRow.map(cell => cloneCell(cell)))
  }

  previewBody.forEach((row, dataIndex) => {
    row.forEach((cell: any, colIndex: number) => {
      const bindingKey = getPreferredBinding(colIndex, cell)
      if (bindingKey) {
        const value = getClampedColumnValue(bindingKey, dataIndex)
        cell.content = value
      }
    })
  })

  return [...headerRows, ...previewBody]
}

function getCellDisplayValue(renderRowIndex: number, col: number, cell: any) {
  if (!cell) return ""
  const actualRowIndex = getActualRowIndex(renderRowIndex)
  const isBodyRow = actualRowIndex >= headerRowCount.value
  const isHeaderRow = !isBodyRow
  const bindingKey = getPreferredBinding(col, cell)

  if (isPreview.value) {
    // 预览模式：表头显示原始内容，数据区显示绑定的值
    if (isHeaderRow) {
      return cell.content
    }
    if (!bindingKey) {
      return cell.content
    }
    const headerOffset = isHeaderHidden.value ? 0 : headerRowCount.value
    const dataRowIndex = Math.max(renderRowIndex - headerOffset, 0)
    if (isSimpleTable.value) {
      return getClampedColumnValue(bindingKey, 0)
    }
    if (isAutoFillTable.value) {
      return getClampedColumnValue(bindingKey, dataRowIndex)
    }
    return getClampedColumnValue(bindingKey, 0)
  }

  // 编辑模式
  if (isComplexTable.value && isBodyRow && bindingKey) {
    return "自动填充"
  }
  if (bindingKey && !isComplexTable.value) {
    return null
  }
  return cell.content
}

function getCellBindingKey(renderRowIndex: number, col: number, cell: any) {
  if (!cell) return null
  const actualRowIndex = getActualRowIndex(renderRowIndex)
  const isBodyRow = actualRowIndex >= headerRowCount.value
  const bindingKey = getPreferredBinding(col, cell)

  // 编辑模式下显示绑定标签
  if (!isPreview.value && bindingKey) {
    // 复杂表格：只在数据区显示绑定标签
    if (isComplexTable.value && isBodyRow) {
      return bindingKey
    }
    // 非复杂表格：非自动填充的单元格显示绑定标签
    if (!isComplexTable.value && !(isAutoFillTable.value && isBodyRow)) {
      return bindingKey
    }
  }
  return null
}

const tableStyle = computed(() => ({
  width: '100%',
  height: '100%',
  borderCollapse: 'collapse' as const,
  tableLayout: 'fixed' as const,
  border: `${tableBorder.value.width}px ${tableBorder.value.style} ${tableBorder.value.color}`
}))

const cellStyle = computed(() => (renderRowIndex: number, colIndex: number) => {
  const actualRowIndex = getActualRowIndex(renderRowIndex)
  const selected = !isPreview.value && isSelected.value(actualRowIndex, colIndex)
  const isHeaderRow = actualRowIndex < headerRowCount.value
  const border = cellBorder.value

  // 获取单元格数据
  // 在预览模式下，从 renderRows 获取单元格数据（包含循环生成的行）
  // 在编辑模式下，从 props.widget.cells 获取原始数据
  const cell = isPreview.value
    ? renderRows.value[renderRowIndex]?.[colIndex]
    : props.widget.cells[actualRowIndex]?.[colIndex]

  // 基础样式
  const baseStyle: any = {
    border: `${border.width}px ${border.style} ${border.color}`,
    padding: '4px 8px',
    outline: selected ? '1px solid #1890ff' : 'none',
    cursor: 'cell'
  }

  // 应用单元格自定义样式
  if (cell) {
    baseStyle.fontSize = cell.fontSize ? `${cell.fontSize}px` : '12px'
    baseStyle.fontFamily = cell.fontFamily || 'Arial'
    baseStyle.fontWeight = cell.fontWeight || (isHeaderRow ? 'bold' : 'normal')
    baseStyle.color = cell.color || '#000000'
    baseStyle.textAlign = cell.textAlign || 'left'
    baseStyle.backgroundColor = selected
      ? '#e6f7ff'
      : (cell.backgroundColor || (isHeaderRow ? '#f5f5f5' : 'transparent'))
  } else {
    // 默认样式
    baseStyle.fontSize = '12px'
    baseStyle.fontWeight = isHeaderRow ? 'bold' : 'normal'
    baseStyle.backgroundColor = selected ? '#e6f7ff' : (isHeaderRow ? '#f5f5f5' : 'transparent')
  }

  return baseStyle
})

function onMouseDown(event: MouseEvent, renderRow: number, col: number) {
  if (isPreview.value || event.button !== 0) return
  const row = getActualRowIndex(renderRow)
  ensureWidgetSelected()
  isSelecting.value = true
  selectionStart.value = { row, col }
  isRowSelecting.value = false
  isColSelecting.value = false
  editorStore.setTableSelection({
    startRow: row,
    startCol: col,
    endRow: row,
    endCol: col
  })
}

function normalizeFractions(values: number[]) {
  const total = values.reduce((sum, val) => sum + val, 0)
  if (!total) {
    const length = values.length
    return length > 0 ? Array(length).fill(1 / length) : values
  }
  return values.map(val => val / total)
}

function updateColumnWidths(widths: number[]) {
  const normalized = normalizeFractions(widths)
  editorStore.updateWidget(props.widget.id, { columnWidths: normalized })
}

function updateRowHeights(heights: number[]) {
  const normalized = normalizeFractions(heights)
  editorStore.updateWidget(props.widget.id, { rowHeights: normalized })
}

function startColumnResize(index: number, event: MouseEvent) {
  if (isPreview.value) return
  ensureWidgetSelected()
  columnResizeState.value = {
    index,
    startX: event.clientX,
    initialWidths: [...normalizedColumnWidths.value]
  }
  window.addEventListener('mousemove', onColumnResize)
  window.addEventListener('mouseup', stopColumnResize)
}

function onColumnResize(event: MouseEvent) {
  const state = columnResizeState.value
  if (!state) return
  const tableWidth = props.widget.width
  if (tableWidth <= 0) return
  const scale = editorStore.scale
  let deltaRatio = (event.clientX - state.startX) / scale / tableWidth
  const widths = [...state.initialWidths]
  const leftIndex = state.index
  const rightIndex = state.index + 1
  if (rightIndex >= widths.length) return
  const minRatio = tableWidth > 0 ? MIN_COLUMN_PX / tableWidth : 0
  const maxIncrease = widths[rightIndex] - minRatio
  const maxDecrease = widths[leftIndex] - minRatio
  deltaRatio = Math.min(deltaRatio, maxIncrease)
  deltaRatio = Math.max(deltaRatio, -maxDecrease)
  widths[leftIndex] = widths[leftIndex] + deltaRatio
  widths[rightIndex] = widths[rightIndex] - deltaRatio
  updateColumnWidths(widths)
}

function stopColumnResize() {
  columnResizeState.value = null
  window.removeEventListener('mousemove', onColumnResize)
  window.removeEventListener('mouseup', stopColumnResize)
}

function startRowResize(boundary: { topIndex: number; bottomIndex: number }, event: MouseEvent) {
  if (isPreview.value) return
  ensureWidgetSelected()
  rowResizeState.value = {
    topIndex: boundary.topIndex,
    bottomIndex: boundary.bottomIndex,
    startY: event.clientY,
    initialHeights: [...normalizedRowHeights.value]
  }
  window.addEventListener('mousemove', onRowResize)
  window.addEventListener('mouseup', stopRowResize)
}

function onRowResize(event: MouseEvent) {
  const state = rowResizeState.value
  if (!state) return
  const tableHeight = props.widget.height
  if (tableHeight <= 0) return
  const scale = editorStore.scale
  let deltaRatio = (event.clientY - state.startY) / scale / tableHeight
  const heights = [...state.initialHeights]
  const topIndex = state.topIndex
  const bottomIndex = state.bottomIndex
  if (bottomIndex >= heights.length || topIndex < 0) return
  const minRatio = tableHeight > 0 ? MIN_ROW_PX / tableHeight : 0
  const maxIncrease = heights[bottomIndex] - minRatio
  const maxDecrease = heights[topIndex] - minRatio
  deltaRatio = Math.min(deltaRatio, maxIncrease)
  deltaRatio = Math.max(deltaRatio, -maxDecrease)
  heights[topIndex] = heights[topIndex] + deltaRatio
  heights[bottomIndex] = heights[bottomIndex] - deltaRatio
  updateRowHeights(heights)
}

function stopRowResize() {
  rowResizeState.value = null
  window.removeEventListener('mousemove', onRowResize)
  window.removeEventListener('mouseup', stopRowResize)
}

onBeforeUnmount(() => {
  stopColumnResize()
  stopRowResize()
})

// 计算预览模式下复杂表格的实际高度
const actualHeight = computed(() => {
  if (!isPreview.value || !isComplexTable.value) {
    return props.widget.height
  }

  // 复杂表格在预览模式下，根据实际渲染的行数计算高度
  const originalRows = props.widget.rows
  const renderRowCount = renderRows.value.length

  if (originalRows <= 0 || renderRowCount <= 0) {
    return props.widget.height
  }

  // 计算实际高度：根据渲染行数与原始行数的比例
  return props.widget.height * (renderRowCount / originalRows)
})

// 监听高度变化并通知父组件
watch(actualHeight, (newHeight: number) => {
  if (isPreview.value && isComplexTable.value) {
    emit('heightChange', newHeight)
  }
}, { immediate: true })

function onMouseEnter(renderRow: number, col: number) {
  if (isPreview.value || !isSelecting.value || !selectionStart.value) return
  const row = getActualRowIndex(renderRow)
  
  const startRow = Math.min(selectionStart.value.row, row)
  const startCol = Math.min(selectionStart.value.col, col)
  const endRow = Math.max(selectionStart.value.row, row)
  const endCol = Math.max(selectionStart.value.col, col)
  
  editorStore.setTableSelection({
    startRow,
    startCol,
    endRow,
    endCol
  })
}

function onMouseUp() {
  isSelecting.value = false
  isRowSelecting.value = false
  isColSelecting.value = false
  selectionStart.value = null
  rowSelectionStart.value = null
  colSelectionStart.value = null
}

function onRowHeaderMouseDown(event: MouseEvent, renderRow: number) {
  if (isPreview.value || event.button !== 0) return
  const row = getActualRowIndex(renderRow)
  ensureWidgetSelected()
  isRowSelecting.value = true
  rowSelectionStart.value = row
  editorStore.setTableSelection({
    startRow: row,
    endRow: row,
    startCol: 0,
    endCol: props.widget.cols - 1
  })
}

function onRowHeaderMouseEnter(renderRow: number) {
  if (isPreview.value || !isRowSelecting.value || rowSelectionStart.value === null) return
  const row = getActualRowIndex(renderRow)
  const startRow = Math.min(rowSelectionStart.value, row)
  const endRow = Math.max(rowSelectionStart.value, row)
  editorStore.setTableSelection({
    startRow,
    endRow,
    startCol: 0,
    endCol: props.widget.cols - 1
  })
}

function onColHeaderMouseDown(event: MouseEvent, col: number) {
  if (isPreview.value || event.button !== 0) return
  ensureWidgetSelected()
  isColSelecting.value = true
  colSelectionStart.value = col
  editorStore.setTableSelection({
    startRow: 0,
    endRow: props.widget.rows - 1,
    startCol: col,
    endCol: col
  })
}

function onColHeaderMouseEnter(col: number) {
  if (isPreview.value || !isColSelecting.value || colSelectionStart.value === null) return
  const startCol = Math.min(colSelectionStart.value, col)
  const endCol = Math.max(colSelectionStart.value, col)
  editorStore.setTableSelection({
    startRow: 0,
    endRow: props.widget.rows - 1,
    startCol,
    endCol
  })
}

function onCellContextMenu(renderRow: number, col: number) {
  if (isPreview.value) return
  const row = getActualRowIndex(renderRow)
  ensureWidgetSelected()
  ensureCellSelection(row, col)
}

function onRowHeaderContextMenu(renderRow: number) {
  if (isPreview.value) return
  const row = getActualRowIndex(renderRow)
  ensureWidgetSelected()
  ensureRowSelection(row)
}

function onColHeaderContextMenu(col: number) {
  if (isPreview.value) return
  ensureWidgetSelected()
  ensureColSelection(col)
}

function getRowHeightPercent(renderRowIndex: number) {
  return (renderRowFractions.value[renderRowIndex] ?? defaultRowHeight.value) * 100
}

function onCellDoubleClick(renderRow: number, col: number) {
  if (isPreview.value) return
  const row = getActualRowIndex(renderRow)
  if (isAutoFillTable.value && row >= headerRowCount.value) {
    return
  }
  editingCell.value = { renderRow, actualRow: row, col }
  editContent.value = props.widget.cells[row][col].content
}

function onCellBlur() {
  if (!isPreview.value && editingCell.value) {
    const { actualRow, col } = editingCell.value
    const newCells = JSON.parse(JSON.stringify(props.widget.cells))
    newCells[actualRow][col].content = editContent.value
    editorStore.updateWidget(props.widget.id, { cells: newCells })
    editingCell.value = null
  }
}

function shouldRenderCell(renderRow: number, col: number): boolean {
  const rows = renderRows.value
  for (let r = 0; r < renderRow; r++) {
    const prevCell = rows[r]?.[col]
    if (prevCell.rowSpan && r + prevCell.rowSpan > renderRow) {
      return false
    }
  }
  for (let c = 0; c < col; c++) {
    const prevCell = rows[renderRow]?.[c]
    if (prevCell.colSpan && c + prevCell.colSpan > col) {
      return false
    }
  }
  return true
}
</script>

<template>
  <div class="table-container" @mouseup="onMouseUp" @mouseleave="onMouseUp">
    <div
      v-if="!isPreview"
      class="table-drag-handle"
      title="拖动表格"
      @mousedown="ensureWidgetSelected()"
    ></div>
    <!-- 列头 (用于选择列) -->
    <div class="col-headers" v-if="!isPreview && editorStore.selectedWidgetId === widget.id">
      <div
        v-for="(width, col) in normalizedColumnWidths"
        :key="col"
        class="col-header"
        :style="{ width: `${width * 100}%` }"
        @mousedown.stop="onColHeaderMouseDown($event, col)"
        @mouseenter="onColHeaderMouseEnter(col)"
        @contextmenu="onColHeaderContextMenu(col)"
      ></div>
    </div>
    
    <div class="table-body-wrapper">
      <!-- 行头 (用于选择行) -->
      <div class="row-headers" v-if="!isPreview && editorStore.selectedWidgetId === widget.id">
        <div
        v-for="(height, row) in normalizedRowHeights"
        :key="row"
        class="row-header"
        :style="{ height: `${height * 100}%` }"
        @mousedown.stop="onRowHeaderMouseDown($event, row)"
        @mouseenter="onRowHeaderMouseEnter(row)"
        @contextmenu="onRowHeaderContextMenu(row)"
      ></div>
    </div>
      <div class="table-content">
        <table :style="tableStyle">
          <colgroup>
            <col
              v-for="(width, colIndex) in normalizedColumnWidths"
              :key="colIndex"
              :style="{ width: `${width * 100}%` }"
            />
          </colgroup>
          <tbody>
            <tr
              v-for="(row, rowIndex) in renderRows"
              :key="rowIndex"
              :style="{ height: `${getRowHeightPercent(rowIndex)}%` }"
            >
              <template v-for="(cell, colIndex) in row" :key="colIndex">
                <td
                  v-if="shouldRenderCell(rowIndex, colIndex)"
                  :style="cellStyle(rowIndex, colIndex)"
                  :rowspan="cell.rowSpan || 1"
                  :colspan="cell.colSpan || 1"
                  @mousedown.stop="isPreview ? null : onMouseDown($event, rowIndex, colIndex)"
                  @mouseenter="isPreview ? null : onMouseEnter(rowIndex, colIndex)"
                  @dblclick.stop="isPreview ? null : onCellDoubleClick(rowIndex, colIndex)"
                  @contextmenu="isPreview ? null : onCellContextMenu(rowIndex, colIndex)"
                >
                  <span
                    v-if="getCellBindingKey(rowIndex, colIndex, cell)"
                    class="cell-binding-tag"
                  >
                    [绑定:{{ getCellBindingKey(rowIndex, colIndex, cell) }}]
                  </span>
                  <span
                    v-else
                    class="cell-text"
                    :class="{ 'cell-text--editing': isEditingCell(rowIndex, colIndex) }"
                  >
                    {{ getCellDisplayValue(rowIndex, colIndex, cell) }}
                  </span>
                  <input
                    v-if="isEditingCell(rowIndex, colIndex)"
                    v-model="editContent"
                    class="cell-input"
                    autofocus
                    @blur="onCellBlur"
                    @keydown.enter.prevent="onCellBlur"
                    @keydown.stop
                  />
                </td>
              </template>
            </tr>
          </tbody>
        </table>

        <div
          v-if="!isPreview && isWidgetSelected && columnHandlePositions.length > 0"
          class="col-resize-handles"
        >
          <div
            v-for="(position, index) in columnHandlePositions"
            :key="`col-handle-${index}`"
            class="col-resize-handle"
            :style="{ left: `${position * 100}%` }"
            @mousedown.stop="startColumnResize(index, $event)"
          ></div>
        </div>

        <div
          v-if="!isPreview && isWidgetSelected && rowHandleConfigs.length > 0"
          class="row-resize-handles"
        >
          <div
            v-for="(config, index) in rowHandleConfigs"
            :key="`row-handle-${index}`"
            class="row-resize-handle"
            :style="{ top: `${config.position * 100}%` }"
            @mousedown.stop="startRowResize(config, $event)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

.cell-text {
  display: inline-block;
  width: 100%;
  overflow: hidden;
  text-overflow: inherit;
  white-space: inherit;
}

.cell-text--editing {
  visibility: hidden;
}

.cell-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  line-height: inherit;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

td {
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: none;
  position: relative;
}

.table-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.table-drag-handle {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 32px;
  height: 18px;
  border-radius: 4px;
  background: rgba(24, 144, 255, 0.18);
  color: #1890ff;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  z-index: 20;
  pointer-events: auto;
}

.table-drag-handle::before {
  content: '';
  position: absolute;
  inset: 2px;
  border: 1px dashed rgba(24, 144, 255, 0.6);
  border-radius: 4px;
}

.table-drag-handle::after {
  content: '拖动';
  position: relative;
  font-weight: 600;
}

.table-body-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
}

.table-content {
  position: relative;
  flex: 1;
  height: 100%;
}

.col-headers {
  display: flex;
  position: absolute;
  top: -15px;
  left: 0;
  width: 100%;
  height: 15px;
  z-index: 10;
}

.col-header {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  cursor: pointer;
}

.col-header:hover {
  background: #1890ff;
}

.row-headers {
  display: flex;
  flex-direction: column;
  position: absolute;
  left: -15px;
  top: 0;
  width: 15px;
  height: 100%;
  z-index: 10;
}

.row-header {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  cursor: pointer;
}

.row-header:hover {
  background: #1890ff;
}

.cell-binding-tag {
  display: inline-block;
  padding: 0 4px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 2px;
  color: #1890ff;
  font-size: 12px;
  line-height: 1.5;
}

.col-resize-handles,
.row-resize-handles {
  position: absolute;
  pointer-events: none;
  inset: 0;
}

.col-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  margin-left: -3px;
  cursor: col-resize;
  pointer-events: auto;
  z-index: 5;
}

.row-resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  height: 6px;
  margin-top: -3px;
  cursor: row-resize;
  pointer-events: auto;
  z-index: 5;
}

.col-resize-handle::after,
.row-resize-handle::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(24, 144, 255, 0.2);
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.col-resize-handle:hover::after,
.row-resize-handle:hover::after {
  opacity: 1;
}
</style>
