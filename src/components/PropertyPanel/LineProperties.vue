<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import type { LineWidget } from '@/types'

const props = defineProps<{
  widget: LineWidget
}>()

const editorStore = useEditorStore()

const directions = [
  { label: '水平', value: 'horizontal' },
  { label: '垂直', value: 'vertical' }
]

const lineStyles = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
]

function update(key: keyof LineWidget, value: any) {
  editorStore.updateWidget(props.widget.id, { [key]: value })
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">线条属性</a-divider>
  
  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="方向">
      <a-select :value="widget.direction" @change="(v: string) => update('direction', v)">
        <a-select-option v-for="d in directions" :key="d.value" :value="d.value">
          {{ d.label }}
        </a-select-option>
      </a-select>
    </a-form-item>
    
    <a-form-item label="线宽">
      <a-input-number
        :value="widget.lineWidth"
        @change="(v: number) => update('lineWidth', v)"
        :min="1"
        :max="10"
        style="width: 100%"
      />
    </a-form-item>
    
    <a-form-item label="颜色">
      <a-input
        type="color"
        :value="widget.lineColor"
        @change="(e: Event) => update('lineColor', (e.target as HTMLInputElement).value)"
      />
    </a-form-item>
    
    <a-form-item label="样式">
      <a-select :value="widget.lineStyle" @change="(v: string) => update('lineStyle', v)">
        <a-select-option v-for="s in lineStyles" :key="s.value" :value="s.value">
          {{ s.label }}
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
