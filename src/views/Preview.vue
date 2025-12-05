<script setup lang="ts">
import { ref, onMounted, computed, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons-vue'
import { useTemplateStore } from '@/stores/template'
import { useDataSourceStore } from '@/stores/datasource'
import type { Template, Widget } from '@/types'
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

provide('renderMode', 'preview')

const MM_TO_PX = 3.78

const paperStyle = computed(() => {
  if (!template.value) return {}
  return {
    width: `${template.value.paperSize.width * MM_TO_PX}px`,
    height: `${template.value.paperSize.height * MM_TO_PX}px`
  }
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

function getWidgetStyle(widget: Widget) {
  return {
    position: 'absolute' as const,
    left: `${widget.x}px`,
    top: `${widget.y}px`,
    width: `${widget.width}px`,
    height: `${widget.height}px`,
    zIndex: widget.zIndex
  }
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
            v-for="widget in template.widgets"
            :key="widget.id"
            :style="getWidgetStyle(widget)"
          >
            <component :is="getWidgetComponent(widget.type)" :widget="widget" />
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
