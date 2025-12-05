<script setup lang="ts">
import { computed } from 'vue'
import { useDataSourceStore } from '@/stores/datasource'
import type { BarcodeWidget } from '@/types'

const props = defineProps<{
  widget: BarcodeWidget
}>()

const dataSourceStore = useDataSourceStore()

const displayValue = computed(() => {
  if (props.widget.dataSource) {
    const value = dataSourceStore.getColumnValue(props.widget.dataSource, 0)
    return value !== '' ? String(value) : props.widget.value
  }
  return props.widget.value
})
</script>

<template>
  <div class="barcode-widget">
    <div class="barcode-placeholder">
      <div class="barcode-lines">
        <span v-for="i in 30" :key="i" class="line" :style="{ width: `${Math.random() * 2 + 1}px` }"></span>
      </div>
      <div class="barcode-value">{{ displayValue }}</div>
    </div>
  </div>
</template>

<style scoped>
.barcode-widget {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.barcode-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
}

.barcode-lines {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 1px;
  flex: 1;
  padding: 4px;
}

.line {
  background: #000;
  height: 100%;
}

.barcode-value {
  font-size: 10px;
  padding: 2px;
  text-align: center;
}
</style>
