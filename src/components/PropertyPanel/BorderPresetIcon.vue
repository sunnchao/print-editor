<script setup lang="ts">
  import { computed } from 'vue'

  type BorderPreset = 'preset1' | 'preset2' | 'preset3' | 'custom'

  const props = defineProps<{
    preset: BorderPreset
  }>()

  const outerDashArray = computed(() => (props.preset === 'preset2' ? '2 1' : ''))
  const innerDashArray = computed(() => (props.preset === 'preset3' ? '' : '2 1'))
  const outerStrokeWidth = computed(() =>
    props.preset === 'preset1' || props.preset === 'preset3' ? 1.6 : 1.2
  )
  const innerStrokeWidth = computed(() => (props.preset === 'preset3' ? 1.2 : 1))
</script>

<template>
  <svg class="border-preset-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <rect
      x="2.25"
      y="2.25"
      width="11.5"
      height="11.5"
      rx="0.6"
      fill="none"
      stroke="currentColor"
      :stroke-width="outerStrokeWidth"
      :stroke-dasharray="outerDashArray"
    />
    <path
      d="M8 2.8V13.2M2.8 8H13.2"
      fill="none"
      stroke="currentColor"
      :stroke-width="innerStrokeWidth"
      :stroke-dasharray="innerDashArray"
      stroke-linecap="round"
    />
    <path
      v-if="preset === 'custom'"
      d="M12.2 3.2l.6.6M11.9 4.5l-2.4 2.4-.9.2.2-.9 2.4-2.4a.6.6 0 0 1 .7 0z"
      fill="none"
      stroke="currentColor"
      stroke-width="1"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
  .border-preset-icon {
    display: inline-block;
    flex: 0 0 auto;
    color: rgba(0, 0, 0, 0.65);
  }
</style>
