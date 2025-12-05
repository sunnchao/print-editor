<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { QRCodeWidget } from '@/types'

const props = defineProps<{
  widget: QRCodeWidget
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()

function update(key: keyof QRCodeWidget, value: any) {
  editorStore.updateWidget(props.widget.id, { [key]: value })
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">二维码属性</a-divider>
  
  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="内容">
      <a-input
        :value="widget.value"
        @change="(e: Event) => update('value', (e.target as HTMLInputElement).value)"
      />
    </a-form-item>
    
    <a-form-item label="数据源">
      <a-select
        :value="widget.dataSource"
        @change="(v: string) => update('dataSource', v)"
        allowClear
        placeholder="选择数据列"
      >
        <a-select-option v-for="col in dataSourceStore.columnOptions" :key="col.value" :value="col.value">
          {{ col.label }}
        </a-select-option>
      </a-select>
    </a-form-item>
  </a-form>
</template>
