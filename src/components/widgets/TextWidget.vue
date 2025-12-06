<script setup lang="ts">
import { computed, ref, watch, inject } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { TextWidget } from '@/types'

const props = defineProps<{
  widget: TextWidget
  dataRowIndex?: number
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()
const renderMode = inject<'editor' | 'preview'>('renderMode', 'editor')
const isPreview = computed(() => renderMode === 'preview')

const isEditing = ref(false)
const editContent = ref('')

watch(() => props.widget, (newContent) => {

  console.log('Widget content changed:', newContent, dataSourceStore)
},
{
  immediate: true,
  deep: true
})

const displayContent = computed(() => {
  if (props.widget.dataSource) {
    // 使用传入的 dataRowIndex，如果没有则使用 widget 上的 dataRowIndex，都没有则默认为 0
    const rowIndex = props.dataRowIndex ?? (typeof props.widget.dataRowIndex === 'number' ? props.widget.dataRowIndex : 0)
    const value = dataSourceStore.getColumnValue(props.widget.dataSource, rowIndex)
    if (value !== '') return String(value)
    if (isPreview.value) return ''
    return null
  }
  return props.widget.content
})

const bindingKey = computed(() => {
  if (!isPreview.value && props.widget.dataSource) {
    return props.widget.dataSource
  }
  return null
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
    <span v-else-if="bindingKey" class="binding-tag">[绑定:{{ bindingKey }}]</span>
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

.binding-tag {
  display: inline-block;
  padding: 0 4px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 2px;
  color: #1890ff;
  font-size: 12px;
  line-height: 1.5;
}
</style>
