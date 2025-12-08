<script setup lang="ts">
import { ref, onMounted, computed, provide, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { ArrowLeftOutlined, PrinterOutlined, DownloadOutlined, FileTextOutlined, FilePdfOutlined } from '@ant-design/icons-vue'
import { useTemplateStore } from '@/stores/template'
import { useDataSourceStore } from '@/stores/datasource'
import type { Template, Widget } from '@/types'
import { exportAsHtml, downloadHtml } from '@/utils/exportHtml'
import { exportAsPdf } from '@/utils/exportPdf'
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

// 将组件分组到不同的页面，支持自动分页
const pagedWidgets = computed(() => {
  if (!template.value || renderedWidgets.value.length === 0) {
    return []
  }

  const paperHeight = template.value.paperSize.height * MM_TO_PX
  const pages: Array<Array<{ widget: Widget; dataRowIndex?: number; key: string; loopIndex?: number; pageOffset: number; topInPage: number }>> = []

  let currentPage: Array<{ widget: Widget; dataRowIndex?: number; key: string; loopIndex?: number; pageOffset: number; topInPage: number }> = []
  let currentPageIndex = 0
  let nextTopInCurrentPage = 0  // 下一个组件在当前页面中应该放置的 top 位置

  // 检查是否启用了全局强制分页
  const globalForce = template.value.globalForcePageBreak || false

  for (const item of renderedWidgets.value) {
    const widget = item.widget

    // 计算组件的实际高度
    let actualHeight = widget.height
    if (widget.type === 'table') {
      const heightOffset = tableHeightOffsets[widget.id] || 0
      actualHeight += heightOffset
    }

    // 检查当前页面的剩余空间是否足够
    const spaceLeft = paperHeight - nextTopInCurrentPage

    // 判断是否需要换页：
    // 1. 全局强制分页：每个组件独占一页（除了当前页为空）
    // 2. 组件强制分页：该组件独占一页（除了当前页为空）
    // 3. 常规逻辑：剩余空间不足以容纳整个组件，且当前页不为空
    // 4. 复杂表格除外（表格可以跨页）
    const needNewPage = currentPage.length > 0 && (
      globalForce || // 全局强制分页
      widget.forcePageBreak || // 组件强制分页
      (spaceLeft < actualHeight && widget.type !== 'table') // 空间不足
    )

    if (needNewPage) {
      // 保存当前页
      pages.push(currentPage)

      // 创建新页
      currentPage = []
      currentPageIndex++
      nextTopInCurrentPage = 0  // 新页面从顶部开始
    }

    // 将组件添加到当前页
    currentPage.push({
      ...item,
      pageOffset: currentPageIndex * paperHeight,
      topInPage: nextTopInCurrentPage  // 记录在当前页面中的位置
    })

    // 更新下一个组件的位置
    nextTopInCurrentPage += actualHeight

    // 如果启用了全局强制分页或组件强制分页，当前组件后立即新建页面
    if (globalForce || widget.forcePageBreak) {
      pages.push(currentPage)
      currentPage = []
      currentPageIndex++
      nextTopInCurrentPage = 0
    }
  }

  // 添加最后一页
  if (currentPage.length > 0) {
    pages.push(currentPage)
  }

  return pages
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
      isLoading.value = false
      return
    }
  }
  isLoading.value = false

  // 检查是否需要自动打印
  const autoPrint = route.query.autoPrint === 'true'
  if (autoPrint && template.value) {
    // 等待 DOM 更新和渲染完成后再触发打印
    setTimeout(() => {
      handlePrint()
    }, 500) // 给予足够时间让页面完全渲染
  }

  // 检查是否需要自动导出 PDF
  const exportPdf = route.query.exportPdf === 'true'
  if (exportPdf && template.value) {
    // 等待 DOM 更新和渲染完成后再触发导出
    setTimeout(() => {
      handleExportPdf()
    }, 800) // 给予足够时间让页面完全渲染
  }
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

// 创建表格高度变化处理函数（用于模板绑定）
const createHeightChangeHandler = (widgetId: string) => {
  return (height: number) => handleTableHeightChange(widgetId, height)
}

function getWidgetStyle(widget: Widget, item?: { widget: Widget; dataRowIndex?: number; loopIndex?: number; pageOffset?: number; topInPage?: number }) {
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

  // 使用新的分页逻辑：直接使用 topInPage 位置
  if (item?.topInPage !== undefined) {
    baseStyle.top = `${item.topInPage}px`
  }

  return baseStyle
}

function goBack() {
  router.back()
}

function handlePrint() {
  // 在打印前动态设置画布大小
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

function handleExportHtml() {
  if (!template.value) {
    message.error('模板数据不存在')
    return
  }

  try {
    const html = exportAsHtml(template.value, dataSourceStore)
    downloadHtml(html, template.value.name)
    message.success('HTML 导出成功，可在浏览器中打开并二次编辑')
  } catch (error) {
    message.error('HTML 导出失败')
    console.error(error)
  }
}

async function handleExportPdf() {
  if (!template.value) {
    message.error('模板数据不存在')
    return
  }

  const pageElements = Array.from(document.querySelectorAll('.preview-paper')) as HTMLElement[]
  if (pageElements.length === 0) {
    message.error('未找到预览页面元素')
    return
  }

  try {
    message.loading('正在生成 PDF，请稍候...', 0)

    // 如果有多页，使用多页导出
    if (pageElements.length > 1) {
      const { exportMultiPagePdf } = await import('@/utils/exportPdf')
      await exportMultiPagePdf(template.value, pageElements, {
        filename: template.value.name,
        quality: 8,
        scale: 2
      })
    } else {
      // 单页使用原来的导出方式
      await exportAsPdf(template.value, pageElements[0], {
        filename: template.value.name,
        quality: 8,
        scale: 2
      })
    }

    message.destroy()
    message.success('PDF 导出成功')
  } catch (error) {
    message.destroy()
    message.error('PDF 导出失败')
    console.error(error)
  }
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
      <a-space>
        <a-button type="primary" @click="handlePrint">
          <printer-outlined />
          打印
        </a-button>
        <a-dropdown>
          <a-button>
            <download-outlined />
            导出
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="html" @click="handleExportHtml">
                <file-text-outlined />
                导出为 HTML
              </a-menu-item>
              <a-menu-item key="pdf" @click="handleExportPdf">
                <file-pdf-outlined />
                导出为 PDF
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-space>
    </div>
    
    <div class="preview-container">
      <a-spin :spinning="isLoading">
        <template v-if="template">
          <div
            v-for="(pageWidgets, pageIndex) in pagedWidgets"
            :key="`page-${pageIndex}`"
            class="preview-paper"
            :style="paperStyle"
          >
            <div
              v-for="item in pageWidgets"
              :key="item.key"
              :style="getWidgetStyle(item.widget, item)"
            >
              <component
                :is="getWidgetComponent(item.widget.type)"
                :widget="item.widget"
                :data-row-index="item.dataRowIndex"
                @height-change="createHeightChangeHandler(item.widget.id)"
              />
            </div>
          </div>
        </template>
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
