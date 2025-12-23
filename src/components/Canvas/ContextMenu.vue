<script setup lang="ts">
  import { computed, onMounted, onUnmounted } from 'vue'
  import { useEditorStore } from '@/stores/editor'
  import type { TableWidget } from '@/types'

  const props = defineProps<{
    position: { x: number; y: number }
    widgetId: string | null
  }>()

  const emit = defineEmits<{
    close: []
  }>()

  const editorStore = useEditorStore()

  const widget = computed(() => {
    if (!props.widgetId) return null
    return editorStore.widgets.find(w => w.id === props.widgetId)
  })

  const isTable = computed(() => widget.value?.type === 'table')

  const table = computed<TableWidget | null>(() => {
    if (!isTable.value) return null
    return widget.value as TableWidget
  })

  const isComplexMode = computed(() => table.value?.tableMode === 'complex')

  const selection = computed(() => (isTable.value ? editorStore.tableSelection : null))
  const hasSelection = computed(() => !!selection.value)

  const canMerge = computed(() => {
    if (isComplexMode.value) return false // 复杂表格不支持合并
    if (!hasSelection.value || !selection.value) return false
    const { startRow, startCol, endRow, endCol } = selection.value
    return startRow !== endRow || startCol !== endCol
  })

  const canSplit = computed(() => {
    if (isComplexMode.value) return false // 复杂表格不支持拆分
    if (!hasSelection.value || !selection.value || !table.value) return false
    const { startRow, startCol, endRow, endCol } = selection.value
    if (startRow !== endRow || startCol !== endCol) return false

    const cell = table.value.cells[startRow][startCol]
    return (cell.rowSpan || 1) > 1 || (cell.colSpan || 1) > 1
  })

  // 复杂表格不支持插入/删除行
  const canInsertRow = computed(() => {
    if (isComplexMode.value) return false
    return hasSelection.value
  })

  const canDeleteSelectedRow = computed(() => {
    if (isComplexMode.value) return false
    return canDeleteRow.value
  })

  const selectedRowCount = computed(() => {
    if (!selection.value) return 0
    return selection.value.endRow - selection.value.startRow + 1
  })

  const selectedColCount = computed(() => {
    if (!selection.value) return 0
    return selection.value.endCol - selection.value.startCol + 1
  })

  const canDeleteRow = computed(() => {
    if (!table.value || !selection.value) return false
    return table.value.rows - selectedRowCount.value >= 1
  })

  const canDeleteCol = computed(() => {
    if (!table.value || !selection.value) return false
    return table.value.cols - selectedColCount.value >= 1
  })

  const selectionSummary = computed(() => {
    if (!selection.value) return '未选择单元格'
    const { startRow, endRow, startCol, endCol } = selection.value
    const rowLabel =
      startRow === endRow ? `第 ${startRow + 1} 行` : `第 ${startRow + 1}-${endRow + 1} 行`
    const colLabel =
      startCol === endCol ? `第 ${startCol + 1} 列` : `第 ${startCol + 1}-${endCol + 1} 列`
    return `${rowLabel} · ${colLabel}`
  })

  const menuStyle = computed(() => ({
    left: `${props.position.x}px`,
    top: `${props.position.y}px`
  }))

  function copy() {
    if (props.widgetId) {
      editorStore.copyWidget(props.widgetId)
    }
    emit('close')
  }

  function paste() {
    editorStore.pasteWidget()
    emit('close')
  }

  function deleteWidget() {
    if (props.widgetId) {
      editorStore.deleteWidget(props.widgetId)
    }
    emit('close')
  }

  function bringToFront() {
    if (props.widgetId) {
      editorStore.bringToFront(props.widgetId)
    }
    emit('close')
  }

  function sendToBack() {
    if (props.widgetId) {
      editorStore.sendToBack(props.widgetId)
    }
    emit('close')
  }

  function mergeCells() {
    if (!canMerge.value) return
    editorStore.mergeTableCells()
    emit('close')
  }

  function splitCells() {
    if (!canSplit.value) return
    editorStore.splitTableCells()
    emit('close')
  }

  function insertRow(position: 'before' | 'after') {
    if (!selection.value || isComplexMode.value) return
    editorStore.insertTableRow(selection.value.startRow, position)
    emit('close')
  }

  function insertCol(position: 'before' | 'after') {
    if (!selection.value) return
    editorStore.insertTableCol(selection.value.startCol, position)
    emit('close')
  }

  function deleteRow() {
    if (!selection.value || !canDeleteSelectedRow.value) return
    editorStore.deleteTableRow(selection.value.startRow)
    emit('close')
  }

  function deleteCol() {
    if (!selection.value || !canDeleteCol.value) return
    editorStore.deleteTableCol(selection.value.startCol)
    emit('close')
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.context-menu')) {
      emit('close')
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleClickOutside)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
</script>

<template>
  <div class="context-menu" :style="menuStyle">
    <div class="context-menu-item" @click="copy">复制</div>
    <div class="context-menu-item" @click="paste">粘贴</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" @click="bringToFront">置于顶层</div>
    <div class="context-menu-item" @click="sendToBack">置于底层</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" @click="deleteWidget">删除</div>

    <template v-if="isTable">
      <div class="context-menu-divider"></div>
      <div class="context-menu-hint">{{ selectionSummary }}</div>
      <div :class="['context-menu-item', { disabled: !canMerge }]" @click="mergeCells">
        合并单元格
      </div>
      <div :class="['context-menu-item', { disabled: !canSplit }]" @click="splitCells">
        拆分单元格
      </div>
      <div class="context-menu-divider"></div>
      <div :class="['context-menu-item', { disabled: !canInsertRow }]" @click="insertRow('before')">
        上方插入行
      </div>
      <div :class="['context-menu-item', { disabled: !canInsertRow }]" @click="insertRow('after')">
        下方插入行
      </div>
      <div :class="['context-menu-item', { disabled: !hasSelection }]" @click="insertCol('before')">
        左侧插入列
      </div>
      <div :class="['context-menu-item', { disabled: !hasSelection }]" @click="insertCol('after')">
        右侧插入列
      </div>
      <div class="context-menu-divider"></div>
      <div
        :class="['context-menu-item', 'danger', { disabled: !canDeleteSelectedRow }]"
        @click="deleteRow"
      >
        删除选中行
      </div>
      <div :class="['context-menu-item', 'danger', { disabled: !canDeleteCol }]" @click="deleteCol">
        删除选中列
      </div>
    </template>
  </div>
</template>
