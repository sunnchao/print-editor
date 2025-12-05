<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { UploadOutlined, DownloadOutlined, PrinterOutlined } from '@ant-design/icons-vue'
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import { PAPER_SIZES } from '@/types'
import type { UploadChangeParam } from 'ant-design-vue'
import TextProperties from './TextProperties.vue'
import TableProperties from './TableProperties.vue'
import ImageProperties from './ImageProperties.vue'
import LineProperties from './LineProperties.vue'
import RectProperties from './RectProperties.vue'
import BarcodeProperties from './BarcodeProperties.vue'
import QRCodeProperties from './QRCodeProperties.vue'

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()

const activeTab = ref('properties')

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
  (file as any).__uploaded = true
  
  try {
    console.log('处理上传文件:', file.name)
    await dataSourceStore.uploadExcel(file)
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
    reader.onload = (e) => {
      const json = e.target?.result as string
      editorStore.importTemplate(json)
      message.success('模板导入成功')
    }
    reader.readAsText(file)
  }
}

function print() {
  window.print()
}
</script>

<template>
  <div class="property-panel">
    <a-tabs v-model:activeKey="activeTab" size="small">
      <a-tab-pane key="properties" tab="属性">
        <div class="panel-content">
          <template v-if="editorStore.selectedWidget">
            <a-divider orientation="left" style="font-size: 12px">基础属性</a-divider>
            
            <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
              <a-form-item label="X">
                <a-input-number
                  :value="editorStore.selectedWidget.x"
                  @change="(v: number) => editorStore.updateWidget(editorStore.selectedWidget!.id, { x: v })"
                  :min="0"
                  style="width: 100%"
                />
              </a-form-item>
              <a-form-item label="Y">
                <a-input-number
                  :value="editorStore.selectedWidget.y"
                  @change="(v: number) => editorStore.updateWidget(editorStore.selectedWidget!.id, { y: v })"
                  :min="0"
                  style="width: 100%"
                />
              </a-form-item>
              <a-form-item label="宽度">
                <a-input-number
                  :value="editorStore.selectedWidget.width"
                  @change="(v: number) => editorStore.updateWidget(editorStore.selectedWidget!.id, { width: v })"
                  :min="10"
                  style="width: 100%"
                />
              </a-form-item>
              <a-form-item label="高度">
                <a-input-number
                  :value="editorStore.selectedWidget.height"
                  @change="(v: number) => editorStore.updateWidget(editorStore.selectedWidget!.id, { height: v })"
                  :min="10"
                  style="width: 100%"
                />
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
            <div v-for="ds in dataSourceStore.dataSources" :key="ds.fileName" class="datasource-item">
              <span>{{ ds.fileName }}</span>
              <a-button type="link" size="small" danger @click="dataSourceStore.removeDataSource(ds.fileName)">
                删除
              </a-button>
            </div>
            
            <a-divider orientation="left" style="font-size: 12px">可用数据列</a-divider>
            <a-select
              v-model:value="dataSourceStore.currentDataSource"
              style="width: 100%; margin-bottom: 8px"
              placeholder="选择数据源"
            >
              <a-select-option v-for="ds in dataSourceStore.dataSources" :key="ds.fileName" :value="ds">
                {{ ds.fileName }}
              </a-select-option>
            </a-select>
            
            <div v-if="dataSourceStore.currentDataSource" class="column-list">
              <div v-for="col in dataSourceStore.currentDataSource.columns" :key="col.name" class="column-item">
                <strong>{{ col.name }}</strong>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>
      
      <a-tab-pane key="page" tab="页面">
        <div class="panel-content">
          <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
            <a-form-item label="纸张大小">
              <a-select
                :value="editorStore.paperSize.name"
                @change="(name: string) => editorStore.setPaperSize(PAPER_SIZES.find(p => p.name === name)!)"
              >
                <a-select-option v-for="size in PAPER_SIZES" :key="size.name" :value="size.name">
                  {{ size.name }} ({{ size.width }}x{{ size.height }}mm)
                </a-select-option>
              </a-select>
            </a-form-item>
            
            <a-form-item label="缩放">
              <a-slider
                :value="editorStore.scale * 100"
                :min="25"
                :max="200"
                @change="(v: number) => editorStore.setScale(v / 100)"
              />
            </a-form-item>
          </a-form>
          
          <a-divider orientation="left" style="font-size: 12px">模板操作</a-divider>
          
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
          </a-space>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
.property-panel {
  padding: 12px;
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
  max-height: 300px;
  overflow-y: auto;
}

.column-item {
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.column-item strong {
  display: block;
  font-size: 12px;
}

.column-preview {
  font-size: 11px;
  color: #999;
}
</style>
