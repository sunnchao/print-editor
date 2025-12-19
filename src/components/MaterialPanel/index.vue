<script setup lang="ts">
import { 
  FontSizeOutlined, 
  PictureOutlined, 
  TableOutlined, 
  LineOutlined,
  BorderOutlined
} from '@ant-design/icons-vue'
import type { WidgetType } from '@/types'

interface MaterialItem {
  type: WidgetType
  label: string
  icon: any
  tableMode?: "simple" | "complex"
}

const materials: MaterialItem[] = [
  { type: "text", label: "文本", icon: FontSizeOutlined },
  { type: "image", label: "图片", icon: PictureOutlined },
  { type: "table", label: "简单表格", icon: TableOutlined, tableMode: "simple" },
  { type: "table", label: "复杂表格", icon: TableOutlined, tableMode: "complex" },
  // { type: "barcode", label: "条形码", icon: BarcodeOutlined },
  // { type: "qrcode", label: "二维码", icon: QrcodeOutlined },
  { type: "line", label: "线条", icon: LineOutlined },
  { type: "rect", label: "矩形框", icon: BorderOutlined }
]

function onDragStart(e: DragEvent, item: MaterialItem) {
  e.dataTransfer?.setData("widgetType", item.type)
  if (item.tableMode) {
    e.dataTransfer?.setData("tableMode", item.tableMode)
  }
}

</script>

<template>
  <div class="material-panel">
    <div class="panel-header">物料组件</div>
    <div class="panel-content">
      <div
        v-for="item in materials"
        :key="item.tableMode ? item.type + item.tableMode : item.type"
        class="material-item"
        draggable="true"
        @dragstart="onDragStart($event, item)"
      >
        <component :is="item.icon" />
        <span>{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>
