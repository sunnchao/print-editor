<script setup lang="ts">
import { computed } from 'vue'
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

// 计算可选的数据行选项
const rowIndexOptions = computed(() => {
  if (!props.widget.dataSource) return []
  const columnData = dataSourceStore.getColumnData(props.widget.dataSource)
  const options: Array<{ label: string; value: number | 'all' }> = [{ label: '所有数据', value: 'all' }]
  for (let i = 0; i < columnData.length; i++) {
    options.push({ label: `第 ${i + 1} 行`, value: i })
  }
  return options
})

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
        @change="e => update('content', e.target.value)"
      />
    </a-form-item>

    <a-form-item label="字体">
      <a-select :value="widget.fontFamily" @change="v => update('fontFamily', v)">
        <a-select-option v-for="font in fontFamilies" :key="font" :value="font">
          {{ font }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item label="字号">
      <a-input-number
        :value="widget.fontSize"
        @change="v => update('fontSize', v)"
        :min="8"
        :max="72"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item label="字重">
      <a-select :value="widget.fontWeight" @change="v => update('fontWeight', v)">
        <a-select-option v-for="w in fontWeights" :key="w.value" :value="w.value">
          {{ w.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item label="颜色">
      <a-input type="color" :value="widget.color" @change="e => update('color', e.target.value)" />
    </a-form-item>

    <a-form-item label="对齐">
      <a-select :value="widget.textAlign" @change="v => update('textAlign', v)">
        <a-select-option v-for="align in textAligns" :key="align.value" :value="align.value">
          {{ align.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item label="数据源">
      <a-select
        :value="widget.dataSource"
        @change="v => update('dataSource', v)"
        allowClear
        placeholder="选择数据列"
      >
        <a-select-option v-for="col in dataSourceStore.columnOptions" :key="col.value" :value="col.value">
          {{ col.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item v-if="widget.dataSource" label="数据行">
      <a-select
        :value="widget.dataRowIndex ?? 'all'"
        @change="v => update('dataRowIndex', v)"
        placeholder="选择数据行"
      >
        <a-select-option v-for="option in rowIndexOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-divider orientation="left" style="font-size: 12px">高级设置</a-divider>

    <a-form-item label="强制分页">
      <a-switch
        :checked="widget.forcePageBreak || false"
        @change="v => update('forcePageBreak', v)"
      />
      <div style="font-size: 12px; color: #999; margin-top: 4px">
        开启后，此组件将独占一页
      </div>
    </a-form-item>
  </a-form>
</template>
