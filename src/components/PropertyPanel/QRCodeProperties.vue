<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { QRCodeWidget } from '@/types'

const props = defineProps<{
  widget: QRCodeWidget
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()

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

function update(key: keyof QRCodeWidget, value: any) {
  if (value === undefined) return
  editorStore.updateWidget(props.widget.id, { [key]: value })
}

function handleInputChange(e: Event) {
  const value = (e.target as HTMLInputElement)?.value
  if (value !== undefined) {
    update('value', value)
  }
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">二维码属性</a-divider>

  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="内容">
      <a-input
        :value="widget.value"
        @change="handleInputChange"
      />
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

<!--    <a-divider orientation="left" style="font-size: 12px">高级设置</a-divider>-->

<!--    <a-form-item label="强制分页">-->
<!--      <a-switch-->
<!--        :checked="widget.forcePageBreak || false"-->
<!--        @change="v => update('forcePageBreak', v)"-->
<!--      />-->
<!--      <div style="font-size: 12px; color: #999; margin-top: 4px">-->
<!--        开启后，此组件将独占一页-->
<!--      </div>-->
<!--    </a-form-item>-->
  </a-form>
</template>
