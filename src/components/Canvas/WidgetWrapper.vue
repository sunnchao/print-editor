<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { Widget, SnapLine } from '@/types'
import TextWidgetComp from '../widgets/TextWidget.vue'
import TableWidgetComp from '../widgets/TableWidget.vue'
import ImageWidgetComp from '../widgets/ImageWidget.vue'
import LineWidgetComp from '../widgets/LineWidget.vue'
import RectWidgetComp from '../widgets/RectWidget.vue'
import BarcodeWidgetComp from '../widgets/BarcodeWidget.vue'
import QRCodeWidgetComp from '../widgets/QRCodeWidget.vue'

const props = defineProps<{
  widget: Widget
}>()

const emit = defineEmits<{
  contextmenu: [e: MouseEvent]
}>()

const editorStore = useEditorStore()

const isDragging = ref(false)
const isResizing = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// RAF 优化相关
let rafId: number | null = null
let lastMouseEvent: MouseEvent | null = null

const isSelected = computed(() => editorStore.selectedWidgetId === props.widget.id)

const wrapperStyle = computed(() => ({
  left: `${props.widget.x}px`,
  top: `${props.widget.y}px`,
  width: `${props.widget.width}px`,
  height: `${props.widget.height}px`,
  zIndex: props.widget.zIndex
}))

const widgetComponent = computed(() => {
  const components: Record<string, any> = {
    text: TextWidgetComp,
    table: TableWidgetComp,
    image: ImageWidgetComp,
    line: LineWidgetComp,
    rect: RectWidgetComp,
    barcode: BarcodeWidgetComp,
    qrcode: QRCodeWidgetComp
  }
  return components[props.widget.type]
})

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  editorStore.selectWidget(props.widget.id)

  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - props.widget.x,
    y: e.clientY - props.widget.y
  }

  window.addEventListener('mousemove', onDragThrottled)
  window.addEventListener('mouseup', onDragEnd)
}

// 使用 RAF 节流的拖拽处理
function onDragThrottled(e: MouseEvent) {
  if (!isDragging.value) return

  lastMouseEvent = e

  if (rafId === null) {
    rafId = requestAnimationFrame(processDrag)
  }
}

// 获取附近的组件（空间索引优化）
function getNearbyWidgets(x: number, y: number, width: number, height: number, threshold: number): Widget[] {
  const allWidgets = editorStore.widgets.filter(w => w.id !== props.widget.id)

  // 如果组件数量较少，直接返回所有组件
  if (allWidgets.length <= 10) {
    return allWidgets
  }

  // 计算扩展的边界框（包含吸附阈值）
  const expandedLeft = x - threshold
  const expandedRight = x + width + threshold
  const expandedTop = y - threshold
  const expandedBottom = y + height + threshold

  // 只返回在附近范围内的组件
  return allWidgets.filter(w => {
    const wRight = w.x + w.width
    const wBottom = w.y + w.height

    // 检查是否有重叠（包括阈值）
    return !(
      w.x > expandedRight ||
      wRight < expandedLeft ||
      w.y > expandedBottom ||
      wBottom < expandedTop
    )
  })
}

function processDrag() {
  rafId = null

  if (!lastMouseEvent || !isDragging.value) return

  const e = lastMouseEvent
  const scale = editorStore.scale

  let newX = (e.clientX - dragOffset.value.x) / scale
  let newY = (e.clientY - dragOffset.value.y) / scale

  // 吸附逻辑
  const threshold = 5
  const snapLines: SnapLine[] = []

  // 获取附近的组件（空间索引优化）
  const nearbyWidgets = getNearbyWidgets(
    newX,
    newY,
    props.widget.width,
    props.widget.height,
    threshold * 10 // 扩大搜索范围
  )

  // 水平方向吸附 (X轴)
  let snappedX = false

  // 1. 画布中心
  const paperWidth = editorStore.paperSize.width * 3.78 // MM_TO_PX
  if (Math.abs(newX + props.widget.width / 2 - paperWidth / 2) < threshold) {
    newX = paperWidth / 2 - props.widget.width / 2
    snapLines.push({ type: 'vertical', position: paperWidth / 2 })
    snappedX = true
  }

  // 2. 附近组件
  if (!snappedX) {
    for (const w of nearbyWidgets) {
      // 左对左
      if (Math.abs(newX - w.x) < threshold) {
        newX = w.x
        snapLines.push({ type: 'vertical', position: w.x })
        snappedX = true
        break
      }
      // 左对右
      if (Math.abs(newX - (w.x + w.width)) < threshold) {
        newX = w.x + w.width
        snapLines.push({ type: 'vertical', position: w.x + w.width })
        snappedX = true
        break
      }
      // 右对左
      if (Math.abs(newX + props.widget.width - w.x) < threshold) {
        newX = w.x - props.widget.width
        snapLines.push({ type: 'vertical', position: w.x })
        snappedX = true
        break
      }
      // 右对右
      if (Math.abs(newX + props.widget.width - (w.x + w.width)) < threshold) {
        newX = w.x + w.width - props.widget.width
        snapLines.push({ type: 'vertical', position: w.x + w.width })
        snappedX = true
        break
      }
      // 中对中
      if (Math.abs(newX + props.widget.width / 2 - (w.x + w.width / 2)) < threshold) {
        newX = w.x + w.width / 2 - props.widget.width / 2
        snapLines.push({ type: 'vertical', position: w.x + w.width / 2 })
        snappedX = true
        break
      }
    }
  }

  // 垂直方向吸附 (Y轴)
  let snappedY = false

  // 1. 画布中心
  const paperHeight = editorStore.paperSize.height * 3.78 // MM_TO_PX
  if (Math.abs(newY + props.widget.height / 2 - paperHeight / 2) < threshold) {
    newY = paperHeight / 2 - props.widget.height / 2
    snapLines.push({ type: 'horizontal', position: paperHeight / 2 })
    snappedY = true
  }

  // 2. 附近组件
  if (!snappedY) {
    for (const w of nearbyWidgets) {
      // 顶对顶
      if (Math.abs(newY - w.y) < threshold) {
        newY = w.y
        snapLines.push({ type: 'horizontal', position: w.y })
        snappedY = true
        break
      }
      // 顶对底
      if (Math.abs(newY - (w.y + w.height)) < threshold) {
        newY = w.y + w.height
        snapLines.push({ type: 'horizontal', position: w.y + w.height })
        snappedY = true
        break
      }
      // 底对顶
      if (Math.abs(newY + props.widget.height - w.y) < threshold) {
        newY = w.y - props.widget.height
        snapLines.push({ type: 'horizontal', position: w.y })
        snappedY = true
        break
      }
      // 底对底
      if (Math.abs(newY + props.widget.height - (w.y + w.height)) < threshold) {
        newY = w.y + w.height - props.widget.height
        snapLines.push({ type: 'horizontal', position: w.y + w.height })
        snappedY = true
        break
      }
      // 中对中
      if (Math.abs(newY + props.widget.height / 2 - (w.y + w.height / 2)) < threshold) {
        newY = w.y + w.height / 2 - props.widget.height / 2
        snapLines.push({ type: 'horizontal', position: w.y + w.height / 2 })
        snappedY = true
        break
      }
    }
  }
  
  editorStore.setSnapLines(snapLines)

  editorStore.updateWidget(props.widget.id, {
    x: newX,
    y: newY
  })
}

function onDragEnd() {
  isDragging.value = false
  lastMouseEvent = null

  // 清理未完成的 RAF
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  editorStore.clearSnapLines()
  window.removeEventListener('mousemove', onDragThrottled)
  window.removeEventListener('mouseup', onDragEnd)
}

function onResizeStart(e: MouseEvent, _handle: string) {
  e.stopPropagation()
  isResizing.value = true
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    width: props.widget.width,
    height: props.widget.height
  }
  
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', onResizeEnd)
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  
  const scale = editorStore.scale
  const dx = (e.clientX - resizeStart.value.x) / scale
  const dy = (e.clientY - resizeStart.value.y) / scale

  const nextWidth = Math.max(20, resizeStart.value.width + dx)
  const nextHeight = Math.max(20, resizeStart.value.height + dy)

  const snapLines: SnapLine[] = []
  const marginThreshold = 2
  const paperWidth = editorStore.paperSize.width * 3.78
  const paperHeight = editorStore.paperSize.height * 3.78

  if (paperWidth > 0) {
    const leftMargin = props.widget.x
    const rightMargin = paperWidth - (props.widget.x + nextWidth)
    if (Math.abs(leftMargin - rightMargin) <= marginThreshold) {
      snapLines.push({ type: 'vertical', position: props.widget.x })
      snapLines.push({ type: 'vertical', position: props.widget.x + nextWidth })
    }
  }

  if (paperHeight > 0) {
    const topMargin = props.widget.y
    const bottomMargin = paperHeight - (props.widget.y + nextHeight)
    if (Math.abs(topMargin - bottomMargin) <= marginThreshold) {
      snapLines.push({ type: 'horizontal', position: props.widget.y })
      snapLines.push({ type: 'horizontal', position: props.widget.y + nextHeight })
    }
  }

  if (snapLines.length > 0) {
    editorStore.setSnapLines(snapLines)
  } else {
    editorStore.clearSnapLines()
  }

  editorStore.updateWidget(props.widget.id, {
    width: nextWidth,
    height: nextHeight
  })
}

function onResizeEnd() {
  isResizing.value = false
  editorStore.clearSnapLines()
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', onResizeEnd)
}

function onContextMenu(e: MouseEvent) {
  emit('contextmenu', e)
}
</script>

<template>
  <div
    class="widget-wrapper"
    :class="{ selected: isSelected }"
    :style="wrapperStyle"
    @mousedown="onMouseDown"
    @contextmenu="onContextMenu"
  >
    <component :is="widgetComponent" :widget="widget" />
    
    <template v-if="isSelected">
      <div class="resize-handle se" @mousedown="onResizeStart($event, 'se')"></div>
      <div class="resize-handle sw" @mousedown="onResizeStart($event, 'sw')"></div>
      <div class="resize-handle ne" @mousedown="onResizeStart($event, 'ne')"></div>
      <div class="resize-handle nw" @mousedown="onResizeStart($event, 'nw')"></div>
    </template>
  </div>
</template>
