<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { TextWidget } from '@/types'

const props = defineProps<{
  widget: TextWidget
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()

const fontFamilies = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'SimSun',
  'SimHei',
  'Microsoft YaHei',
  'KaiTi'
]

const fontWeights = [
  { label: '正常', value: 'normal' },
  { label: '粗体', value: 'bold' }
]

const textAligns = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' }
]

function update(key: keyof TextWidget, value: any) {
  editorStore.updateWidget(props.widget.id, { [key]: value })
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">文本属性</a-divider>
  
  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="内容">
      <a-input
        :value="widget.content"
        @change="(e: Event) => update('content', (e.target as HTMLInputElement).value)"
      />
    </a-form-item>
    
    <a-form-item label="字体">
      <a-select :value="widget.fontFamily" @change="(v: string) => update('fontFamily', v)">
        <a-select-option v-for="font in fontFamilies" :key="font" :value="font">
          {{ font }}
        </a-select-option>
      </a-select>
    </a-form-item>
    
    <a-form-item label="字号">
      <a-input-number
        :value="widget.fontSize"
        @change="(v: number) => update('fontSize', v)"
        :min="8"
        :max="72"
        style="width: 100%"
      />
    </a-form-item>
    
    <a-form-item label="字重">
      <a-select :value="widget.fontWeight" @change="(v: string) => update('fontWeight', v)">
        <a-select-option v-for="w in fontWeights" :key="w.value" :value="w.value">
          {{ w.label }}
        </a-select-option>
      </a-select>
    </a-form-item>
    
    <a-form-item label="颜色">
      <a-input type="color" :value="widget.color" @change="(e: Event) => update('color', (e.target as HTMLInputElement).value)" />
    </a-form-item>
    
    <a-form-item label="对齐">
      <a-select :value="widget.textAlign" @change="(v: string) => update('textAlign', v)">
        <a-select-option v-for="align in textAligns" :key="align.value" :value="align.value">
          {{ align.label }}
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
