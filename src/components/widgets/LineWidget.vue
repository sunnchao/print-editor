<script setup lang="ts">
import { computed } from 'vue'
import type { LineWidget } from '@/types'

const props = defineProps<{
  widget: LineWidget
}>()

const lineStyle = computed(() => {
  const isHorizontal = props.widget.direction === 'horizontal'
  return {
    width: isHorizontal ? '100%' : `${props.widget.lineWidth}px`,
    height: isHorizontal ? `${props.widget.lineWidth}px` : '100%',
    backgroundColor: props.widget.lineColor,
    borderStyle: props.widget.lineStyle === 'dashed' ? 'dashed' : 
                 props.widget.lineStyle === 'dotted' ? 'dotted' : 'none'
  }
})
</script>

<template>
  <div class="line-widget" :style="lineStyle"></div>
</template>

<style scoped>
.line-widget {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
