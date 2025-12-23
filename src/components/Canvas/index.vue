<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import { message } from 'ant-design-vue'
  import { useEditorStore } from '@/stores/editor'
  import type {
    Widget,
    TextWidget,
    TableWidget,
    ImageWidget,
    LineWidget,
    RectWidget,
    BarcodeWidget,
    QRCodeWidget
  } from '@/types'
  import { MM_TO_PX } from '@/types'
  import WidgetWrapper from './WidgetWrapper.vue'
  import ContextMenu from './ContextMenu.vue'
  import { ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons-vue'

  const editorStore = useEditorStore()

  const canvasRef = ref<HTMLDivElement | null>(null)
  const contextMenuVisible = ref(false)
  const contextMenuPosition = ref({ x: 0, y: 0 })
  const contextMenuWidgetId = ref<string | null>(null)
  const PAPER_OFFSET = 40 // 纸张距离0刻度线的偏移量（像素）
  const RULER_EXTENSION = 200 // 刻度尺延伸长度（像素）

  // 是否已选择画布大小
  const hasPaperSize = computed(() => !!editorStore.paperSize)

  const paperWidth = computed(() => (editorStore.paperSize?.width || 210) * MM_TO_PX)
  const paperHeight = computed(() => (editorStore.paperSize?.height || 297) * MM_TO_PX)

  // 装订线宽度（像素）
  const gutterLeftPx = computed(() => (editorStore.paperSize?.gutterLeft || 0) * MM_TO_PX)
  const gutterRightPx = computed(() => (editorStore.paperSize?.gutterRight || 0) * MM_TO_PX)

  // 页眉页脚内容
  const headerText = computed(() => editorStore.paperSize?.header || '')
  const footerText = computed(() => editorStore.paperSize?.footer || '')

  // 水印配置
  const watermark = computed(() => editorStore.paperSize?.watermark)

  // 刻度尺的总长度（纸张 + 左侧偏移 + 右侧延伸）
  const rulerWidth = computed(() => paperWidth.value + PAPER_OFFSET + RULER_EXTENSION)
  const rulerHeight = computed(() => paperHeight.value + PAPER_OFFSET + RULER_EXTENSION)

  const paperStyle = computed(() => ({
    width: `${paperWidth.value}px`,
    height: `${paperHeight.value}px`,
    transform: `scale(${editorStore.scale})`,
    position: 'absolute' as const,
    // left: `${PAPER_OFFSET}px`,
    // top: `${PAPER_OFFSET}px`,
    paddingLeft: `${gutterLeftPx.value}px`,
    paddingRight: `${gutterRightPx.value}px`,
    boxSizing: 'border-box' as const
  }))

  // 装订线样式
  const gutterStyle = computed(() => ({
    left: {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width: `${gutterLeftPx.value}px`,
      height: '100%',
      background: 'rgba(128, 128, 128, 0.15)',
      zIndex: 1
    },
    right: {
      position: 'absolute' as const,
      right: 0,
      top: 0,
      width: `${gutterRightPx.value}px`,
      height: '100%',
      background: 'rgba(128, 128, 128, 0.15)',
      zIndex: 1
    }
  }))

  const horizontalRulerMarks = computed(() => {
    const marks: { position: number; label: string; isMajor: boolean }[] = []
    // 刻度尺总长度转换为毫米
    const totalWidthMm = rulerWidth.value / MM_TO_PX

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

    // 从0开始绘制刻度，延伸到总长度
    for (let mm = 0; mm <= totalWidthMm; mm += minorInterval) {
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
    // 刻度尺总长度转换为毫米
    const totalHeightMm = rulerHeight.value / MM_TO_PX

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

    // 从0开始绘制刻度，延伸到总长度
    for (let mm = 0; mm <= totalHeightMm; mm += minorInterval) {
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

    // 检查是否已选择画布大小
    if (!editorStore.paperSize) {
      message.warning('请先选择画布大小')
      return
    }

    const widgetType = e.dataTransfer?.getData('widgetType')
    if (!widgetType || !canvasRef.value) return

    const rect = canvasRef.value.getBoundingClientRect()
    // 考虑纸张的偏移量和缩放，并转换为毫米
    const xPx = (e.clientX - rect.left) / editorStore.scale
    const yPx = (e.clientY - rect.top) / editorStore.scale
    const x = xPx / MM_TO_PX // 转换为毫米
    const y = yPx / MM_TO_PX // 转换为毫米

    const tableMode = e.dataTransfer?.getData('tableMode')
    const normalizedMode = tableMode === 'simple' || tableMode === 'complex' ? tableMode : undefined

    createWidget(widgetType, x, y, { tableMode: normalizedMode })
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }

  // 创建组件时，x, y, width, height 单位都是毫米
  function createWidget(
    type: string,
    x: number,
    y: number,
    options?: { tableMode?: 'simple' | 'complex' }
  ) {
    const baseWidget = { x, y }

    switch (type) {
      case 'text':
        editorStore.addWidget({
          ...baseWidget,
          type: 'text',
          width: 30, // 30mm
          height: 8, // 8mm
          content: '双击编辑文本',
          fontSize: 14,
          fontFamily: 'Arial',
          fontWeight: 'normal',
          color: '#000000',
          textAlign: 'left',
          verticalAlign: 'middle',
          letterSpacing: 0,
          customCss: ''
          // title, borderTop, borderRight, borderBottom, borderLeft 是可选的，不需要默认值
        } as Omit<TextWidget, 'id' | 'zIndex'>)
        break
      case 'table':
        const mode = options?.tableMode === 'simple' ? 'simple' : 'complex'
        const cols = 3
        const headerRows = 1 // 默认1行表头
        const bodyRows = mode === 'complex' ? 1 : 4
        const totalRows = headerRows + bodyRows
        const cells = Array(totalRows)
          .fill(null)
          .map((_, rowIndex) =>
            Array(cols)
              .fill(null)
              .map((_, colIndex) => ({
                content: rowIndex < headerRows ? `表头${colIndex + 1}` : '',
                rowSpan: 1,
                colSpan: 1
              }))
          )
        editorStore.addWidget({
          ...baseWidget,
          type: 'table',
          width: 80, // 80mm
          height: 40, // 40mm
          rows: totalRows,
          cols,
          cells,
          headerRows,
          showHeader: false, // 默认不显示表头
          tableMode: mode,
          borderWidth: 1,
          borderColor: '#000000',
          borderStyle: 'solid',
          tableBorderWidth: 1,
          tableBorderColor: '#000000',
          tableBorderStyle: 'solid',
          cellBorderWidth: 1,
          cellBorderColor: '#000000',
          cellBorderStyle: 'solid',
          columnBindings: {},
          columnWidths: Array(cols).fill(1 / cols),
          rowHeights: totalRows ? Array(totalRows).fill(1 / totalRows) : []
        } as Omit<TableWidget, 'id' | 'zIndex'>)
        break
      case 'image':
        editorStore.addWidget({
          ...baseWidget,
          type: 'image',
          width: 25, // 25mm
          height: 25, // 25mm
          src: '',
          fit: 'contain'
        } as Omit<ImageWidget, 'id' | 'zIndex'>)
        break
      case 'line':
        editorStore.addWidget({
          ...baseWidget,
          type: 'line',
          width: 25, // 25mm
          height: 0.5, // 0.5mm
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
          width: 25, // 25mm
          height: 20, // 20mm
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
          width: 40, // 40mm
          height: 15, // 15mm
          value: '123456789',
          format: 'CODE128'
        } as Omit<BarcodeWidget, 'id' | 'zIndex'>)
        break
      case 'qrcode':
        editorStore.addWidget({
          ...baseWidget,
          type: 'qrcode',
          width: 20, // 20mm
          height: 20, // 20mm
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
    // 检测事件是否来自可编辑元素（输入框、文本域等）
    const target = e.target as HTMLElement
    const isEditableElement =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[contenteditable="true"]')

    // 如果是可编辑元素，不处理复制/粘贴/删除等快捷键，让浏览器原生处理
    if (isEditableElement) {
      // 只保留缩放快捷键，其他交给浏览器处理
      if (e.ctrlKey || e.metaKey) {
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
      return
    }

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
      <div class="ruler ruler-horizontal" :style="{ width: `${rulerWidth * editorStore.scale}px` }">
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
      <div class="ruler ruler-vertical" :style="{ height: `${rulerHeight * editorStore.scale}px` }">
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
          class="canvas-content"
          :style="{
            width: `${rulerWidth * editorStore.scale}px`,
            height: `${rulerHeight * editorStore.scale}px`,
            position: 'relative'
          }"
        >
          <div
            ref="canvasRef"
            class="canvas-paper"
            :class="{ 'no-paper-size': !hasPaperSize }"
            :style="paperStyle"
            @drop="onDrop"
            @dragover="onDragOver"
          >
            <!-- 未选择画布大小时的提示 -->
            <div v-if="!hasPaperSize" class="paper-size-hint">
              <div class="hint-content">
                <span class="hint-icon">📄</span>
                <span class="hint-text">请在右侧属性面板选择画布大小</span>
              </div>
            </div>

            <template v-else>
              <!-- 左装订线 -->
              <div
                v-if="gutterLeftPx > 0"
                :style="gutterStyle.left"
                class="gutter-area gutter-left"
              >
                <span class="gutter-label">装订线</span>
              </div>

              <!-- 右装订线 -->
              <div
                v-if="gutterRightPx > 0"
                :style="gutterStyle.right"
                class="gutter-area gutter-right"
              >
                <span class="gutter-label">装订线</span>
              </div>

              <!-- 页眉 -->
              <div v-if="headerText" class="page-header">
                <span class="page-header-text">{{ headerText }}</span>
              </div>

              <!-- 页脚 -->
              <div v-if="footerText" class="page-footer">
                <span class="page-footer-text">{{ footerText }}</span>
              </div>

              <!-- 水印 -->
              <div v-if="watermark && watermark.text" class="watermark-container">
                <div
                  v-for="i in 20"
                  :key="i"
                  class="watermark-text"
                  :style="{
                    color: watermark.color,
                    opacity: watermark.opacity,
                    transform: `rotate(${watermark.angle}deg)`,
                    fontSize: `${watermark.fontSize}px`
                  }"
                >
                  {{ watermark.text }}
                </div>
              </div>

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
            </template>
          </div>
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
        style="width: 120px; margin: 0 8px"
        @change="handleScaleChange"
      />
      <a-button size="small" @click="handleZoomIn">
        <zoom-in-outlined />
      </a-button>
      <span class="zoom-percentage">{{ Math.round(editorStore.scale * 100) }}%</span>
      <a-button size="small" style="margin-left: 8px" @click="handleZoomReset"> 重置</a-button>
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
    overflow: auto;
  }

  .ruler-corner {
    background: #e8e8e8;
    border-right: 1px solid #d0d0d0;
    border-bottom: 1px solid #d0d0d0;
    position: sticky;
    top: 0;
    left: 0;
    z-index: 10;
  }

  .canvas-wrapper::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  .canvas-wrapper::-webkit-scrollbar-track {
    background: #f0f2f5;
  }

  .canvas-wrapper::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 6px;
  }

  .canvas-wrapper::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  .ruler {
    background: #f5f5f5;
    position: relative;
    overflow: visible;
  }

  .ruler-horizontal {
    height: 20px;
    border-bottom: 1px solid #d0d0d0;
    position: sticky;
    top: 0;
    z-index: 9;
  }

  .ruler-vertical {
    width: 20px;
    border-right: 1px solid #d0d0d0;
    position: sticky;
    left: 0;
    z-index: 9;
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
    padding: 0;
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

  .canvas-content {
    position: relative;
    min-width: max-content;
    min-height: max-content;
  }

  .canvas-paper {
    background: white;
    /* 田字格背景：每5mm一格 (5mm = 18.9px) */
    background-image:
      linear-gradient(to right, #e8e8e8 1px, transparent 1px),
      linear-gradient(to bottom, #e8e8e8 1px, transparent 1px);
    background-size: 18.9px 18.9px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    position: absolute;
    transform-origin: top left;
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

  .gutter-area {
    cursor: pointer;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gutter-area:hover {
    background-color: rgba(64, 158, 255, 0.25) !important;
  }

  .gutter-left {
    border-right: 1px dashed rgba(128, 128, 128, 0.5);
  }

  .gutter-right {
    border-left: 1px dashed rgba(128, 128, 128, 0.5);
  }

  .gutter-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 11px;
    color: rgba(128, 128, 128, 0.6);
    pointer-events: none;
    user-select: none;
    letter-spacing: 2px;
  }

  .page-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 5px 10px;
    border-bottom: 1px dashed rgba(128, 128, 128, 0.4);
    pointer-events: none;
    z-index: 0;
  }

  .page-header-text {
    display: block;
    font-size: 12px;
    color: #666;
    text-align: center;
    white-space: nowrap;
  }

  .page-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 5px 10px;
    border-top: 1px dashed rgba(128, 128, 128, 0.4);
    pointer-events: none;
    z-index: 0;
  }

  .page-footer-text {
    display: block;
    font-size: 12px;
    color: #666;
    text-align: center;
    white-space: nowrap;
  }

  .watermark-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(5, 1fr);
    gap: 20px;
    padding: 40px;
  }

  .watermark-text {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    white-space: nowrap;
    user-select: none;
    transform-origin: center;
  }

  .canvas-paper.no-paper-size {
    background: #fafafa;
    background-image: none;
    border: 2px dashed #d9d9d9;
  }

  .paper-size-hint {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hint-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #999;
  }

  .hint-icon {
    font-size: 48px;
  }

  .hint-text {
    font-size: 14px;
  }
</style>
