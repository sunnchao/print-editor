<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { BarcodeWidget } from '@/types'

const props = defineProps<{
  widget: BarcodeWidget
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()

const formats = [
  { label: 'CODE128', value: 'CODE128' },
  { label: 'CODE39', value: 'CODE39' },
  { label: 'EAN13', value: 'EAN13' },
  { label: 'EAN8', value: 'EAN8' }
]

function update(key: keyof BarcodeWidget, value: any) {
  editorStore.updateWidget(props.widget.id, { [key]: value })
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">条形码属性</a-divider>
  
  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="内容">
      <a-input
        :value="widget.value"
        @change="(e: Event) => update('value', (e.target as HTMLInputElement).value)"
      />
    </a-form-item>
    
    <a-form-item label="格式">
      <a-select :value="widget.format" @change="(v: string) => update('format', v)">
        <a-select-option v-for="f in formats" :key="f.value" :value="f.value">
          {{ f.label }}
        </a-select-option>
      </a-select>
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
