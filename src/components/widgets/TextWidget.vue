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

  watch(
    () => props.widget,
    newContent => {
      console.log('Widget content changed:', newContent, dataSourceStore)
    },
    {
      immediate: true,
      deep: true
    }
  )

  // 显示的数据内容（不包括标题）
  const displayData = computed(() => {
    if (props.widget.dataSource) {
      // 使用传入的 dataRowIndex，如果没有则使用 widget 上的 dataRowIndex，都没有则默认为 0
      const rowIndex =
        props.dataRowIndex ??
        (typeof props.widget.dataRowIndex === 'number' ? props.widget.dataRowIndex : 0)
      const value = dataSourceStore.getColumnValue(props.widget.dataSource, rowIndex)
      if (value !== '') return String(value)
      if (isPreview.value) return ''
      return null
    }
    return props.widget.content
  })

  // 是否显示标题（showTitle 默认为 true）
  const shouldShowTitle = computed(() => {
    return props.widget.title && props.widget.showTitle !== false
  })

  // 是否显示数据内容（showContent 默认为 true）
  const shouldShowContent = computed(() => {
    return props.widget.showContent !== false
  })

  // 完整显示内容（标题 + 数据）
  const displayContent = computed(() => {
    const showTitle = shouldShowTitle.value
    const showContent = shouldShowContent.value
    const title = props.widget.title || ''
    const data = displayData.value || ''

    if (showTitle && showContent) {
      // 都显示
      return data ? `${title}${data}` : title
    } else if (showTitle && !showContent) {
      // 只显示标题
      return title
    } else if (!showTitle && showContent) {
      // 只显示数据
      return data
    } else {
      // 都不显示
      return ''
    }
  })

  const bindingKey = computed(() => {
    if (!isPreview.value && props.widget.dataSource) {
      return props.widget.dataSource
    }
    return null
  })

  // 构建边框样式
  function getBorderStyle(border?: { width: number; color: string; style: string }) {
    if (!border || border.style === 'none') return 'none'
    return `${border.width}px ${border.style} ${border.color}`
  }

  function parseCustomCss(input?: string): Record<string, string> {
    if (!input) return {}
    const blocked = new Set([
      'position',
      'inset',
      'top',
      'right',
      'bottom',
      'left',
      'z-index',
      'width',
      'height',
      'min-width',
      'min-height',
      'max-width',
      'max-height',
      'display',
      'overflow',
      'box-sizing',
      'justify-content',
      'align-items'
    ])

    const result: Record<string, string> = {}
    for (const rawDecl of input.split(';')) {
      const decl = rawDecl.trim()
      if (!decl) continue
      const colonIndex = decl.indexOf(':')
      if (colonIndex <= 0) continue
      const prop = decl.slice(0, colonIndex).trim()
      const value = decl.slice(colonIndex + 1).trim()
      if (!prop || !value) continue
      if (blocked.has(prop.toLowerCase())) continue
      result[prop] = value
    }
    return result
  }

  function toAlignItems(
    verticalAlign: TextWidget['verticalAlign']
  ): 'flex-start' | 'center' | 'flex-end' {
    if (verticalAlign === 'top') return 'flex-start'
    if (verticalAlign === 'bottom') return 'flex-end'
    return 'center'
  }

  function toJustifyContent(
    textAlign: TextWidget['textAlign']
  ): 'flex-start' | 'center' | 'flex-end' {
    if (textAlign === 'center') return 'center'
    if (textAlign === 'right') return 'flex-end'
    return 'flex-start'
  }

  const textStyle = computed(() => {
    const textAlign = props.widget.textAlign || 'left'
    const verticalAlign = props.widget.verticalAlign || 'middle'
    const custom = parseCustomCss(props.widget.customCss)

    return {
      fontSize: `${props.widget.fontSize}px`,
      fontFamily: props.widget.fontFamily,
      fontWeight: props.widget.fontWeight,
      color: props.widget.color,
      textAlign,
      letterSpacing: `${props.widget.letterSpacing ?? 0}px`,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: toAlignItems(verticalAlign),
      justifyContent: toJustifyContent(textAlign),
      overflow: 'hidden',
      boxSizing: 'border-box' as const,
      ...custom,
      // 四边边框
      borderTop: getBorderStyle(props.widget.borderTop),
      borderRight: getBorderStyle(props.widget.borderRight),
      borderBottom: getBorderStyle(props.widget.borderBottom),
      borderLeft: getBorderStyle(props.widget.borderLeft)
    }
  })

  function onDoubleClick() {
    // 预览模式下禁止编辑
    if (isPreview.value) return
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
  <div
    class="text-widget"
    :class="{ 'preview-mode': isPreview }"
    :style="textStyle"
    @dblclick="onDoubleClick"
  >
    <input
      v-if="isEditing"
      v-model="editContent"
      class="text-input"
      autofocus
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <template v-else-if="bindingKey">
      <span v-if="shouldShowTitle">{{ widget.title }}：</span>
      <span v-if="shouldShowContent" class="binding-tag">[绑定:{{ bindingKey }}]</span>
    </template>
    <span v-else>{{ displayContent }}</span>
  </div>
</template>

<style scoped>
  .text-widget {
    word-break: break-word;
  }

  /* 编辑模式下禁止选择，预览模式下允许选择文本 */
  .text-widget:not(.preview-mode) {
    user-select: none;
    cursor: default;
  }

  .text-widget.preview-mode {
    user-select: text;
    cursor: text;
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
