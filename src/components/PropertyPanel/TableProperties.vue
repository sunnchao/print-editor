<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { TableWidget, TableCell } from '@/types'
import { cloneDeep } from 'lodash-es'

const props = defineProps<{
  widget: TableWidget
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()

const borderStyleOptions = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
]

const fontFamilyOptions = [
  { label: 'Arial', value: 'Arial' },
  { label: '宋体', value: '宋体' },
  { label: '微软雅黑', value: '微软雅黑' },
  { label: 'Helvetica', value: 'Helvetica' }
]

const fontWeightOptions = [
  { label: '正常', value: 'normal' },
  { label: '粗体', value: 'bold' }
]

const textAlignOptions = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' }
]

const tableMode = computed(() => props.widget.tableMode ?? 'legacy')
const isSimpleMode = computed(() => tableMode.value === 'simple')
const isComplexMode = computed(() => tableMode.value === 'complex')
const hasColumnBindings = computed(() => Object.keys(props.widget.columnBindings || {}).length > 0)
const isAutoFillMode = computed(() => isComplexMode.value || hasColumnBindings.value)
const modeLabel = computed(() => {
  if (isSimpleMode.value) return '简单表格'
  if (isComplexMode.value) return '复杂表格'
  return '旧版表格'
})
const effectiveHeaderRows = computed(() => props.widget.headerRows ?? 0)
const bodyRowCount = computed(() => {
  const rows = props.widget.rows
  return Math.max(rows - effectiveHeaderRows.value, 0)
})


function getClampedPreviewValue(column: string, rowIndex: number): string {
  const data = dataSourceStore.getColumnData(column)
  if (!data.length) return ''
  const safeIndex = Math.min(Math.max(rowIndex, 0), data.length - 1)
  const value = data[safeIndex]
  if (value === undefined || value === null) return ''
  return String(value)
}

function createUniformArray(length: number) {
  if (length <= 0) return []
  const value = 1 / length
  return Array(length).fill(value)
}

function normalizeFractions(values: number[], length: number) {
  if (length <= 0) return []
  if (values.length !== length) {
    return createUniformArray(length)
  }
  const total = values.reduce((sum, val) => sum + val, 0)
  if (!total) {
    return createUniformArray(length)
  }
  return values.map(val => val / total)
}

function resizeFractions(values: number[], targetLength: number) {
  if (targetLength <= 0) return []
  if (values.length === 0) {
    return createUniformArray(targetLength)
  }
  const normalized = normalizeFractions(values, values.length)
  if (targetLength === normalized.length) {
    return normalized
  }
  if (targetLength < normalized.length) {
    const truncated = normalized.slice(0, targetLength)
    const leftover = normalized.slice(targetLength).reduce((sum, val) => sum + val, 0)
    if (truncated.length === 0) {
      return createUniformArray(targetLength)
    }
    truncated[truncated.length - 1] = (truncated[truncated.length - 1] ?? 0) + leftover
    return normalizeFractions(truncated, truncated.length)
  }
  const result = [...normalized]
  const extraCount = targetLength - normalized.length
  for (let i = 0; i < extraCount; i++) {
    result.push(1 / targetLength)
  }
  return normalizeFractions(result, result.length)
}

const tableSelection = computed(() => editorStore.tableSelection)
const selectionSummary = computed(() => {
  if (!tableSelection.value) return '未选择单元格'
  const { startRow, endRow, startCol, endCol } = tableSelection.value
  const row = startRow === endRow ? `第 ${startRow + 1} 行` : `第 ${startRow + 1}-${endRow + 1} 行`
  const col = startCol === endCol ? `第 ${startCol + 1} 列` : `第 ${startCol + 1}-${endCol + 1} 列`
  return `${row} · ${col}`
})

const activeCell = computed<TableCell | null>(() => {
  if (!tableSelection.value) return null
  const { startRow, startCol } = tableSelection.value
  return props.widget.cells[startRow]?.[startCol] || null
})

const selectedColumnIndex = computed(() => tableSelection.value ? tableSelection.value.startCol : null)
const isHeaderSelection = computed(() => {
  if (!tableSelection.value) return false
  return tableSelection.value.startRow < effectiveHeaderRows.value
})
const isAutoFillCell = computed(() => {
  if (!tableSelection.value) return false
  return isAutoFillMode.value && tableSelection.value.startRow >= effectiveHeaderRows.value
})

const columnBindingValue = computed(() => {
  if (selectedColumnIndex.value === null) return null
  return props.widget.columnBindings?.[selectedColumnIndex.value] || null
})

const activeCellDataPreview = computed(() => {
  if (!tableSelection.value) return ''

  const cellBinding = activeCell.value?.dataSource
  if (cellBinding) {
    // 简单表格：始终以索引 0 作为示例行，避免因行号增加取不到值
    const value = getClampedPreviewValue(cellBinding, 0)
    return value !== '' ? value : `[${cellBinding}]`
  }

  const columnBinding = columnBindingValue.value
  if (columnBinding) {
    const value = getClampedPreviewValue(columnBinding, 0)
    return value !== '' ? value : `[${columnBinding}]`
  }

  return ''
})

const selectedRowCount = computed(() => {
  if (!tableSelection.value) return 0
  return tableSelection.value.endRow - tableSelection.value.startRow + 1
})

const selectedColCount = computed(() => {
  if (!tableSelection.value) return 0
  return tableSelection.value.endCol - tableSelection.value.startCol + 1
})

const canMerge = computed(() => {
  if (isComplexMode.value) return false  // 复杂表格不支持合并
  if (!tableSelection.value) return false
  const { startRow, endRow, startCol, endCol } = tableSelection.value
  return startRow !== endRow || startCol !== endCol
})

const canSplit = computed(() => {
  if (isComplexMode.value) return false  // 复杂表格不支持拆分
  if (!tableSelection.value) return false
  const { startRow, endRow, startCol, endCol } = tableSelection.value
  if (startRow !== endRow || startCol !== endCol) return false
  const cell = props.widget.cells[startRow][startCol]
  return (cell.rowSpan || 1) > 1 || (cell.colSpan || 1) > 1
})

const canDeleteRow = computed(() => {
  if (!tableSelection.value) return false
  return props.widget.rows - selectedRowCount.value >= 1
})

const canDeleteCol = computed(() => {
  if (!tableSelection.value) return false
  return props.widget.cols - selectedColCount.value >= 1
})

function update(key: keyof TableWidget, value: any) {
  editorStore.updateWidget(props.widget.id, { [key]: value })
}

function updateWidgetFields(payload: Partial<TableWidget>) {
  editorStore.updateWidget(props.widget.id, payload)
}

/**
 * 处理表头行数变化
 * 当增加表头行数时，在表格顶部插入新的表头行
 * 当减少表头行数时，从表格顶部删除表头行
 */
function handleHeaderRowsChange(newHeaderRows: number) {
  const currentHeaderRows = effectiveHeaderRows.value
  const diff = newHeaderRows - currentHeaderRows
  
  if (diff === 0) return
  
  const oldCells = props.widget.cells
  const cols = props.widget.cols
  let newCells: typeof oldCells
  let newTotalRows: number
  let newRowHeights: number[]
  
  const currentRowHeights = normalizeFractions(props.widget.rowHeights || [], props.widget.rows)
  
  if (diff > 0) {
    // 增加表头行：在顶部插入新行
    const newRows = Array(diff).fill(null).map(() =>
      Array(cols).fill(null).map((_, colIndex) => ({
        content: `表头${colIndex + 1}`,
        rowSpan: 1,
        colSpan: 1
      }))
    )
    newCells = [...newRows, ...oldCells]
    newTotalRows = props.widget.rows + diff
    
    // 为新增的行分配行高（均匀分配）
    const newRowFraction = 1 / newTotalRows
    const newHeights = Array(diff).fill(newRowFraction)
    // 重新归一化现有行高
    const existingHeights = currentRowHeights.map(h => h * (1 - diff * newRowFraction))
    newRowHeights = resizeFractions([...newHeights, ...existingHeights], newTotalRows)
  } else {
    // 减少表头行：从顶部删除行
    const rowsToRemove = Math.abs(diff)
    newCells = oldCells.slice(rowsToRemove)
    newTotalRows = props.widget.rows - rowsToRemove
    
    // 重新归一化剩余行高
    newRowHeights = resizeFractions(currentRowHeights.slice(rowsToRemove), newTotalRows)
  }
  
  editorStore.updateWidget(props.widget.id, {
    headerRows: newHeaderRows,
    rows: newTotalRows,
    cells: newCells,
    rowHeights: newRowHeights
  })
}

function updateTableBorderField(key: 'tableBorderWidth' | 'tableBorderColor' | 'tableBorderStyle', value: any) {
  updateWidgetFields({ [key]: value })
}

function handleTableBorderWidthChange(value: number | null) {
  updateTableBorderField('tableBorderWidth', typeof value === 'number' ? value : 0)
}

function handleTableBorderStyleChange(value: 'solid' | 'dashed' | 'dotted') {
  updateTableBorderField('tableBorderStyle', value)
}

function updateRowsCols(bodyRows: number, cols: number) {
  if (isComplexMode.value) return
  const headerCount = effectiveHeaderRows.value
  const normalizedBodyRows = Math.max(0, bodyRows)
  const totalRows = normalizedBodyRows + headerCount
  const oldCells = props.widget.cells
  const newCells = Array(totalRows).fill(null).map((_, rowIndex) =>
    Array(cols).fill(null).map((_, colIndex) => {
      if (oldCells[rowIndex]?.[colIndex]) {
        return oldCells[rowIndex][colIndex]
      }
      return { content: '', rowSpan: 1, colSpan: 1 }
    })
  )
  const bindings = { ...(props.widget.columnBindings || {}) }
  Object.keys(bindings).forEach(key => {
    const colIndex = Number(key)
    if (colIndex >= cols) {
      delete bindings[colIndex]
    }
  })
  const currentColumnFractions = normalizeFractions(props.widget.columnWidths || [], props.widget.cols)
  const currentRowFractions = normalizeFractions(props.widget.rowHeights || [], props.widget.rows)
  const columnWidths = resizeFractions(currentColumnFractions, cols)
  const rowHeights = resizeFractions(currentRowFractions, totalRows)
  editorStore.updateWidget(props.widget.id, {
    rows: totalRows,
    cols,
    cells: newCells,
    columnBindings: bindings,
    columnWidths,
    rowHeights
  })
}

function handleMerge() {
  if (!canMerge.value) return
  editorStore.mergeTableCells()
}

function handleSplit() {
  if (!canSplit.value) return
  editorStore.splitTableCells()
}

function handleInsertRow(position: 'before' | 'after') {
  if (isComplexMode.value) return
  let targetRow: number
  if (tableSelection.value) {
    targetRow = position === 'before' ? tableSelection.value.startRow : tableSelection.value.endRow
  } else {
    targetRow = position === 'before' ? 0 : props.widget.rows - 1
  }
  editorStore.insertTableRow(targetRow, position)
}

function handleInsertCol(position: 'before' | 'after') {
  let targetCol: number
  if (tableSelection.value) {
    targetCol = position === 'before' ? tableSelection.value.startCol : tableSelection.value.endCol
  } else {
    targetCol = position === 'before' ? 0 : props.widget.cols - 1
  }
  editorStore.insertTableCol(targetCol, position)
}

function handleDeleteRow() {
  if (!tableSelection.value || !canDeleteRow.value) return
  editorStore.deleteTableRow(tableSelection.value.startRow)
}

function handleDeleteCol() {
  if (!tableSelection.value || !canDeleteCol.value) return
  editorStore.deleteTableCol(tableSelection.value.startCol)
}

function updateActiveCell(updates: Partial<TableCell>) {
  if (!tableSelection.value) return
  const { startRow, startCol } = tableSelection.value
  const newCells = cloneDeep(props.widget.cells)
  newCells[startRow][startCol] = {
    ...newCells[startRow][startCol],
    ...updates
  }
  editorStore.updateWidget(props.widget.id, { cells: newCells })
}

function handleCellContentChange(value: string) {
  if (isAutoFillCell.value) return
  updateActiveCell({ content: value })
}

function handleCellDataSourceChange(value: string | null) {
  if (isAutoFillCell.value && !isSimpleMode.value) return
  if (value) {
    updateActiveCell({ dataSource: value })
  } else {
    updateActiveCell({ dataSource: undefined })
  }
}

function handleColumnBindingChange(value: string | null) {
  if (!isHeaderSelection.value || selectedColumnIndex.value === null) return
  const bindings = { ...(props.widget.columnBindings || {}) }
  if (value) {
    bindings[selectedColumnIndex.value] = value
  } else {
    delete bindings[selectedColumnIndex.value]
  }
  editorStore.updateWidget(props.widget.id, { columnBindings: bindings })
}

function updateCellStyle(styleUpdates: Partial<TableCell>) {
  if (!tableSelection.value) return
  const { startRow, endRow, startCol, endCol } = tableSelection.value
  const newCells = cloneDeep(props.widget.cells)

  // 更新选中区域的所有单元格样式
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      if (newCells[row] && newCells[row][col]) {
        newCells[row][col] = {
          ...newCells[row][col],
          ...styleUpdates
        }
      }
    }
  }

  editorStore.updateWidget(props.widget.id, { cells: newCells })
}

// 处理颜色输入变化的辅助函数
function handleCellColorChange(e: Event) {
  const value = (e.target as HTMLInputElement)?.value
  if (value !== undefined) {
    updateCellStyle({ color: value })
  }
}

function handleCellBgColorChange(e: Event) {
  const value = (e.target as HTMLInputElement)?.value
  if (value !== undefined) {
    updateCellStyle({ backgroundColor: value })
  }
}

// 更新表格四边边框
type TableBorderSide = 'tableBorderTop' | 'tableBorderRight' | 'tableBorderBottom' | 'tableBorderLeft'
function updateTableSideBorder(side: TableBorderSide, updates: Partial<{ width: number; color: string; style: 'solid' | 'dashed' | 'dotted' | 'none' }>) {
  const current = props.widget[side] || { width: 1, color: '#000000', style: 'solid' }
  editorStore.updateWidget(props.widget.id, {
    [side]: { ...current, ...updates }
  })
}

// 获取表格边框样式
function getTableBorderStyle(side: TableBorderSide) {
  return props.widget[side]?.style || 'solid'
}

function getTableBorderWidth(side: TableBorderSide) {
  return props.widget[side]?.width ?? (props.widget.tableBorderWidth ?? props.widget.borderWidth ?? 1)
}

function getTableBorderColor(side: TableBorderSide) {
  return props.widget[side]?.color ?? (props.widget.tableBorderColor ?? props.widget.borderColor ?? '#000000')
}

// 更新单元格边框
type CellBorderSide = 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft'
function updateCellSideBorder(side: CellBorderSide, updates: Partial<{ width: number; color: string; style: 'solid' | 'dashed' | 'dotted' | 'none' }>) {
  if (!tableSelection.value) return
  const { startRow, endRow, startCol, endCol } = tableSelection.value
  const newCells = cloneDeep(props.widget.cells)
  
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      if (newCells[row] && newCells[row][col]) {
        const current = newCells[row][col][side] || { width: 1, color: '#000000', style: 'solid' }
        newCells[row][col][side] = { ...current, ...updates }
      }
    }
  }
  
  editorStore.updateWidget(props.widget.id, { cells: newCells })
}

// 单元格边框样式计算属性（响应式）
const cellBorderTop = computed(() => ({
  style: activeCell.value?.borderTop?.style || 'solid',
  width: activeCell.value?.borderTop?.width ?? (props.widget.cellBorderWidth ?? props.widget.borderWidth ?? 1),
  color: activeCell.value?.borderTop?.color ?? (props.widget.cellBorderColor ?? props.widget.borderColor ?? '#000000')
}))

const cellBorderRight = computed(() => ({
  style: activeCell.value?.borderRight?.style || 'solid',
  width: activeCell.value?.borderRight?.width ?? (props.widget.cellBorderWidth ?? props.widget.borderWidth ?? 1),
  color: activeCell.value?.borderRight?.color ?? (props.widget.cellBorderColor ?? props.widget.borderColor ?? '#000000')
}))

const cellBorderBottom = computed(() => ({
  style: activeCell.value?.borderBottom?.style || 'solid',
  width: activeCell.value?.borderBottom?.width ?? (props.widget.cellBorderWidth ?? props.widget.borderWidth ?? 1),
  color: activeCell.value?.borderBottom?.color ?? (props.widget.cellBorderColor ?? props.widget.borderColor ?? '#000000')
}))

const cellBorderLeft = computed(() => ({
  style: activeCell.value?.borderLeft?.style || 'solid',
  width: activeCell.value?.borderLeft?.width ?? (props.widget.cellBorderWidth ?? props.widget.borderWidth ?? 1),
  color: activeCell.value?.borderLeft?.color ?? (props.widget.cellBorderColor ?? props.widget.borderColor ?? '#000000')
}))

// 计算选中行/列的当前行高/列宽（像素）
const selectedRowHeight = computed(() => {
  if (!tableSelection.value) return null
  const rowIndex = tableSelection.value.startRow
  const rowHeights = props.widget.rowHeights || []
  const fraction = rowHeights[rowIndex] || (1 / props.widget.rows)
  return Math.round(props.widget.height * fraction)
})

const selectedColWidth = computed(() => {
  if (!tableSelection.value) return null
  const colIndex = tableSelection.value.startCol
  const columnWidths = props.widget.columnWidths || []
  const fraction = columnWidths[colIndex] || (1 / props.widget.cols)
  return Math.round(props.widget.width * fraction)
})

function updateRowHeight(heightPx: number) {
  if (!tableSelection.value) return
  const rowIndex = tableSelection.value.startRow
  const currentRowHeights = normalizeFractions(props.widget.rowHeights || [], props.widget.rows)

  // 计算新的比例
  const newFraction = heightPx / props.widget.height
  const oldFraction = currentRowHeights[rowIndex]
  const diff = newFraction - oldFraction

  // 按比例分配差值到其他行
  const newRowHeights = currentRowHeights.map((frac, idx) => {
    if (idx === rowIndex) return newFraction
    return frac - (diff / (props.widget.rows - 1))
  })

  editorStore.updateWidget(props.widget.id, { rowHeights: normalizeFractions(newRowHeights, props.widget.rows) })
}

function updateColWidth(widthPx: number) {
  if (!tableSelection.value) return
  const colIndex = tableSelection.value.startCol
  const currentColWidths = normalizeFractions(props.widget.columnWidths || [], props.widget.cols)

  // 计算新的比例
  const newFraction = widthPx / props.widget.width
  const oldFraction = currentColWidths[colIndex]
  const diff = newFraction - oldFraction

  // 按比例分配差值到其他列
  const newColWidths = currentColWidths.map((frac, idx) => {
    if (idx === colIndex) return newFraction
    return frac - (diff / (props.widget.cols - 1))
  })

  editorStore.updateWidget(props.widget.id, { columnWidths: normalizeFractions(newColWidths, props.widget.cols) })
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">表格属性</a-divider>
  <a-alert type="info" show-icon class="table-mode-alert">
    <template #message>当前模式：{{ modeLabel }}</template>
    <template #description>
      <span v-if="isSimpleMode">简单表格内的单元格可直接绑定字段并展示对应数据。</span>
      <span v-else-if="isComplexMode">复杂表格需在表头绑定列数据源，数据区会按照绑定结果自动填充。</span>
      <span v-else>旧版表格兼容手动编辑与列绑定两种方式。</span>
    </template>
  </a-alert>

  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="单元格行数">
      <a-input-number
        :value="bodyRowCount"
        @change="(v: number) => updateRowsCols(v, widget.cols)"
        :min="1"
        :max="50"
        :disabled="isComplexMode"
        style="width: 100%"
      />
      <small v-if="isComplexMode" class="form-tip">复杂表格的数据区域由绑定结果自动生成。</small>
    </a-form-item>
    
    <a-form-item label="列数">
      <a-input-number
        :value="widget.cols"
        @change="(v: number) => updateRowsCols(bodyRowCount, v)"
        :min="1"
        :max="20"
        style="width: 100%"
      />
    </a-form-item>
    
    <a-form-item label="表头行数">
      <a-input-number
        :value="effectiveHeaderRows"
        @change="(v: number) => handleHeaderRowsChange(v)"
        :min="0"
        :max="widget.rows"
        style="width: 100%"
      />
      <small class="form-tip">设置表格顶部作为表头的行数，表头可以进行样式独立设置。</small>
    </a-form-item>
    
    <a-form-item label="显示表头">
      <a-switch
        :checked="widget.showHeader !== false"
        @change="(checked: boolean) => update('showHeader', checked)"
        :disabled="effectiveHeaderRows === 0"
      />
      <small v-if="effectiveHeaderRows === 0" class="form-tip">请先设置表头行数</small>
    </a-form-item>

    <a-divider orientation="left" style="font-size: 12px">表格边框</a-divider>
    <a-form-item label="统一设置">
      <a-space>
        <a-input-number
          :value="widget.tableBorderWidth ?? widget.borderWidth"
          @change="handleTableBorderWidthChange"
          :min="0"
          :max="5"
          style="width: 60px"
          placeholder="宽度"
        />
        <a-input
          type="color"
          :value="widget.tableBorderColor ?? widget.borderColor"
          @change="(e: Event) => updateTableBorderField('tableBorderColor', (e.target as HTMLInputElement).value)"
          style="width: 40px"
        />
        <a-select
          :value="widget.tableBorderStyle ?? widget.borderStyle ?? 'solid'"
          @change="handleTableBorderStyleChange"
          style="width: 70px"
        >
          <a-select-option v-for="option in borderStyleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </a-select-option>
        </a-select>
      </a-space>
    </a-form-item>
    
    <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }" size="small">
      <a-form-item label="上">
        <a-space>
          <a-input-number :value="getTableBorderWidth('tableBorderTop')" @change="(v: number) => updateTableSideBorder('tableBorderTop', { width: v })" :min="0" :max="5" style="width: 50px" />
          <a-input type="color" :value="getTableBorderColor('tableBorderTop')" @change="(e: Event) => updateTableSideBorder('tableBorderTop', { color: (e.target as HTMLInputElement).value })" style="width: 36px" />
          <a-select :value="getTableBorderStyle('tableBorderTop')" @change="(v: 'solid' | 'dashed' | 'dotted' | 'none') => updateTableSideBorder('tableBorderTop', { style: v })" style="width: 65px">
            <a-select-option value="solid">实线</a-select-option>
            <a-select-option value="dashed">虚线</a-select-option>
            <a-select-option value="dotted">点线</a-select-option>
            <a-select-option value="none">无</a-select-option>
          </a-select>
        </a-space>
      </a-form-item>
      <a-form-item label="右">
        <a-space>
          <a-input-number :value="getTableBorderWidth('tableBorderRight')" @change="(v: number) => updateTableSideBorder('tableBorderRight', { width: v })" :min="0" :max="5" style="width: 50px" />
          <a-input type="color" :value="getTableBorderColor('tableBorderRight')" @change="(e: Event) => updateTableSideBorder('tableBorderRight', { color: (e.target as HTMLInputElement).value })" style="width: 36px" />
          <a-select :value="getTableBorderStyle('tableBorderRight')" @change="(v: 'solid' | 'dashed' | 'dotted' | 'none') => updateTableSideBorder('tableBorderRight', { style: v })" style="width: 65px">
            <a-select-option value="solid">实线</a-select-option>
            <a-select-option value="dashed">虚线</a-select-option>
            <a-select-option value="dotted">点线</a-select-option>
            <a-select-option value="none">无</a-select-option>
          </a-select>
        </a-space>
      </a-form-item>
      <a-form-item label="下">
        <a-space>
          <a-input-number :value="getTableBorderWidth('tableBorderBottom')" @change="(v: number) => updateTableSideBorder('tableBorderBottom', { width: v })" :min="0" :max="5" style="width: 50px" />
          <a-input type="color" :value="getTableBorderColor('tableBorderBottom')" @change="(e: Event) => updateTableSideBorder('tableBorderBottom', { color: (e.target as HTMLInputElement).value })" style="width: 36px" />
          <a-select :value="getTableBorderStyle('tableBorderBottom')" @change="(v: 'solid' | 'dashed' | 'dotted' | 'none') => updateTableSideBorder('tableBorderBottom', { style: v })" style="width: 65px">
            <a-select-option value="solid">实线</a-select-option>
            <a-select-option value="dashed">虚线</a-select-option>
            <a-select-option value="dotted">点线</a-select-option>
            <a-select-option value="none">无</a-select-option>
          </a-select>
        </a-space>
      </a-form-item>
      <a-form-item label="左">
        <a-space>
          <a-input-number :value="getTableBorderWidth('tableBorderLeft')" @change="(v: number) => updateTableSideBorder('tableBorderLeft', { width: v })" :min="0" :max="5" style="width: 50px" />
          <a-input type="color" :value="getTableBorderColor('tableBorderLeft')" @change="(e: Event) => updateTableSideBorder('tableBorderLeft', { color: (e.target as HTMLInputElement).value })" style="width: 36px" />
          <a-select :value="getTableBorderStyle('tableBorderLeft')" @change="(v: 'solid' | 'dashed' | 'dotted' | 'none') => updateTableSideBorder('tableBorderLeft', { style: v })" style="width: 65px">
            <a-select-option value="solid">实线</a-select-option>
            <a-select-option value="dashed">虚线</a-select-option>
            <a-select-option value="dotted">点线</a-select-option>
            <a-select-option value="none">无</a-select-option>
          </a-select>
        </a-space>
      </a-form-item>
    </a-form>

    <a-divider orientation="left" style="font-size: 11px; margin: 8px 0">单元格边框</a-divider>
    <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }" size="small">
      <a-form-item label="上">
        <a-space>
          <a-input-number :value="cellBorderTop.width" @change="(v: number) => updateCellSideBorder('borderTop', { width: v })" :min="0" :max="5" style="width: 50px" />
          <a-input type="color" :value="cellBorderTop.color" @change="(e: Event) => updateCellSideBorder('borderTop', { color: (e.target as HTMLInputElement).value })" style="width: 36px" />
          <a-select :value="cellBorderTop.style" @change="(v: 'solid' | 'dashed' | 'dotted' | 'none') => updateCellSideBorder('borderTop', { style: v })" style="width: 65px">
            <a-select-option value="solid">实线</a-select-option>
            <a-select-option value="dashed">虚线</a-select-option>
            <a-select-option value="dotted">点线</a-select-option>
            <a-select-option value="none">无</a-select-option>
          </a-select>
        </a-space>
      </a-form-item>
      <a-form-item label="右">
        <a-space>
          <a-input-number :value="cellBorderRight.width" @change="(v: number) => updateCellSideBorder('borderRight', { width: v })" :min="0" :max="5" style="width: 50px" />
          <a-input type="color" :value="cellBorderRight.color" @change="(e: Event) => updateCellSideBorder('borderRight', { color: (e.target as HTMLInputElement).value })" style="width: 36px" />
          <a-select :value="cellBorderRight.style" @change="(v: 'solid' | 'dashed' | 'dotted' | 'none') => updateCellSideBorder('borderRight', { style: v })" style="width: 65px">
            <a-select-option value="solid">实线</a-select-option>
            <a-select-option value="dashed">虚线</a-select-option>
            <a-select-option value="dotted">点线</a-select-option>
            <a-select-option value="none">无</a-select-option>
          </a-select>
        </a-space>
      </a-form-item>
      <a-form-item label="下">
        <a-space>
          <a-input-number :value="cellBorderBottom.width" @change="(v: number) => updateCellSideBorder('borderBottom', { width: v })" :min="0" :max="5" style="width: 50px" />
          <a-input type="color" :value="cellBorderBottom.color" @change="(e: Event) => updateCellSideBorder('borderBottom', { color: (e.target as HTMLInputElement).value })" style="width: 36px" />
          <a-select :value="cellBorderBottom.style" @change="(v: 'solid' | 'dashed' | 'dotted' | 'none') => updateCellSideBorder('borderBottom', { style: v })" style="width: 65px">
            <a-select-option value="solid">实线</a-select-option>
            <a-select-option value="dashed">虚线</a-select-option>
            <a-select-option value="dotted">点线</a-select-option>
            <a-select-option value="none">无</a-select-option>
          </a-select>
        </a-space>
      </a-form-item>
      <a-form-item label="左">
        <a-space>
          <a-input-number :value="cellBorderLeft.width" @change="(v: number) => updateCellSideBorder('borderLeft', { width: v })" :min="0" :max="5" style="width: 50px" />
          <a-input type="color" :value="cellBorderLeft.color" @change="(e: Event) => updateCellSideBorder('borderLeft', { color: (e.target as HTMLInputElement).value })" style="width: 36px" />
          <a-select :value="cellBorderLeft.style" @change="(v: 'solid' | 'dashed' | 'dotted' | 'none') => updateCellSideBorder('borderLeft', { style: v })" style="width: 65px">
            <a-select-option value="solid">实线</a-select-option>
            <a-select-option value="dashed">虚线</a-select-option>
            <a-select-option value="dotted">点线</a-select-option>
            <a-select-option value="none">无</a-select-option>
          </a-select>
        </a-space>
      </a-form-item>
    </a-form>
  </a-form>

  <a-divider orientation="left" style="font-size: 12px">表格操作提示</a-divider>
  <div class="table-ops">
    <div class="table-selection-info">当前选择：{{ selectionSummary }}</div>
    <a-space wrap size="small">
      <a-button size="small" @click="handleMerge" :disabled="!canMerge">合并单元格</a-button>
      <a-button size="small" @click="handleSplit" :disabled="!canSplit">拆分单元格</a-button>
      <a-button size="small" @click="handleInsertRow('before')" :disabled="isComplexMode">上方插入行</a-button>
      <a-button size="small" @click="handleInsertRow('after')" :disabled="isComplexMode">下方插入行</a-button>
      <a-button size="small" @click="handleInsertCol('before')">左侧插入列</a-button>
      <a-button size="small" @click="handleInsertCol('after')">右侧插入列</a-button>
      <a-button size="small" danger @click="handleDeleteRow" :disabled="!canDeleteRow">删除选中行</a-button>
      <a-button size="small" danger @click="handleDeleteCol" :disabled="!canDeleteCol">删除选中列</a-button>
    </a-space>
  </div>

  <a-divider orientation="left" style="font-size: 12px">列数据绑定</a-divider>
  <div v-if="!isSimpleMode" class="table-cell-panel">
    <template v-if="isHeaderSelection && selectedColumnIndex !== null">
      <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
        <a-form-item label="目标列">
          第 {{ selectedColumnIndex + 1 }} 列
        </a-form-item>
        <a-form-item label="绑定数据">
          <a-select
            :value="columnBindingValue || undefined"
            allow-clear
            placeholder="选择数据列"
            @change="(value: string | undefined) => handleColumnBindingChange(value ?? null)"
          >
            <a-select-option v-for="col in dataSourceStore.columnOptions" :key="col.value" :value="col.value">
              {{ col.label }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
      <div v-if="columnBindingValue" class="cell-binding-preview">
        已绑定：<span>{{ columnBindingValue }}</span>
      </div>
      <div v-if="activeCellDataPreview" class="cell-binding-preview">
        数据预览：<span>{{ activeCellDataPreview }}</span>
      </div>
    </template>
    <p v-else class="table-cell-empty">请选择表头单元格以绑定列数据源</p>
  </div>
  <div v-else class="table-cell-panel">
    <p class="table-cell-empty">简单表格请直接选择单元格并绑定数据列</p>
  </div>
  <a-divider orientation="left" style="font-size: 12px">单元格内容</a-divider>
  <div class="table-cell-panel">
    <template v-if="activeCell">
      <template v-if="isAutoFillCell">
        <p class="table-cell-empty">该单元格由数据源自动填充，请在表头设置对应列的绑定。</p>
        <div v-if="activeCellDataPreview" class="cell-binding-preview">
          数据预览：<span>{{ activeCellDataPreview }}</span>
        </div>
      </template>
      <template v-else>
        <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
          <a-form-item label="文本内容">
            <a-textarea
              :value="activeCell.content"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              @change="(e: Event) => handleCellContentChange((e.target as HTMLTextAreaElement).value)"
            />
          </a-form-item>
          <!-- 复杂表格不显示单元格级别的数据绑定 -->
          <a-form-item v-if="!isComplexMode" label="绑定数据">
            <a-select
              :value="activeCell.dataSource"
              allow-clear
              placeholder="选择数据列"
              @change="(value: string | undefined) => handleCellDataSourceChange(value ?? null)"
            >
              <a-select-option v-for="col in dataSourceStore.columnOptions" :key="col.value" :value="col.value">
                {{ col.label }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <div v-if="activeCellDataPreview" class="cell-binding-preview">
            数据预览：<span>{{ activeCellDataPreview }}</span>
          </div>
        </a-form>
      </template>
    </template>
    <p v-else class="table-cell-empty">请选择一个单元格以编辑内容</p>
  </div>

  <a-divider orientation="left" style="font-size: 12px">单元格样式</a-divider>
  <div class="table-cell-panel">
    <template v-if="tableSelection">
      <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
        <a-form-item label="字体大小">
          <a-input-number
            :value="activeCell?.fontSize || 14"
            @change="v => updateCellStyle({ fontSize: v })"
            :min="8"
            :max="72"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="字体">
          <a-select
            :value="activeCell?.fontFamily || 'Arial'"
            @change="v => updateCellStyle({ fontFamily: v })"
          >
            <a-select-option v-for="option in fontFamilyOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="字重">
          <a-select
            :value="activeCell?.fontWeight || 'normal'"
            @change="v => updateCellStyle({ fontWeight: v })"
          >
            <a-select-option v-for="option in fontWeightOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="文字颜色">
          <a-input
            type="color"
            :value="activeCell?.color || '#000000'"
            @change="handleCellColorChange"
          />
        </a-form-item>
        <a-form-item label="对齐方式">
          <a-select
            :value="activeCell?.textAlign || 'left'"
            @change="v => updateCellStyle({ textAlign: v })"
          >
            <a-select-option v-for="option in textAlignOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="背景颜色">
          <a-input
            type="color"
            :value="activeCell?.backgroundColor || '#ffffff'"
            @change="handleCellBgColorChange"
          />
        </a-form-item>
        

      </a-form>
    </template>
    <p v-else class="table-cell-empty">请选择单元格以编辑样式</p>
  </div>

  <a-divider orientation="left" style="font-size: 12px">行高和列宽</a-divider>
  <div class="table-cell-panel">
    <template v-if="tableSelection">
      <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
        <a-form-item label="行高 (mm)">
          <a-input-number
            :value="selectedRowHeight"
            @change="v => updateRowHeight(v)"
            :min="3"
            :max="200"
            style="width: 100%"
          />
          <small class="form-tip">调整第 {{ tableSelection.startRow + 1 }} 行的高度</small>
        </a-form-item>
        <a-form-item label="列宽 (mm)">
          <a-input-number
            :value="selectedColWidth"
            @change="v => updateColWidth(v)"
            :min="3"
            :max="200"
            style="width: 100%"
          />
          <small class="form-tip">调整第 {{ tableSelection.startCol + 1 }} 列的宽度</small>
        </a-form-item>
      </a-form>
    </template>
    <p v-else class="table-cell-empty">请选择单元格以调整行高列宽</p>
  </div>

  <!-- 高级设置 -->
  <a-divider orientation="left" style="font-size: 12px">高级设置</a-divider>
  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small" style="padding: 0 8px">
    <a-form-item label="强制分页">
      <a-switch
        :checked="widget.forcePageBreak || false"
        @change="v => update('forcePageBreak', v)"
      />
      <div style="font-size: 12px; color: #999; margin-top: 4px">
        开启后，此组件将独占一页
      </div>
    </a-form-item>
  </a-form>

</template>

<style scoped>
.table-ops {
  padding: 0 8px 8px;
}

.table-selection-info {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.form-tip {
  display: block;
  margin-top: 4px;
  color: #8c8c8c;
}

.table-cell-panel {
  padding: 0 8px 8px;
}

.table-cell-empty {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.cell-binding-preview {
  font-size: 12px;
  color: #666;
  margin-left: 8px;
}

.cell-binding-preview span {
  font-weight: 500;
}

.table-mode-alert {
  margin: 0 8px 12px;
}
</style>
