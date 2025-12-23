<script setup lang="ts">
  import { computed } from 'vue'
  import { useDataSourceStore } from '@/stores/datasource'
  import type { QRCodeWidget } from '@/types'

  const props = defineProps<{
    widget: QRCodeWidget
    dataRowIndex?: number
  }>()

  const dataSourceStore = useDataSourceStore()

  const displayValue = computed(() => {
    if (props.widget.dataSource) {
      // 使用传入的 dataRowIndex，如果没有则使用 widget 上的 dataRowIndex，都没有则默认为 0
      const rowIndex =
        props.dataRowIndex ??
        (typeof props.widget.dataRowIndex === 'number' ? props.widget.dataRowIndex : 0)
      const value = dataSourceStore.getColumnValue(props.widget.dataSource, rowIndex)
      return value !== '' ? String(value) : props.widget.value
    }
    return props.widget.value
  })
</script>

<template>
  <div class="qrcode-widget">
    <div class="qrcode-placeholder">
      <div class="qr-pattern">
        <div class="qr-corner tl"></div>
        <div class="qr-corner tr"></div>
        <div class="qr-corner bl"></div>
        <div class="qr-content">
          <div v-for="i in 9" :key="i" class="qr-row">
            <div
              v-for="j in 9"
              :key="j"
              class="qr-cell"
              :class="{ filled: Math.random() > 0.5 }"
            ></div>
          </div>
        </div>
      </div>
      <div class="qr-value" :title="displayValue">
        {{ displayValue.substring(0, 20) }}{{ displayValue.length > 20 ? '...' : '' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
  .qrcode-widget {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .qrcode-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .qr-pattern {
    position: relative;
    width: 60px;
    height: 60px;
    border: 2px solid #000;
    padding: 4px;
  }

  .qr-corner {
    position: absolute;
    width: 14px;
    height: 14px;
    border: 2px solid #000;
  }

  .qr-corner::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 6px;
    height: 6px;
    background: #000;
  }

  .qr-corner.tl {
    top: 2px;
    left: 2px;
  }

  .qr-corner.tr {
    top: 2px;
    right: 2px;
  }

  .qr-corner.bl {
    bottom: 2px;
    left: 2px;
  }

  .qr-content {
    position: absolute;
    top: 18px;
    left: 18px;
    right: 4px;
    bottom: 4px;
  }

  .qr-row {
    display: flex;
    height: calc(100% / 9);
  }

  .qr-cell {
    flex: 1;
  }

  .qr-cell.filled {
    background: #000;
  }

  .qr-value {
    font-size: 9px;
    margin-top: 4px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
