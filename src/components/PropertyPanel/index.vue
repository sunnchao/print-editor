<script setup lang="ts">
  import { useDataSourceStore } from '@/stores/datasource'
  import { useEditorStore } from '@/stores/editor'
  import { PAPER_SIZES } from '@/types'
  import { getWidgetCode, getWidgetTypeLabel } from '@/utils/widgetCode'
  import { SwapOutlined, UploadOutlined } from '@ant-design/icons-vue'
  import type { UploadChangeParam } from 'ant-design-vue'
  import { message } from 'ant-design-vue'
  import { computed, ref, watch } from 'vue'
  import BarcodeProperties from './BarcodeProperties.vue'
  import ImageProperties from './ImageProperties.vue'
  import LineProperties from './LineProperties.vue'
  import QRCodeProperties from './QRCodeProperties.vue'
  import RectProperties from './RectProperties.vue'
  import TableProperties from './TableProperties.vue'
  import TextProperties from './TextProperties.vue'

  const editorStore = useEditorStore()
  const dataSourceStore = useDataSourceStore()

  const activeTab = ref('properties')

  const isCustomPaper = computed(() => editorStore.paperSize?.name === '自定义')

  // 统一数据源选择：只保留 batchPrint 的 store 作为单一数据源选择状态
  watch(
    () => editorStore.batchPrint.dataSourceFile,
    fileName => {
      if (!fileName) {
        dataSourceStore.currentDataSource = null
        return
      }
      if (!dataSourceStore.dataSources.some(ds => ds.fileName === fileName)) return
      if (dataSourceStore.currentDataSource?.fileName === fileName) return
      dataSourceStore.setCurrentDataSource(fileName)
    }
  )

  const selectedDataSource = computed(() => {
    const fileName = editorStore.batchPrint.dataSourceFile
    if (!fileName) return null
    return dataSourceStore.dataSources.find(ds => ds.fileName === fileName) || null
  })

  const selectedDataSourceColumnNames = computed(() => {
    const cols = selectedDataSource.value?.columns ?? []
    return cols.map(c => c.name).join('，')
  })

  const propertyComponent = computed(() => {
    if (!editorStore.selectedWidget) return null
    const components: Record<string, any> = {
      text: TextProperties,
      table: TableProperties,
      image: ImageProperties,
      line: LineProperties,
      rect: RectProperties,
      barcode: BarcodeProperties,
      qrcode: QRCodeProperties
    }
    return components[editorStore.selectedWidget.type]
  })

  const selectedWidgetCode = computed(() => {
    if (!editorStore.selectedWidget) return ''
    return getWidgetCode(editorStore.selectedWidget)
  })

  const usedWidgets = computed(() => {
    return [...editorStore.widgets].sort((a, b) => a.zIndex - b.zIndex)
  })

  function handleSelectWidgetFromList(id: string) {
    editorStore.selectWidget(id)
  }

  // ========== 批量打印相关计算属性 ==========

  /**
   * 获取当前选中数据源的总行数
   */
  const batchPrintTotalRows = computed(() => {
    const fileName = editorStore.batchPrint.dataSourceFile
    if (!fileName) return 0
    const ds = dataSourceStore.dataSources.find(d => d.fileName === fileName)
    if (!ds || ds.columns.length === 0) return 0
    return ds.columns[0].data.length
  })

  /**
   * 计算将生成的面单数量
   * 根据打印范围配置决定生成多少张
   */
  const batchPrintPageCount = computed(() => {
    if (!editorStore.batchPrint.enabled) return 0
    const total = batchPrintTotalRows.value
    if (total === 0) return 0

    if (editorStore.batchPrint.printRange === 'all') {
      return total
    }

    // 指定范围模式
    const start = editorStore.batchPrint.rangeStart ?? 0
    const end = editorStore.batchPrint.rangeEnd ?? total - 1
    return Math.max(0, end - start + 1)
  })

  function handlePaperSizeChange(name: string) {
    const paperSize = PAPER_SIZES.find((p: any) => p.name === name)
    if (paperSize) {
      editorStore.setPaperSize({ ...paperSize })
    }
  }

  function handleCustomWidthChange(width: number | null) {
    if (width === null) return
    if (!editorStore.paperSize) return
    editorStore.setPaperSize({
      name: '自定义',
      width,
      height: editorStore.paperSize.height
    })
  }

  function handleCustomHeightChange(height: number | null) {
    if (height === null) return
    if (!editorStore.paperSize) return
    editorStore.setPaperSize({
      name: '自定义',
      width: editorStore.paperSize.width,
      height
    })
  }

  // 交换宽高（横竖切换）
  function swapPaperSize() {
    if (!editorStore.paperSize) return
    editorStore.setPaperSize({
      name: '自定义',
      width: editorStore.paperSize.height,
      height: editorStore.paperSize.width
    })
    message.success('已切换纸张方向')
  }

  // 常用自定义尺寸
  const customPresets = [
    { label: '80x80mm (收据)', width: 80, height: 80 },
    { label: '100x150mm (标签)', width: 100, height: 150 },
    { label: '120x200mm (快递单)', width: 120, height: 200 },
    { label: '148x210mm (A5)', width: 148, height: 210 },
    { label: '210x297mm (A4)', width: 210, height: 297 }
  ]

  function applyPreset(width: number, height: number) {
    editorStore.setPaperSize({
      name: '自定义',
      width,
      height
    })
    message.success('已应用预设尺寸')
  }

  function handlePresetChange(label: string) {
    const preset = customPresets.find(p => p.label === label)
    if (preset) {
      applyPreset(preset.width, preset.height)
    }
  }

  async function handleExcelUpload(info: UploadChangeParam) {
    // Ant Design Vue Upload 组件会多次触发 change 事件，需要检查状态
    // 由于我们设置了 beforeUpload 返回 false，文件不会自动上传
    // 所以直接从 info.file 获取原始文件
    const file = info.file.originFileObj || info.file

    if (!file || !(file instanceof File)) {
      return
    }

    // 防止重复处理
    if ((file as any).__uploaded) {
      return
    }
    ;(file as any).__uploaded = true

    try {
      console.log('处理上传文件:', file.name)
      const dataSource = await dataSourceStore.uploadExcel(file)
      editorStore.setBatchPrint({ dataSourceFile: dataSource.fileName })
      message.success(`Excel文件 "${file.name}" 解析成功`)
    } catch (e) {
      console.error('上传失败:', e)
      message.error('Excel解析失败: ' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  function exportTemplate() {
    const json = editorStore.exportTemplate()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importTemplate(info: UploadChangeParam) {
    const file = info.file.originFileObj
    if (file) {
      const reader = new FileReader()
      reader.onload = e => {
        const json = e.target?.result as string
        editorStore.importTemplate(json)
        message.success('模板导入成功')
      }
      reader.readAsText(file)
    }
  }

  // 处理装订线变化
  function handleGutterChange(key: 'gutterLeft' | 'gutterRight', value: number | null) {
    if (!editorStore.paperSize) return
    if (value === null || value === undefined) return
    editorStore.setPaperSize({
      ...editorStore.paperSize,
      [key]: value
    })
  }

  // 处理页眉变化
  function handleHeaderChange(e: Event) {
    if (!editorStore.paperSize) return
    const value = (e.target as HTMLInputElement)?.value
    if (value !== undefined) {
      editorStore.setPaperSize({
        ...editorStore.paperSize,
        header: value
      })
    }
  }

  // 处理页脚变化
  function handleFooterChange(e: Event) {
    if (!editorStore.paperSize) return
    const value = (e.target as HTMLInputElement)?.value
    if (value !== undefined) {
      editorStore.setPaperSize({
        ...editorStore.paperSize,
        footer: value
      })
    }
  }

  // 处理水印变化
  function handleWatermarkChange(key: 'text' | 'opacity' | 'angle' | 'fontSize', value: any) {
    if (!editorStore.paperSize) return
    if (value === undefined) return

    const currentWatermark = editorStore.paperSize.watermark || {
      text: '',
      color: '#000000',
      opacity: 0.1,
      angle: -45,
      fontSize: 48
    }

    // 如果是文本变化，需要从事件中提取值
    if (key === 'text' && typeof value === 'object' && value.target) {
      value = (value.target as HTMLInputElement)?.value || ''
    }

    editorStore.setPaperSize({
      ...editorStore.paperSize,
      watermark: {
        ...currentWatermark,
        [key]: value
      }
    })
  }

  // 处理水印颜色变化
  function handleWatermarkColorChange(e: Event) {
    if (!editorStore.paperSize) return
    const value = (e.target as HTMLInputElement)?.value
    if (value !== undefined) {
      const currentWatermark = editorStore.paperSize.watermark || {
        text: '',
        color: '#000000',
        opacity: 0.1,
        angle: -45,
        fontSize: 48
      }

      editorStore.setPaperSize({
        ...editorStore.paperSize,
        watermark: {
          ...currentWatermark,
          color: value
        }
      })
    }
  }

  function print() {
    if (!editorStore.paperSize) {
      message.warning('请选择画布大小')
      return
    }
    // 在打印前动态设置画布大小
    const { width, height } = editorStore.paperSize

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

    window.print()
  }
</script>

<template>
  <div class="property-panel">
    <a-tabs v-model:active-key="activeTab" size="small">
      <a-tab-pane key="properties" tab="属性">
        <div class="panel-content">
          <template v-if="editorStore.selectedWidget">
            <a-divider orientation="left" style="font-size: 12px">基础属性</a-divider>

            <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
              <a-form-item label="X(mm)">
                <a-input-number
                  :value="editorStore.selectedWidget.x"
                  :min="0"
                  :precision="0"
                  style="width: 100%"
                  @change="
                    (v: number) =>
                      editorStore.updateWidget(editorStore.selectedWidget!.id, { x: v })
                  "
                />
              </a-form-item>
              <a-form-item label="Y(mm)">
                <a-input-number
                  :value="editorStore.selectedWidget.y"
                  :min="0"
                  :precision="0"
                  style="width: 100%"
                  @change="
                    (v: number) =>
                      editorStore.updateWidget(editorStore.selectedWidget!.id, { y: v })
                  "
                />
              </a-form-item>
              <a-form-item label="宽度(mm)">
                <a-input-number
                  :value="editorStore.selectedWidget.width"
                  :min="10"
                  :precision="0"
                  style="width: 100%"
                  @change="
                    (v: number) =>
                      editorStore.updateWidget(editorStore.selectedWidget!.id, { width: v })
                  "
                />
              </a-form-item>
              <a-form-item label="高度(mm)">
                <a-input-number
                  :value="editorStore.selectedWidget.height"
                  :min="10"
                  :precision="0"
                  style="width: 100%"
                  @change="
                    (v: number) =>
                      editorStore.updateWidget(editorStore.selectedWidget!.id, { height: v })
                  "
                />
              </a-form-item>
              <a-form-item label="控件编码">
                <a-input :value="selectedWidgetCode" readonly />
              </a-form-item>
            </a-form>

            <component :is="propertyComponent" :widget="editorStore.selectedWidget" />
          </template>

          <template v-else>
            <a-empty description="请选择一个组件" />
          </template>
        </div>
      </a-tab-pane>

      <a-tab-pane key="datasource" tab="数据源">
        <div class="panel-content">
          <a-upload
            accept=".xlsx,.xls"
            :show-upload-list="false"
            :before-upload="() => false"
            @change="handleExcelUpload"
          >
            <a-button block>
              <upload-outlined />
              上传Excel文件
            </a-button>
          </a-upload>

          <div v-if="dataSourceStore.dataSources.length > 0" style="margin-top: 16px">
            <a-divider orientation="left" style="font-size: 12px">已上传文件</a-divider>
            <div
              v-for="ds in dataSourceStore.dataSources"
              :key="ds.fileName"
              class="datasource-item"
            >
              <span>{{ ds.fileName }}</span>
              <a-button
                type="link"
                size="small"
                danger
                @click="dataSourceStore.removeDataSource(ds.fileName)"
              >
                删除
              </a-button>
            </div>

            <a-form-item label="数据源">
              <a-select
                :value="editorStore.batchPrint.dataSourceFile"
                placeholder="选择数据源"
                style="width: 100%"
                @change="(v: string) => editorStore.setBatchPrint({ dataSourceFile: v })"
              >
                <a-select-option
                  v-for="ds in dataSourceStore.dataSources"
                  :key="ds.fileName"
                  :value="ds.fileName"
                >
                  {{ ds.fileName }} ({{ ds.columns[0]?.data.length || 0 }} 条)
                </a-select-option>
              </a-select>
            </a-form-item>

            <a-card
              v-if="selectedDataSource"
              class="column-list"
              :head-style="{
                fontSize: '14px'
              }"
              :body-style="{
                padding: '12px'
              }"
            >
              <template #title> 可用数据列 </template>
              <div class="column-names">
                {{ selectedDataSourceColumnNames || '暂无列' }}
              </div>
            </a-card>
          </div>

          <!-- 批量打印设置：用于将模板与数据源结合，生成 N 份打印内容 -->
          <a-divider></a-divider>

          <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
            <!-- <a-form-item label="启用批量打印">
              <a-switch
                :checked="editorStore.batchPrint.enabled"
                @change="(v: boolean) => editorStore.setBatchPrint({ enabled: v })"
              />
            </a-form-item> -->

            <!-- 批量打印详细设置，仅在启用时显示 -->
            <!-- <template v-if="editorStore.batchPrint.enabled"> -->

            <a-form-item label="打印范围">
              <a-radio-group
                :value="editorStore.batchPrint.printRange"
                @change="(e: any) => editorStore.setBatchPrint({ printRange: e.target.value })"
              >
                <a-radio value="range">指定范围</a-radio>
                <a-radio value="all">全部</a-radio>
              </a-radio-group>
            </a-form-item>

            <!-- 指定范围时显示起止行输入 -->
            <template v-if="editorStore.batchPrint.printRange === 'range'">
              <a-form-item label="起始行">
                <a-input-number
                  :value="(editorStore.batchPrint.rangeStart ?? 0) + 1"
                  :min="1"
                  :max="batchPrintTotalRows"
                  style="width: 100%"
                  @change="
                    (v: number | null) =>
                      v !== null && editorStore.setBatchPrint({ rangeStart: v - 1 })
                  "
                />
              </a-form-item>
              <a-form-item label="结束行">
                <a-input-number
                  :value="(editorStore.batchPrint.rangeEnd ?? batchPrintTotalRows - 1) + 1"
                  :min="(editorStore.batchPrint.rangeStart ?? 0) + 1"
                  :max="batchPrintTotalRows"
                  style="width: 100%"
                  @change="
                    (v: number | null) =>
                      v !== null && editorStore.setBatchPrint({ rangeEnd: v - 1 })
                  "
                />
              </a-form-item>
            </template>

            <!-- 显示将生成的面单数量 -->
            <a-alert
              v-if="batchPrintPageCount > 0"
              type="info"
              show-icon
              style="margin-bottom: 16px"
            >
              <template #message>
                将生成 <strong>{{ batchPrintPageCount }}</strong> 张单据
              </template>
            </a-alert>
            <a-alert
              v-else
              type="warning"
              message="请先上传数据源并选择"
              show-icon
              style="margin-bottom: 16px"
            />
            <!-- </template> -->
          </a-form>
        </div>
      </a-tab-pane>

      <a-tab-pane key="page" tab="画布">
        <div class="panel-content">
          <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
            <a-form-item label="画布大小">
              <a-select :value="editorStore.paperSize?.name" @change="handlePaperSizeChange">
                <a-select-option v-for="size in PAPER_SIZES" :key="size.name" :value="size.name">
                  {{ size.name }} ({{ size.width }}x{{ size.height }}mm)
                </a-select-option>
              </a-select>
            </a-form-item>

            <template v-if="editorStore.paperSize">
              <template v-if="isCustomPaper">
                <a-form-item label="快捷尺寸">
                  <a-select
                    placeholder="选择预设尺寸"
                    :value="undefined"
                    style="width: 100%"
                    @change="handlePresetChange"
                  >
                    <a-select-option
                      v-for="preset in customPresets"
                      :key="preset.label"
                      :value="preset.label"
                    >
                      {{ preset.label }}
                    </a-select-option>
                  </a-select>
                </a-form-item>

                <a-form-item label="宽度 (mm)">
                  <a-input-number
                    :value="editorStore.paperSize.width"
                    :min="50"
                    :max="1000"
                    :step="1"
                    style="width: 100%"
                    placeholder="输入宽度"
                    @change="handleCustomWidthChange"
                  />
                </a-form-item>

                <a-form-item label="高度 (mm)">
                  <a-input-number
                    :value="editorStore.paperSize.height"
                    :min="50"
                    :max="1000"
                    :step="1"
                    style="width: 100%"
                    placeholder="输入高度"
                    @change="handleCustomHeightChange"
                  />
                </a-form-item>

                <a-form-item label="方向切换">
                  <a-button block @click="swapPaperSize">
                    <template #icon>
                      <swap-outlined />
                    </template>
                    横竖切换 ({{ editorStore.paperSize.width }}x{{
                      editorStore.paperSize.height
                    }}mm)
                  </a-button>
                </a-form-item>

                <a-alert
                  message="当前尺寸"
                  :description="`宽: ${editorStore.paperSize.width}mm, 高: ${editorStore.paperSize.height}mm`"
                  type="info"
                  show-icon
                  style="margin-bottom: 16px"
                />
              </template>

              <!-- <a-divider orientation="left" style="font-size: 12px">装订线设置</a-divider>

              <a-form-item label="左装订线 (mm)">
                <a-input-number
                  :value="editorStore.paperSize.gutterLeft || 0"
                  :min="0"
                  :max="50"
                  :step="1"
                  style="width: 100%"
                  placeholder="左侧装订线宽度"
                  @change="(v: number | null) => handleGutterChange('gutterLeft', v)"
                />
              </a-form-item>

              <a-form-item label="右装订线 (mm)">
                <a-input-number
                  :value="editorStore.paperSize.gutterRight || 0"
                  :min="0"
                  :max="50"
                  :step="1"
                  style="width: 100%"
                  placeholder="右侧装订线宽度"
                  @change="(v: number | null) => handleGutterChange('gutterRight', v)"
                />
              </a-form-item> -->

              <!-- <a-divider orientation="left" style="font-size: 12px">页眉页脚</a-divider>

              <a-form-item label="页眉内容">
                <a-input
                  :value="editorStore.paperSize.header || ''"
                  placeholder="输入页眉文字"
                  @change="handleHeaderChange"
                />
              </a-form-item>

              <a-form-item label="页脚内容">
                <a-input
                  :value="editorStore.paperSize.footer || ''"
                  placeholder="输入页脚文字"
                  @change="handleFooterChange"
                />
              </a-form-item> -->

              <a-divider orientation="left" style="font-size: 12px">水印设置</a-divider>

              <a-form-item label="水印文字">
                <a-input
                  :value="editorStore.paperSize.watermark?.text || ''"
                  placeholder="输入水印文字"
                  @change="handleWatermarkChange('text', $event)"
                />
              </a-form-item>

              <a-form-item label="水印颜色">
                <a-input
                  type="color"
                  :value="editorStore.paperSize.watermark?.color || '#000000'"
                  @change="handleWatermarkColorChange"
                />
              </a-form-item>

              <a-form-item label="透明度">
                <a-slider
                  :value="(editorStore.paperSize.watermark?.opacity ?? 0.1) * 100"
                  :min="0"
                  :max="100"
                  :step="5"
                  :tooltip-formatter="(v: number) => `${v}%`"
                  @change="(v: number) => handleWatermarkChange('opacity', v / 100)"
                />
              </a-form-item>

              <a-form-item label="旋转角度">
                <a-slider
                  :value="editorStore.paperSize.watermark?.angle ?? -45"
                  :min="-180"
                  :max="180"
                  :step="15"
                  :tooltip-formatter="(v: number) => `${v}°`"
                  @change="(v: number) => handleWatermarkChange('angle', v)"
                />
              </a-form-item>

              <a-form-item label="字体大小">
                <a-input-number
                  :value="editorStore.paperSize.watermark?.fontSize ?? 12"
                  :min="12"
                  :max="200"
                  :step="4"
                  style="width: 100%"
                  @change="(v: number | null) => v !== null && handleWatermarkChange('fontSize', v)"
                />
              </a-form-item>

              <a-form-item label="缩放">
                <a-slider
                  :value="editorStore.scale * 100"
                  :min="25"
                  :max="200"
                  @change="(v: number) => editorStore.setScale(v / 100)"
                />
              </a-form-item>
            </template>

            <template v-else>
              <a-alert
                message="画布尚未配置"
                description="请选择画布大小以开启配置项"
                type="info"
                show-icon
                style="margin-top: 16px"
              />
            </template>
          </a-form>

          <a-divider orientation="left" style="font-size: 12px">组件列表</a-divider>
          <div class="widget-list">
            <div
              v-for="w in usedWidgets"
              :key="w.id"
              class="widget-list-item"
              :class="{ active: editorStore.selectedWidgetId === w.id }"
              @click="handleSelectWidgetFromList(w.id)"
            >
              <div class="widget-list-title">
                <span>{{ getWidgetTypeLabel(w.type) }}</span>
                <span class="widget-list-code">{{ getWidgetCode(w) }}</span>
              </div>
              <div class="widget-list-meta">
                X: {{ w.x }}, Y: {{ w.y }}, W: {{ w.width }}, H: {{ w.height }}
              </div>
            </div>
            <a-empty v-if="usedWidgets.length === 0" description="暂无组件" />
          </div>

          <!-- <a-divider orientation="left" style="font-size: 12px">模板操作</a-divider>

          <a-space direction="vertical" style="width: 100%">
            <a-button block @click="exportTemplate">
              <download-outlined />
              导出模板
            </a-button>

            <a-upload
              accept=".json"
              :show-upload-list="false"
              :before-upload="() => false"
              @change="importTemplate"
            >
              <a-button block>
                <upload-outlined />
                导入模板
              </a-button>
            </a-upload>

            <a-button type="primary" block @click="print">
              <printer-outlined />
              打印预览
            </a-button>
          </a-space> -->
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
  .property-panel {
    padding: 12px;
    padding-bottom: 60px;
  }

  .datasource-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background: #fafafa;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .column-list {
    /* max-height: 300px; */
    overflow-y: auto;
  }

  .column-names {
    padding: 8px;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-all;
    white-space: normal;
  }

  .column-preview {
    font-size: 11px;
    color: #999;
  }

  .widget-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .widget-list-item {
    padding: 8px;
    border: 1px solid #f0f0f0;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease;
  }

  .widget-list-item:hover {
    border-color: #d9d9d9;
    background: #fafafa;
  }

  .widget-list-item.active {
    border-color: #1677ff;
    background: rgba(22, 119, 255, 0.06);
  }

  .widget-list-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    line-height: 1.2;
  }

  .widget-list-code {
    color: #8c8c8c;
    font-size: 11px;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
      monospace;
  }

  .widget-list-meta {
    margin-top: 4px;
    color: #8c8c8c;
    font-size: 11px;
  }
</style>
