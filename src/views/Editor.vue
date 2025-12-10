<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  EyeOutlined,
  PrinterOutlined,
  DownloadOutlined,
  UploadOutlined
} from '@ant-design/icons-vue'
import MaterialPanel from '@/components/MaterialPanel/index.vue'
import EditorCanvas from '@/components/Canvas/index.vue'
import PropertyPanel from '@/components/PropertyPanel/index.vue'
import { useEditorStore } from '@/stores/editor'
import { useTemplateStore } from '@/stores/template'
import { useDataSourceStore } from '@/stores/datasource'
import type { Template } from '@/types'
import { exportAsHtml, downloadHtml } from '@/utils/exportHtml'

const route = useRoute()
const router = useRouter()
const editorStore = useEditorStore()
const templateStore = useTemplateStore()
const dataSourceStore = useDataSourceStore()

const templateId = ref<string | null>(null)
const templateName = ref('未命名模板')
const isSaving = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

provide('renderMode', 'editor')

// 键盘快捷键处理
function handleKeydown(event: KeyboardEvent) {
  // Ctrl+S 或 Cmd+S (Mac) 保存
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    handleSave()
  }
}

onMounted(async () => {
  const id = route.params.id as string
  if (id) {
    templateId.value = id
    const template = await templateStore.loadTemplate(id)
    if (template) {
      templateName.value = template.name
      editorStore.setPaperSize(template.paperSize)
      editorStore.loadWidgets(template.widgets)
      if (template.globalForcePageBreak !== undefined) {
        editorStore.setGlobalForcePageBreak(template.globalForcePageBreak)
      }
      // 加载批量打印配置
      if (template.batchPrint) {
        editorStore.setBatchPrint(template.batchPrint)
      } else {
        editorStore.resetBatchPrint()
      }
    } else {
      message.error('模板不存在')
      router.push('/')
    }
  } else {
    // 新建模板
    editorStore.clearWidgets()
    editorStore.resetBatchPrint()  // 重置批量打印配置
  }

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  // 移除键盘事件监听
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => route.params.id, async (newId) => {
  if (newId && newId !== templateId.value) {
    templateId.value = newId as string
    const template = await templateStore.loadTemplate(newId as string)
    if (template) {
      templateName.value = template.name
      editorStore.setPaperSize(template.paperSize)
      editorStore.loadWidgets(template.widgets)
      if (template.globalForcePageBreak !== undefined) {
        editorStore.setGlobalForcePageBreak(template.globalForcePageBreak)
      }
    }
  }
})

function goBack() {
  router.push('/')
}

async function handleSave() {
  try {
    isSaving.value = true

    if (templateId.value) {
      // 更新现有模板
      const template = await templateStore.loadTemplate(templateId.value)
      if (template) {
        template.name = templateName.value
        template.widgets = editorStore.widgets
        template.paperSize = editorStore.paperSize
        template.globalForcePageBreak = editorStore.globalForcePageBreak
        template.batchPrint = editorStore.batchPrint  // 保存批量打印配置
        await templateStore.updateTemplate(template)
        message.success('保存成功')
      }
    } else {
      // 创建新模板
      const template = await templateStore.createTemplate(templateName.value)
      template.widgets = editorStore.widgets
      template.paperSize = editorStore.paperSize
      template.globalForcePageBreak = editorStore.globalForcePageBreak
      template.batchPrint = editorStore.batchPrint  // 保存批量打印配置
      await templateStore.updateTemplate(template)
      templateId.value = template.id
      router.replace(`/editor/${template.id}`)
      message.success('模板已创建')
    }
  } catch (e) {
    message.error('保存失败'+ e)
  } finally {
    isSaving.value = false
  }
}

function handlePreview() {
  if (templateId.value) {
    // 先保存再预览
    handleSave().then(() => {
      window.open(`/preview/${templateId.value}`, '_blank')
    })
  } else {
    message.warning('请先保存模板')
  }
}

async function handlePrint() {
  // 直接在当前页面打印，不打开新窗口
  const { width, height } = editorStore.paperSize

  // 保存当前缩放比例
  const originalScale = editorStore.scale
  // 打印前重置缩放为1
  editorStore.setScale(1)

  // 移除旧的打印样式（如果存在）
  const oldStyle = document.getElementById('dynamic-print-style')
  if (oldStyle) {
    oldStyle.remove()
  }

  // 创建新的 style 元素，设置页面尺寸
  const style = document.createElement('style')
  style.id = 'dynamic-print-style'
  style.textContent = `
    @page {
      size: ${width}mm ${height}mm;
      margin: 0;
    }
  `
  document.head.appendChild(style)

  // 等待重绘完成后再打印
  await new Promise(resolve => setTimeout(resolve, 100))

  window.print()

  // 打印后恢复缩放比例
  editorStore.setScale(originalScale)
}

function handleExportJson() {
  const data: Partial<Template> = {
    name: templateName.value,
    paperSize: editorStore.paperSize,
    widgets: editorStore.widgets
  }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${templateName.value}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.success('JSON 导出成功')
}

function handleExportHtml() {
  try {
    const template: Template = {
      id: templateId.value || '',
      name: templateName.value,
      paperSize: editorStore.paperSize,
      widgets: editorStore.widgets,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const html = exportAsHtml(template, dataSourceStore)
    downloadHtml(html, templateName.value)
    message.success('HTML 导出成功，可在浏览器中打开并二次编辑')
  } catch (error) {
    message.error('HTML 导出失败')
    console.error(error)
  }
}

async function handleExportPdf() {
  // 先保存模板，然后跳转到预览页面让用户导出 PDF
  try {
    isSaving.value = true

    if (templateId.value) {
      const template = await templateStore.loadTemplate(templateId.value)
      if (template) {
        template.name = templateName.value
        template.widgets = editorStore.widgets
        template.paperSize = editorStore.paperSize
        await templateStore.updateTemplate(template)
      }
    } else {
      const template = await templateStore.createTemplate(templateName.value)
      template.widgets = editorStore.widgets
      template.paperSize = editorStore.paperSize
      await templateStore.updateTemplate(template)
      templateId.value = template.id
    }

    message.info('正在跳转到预览页面导出 PDF...')

    // 跳转到预览页面
    setTimeout(() => {
      router.push(`/preview/${templateId.value}?exportPdf=true`)
    }, 500)
  } catch (e) {
    message.error('导出失败')
  } finally {
    isSaving.value = false
  }
}

function triggerImport() {
  fileInputRef.value?.click()
}

function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const json = e.target?.result as string
      const data = JSON.parse(json) as Partial<Template>
      
      if (data.paperSize) {
        editorStore.setPaperSize(data.paperSize)
      }
      if (data.widgets) {
        editorStore.loadWidgets(data.widgets)
      }
      if (data.name) {
        templateName.value = data.name
      }
      
      message.success('导入成功')
    } catch (err) {
      message.error('导入失败: 文件格式错误')
    }
  }
  reader.readAsText(file)
  
  // 清空 input 以便重复选择同一文件
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>

<template>
  <div class="editor-page">
    <!-- 顶部工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <a-button @click="goBack">
          <arrow-left-outlined />
          返回
        </a-button>
        <a-divider type="vertical" />
        <a-input
          v-model:value="templateName"
          class="template-name-input"
          placeholder="模板名称"
        />
      </div>
      
      <div class="toolbar-right">
        <a-space>
          <a-button @click="handlePreview">
            <eye-outlined />
            预览
          </a-button>
          <a-button @click="handlePrint">
            <printer-outlined />
            打印
          </a-button>
          <a-divider type="vertical" />
          <a-button @click="triggerImport">
            <upload-outlined />
            导入
          </a-button>
          <a-dropdown>
            <a-button>
              <download-outlined />
              导出
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="json" @click="handleExportJson">
                  导出为 JSON
                </a-menu-item>
                <a-menu-item key="html" @click="handleExportHtml">
                  导出为 HTML（可编辑）
                </a-menu-item>
                <a-menu-item key="pdf" @click="handleExportPdf">
                  导出为 PDF
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
          <a-divider type="vertical" />
          <a-button type="primary" :loading="isSaving" @click="handleSave">
            <save-outlined />
            保存
          </a-button>
        </a-space>
      </div>
    </div>
    
    <!-- 编辑器主体 -->
    <div class="editor-main">
      <MaterialPanel />
      <EditorCanvas />
      <PropertyPanel />
    </div>
    
    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleImport"
    />
  </div>
</template>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-name-input {
  width: 200px;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.editor-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
