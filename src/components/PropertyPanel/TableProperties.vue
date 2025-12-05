<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { TableWidget, TableCell } from '@/types'

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
const effectiveHeaderRows = computed(() => (isSimpleMode.value ? 0 : props.widget.headerRows))
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
  if (!tableSelection.value) return false
  const { startRow, endRow, startCol, endCol } = tableSelection.value
  return startRow !== endRow || startCol !== endCol
})

const canSplit = computed(() => {
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

function updateTableBorderField(key: 'tableBorderWidth' | 'tableBorderColor' | 'tableBorderStyle', value: any) {
  updateWidgetFields({ [key]: value })
}

function updateCellBorderField(key: 'cellBorderWidth' | 'cellBorderColor' | 'cellBorderStyle', value: any) {
  const payload: Partial<TableWidget> = { [key]: value }
  if (key === 'cellBorderWidth') {
    payload.borderWidth = value
  }
  if (key === 'cellBorderColor') {
    payload.borderColor = value
  }
  if (key === 'cellBorderStyle') {
    payload.borderStyle = value
  }
  updateWidgetFields(payload)
}

function handleTableBorderWidthChange(value: number | null) {
  updateTableBorderField('tableBorderWidth', typeof value === 'number' ? value : 0)
}

function handleCellBorderWidthChange(value: number | null) {
  updateCellBorderField('cellBorderWidth', typeof value === 'number' ? value : 0)
}

function handleTableBorderStyleChange(value: 'solid' | 'dashed' | 'dotted') {
  updateTableBorderField('tableBorderStyle', value)
}

function handleCellBorderStyleChange(value: 'solid' | 'dashed' | 'dotted') {
  updateCellBorderField('cellBorderStyle', value)
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
  const newCells = JSON.parse(JSON.stringify(props.widget.cells))
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
    
    <template v-if="!isSimpleMode">
      <a-form-item label="表头行数">
        <a-input-number
          :value="effectiveHeaderRows"
          @change="(v: number) => !isComplexMode && update('headerRows', v)"
          :min="0"
          :max="widget.rows"
          :disabled="isComplexMode"
          style="width: 100%"
        />
        <small v-if="isComplexMode" class="form-tip">复杂表格固定为一行表头。</small>
      </a-form-item>
      <a-form-item v-if="!isComplexMode" label="显示表头">
        <a-switch
          :checked="widget.showHeader !== false"
          @change="(checked: boolean) => update('showHeader', checked)"
        />
      </a-form-item>
    </template>

    <a-divider orientation="left" style="font-size: 12px">表格边框</a-divider>
    <a-form-item label="宽度">
      <a-input-number
        :value="widget.tableBorderWidth ?? widget.borderWidth"
        @change="handleTableBorderWidthChange"
        :min="0"
        :max="5"
        style="width: 100%"
      />
    </a-form-item>
    <a-form-item label="颜色">
      <a-input
        type="color"
        :value="widget.tableBorderColor ?? widget.borderColor"
        @change="(e: Event) => updateTableBorderField('tableBorderColor', (e.target as HTMLInputElement).value)"
      />
    </a-form-item>
    <a-form-item label="线型">
      <a-select
        :value="widget.tableBorderStyle ?? widget.borderStyle ?? 'solid'"
        @change="handleTableBorderStyleChange"
      >
        <a-select-option v-for="option in borderStyleOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-divider orientation="left" style="font-size: 12px">单元格边框</a-divider>
    <a-form-item label="宽度">
      <a-input-number
        :value="widget.cellBorderWidth ?? widget.borderWidth"
        @change="handleCellBorderWidthChange"
        :min="0"
        :max="5"
        style="width: 100%"
      />
    </a-form-item>
    <a-form-item label="颜色">
      <a-input
        type="color"
        :value="widget.cellBorderColor ?? widget.borderColor"
        @change="(e: Event) => updateCellBorderField('cellBorderColor', (e.target as HTMLInputElement).value)"
      />
    </a-form-item>
    <a-form-item label="线型">
      <a-select
        :value="widget.cellBorderStyle ?? widget.borderStyle ?? 'solid'"
        @change="handleCellBorderStyleChange"
      >
        <a-select-option v-for="option in borderStyleOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </a-select-option>
      </a-select>
    </a-form-item>
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
          <a-form-item label="绑定数据">
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
