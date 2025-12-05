<script setup lang="ts">
import { computed } from 'vue'
import type { RectWidget } from '@/types'

const props = defineProps<{
  widget: RectWidget
}>()

const rectStyle = computed(() => ({
  width: '100%',
  height: '100%',
  border: `${props.widget.borderWidth}px ${props.widget.borderStyle} ${props.widget.borderColor}`,
  backgroundColor: props.widget.backgroundColor,
  borderRadius: `${props.widget.borderRadius}px`,
  boxSizing: 'border-box' as const
}))
</script>

<template>
  <div class="rect-widget" :style="rectStyle"></div>
</template>
