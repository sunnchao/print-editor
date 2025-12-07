<script setup lang="ts">
import { ref, onMounted, computed, provide, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons-vue'
import { useTemplateStore } from '@/stores/template'
import { useDataSourceStore } from '@/stores/datasource'
import type { Template, Widget, TableWidget } from '@/types'
import TextWidgetComp from '@/components/widgets/TextWidget.vue'
import TableWidgetComp from '@/components/widgets/TableWidget.vue'
import ImageWidgetComp from '@/components/widgets/ImageWidget.vue'
import LineWidgetComp from '@/components/widgets/LineWidget.vue'
import RectWidgetComp from '@/components/widgets/RectWidget.vue'
import BarcodeWidgetComp from '@/components/widgets/BarcodeWidget.vue'
import QRCodeWidgetComp from '@/components/widgets/QRCodeWidget.vue'

const route = useRoute()
const router = useRouter()
const templateStore = useTemplateStore()
const dataSourceStore = useDataSourceStore()

const template = ref<Template | null>(null)
const isLoading = ref(true)

// 存储复杂表格的实际高度变化
const tableHeightOffsets = reactive<Record<string, number>>({})

// 存储循环渲染组件的高度扩展
const loopWidgetExpansions = reactive<Record<string, number>>({})

provide('renderMode', 'preview')

const MM_TO_PX = 3.78

const paperStyle = computed(() => {
  if (!template.value) return {}
  return {
    width: `${template.value.paperSize.width * MM_TO_PX}px`,
    height: `${template.value.paperSize.height * MM_TO_PX}px`
  }
})

// 计算需要渲染的组件列表（包含循环的组件）
const renderedWidgets = computed(() => {
  if (!template.value) return []

  const result: Array<{ widget: Widget; dataRowIndex?: number; key: string; loopIndex?: number }> = []

  // 清空之前的循环扩展记录
  Object.keys(loopWidgetExpansions).forEach(key => {
    delete loopWidgetExpansions[key]
  })

  for (const widget of template.value.widgets) {
    // 表格组件不参与循环
    if (widget.type === 'table') {
      result.push({ widget, key: widget.id })
      continue
    }

    // 检查是否绑定了数据源
    const hasDataSource = 'dataSource' in widget && widget.dataSource
    if (!hasDataSource) {
      result.push({ widget, key: widget.id })
      continue
    }

    // 获取 dataRowIndex
    const dataRowIndex = 'dataRowIndex' in widget ? widget.dataRowIndex : 'all'

    // 如果是 'all'，循环所有数据
    if (dataRowIndex === 'all') {
      const columnData = dataSourceStore.getColumnData(widget.dataSource!)
      const loopCount = columnData.length

      // 记录循环扩展的高度（除第一个实例外，其他实例占用的额外高度）
      if (loopCount > 1) {
        loopWidgetExpansions[widget.id] = widget.height * (loopCount - 1)
      }

      for (let i = 0; i < loopCount; i++) {
        result.push({
          widget,
          dataRowIndex: i,
          key: `${widget.id}-row-${i}`,
          loopIndex: i
        })
      }
    } else if (typeof dataRowIndex === 'number') {
      // 如果是具体行索引，只渲染一次
      result.push({
        widget,
        dataRowIndex,
        key: `${widget.id}-row-${dataRowIndex}`
      })
    } else {
      // 默认情况（未设置 dataRowIndex）
      result.push({ widget, key: widget.id })
    }
  }

  return result
})

onMounted(async () => {
  await dataSourceStore.initFromDB()
  const id = route.params.id as string
  if (id) {
    const t = await templateStore.loadTemplate(id)
    if (t) {
      template.value = t
    } else {
      message.error('模板不存在')
      router.push('/')
    }
  }
  isLoading.value = false
})

function getWidgetComponent(type: string) {
  const components: Record<string, any> = {
    text: TextWidgetComp,
    table: TableWidgetComp,
    image: ImageWidgetComp,
    line: LineWidgetComp,
    rect: RectWidgetComp,
    barcode: BarcodeWidgetComp,
    qrcode: QRCodeWidgetComp
  }
  return components[type]
}

// 处理复杂表格高度变化
function handleTableHeightChange(widgetId: string, actualHeight: number) {
  if (!template.value) return

  const widget = template.value.widgets.find((w: Widget) => w.id === widgetId)
  if (!widget || widget.type !== 'table') return

  // 计算高度偏移量（实际高度 - 原始高度）
  const heightOffset = actualHeight - widget.height
  tableHeightOffsets[widgetId] = heightOffset
}

// 计算组件的累计位置偏移量
function getAccumulatedOffset(widget: Widget): number {
  if (!template.value) return 0

  let offset = 0

  // 遍历所有在当前组件上方的组件
  for (const w of template.value.widgets) {
    // 跳过当前组件及其之后的组件
    if (w.id === widget.id) break

    // 只考虑在当前组件上方的组件（y + height <= widget.y）
    if (w.y + w.height <= widget.y) {
      // 累加复杂表格的高度偏移
      if (w.type === 'table') {
        offset += tableHeightOffsets[w.id] || 0
      }

      // 累加循环组件的高度扩展
      offset += loopWidgetExpansions[w.id] || 0
    }
  }

  return offset
}

function getWidgetStyle(widget: Widget, item?: { widget: Widget; dataRowIndex?: number; loopIndex?: number }) {
  const baseStyle = {
    position: 'absolute' as const,
    left: `${widget.x}px`,
    top: `${widget.y}px`,
    width: `${widget.width}px`,
    height: `${widget.height}px`,
    zIndex: widget.zIndex
  }

  // 如果是复杂表格，应用实际高度
  if (widget.type === 'table') {
    const actualHeight = tableHeightOffsets[widget.id]
    if (actualHeight !== undefined) {
      baseStyle.height = `${widget.height + actualHeight}px`
    }
  }

  // 计算累计偏移量并调整 top 位置
  let offset = getAccumulatedOffset(widget)

  // 如果是循环组件的非首个实例，需要额外偏移
  if (item?.loopIndex !== undefined && item.loopIndex > 0) {
    offset += widget.height * item.loopIndex
  }

  if (offset !== 0) {
    baseStyle.top = `${widget.y + offset}px`
  }

  return baseStyle
}

function goBack() {
  router.back()
}

function handlePrint() {
  // 在打印前动态设置纸张大小
  if (template.value) {
    const { width, height } = template.value.paperSize

    // 移除旧的打印样式（如果存在）
    const oldStyle = document.getElementById('dynamic-print-style')
    if (oldStyle) {
      oldStyle.remove()
    }

    // 创建新的 style 元素
    const style = document.createElement('style')
    style.id = 'dynamic-print-style'
    style.textContent = `
      @page {
        size: ${width}mm ${height}mm;
        margin: 0;
      }
    `
    document.head.appendChild(style)
  }

  window.print()
}
</script>

<template>
  <div class="preview-page">
    <div class="preview-toolbar no-print">
      <a-button @click="goBack">
        <arrow-left-outlined />
        返回
      </a-button>
      <span v-if="template" class="template-title">{{ template.name }}</span>
      <a-button type="primary" @click="handlePrint">
        <printer-outlined />
        打印
      </a-button>
    </div>
    
    <div class="preview-container">
      <a-spin :spinning="isLoading">
        <div v-if="template" class="preview-paper" :style="paperStyle">
          <div
            v-for="item in renderedWidgets"
            :key="item.key"
            :style="getWidgetStyle(item.widget, item)"
          >
            <component
              :is="getWidgetComponent(item.widget.type)"
              :widget="item.widget"
              :data-row-index="item.dataRowIndex"
              @height-change="(height) => handleTableHeightChange(item.widget.id, height)"
            />
          </div>
        </div>
      </a-spin>
    </div>
  </div>
</template>

<style scoped>
.preview-page {
  min-height: 100vh;
  background: #f0f2f5;
  overflow-y: auto;
}

/* 覆盖全局 overflow: hidden，允许预览页面滚动 */
:global(html),
:global(body),
:global(#app) {
  overflow: visible !important;
  height: auto !important;
  min-height: 100vh;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  position: sticky;
  top: 0;
  z-index: 10;
}

.template-title {
  font-size: 16px;
  font-weight: 500;
}

.preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  min-height: calc(100vh - 49px);
}

.preview-paper {
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  position: relative;
  margin-bottom: 20px;
}

@media print {
  .no-print {
    display: none !important;
  }

  .preview-page {
    background: transparent;
  }

  .preview-container {
    padding: 0;
  }

  .preview-paper {
    box-shadow: none;
    margin: 0;
    page-break-after: always;
  }

  .preview-paper:last-child {
    page-break-after: auto;
  }
}
</style>
