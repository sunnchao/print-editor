<script setup lang="ts">
import { computed } from 'vue'
import type { ImageWidget } from '@/types'

const props = defineProps<{
  widget: ImageWidget
}>()

const imageStyle = computed(() => ({
  width: '100%',
  height: '100%',
  objectFit: props.widget.fit,
  display: 'block'
}))
</script>

<template>
  <div class="image-widget">
    <img
      v-if="widget.src"
      :src="widget.src"
      :style="imageStyle"
      alt="图片"
    />
    <div v-else class="image-placeholder">
      <span>点击右侧面板上传图片</span>
    </div>
  </div>
</template>

<style scoped>
.image-widget {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border: 1px dashed #d9d9d9;
  color: #999;
  font-size: 12px;
}
</style>
