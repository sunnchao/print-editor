<script setup lang="ts">
  import { ref, onMounted, computed, provide, reactive } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { message } from 'ant-design-vue'
  import {
    ArrowLeftOutlined,
    PrinterOutlined,
    DownloadOutlined,
    FileTextOutlined,
    FilePdfOutlined
  } from '@ant-design/icons-vue'
  import { useTemplateStore } from '@/stores/template'
  import { useDataSourceStore } from '@/stores/datasource'
  import type { Template, Widget } from '@/types'
  import { MM_TO_PX } from '@/types'
  import { exportAsHtml, downloadHtml } from '@/utils/exportHtml'
  import { exportAsPdf } from '@/utils/exportPdf'
  import { normalizeBatchPrintConfig } from '@/utils/batchPrint'
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

  const isPopupPreview = computed(() => route.query.popup === '1')

  // 存储复杂表格的实际高度变化
  const tableHeightOffsets = reactive<Record<string, number>>({})

  // 存储循环渲染组件的高度扩展
  const loopWidgetExpansions = reactive<Record<string, number>>({})

  provide('renderMode', 'preview')

  // 页眉页脚高度常量（毫米）
  const HEADER_HEIGHT_MM = 8
  const FOOTER_HEIGHT_MM = 8

  // 页眉页脚内容
  const headerText = computed(() => template.value?.paperSize.header || '')
  const footerText = computed(() => template.value?.paperSize.footer || '')

  function getTemplateReferencedColumns(t: Template): Set<string> {
    const columns = new Set<string>()
    for (const widget of t.widgets) {
      if (
        'dataSource' in widget &&
        typeof (widget as any).dataSource === 'string' &&
        (widget as any).dataSource
      ) {
        columns.add((widget as any).dataSource)
      }
      if (widget.type === 'table') {
        const table: any = widget
        const bindings = table.columnBindings || {}
        Object.values(bindings).forEach((v: any) => {
          if (typeof v === 'string' && v) columns.add(v)
        })
        const cells: any[][] = table.cells || []
        cells.forEach(row =>
          row.forEach(cell => {
            const ds = cell?.dataSource
            if (typeof ds === 'string' && ds) columns.add(ds)
          })
        )
      }
    }
    return columns
  }

  function ensurePreviewDataSource() {
    if (!template.value) return

    const preferredFileName = template.value.batchPrint?.dataSourceFile
    if (preferredFileName) {
      const exists = dataSourceStore.dataSources.some(ds => ds.fileName === preferredFileName)
      if (exists) {
        dataSourceStore.setCurrentDataSource(preferredFileName)
        return
      }
    }

    const referencedColumns = getTemplateReferencedColumns(template.value)
    if (referencedColumns.size === 0) return

    const currentFileName = dataSourceStore.currentDataSource?.fileName
    const currentMatchCount = dataSourceStore.currentDataSource
      ? dataSourceStore.currentDataSource.columns.reduce(
          (acc, col) => acc + (referencedColumns.has(col.name) ? 1 : 0),
          0
        )
      : 0

    let bestFileName: string | null = null
    let bestMatchCount = 0
    for (const ds of dataSourceStore.dataSources) {
      const matchCount = ds.columns.reduce(
        (acc, col) => acc + (referencedColumns.has(col.name) ? 1 : 0),
        0
      )
      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount
        bestFileName = ds.fileName
      }
    }

    if (bestFileName && bestMatchCount > currentMatchCount && bestFileName !== currentFileName) {
      dataSourceStore.setCurrentDataSource(bestFileName)
    }
  }

  // 页眉页脚高度（像素）
  const headerHeightPx = computed(() => (headerText.value ? HEADER_HEIGHT_MM * MM_TO_PX : 0))
  const footerHeightPx = computed(() => (footerText.value ? FOOTER_HEIGHT_MM * MM_TO_PX : 0))

  const paperStyle = computed(() => {
    if (!template.value) return {}
    const gutterLeft = (template.value.paperSize.gutterLeft || 0) * MM_TO_PX
    const gutterRight = (template.value.paperSize.gutterRight || 0) * MM_TO_PX

    return {
      width: `${template.value.paperSize.width * MM_TO_PX}px`,
      height: `${template.value.paperSize.height * MM_TO_PX}px`,
      paddingLeft: `${gutterLeft}px`,
      paddingRight: `${gutterRight}px`,
      paddingTop: `${headerHeightPx.value}px`,
      paddingBottom: `${footerHeightPx.value}px`,
      boxSizing: 'border-box' as const
    }
  })

  // 水印配置
  const watermark = computed(() => template.value?.paperSize.watermark)

  // ========== 批量打印模式相关 ==========

  /**
   * 判断是否启用了批量打印模式
   * 需要同时满足：启用开关 + 选择了数据源 + 数据源存在
   */
  const isBatchMode = computed(() => {
    if (!template.value?.batchPrint?.enabled) return false
    const fileName = template.value.batchPrint.dataSourceFile
    if (!fileName) return false
    const ds = dataSourceStore.dataSources.find(d => d.fileName === fileName)
    return ds && ds.columns.length > 0 && ds.columns[0].data.length > 0
  })

  /**
   * 获取批量打印的数据行索引数组
   * 例如: [0, 1, 2, 3, 4] 表示打印第 1-5 条数据
   */
  const batchDataRows = computed(() => {
    if (!isBatchMode.value || !template.value?.batchPrint) return []

    const fileName = template.value.batchPrint.dataSourceFile!
    const ds = dataSourceStore.dataSources.find(d => d.fileName === fileName)
    if (!ds || ds.columns.length === 0) return []

    const totalRows = ds.columns[0].data.length
    const { printRange, rangeStart, rangeEnd } = template.value.batchPrint

    // 根据打印范围生成行索引数组
    if (printRange === 'range' && rangeStart !== undefined && rangeEnd !== undefined) {
      const start = Math.max(0, rangeStart)
      const end = Math.min(totalRows - 1, rangeEnd)
      return Array.from({ length: end - start + 1 }, (_, i) => start + i)
    }

    // 全部打印
    return Array.from({ length: totalRows }, (_, i) => i)
  })

  /**
   * 批量打印模式下，设置当前数据源（确保组件能正确读取数据）
   */
  const ensureBatchDataSource = () => {
    if (isBatchMode.value && template.value?.batchPrint?.dataSourceFile) {
      dataSourceStore.setCurrentDataSource(template.value.batchPrint.dataSourceFile)
    }
  }

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
  // 非批量打印模式下，固定只使用第一条数据
  const renderedWidgets = computed(() => {
    if (!template.value) return []

    const result: Array<{
      widget: Widget
      dataRowIndex?: number
      dataRangeStart?: number
      dataRangeCount?: number
      key: string
      loopIndex?: number
    }> = []

    // 清空之前的循环扩展记录
    Object.keys(loopWidgetExpansions).forEach(key => {
      delete loopWidgetExpansions[key]
    })

    for (const widget of template.value.widgets) {
      // 表格组件：非批量打印模式下固定使用第一条数据
      if (widget.type === 'table') {
        result.push({
          widget,
          key: widget.id,
          dataRowIndex: 0, // 兼容旧逻辑
          dataRangeStart: 0,
          dataRangeCount: 1 // 非批量打印默认范围 = 1
        })
        continue
      }

      // 检查是否绑定了数据源
      const hasDataSource = 'dataSource' in widget && widget.dataSource
      if (!hasDataSource) {
        result.push({ widget, key: widget.id, dataRowIndex: 0 })
        continue
      }

      // 非批量打印模式下，固定只使用第一条数据（dataRowIndex = 0）
      result.push({
        widget,
        dataRowIndex: 0,
        dataRangeStart: 0,
        dataRangeCount: 1,
        key: `${widget.id}-row-0`
      })
    }

    return result
  })

  // 将组件分组到不同的页面，支持自动分页
  const pagedWidgets = computed(() => {
    if (!template.value) {
      return []
    }

    const paperHeight = template.value.paperSize.height * MM_TO_PX
    // 计算可用内容高度（减去页眉页脚占位）
    const contentHeight = paperHeight - headerHeightPx.value - footerHeightPx.value

    // ========== 批量打印模式：每个数据行生成一个完整页面 ==========
    if (isBatchMode.value && batchDataRows.value.length > 0) {
      // 确保数据源已设置
      ensureBatchDataSource()

      const batchPages: Array<
        Array<{
          widget: Widget
          dataRowIndex?: number
          dataRangeStart?: number
          dataRangeCount?: number
          key: string
          loopIndex?: number
          pageOffset: number
          topInPage: number
          tableStartRow?: number
          tableEndRow?: number
        }>
      > = []

      // 遍历每个数据行，为其生成一个完整页面
      for (const rowIndex of batchDataRows.value) {
        const pageWidgets: Array<{
          widget: Widget
          dataRowIndex: number
          dataRangeStart?: number
          dataRangeCount?: number
          key: string
          pageOffset: number
          topInPage: number
          tableStartRow?: number
          tableEndRow?: number
        }> = []

        // 将模板中的所有组件复制到当前页面，并绑定到当前数据行
        for (const widget of template.value.widgets) {
          pageWidgets.push({
            widget,
            dataRowIndex: rowIndex, // 关键：传递当前数据行索引
            dataRangeStart: rowIndex,
            dataRangeCount: 1, // 批量打印每页范围 = 1
            key: `${widget.id}-batch-${rowIndex}`,
            pageOffset: batchPages.length * paperHeight,
            topInPage: widget.y // 使用组件原始位置（padding已处理偏移）
          })
        }

        batchPages.push(pageWidgets)
      }

      return batchPages
    }

    // ========== 常规模式：使用组件原始位置，但兼容复杂组件高度变化 ==========
    if (renderedWidgets.value.length === 0) {
      return []
    }

    // 先按 y 坐标排序组件
    const sortedWidgets = [...renderedWidgets.value].sort((a, b) => a.widget.y - b.widget.y)

    const pages: Array<
      Array<{
        widget: Widget
        dataRowIndex?: number
        key: string
        loopIndex?: number
        pageOffset: number
        topInPage: number
        tableStartRow?: number
        tableEndRow?: number
      }>
    > = []

    let currentPage: Array<{
      widget: Widget
      dataRowIndex?: number
      key: string
      loopIndex?: number
      pageOffset: number
      topInPage: number
      tableStartRow?: number
      tableEndRow?: number
    }> = []
    let currentPageIndex = 0
    let nextMinTop = 0 // 下一个组件的最小 top 位置（前一个组件底部）

    // 检查是否启用了全局强制分页
    const globalForce = template.value.globalForcePageBreak || false

    for (const item of sortedWidgets) {
      const widget = item.widget

      // 计算组件的实际高度（毫米转像素）
      let actualHeightPx = widget.height * MM_TO_PX
      if (widget.type === 'table') {
        if (widget.tableMode === 'complex') {
          // 直接计算复杂表格的实际高度，不依赖组件回调
          const actualRows = getComplexTableActualRows(widget)
          const originalRows = widget.rows
          if (originalRows > 0 && actualRows > 0) {
            actualHeightPx = widget.height * MM_TO_PX * (actualRows / originalRows)
          }
        } else {
          const heightOffset = tableHeightOffsets[widget.id] || 0
          actualHeightPx += heightOffset * MM_TO_PX
        }
      }

      // 计算组件应该放置的位置：使用原始位置，但如果与前一个组件重叠则下移
      const widgetOriginalTop = widget.y * MM_TO_PX
      const topInPage = Math.max(widgetOriginalTop, nextMinTop)

      // 检查当前页面的剩余空间是否足够（使用内容区高度）
      const spaceLeft = contentHeight - topInPage

      // 判断是否需要换页：
      // 1. 全局强制分页：每个组件独占一页（除了当前页为空）
      // 2. 组件强制分页：该组件独占一页（除了当前页为空）
      // 3. 常规逻辑：剩余空间不足以容纳整个组件，且当前页不为空
      const needNewPage =
        currentPage.length > 0 &&
        (globalForce || // 全局强制分页
          widget.forcePageBreak || // 组件强制分页
          (spaceLeft < actualHeightPx && widget.type !== 'table')) // 空间不足（非表格）

      if (needNewPage) {
        // 保存当前页
        pages.push(currentPage)

        // 创建新页
        currentPage = []
        currentPageIndex++
        nextMinTop = 0 // 新页面从顶部开始
      }

      // 重新计算当前页的 topInPage（换页后可能变化）
      const finalTopInPagePx =
        currentPageIndex === 0 ? topInPage : Math.max(widget.y * MM_TO_PX, nextMinTop)
      const finalSpaceLeft = contentHeight - finalTopInPagePx

      // 处理复杂表格的跨页分割（从当前位置开始渲染）
      if (
        widget.type === 'table' &&
        widget.tableMode === 'complex' &&
        actualHeightPx > finalSpaceLeft
      ) {
        const tableWidget = widget as any
        const actualRows = getComplexTableActualRows(tableWidget)
        const headerRows = tableWidget.headerRows || 0

        if (actualRows > headerRows) {
          // 计算每行的平均高度
          const rowHeight = actualHeightPx / actualRows

          // 计算当前页剩余空间能容纳多少行（包括表头）
          const rowsInCurrentPage = Math.floor(finalSpaceLeft / rowHeight)

          // 如果当前页剩余空间至少能放下表头+1行数据，先在当前页渲染部分表格
          if (rowsInCurrentPage > headerRows) {
            // 在当前页渲染部分表格
            const endRowInCurrentPage = rowsInCurrentPage - 1

            currentPage.push({
              ...item,
              key: item.key,
              pageOffset: currentPageIndex * paperHeight,
              topInPage: finalTopInPagePx / MM_TO_PX, // 转回毫米
              tableStartRow: 0,
              tableEndRow: endRowInCurrentPage
            })

            // 保存当前页
            pages.push(currentPage)
            currentPage = []
            currentPageIndex++
            nextMinTop = 0

            // 继续处理剩余的行
            let currentRow = endRowInCurrentPage + 1

            while (currentRow < actualRows) {
              // 新页面从顶部开始，计算能容纳的行数（使用内容区高度）
              const maxRowsInPage = Math.floor(contentHeight / rowHeight)
              const endRow = Math.min(currentRow + maxRowsInPage - 1, actualRows - 1)

              currentPage.push({
                ...item,
                key: `${item.key}-page-${currentPageIndex}`,
                pageOffset: currentPageIndex * paperHeight,
                topInPage: 0,
                tableStartRow: currentRow,
                tableEndRow: endRow
              })

              currentRow = endRow + 1

              // 如果还有剩余行，保存当前页并准备下一页
              if (currentRow < actualRows) {
                pages.push(currentPage)
                currentPage = []
                currentPageIndex++
                nextMinTop = 0
              } else {
                // 最后一部分表格，更新 nextMinTop
                const lastPartHeight = (endRow - (currentRow - maxRowsInPage) + 1) * rowHeight
                nextMinTop = lastPartHeight
              }
            }
          } else {
            // 当前页剩余空间太小，保存当前页，整个表格从新页面开始
            if (currentPage.length > 0) {
              pages.push(currentPage)
              currentPage = []
              currentPageIndex++
              nextMinTop = 0
            }

            // 分割表格到多个页面
            let currentRow = 0

            while (currentRow < actualRows) {
              const maxRowsInPage = Math.floor(contentHeight / rowHeight)
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

              if (currentRow < actualRows) {
                pages.push(currentPage)
                currentPage = []
                currentPageIndex++
                nextMinTop = 0
              } else {
                const lastPartHeight = (endRow - (currentRow - maxRowsInPage) + 1) * rowHeight
                nextMinTop = lastPartHeight
              }
            }
          }

          continue
        }
      }

      // 将组件添加到当前页（使用原始位置或调整后的位置）
      currentPage.push({
        ...item,
        pageOffset: currentPageIndex * paperHeight,
        topInPage: finalTopInPagePx / MM_TO_PX // 转回毫米
      })

      // 更新下一个组件的最小 top 位置（当前组件底部）
      nextMinTop = finalTopInPagePx + actualHeightPx

      // 如果启用了全局强制分页或组件强制分页，当前组件后立即新建页面
      if (globalForce || widget.forcePageBreak) {
        pages.push(currentPage)
        currentPage = []
        currentPageIndex++
        nextMinTop = 0
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
        // 检查是否已选择画布大小
        if (!t.paperSize) {
          message.error('请先选择画布大小')
          router.push(`/editor/${id}`)
          isLoading.value = false
          return
        }
        template.value = t
        if (template.value.batchPrint) {
          template.value.batchPrint = normalizeBatchPrintConfig(template.value.batchPrint)
        }
        ensurePreviewDataSource()
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

  function getWidgetStyle(
    widget: Widget,
    item?: {
      widget: Widget
      dataRowIndex?: number
      loopIndex?: number
      pageOffset?: number
      topInPage?: number
    }
  ) {
    // 组件存储的是毫米，渲染时转换为像素
    const baseStyle = {
      position: 'absolute' as const,
      left: `${widget.x * MM_TO_PX}px`,
      top: `${widget.y * MM_TO_PX}px`,
      width: `${widget.width * MM_TO_PX}px`,
      height: `${widget.height * MM_TO_PX}px`,
      zIndex: widget.zIndex
    }

    // 如果是复杂表格，应用实际高度（毫米转像素）
    if (widget.type === 'table') {
      const actualHeight = tableHeightOffsets[widget.id]
      if (actualHeight !== undefined) {
        baseStyle.height = `${(widget.height + actualHeight) * MM_TO_PX}px`
      }
    }

    // 使用新的分页逻辑：topInPage 是毫米，转换为像素
    if (item?.topInPage !== undefined) {
      baseStyle.top = `${item.topInPage * MM_TO_PX}px`
    }

    return baseStyle
  }

  function goBack() {
    if (isPopupPreview.value) {
      if (window.opener) {
        window.close()
        return
      }
    }
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
        {{ isPopupPreview ? '关闭' : '返回' }}
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
              <!-- <a-menu-item key="html" @click="handleExportHtml">
                <file-text-outlined />
                导出为 HTML
              </a-menu-item> -->
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
                :data-range-start="item.dataRangeStart"
                :data-range-count="item.dataRangeCount"
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

  .page-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #666;
    text-align: center;
    pointer-events: none;
    z-index: 0;
    white-space: nowrap;
  }

  .page-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
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
