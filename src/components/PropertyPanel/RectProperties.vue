<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import type { RectWidget } from '@/types'

const props = defineProps<{
  widget: RectWidget
}>()

const editorStore = useEditorStore()

const borderStyles = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
]

function update(key: keyof RectWidget, value: any) {
  editorStore.updateWidget(props.widget.id, { [key]: value })
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">矩形属性</a-divider>
  
  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="边框宽度">
      <a-input-number
        :value="widget.borderWidth"
        @change="(v: number) => update('borderWidth', v)"
        :min="0"
        :max="10"
        style="width: 100%"
      />
    </a-form-item>
    
    <a-form-item label="边框颜色">
      <a-input
        type="color"
        :value="widget.borderColor"
        @change="(e: Event) => update('borderColor', (e.target as HTMLInputElement).value)"
      />
    </a-form-item>
    
    <a-form-item label="边框样式">
      <a-select :value="widget.borderStyle" @change="(v: string) => update('borderStyle', v)">
        <a-select-option v-for="s in borderStyles" :key="s.value" :value="s.value">
          {{ s.label }}
        </a-select-option>
      </a-select>
    </a-form-item>
    
    <a-form-item label="背景色">
      <a-input
        type="color"
        :value="widget.backgroundColor || '#ffffff'"
        @change="(e: Event) => update('backgroundColor', (e.target as HTMLInputElement).value)"
      />
    </a-form-item>
    
    <a-form-item label="圆角">
      <a-input-number
        :value="widget.borderRadius"
        @change="(v: number) => update('borderRadius', v)"
        :min="0"
        :max="50"
        style="width: 100%"
      />
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
