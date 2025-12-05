<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { Widget, TextWidget, TableWidget, ImageWidget, LineWidget, RectWidget, BarcodeWidget, QRCodeWidget } from '@/types'
import WidgetWrapper from './WidgetWrapper.vue'
import ContextMenu from './ContextMenu.vue'
import { ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons-vue'

const editorStore = useEditorStore()

const canvasRef = ref<HTMLDivElement | null>(null)
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuWidgetId = ref<string | null>(null)

const MM_TO_PX = 3.78

const paperWidth = computed(() => editorStore.paperSize.width * MM_TO_PX)
const paperHeight = computed(() => editorStore.paperSize.height * MM_TO_PX)

const paperStyle = computed(() => ({
  width: `${paperWidth.value}px`,
  height: `${paperHeight.value}px`,
  transform: `scale(${editorStore.scale})`
}))

const horizontalRulerMarks = computed(() => {
  const marks: { position: number; label: string; isMajor: boolean }[] = []
  const widthMm = editorStore.paperSize.width

  // 根据缩放级别动态调整刻度间隔
  let minorInterval = 5
  let majorInterval = 10

  if (editorStore.scale >= 2) {
    minorInterval = 1
    majorInterval = 5
  } else if (editorStore.scale >= 1.5) {
    minorInterval = 2
    majorInterval = 10
  } else if (editorStore.scale < 0.5) {
    minorInterval = 10
    majorInterval = 50
  }

  for (let mm = 0; mm <= widthMm; mm += minorInterval) {
    marks.push({
      position: mm * MM_TO_PX * editorStore.scale,
      label: mm % majorInterval === 0 ? String(mm) : '',
      isMajor: mm % majorInterval === 0
    })
  }
  return marks
})

const verticalRulerMarks = computed(() => {
  const marks: { position: number; label: string; isMajor: boolean }[] = []
  const heightMm = editorStore.paperSize.height

  // 根据缩放级别动态调整刻度间隔
  let minorInterval = 5
  let majorInterval = 10

  if (editorStore.scale >= 2) {
    minorInterval = 1
    majorInterval = 5
  } else if (editorStore.scale >= 1.5) {
    minorInterval = 2
    majorInterval = 10
  } else if (editorStore.scale < 0.5) {
    minorInterval = 10
    majorInterval = 50
  }

  for (let mm = 0; mm <= heightMm; mm += minorInterval) {
    marks.push({
      position: mm * MM_TO_PX * editorStore.scale,
      label: mm % majorInterval === 0 ? String(mm) : '',
      isMajor: mm % majorInterval === 0
    })
  }
  return marks
})

function onDrop(e: DragEvent) {
  e.preventDefault()
  const widgetType = e.dataTransfer?.getData("widgetType")
  if (!widgetType || !canvasRef.value) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = (e.clientX - rect.left) / editorStore.scale
  const y = (e.clientY - rect.top) / editorStore.scale
  
  const tableMode = e.dataTransfer?.getData("tableMode")
  const normalizedMode = tableMode === "simple" || tableMode === "complex" ? tableMode : undefined
  
  createWidget(widgetType, x, y, { tableMode: normalizedMode })
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function createWidget(type: string, x: number, y: number, options?: { tableMode?: "simple" | "complex" }) {
  const baseWidget = { x, y }
  
  switch (type) {
    case 'text':
      editorStore.addWidget({
        ...baseWidget,
        type: 'text',
        width: 120,
        height: 30,
        content: '双击编辑文本',
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        textAlign: 'left'
      } as Omit<TextWidget, 'id' | 'zIndex'>)
      break
    case "table":
      const mode = options?.tableMode === "simple" ? "simple" : "complex"
      const cols = 3
      const headerRows = mode === "simple" ? 0 : 1
      const bodyRows = mode === "complex" ? 1 : 4
      const totalRows = headerRows + bodyRows
      const cells = Array(totalRows).fill(null).map((_, rowIndex) =>
        Array(cols).fill(null).map((_, colIndex) => ({
          content: rowIndex < headerRows ? `表头${colIndex + 1}` : "",
          rowSpan: 1,
          colSpan: 1
        }))
      )
      editorStore.addWidget({
        ...baseWidget,
        type: "table",
        width: 300,
        height: 150,
        rows: totalRows,
        cols,
        cells,
        headerRows,
        showHeader: mode !== "simple",
        tableMode: mode,
        borderWidth: 1,
        borderColor: "#000000",
        borderStyle: "solid",
        tableBorderWidth: 1,
        tableBorderColor: "#000000",
        tableBorderStyle: "solid",
        cellBorderWidth: 1,
        cellBorderColor: "#000000",
        cellBorderStyle: "solid",
        columnBindings: {},
        columnWidths: Array(cols).fill(1 / cols),
        rowHeights: totalRows ? Array(totalRows).fill(1 / totalRows) : []
      } as Omit<TableWidget, "id" | "zIndex">)
      break
    case 'image':
      editorStore.addWidget({
        ...baseWidget,
        type: 'image',
        width: 100,
        height: 100,
        src: '',
        fit: 'contain'
      } as Omit<ImageWidget, 'id' | 'zIndex'>)
      break
    case 'line':
      editorStore.addWidget({
        ...baseWidget,
        type: 'line',
        width: 100,
        height: 2,
        direction: 'horizontal',
        lineWidth: 1,
        lineColor: '#000000',
        lineStyle: 'solid'
      } as Omit<LineWidget, 'id' | 'zIndex'>)
      break
    case 'rect':
      editorStore.addWidget({
        ...baseWidget,
        type: 'rect',
        width: 100,
        height: 80,
        borderWidth: 1,
        borderColor: '#000000',
        borderStyle: 'solid',
        backgroundColor: 'transparent',
        borderRadius: 0
      } as Omit<RectWidget, 'id' | 'zIndex'>)
      break
    case 'barcode':
      editorStore.addWidget({
        ...baseWidget,
        type: 'barcode',
        width: 150,
        height: 60,
        value: '123456789',
        format: 'CODE128'
      } as Omit<BarcodeWidget, 'id' | 'zIndex'>)
      break
    case 'qrcode':
      editorStore.addWidget({
        ...baseWidget,
        type: 'qrcode',
        width: 80,
        height: 80,
        value: 'https://example.com'
      } as Omit<QRCodeWidget, 'id' | 'zIndex'>)
      break
  }
}

function onCanvasClick(e: MouseEvent) {
  if (e.target === canvasRef.value) {
    editorStore.selectWidget(null)
  }
  contextMenuVisible.value = false
}

function onContextMenu(e: MouseEvent, widget: Widget) {
  e.preventDefault()
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuWidgetId.value = widget.id
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (editorStore.selectedWidgetId) {
      editorStore.deleteWidget(editorStore.selectedWidgetId)
    }
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'c' && editorStore.selectedWidgetId) {
      editorStore.copyWidget(editorStore.selectedWidgetId)
    }
    if (e.key === 'v') {
      editorStore.pasteWidget()
    }
    if (e.key === 'z') {
      if (e.shiftKey) {
        editorStore.redo()
      } else {
        editorStore.undo()
      }
    }
    // 缩放快捷键
    if (e.key === '=' || e.key === '+') {
      e.preventDefault()
      handleZoomIn()
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      handleZoomOut()
    }
    if (e.key === '0') {
      e.preventDefault()
      handleZoomReset()
    }
  }
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.max(0.25, Math.min(3, editorStore.scale + delta))
    editorStore.setScale(newScale)
  }
}

function handleZoomIn() {
  const newScale = Math.min(3, editorStore.scale + 0.1)
  editorStore.setScale(newScale)
}

function handleZoomOut() {
  const newScale = Math.max(0.25, editorStore.scale - 0.1)
  editorStore.setScale(newScale)
}

function handleZoomReset() {
  editorStore.setScale(1)
}

function formatZoomPercentage(val: number): string {
  return `${Math.round(val * 100)}%`
}

function handleScaleChange(val: number) {
  editorStore.setScale(val)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="canvas-container" @click="onCanvasClick">
    <div class="canvas-wrapper">
      <!-- 左上角空白 -->
      <div class="ruler-corner"></div>

      <!-- 水平刻度尺 -->
      <div class="ruler ruler-horizontal" :style="{ width: `${paperWidth * editorStore.scale}px` }">
        <div
          v-for="(mark, index) in horizontalRulerMarks"
          :key="index"
          class="ruler-mark"
          :class="{ major: mark.isMajor }"
          :style="{ left: `${mark.position}px` }"
        >
          <span v-if="mark.label" class="ruler-label">{{ mark.label }}</span>
        </div>
      </div>

      <!-- 垂直刻度尺 -->
      <div class="ruler ruler-vertical" :style="{ height: `${paperHeight * editorStore.scale}px` }">
        <div
          v-for="(mark, index) in verticalRulerMarks"
          :key="index"
          class="ruler-mark"
          :class="{ major: mark.isMajor }"
          :style="{ top: `${mark.position}px` }"
        >
          <span v-if="mark.label" class="ruler-label">{{ mark.label }}</span>
        </div>
      </div>

      <!-- 画布纸张 -->
      <div class="canvas-area" @wheel.passive="handleWheel">
        <div
          ref="canvasRef"
          class="canvas-paper"
          :style="paperStyle"
          @drop="onDrop"
          @dragover="onDragOver"
        >
          <WidgetWrapper
            v-for="widget in editorStore.widgets"
            :key="widget.id"
            :widget="widget"
            @contextmenu="onContextMenu($event, widget)"
          />

          <!-- 对齐线 -->
          <div
            v-for="(line, index) in editorStore.snapLines"
            :key="index"
            class="snap-line"
            :class="line.type"
            :style="{
              left: line.type === 'vertical' ? `${line.position}px` : 0,
              top: line.type === 'horizontal' ? `${line.position}px` : 0,
              width: line.type === 'vertical' ? '1px' : '100%',
              height: line.type === 'horizontal' ? '1px' : '100%'
            }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 缩放控制条 -->
    <div class="zoom-controls">
      <a-button size="small" @click="handleZoomOut">
        <zoom-out-outlined />
      </a-button>
      <a-slider
        v-model:value="editorStore.scale"
        :min="0.25"
        :max="3"
        :step="0.05"
        :tooltip-formatter="formatZoomPercentage"
        style="width: 120px; margin: 0 8px;"
        @change="handleScaleChange"
      />
      <a-button size="small" @click="handleZoomIn">
        <zoom-in-outlined />
      </a-button>
      <span class="zoom-percentage">{{ Math.round(editorStore.scale * 100) }}%</span>
      <a-button size="small" @click="handleZoomReset" style="margin-left: 8px;">
        重置
      </a-button>
    </div>

    <ContextMenu
      v-if="contextMenuVisible"
      :position="contextMenuPosition"
      :widget-id="contextMenuWidgetId"
      @close="closeContextMenu"
    />
  </div>
</template>

<style scoped>
.canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f0f2f5;
}

.canvas-wrapper {
  display: grid;
  grid-template-columns: 20px 1fr;
  grid-template-rows: 20px 1fr;
  gap: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.ruler-corner {
  background: #e8e8e8;
  border-right: 1px solid #d0d0d0;
  border-bottom: 1px solid #d0d0d0;
}

.ruler {
  background: #f5f5f5;
  position: relative;
  overflow: hidden;
}

.ruler-horizontal {
  height: 20px;
  border-bottom: 1px solid #d0d0d0;
}

.ruler-vertical {
  width: 20px;
  border-right: 1px solid #d0d0d0;
}

.ruler-mark {
  position: absolute;
  background: #999;
}

.ruler-horizontal .ruler-mark {
  width: 1px;
  height: 6px;
  bottom: 0;
}

.ruler-horizontal .ruler-mark.major {
  height: 10px;
}

.ruler-vertical .ruler-mark {
  width: 6px;
  height: 1px;
  right: 0;
}

.ruler-vertical .ruler-mark.major {
  width: 10px;
}

.ruler-label {
  position: absolute;
  font-size: 9px;
  color: #666;
  white-space: nowrap;
}

.ruler-horizontal .ruler-label {
  left: 2px;
  top: 2px;
}

.ruler-vertical .ruler-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  top: 2px;
  left: 2px;
}

.canvas-area {
  overflow: auto;
  background: #f0f2f5;
  padding: 20px;
  position: relative;
}

.canvas-area::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.canvas-area::-webkit-scrollbar-track {
  background: #f0f2f5;
}

.canvas-area::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 6px;
}

.canvas-area::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.canvas-paper {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: relative;
  transform-origin: top left;
  margin: auto;
  min-width: max-content;
}

.snap-line {
  position: absolute;
  background-color: #1890ff;
  z-index: 9999;
  pointer-events: none;
}

.zoom-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  background: white;
  padding: 8px 12px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.zoom-percentage {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: center;
}
</style>
