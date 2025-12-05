<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { TextWidget } from '@/types'

const props = defineProps<{
  widget: TextWidget
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()

const isEditing = ref(false)
const editContent = ref('')

const displayContent = computed(() => {
  if (props.widget.dataSource) {
    const value = dataSourceStore.getColumnValue(props.widget.dataSource, 0)
    return value !== '' ? String(value) : `[${props.widget.dataSource}]`
  }
  return props.widget.content
})

const textStyle = computed(() => ({
  fontSize: `${props.widget.fontSize}px`,
  fontFamily: props.widget.fontFamily,
  fontWeight: props.widget.fontWeight,
  color: props.widget.color,
  textAlign: props.widget.textAlign,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: props.widget.textAlign === 'center' ? 'center' : 
                  props.widget.textAlign === 'right' ? 'flex-end' : 'flex-start',
  overflow: 'hidden'
}))

function onDoubleClick() {
  isEditing.value = true
  editContent.value = props.widget.content
}

function onBlur() {
  isEditing.value = false
  editorStore.updateWidget(props.widget.id, { content: editContent.value })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onBlur()
  }
  e.stopPropagation()
}
</script>

<template>
  <div class="text-widget" :style="textStyle" @dblclick="onDoubleClick">
    <input
      v-if="isEditing"
      v-model="editContent"
      class="text-input"
      autofocus
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <span v-else>{{ displayContent }}</span>
  </div>
</template>

<style scoped>
.text-widget {
  user-select: none;
  word-break: break-word;
}

.text-input {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: inherit;
}
</style>
