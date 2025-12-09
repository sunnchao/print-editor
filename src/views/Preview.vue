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
  const gutterLeft = (template.value.paperSize.gutterLeft || 0) * MM_TO_PX
  const gutterRight = (template.value.paperSize.gutterRight || 0) * MM_TO_PX

  return {
    width: `${template.value.paperSize.width * MM_TO_PX}px`,
    height: `${template.value.paperSize.height * MM_TO_PX}px`,
    paddingLeft: `${gutterLeft}px`,
    paddingRight: `${gutterRight}px`,
    boxSizing: 'border-box' as const
  }
})

// 装订线样式
const gutterStyle = computed(() => {
  if (!template.value) return { left: {}, right: {} }
  const gutterLeft = (template.value.paperSize.gutterLeft || 0) * MM_TO_PX
  const gutterRight = (template.value.paperSize.gutterRight || 0) * MM_TO_PX

  return {
    left: {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      width: `${gutterLeft}px`,
      height: '100%',
      background: 'repeating-linear-gradient(90deg, #e0e0e0 0px, #e0e0e0 1px, transparent 1px, transparent 5px)',
      pointerEvents: 'none' as const,
      zIndex: 1
    },
    right: {
      position: 'absolute' as const,
      right: 0,
      top: 0,
      width: `${gutterRight}px`,
      height: '100%',
      background: 'repeating-linear-gradient(90deg, #e0e0e0 0px, #e0e0e0 1px, transparent 1px, transparent 5px)',
      pointerEvents: 'none' as const,
      zIndex: 1
    }
  }
})

// 页眉页脚内容
const headerText = computed(() => template.value?.paperSize.header || '')
const footerText = computed(() => template.value?.paperSize.footer || '')

// 水印配置
const watermark = computed(() => template.value?.paperSize.watermark)

// 计算复杂表格的实际渲染行数
function getComplexTableActualRows(widget: any): number {
  if (widget.type !== 'table' || widget.tableMode !== 'complex') {
    return widget.rows || 0
  }

  const columnBindings = widget.columnBindings || {}
  const bindingKeys = Object.keys(columnBindings)
  const headerRows = widget.headerRows || 0
  const bodyRowCount = Math.max(widget.rows - headerRows, 0)

  if (bindingKeys.length === 0) {
    return widget.rows
  }

  let maxLen = 0
  bindingKeys.forEach((key: string) => {
    const binding = columnBindings[Number(key)]
    const data = dataSourceStore.getColumnData(binding)
    if (data.length > maxLen) maxLen = data.length
  })

  if (!maxLen) {
    return widget.rows
  }

  return Math.max(maxLen + headerRows, bodyRowCount + headerRows)
}

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
  const pages: Array<Array<{ widget: Widget; dataRowIndex?: number; key: string; loopIndex?: number; pageOffset: number; topInPage: number; tableStartRow?: number; tableEndRow?: number }>> = []

  let currentPage: Array<{ widget: Widget; dataRowIndex?: number; key: string; loopIndex?: number; pageOffset: number; topInPage: number; tableStartRow?: number; tableEndRow?: number }> = []
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
    const needNewPage = currentPage.length > 0 && (
      globalForce || // 全局强制分页
      widget.forcePageBreak || // 组件强制分页
      (spaceLeft < actualHeight && widget.type !== 'table') // 空间不足（非表格）
    )

    if (needNewPage) {
      // 保存当前页
      pages.push(currentPage)

      // 创建新页
      currentPage = []
      currentPageIndex++
      nextTopInCurrentPage = 0  // 新页面从顶部开始
    }

    // 处理复杂表格的跨页分割
    if (widget.type === 'table' && widget.tableMode === 'complex' && actualHeight > paperHeight) {
      // 复杂表格高度超过一页，需要跨页分割
      const tableWidget = widget as any
      const actualRows = getComplexTableActualRows(tableWidget)
      const headerRows = tableWidget.headerRows || 0

      if (actualRows > headerRows) {
        // 计算每行的平均高度
        const rowHeight = actualHeight / actualRows

        // 如果当前页有其他内容，先保存当前页
        if (currentPage.length > 0) {
          pages.push(currentPage)
          currentPage = []
          currentPageIndex++
          nextTopInCurrentPage = 0
        }

        // 分割表格到多个页面
        let currentRow = 0

        while (currentRow < actualRows) {
          // 计算当前页可以容纳的行数
          const maxRowsInPage = Math.floor(paperHeight / rowHeight)

          // 确保每页至少包含表头
          if (maxRowsInPage <= headerRows) {
            // 页面太小，无法容纳表头，强制放入
            currentPage.push({
              ...item,
              key: currentRow === 0 ? item.key : `${item.key}-page-${currentPageIndex}`,
              pageOffset: currentPageIndex * paperHeight,
              topInPage: 0,
              tableStartRow: currentRow,
              tableEndRow: Math.min(currentRow + maxRowsInPage - 1, actualRows - 1)
            })

            currentRow += maxRowsInPage
          } else {
            // 正常情况：包含表头和数据行
            const endRow = Math.min(currentRow + maxRowsInPage - 1, actualRows - 1)

            currentPage.push({
              ...item,
              key: currentRow === 0 ? item.key : `${item.key}-page-${currentPageIndex}`,
              pageOffset: currentPageIndex * paperHeight,
              topInPage: 0,
              tableStartRow: currentRow,
              tableEndRow: endRow
            })

            currentRow = endRow + 1
          }

          // 保存当前页并准备下一页
          pages.push(currentPage)
          currentPage = []
          currentPageIndex++
          nextTopInCurrentPage = 0
        }

        continue
      }
    }

    // 处理复杂表格在当前页放不下的情况（但总高度不超过一页）
    if (widget.type === 'table' && widget.tableMode === 'complex' && actualHeight > spaceLeft && currentPage.length > 0) {
      // 保存当前页，表格放到新页
      pages.push(currentPage)
      currentPage = []
      currentPageIndex++
      nextTopInCurrentPage = 0
    }

    // 将组件添加到当前页
    currentPage.push({
      ...item,
      pageOffset: currentPageIndex * paperHeight,
      topInPage: nextTopInCurrentPage
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
            <!-- 左装订线 -->
            <div v-if="template.paperSize.gutterLeft" :style="gutterStyle.left" class="gutter-area"></div>

            <!-- 右装订线 -->
            <div v-if="template.paperSize.gutterRight" :style="gutterStyle.right" class="gutter-area"></div>

            <!-- 页眉 -->
            <div v-if="headerText" class="page-header">{{ headerText }}</div>

            <!-- 页脚 -->
            <div v-if="footerText" class="page-footer">{{ footerText }}</div>

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

            <div
              v-for="item in pageWidgets"
              :key="item.key"
              :style="getWidgetStyle(item.widget, item)"
            >
              <component
                :is="getWidgetComponent(item.widget.type)"
                :widget="item.widget"
                :data-row-index="item.dataRowIndex"
                :start-row="item.tableStartRow"
                :end-row="item.tableEndRow"
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

.gutter-area {
  border-right: 1px dashed #ccc;
}

.page-header {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #666;
  text-align: center;
  pointer-events: none;
  z-index: 0;
  white-space: nowrap;
}

.page-footer {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #666;
  text-align: center;
  pointer-events: none;
  z-index: 0;
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
