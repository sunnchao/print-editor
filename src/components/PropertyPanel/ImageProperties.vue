<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import type { ImageWidget } from '@/types'
import type { UploadChangeParam } from 'ant-design-vue'

const props = defineProps<{
  widget: ImageWidget
}>()

const editorStore = useEditorStore()

const fitOptions = [
  { label: '包含', value: 'contain' },
  { label: '覆盖', value: 'cover' },
  { label: '填充', value: 'fill' }
]

function update(key: keyof ImageWidget, value: any) {
  editorStore.updateWidget(props.widget.id, { [key]: value })
}

function handleUpload(info: UploadChangeParam) {
  const file = info.file.originFileObj
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      update('src', e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">图片属性</a-divider>
  
  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="图片">
      <a-upload
        accept="image/*"
        :show-upload-list="false"
        :before-upload="() => false"
        @change="handleUpload"
      >
        <a-button size="small">上传图片</a-button>
      </a-upload>
    </a-form-item>
    
    <a-form-item label="图片URL">
      <a-input
        :value="widget.src"
        @change="(e: Event) => update('src', (e.target as HTMLInputElement).value)"
        placeholder="或输入图片URL"
      />
    </a-form-item>
    
    <a-form-item label="填充方式">
      <a-select :value="widget.fit" @change="(v: string) => update('fit', v)">
        <a-select-option v-for="opt in fitOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-divider orientation="left" style="font-size: 12px">高级设置</a-divider>

    <a-form-item label="强制分页">
      <a-switch
        :checked="widget.forcePageBreak || false"
        @change="v => update('forcePageBreak', v)"
      />
      <div style="font-size: 12px; color: #999; margin-top: 4px">
        开启后，此组件将独占一页
      </div>
    </a-form-item>
  </a-form>
</template>
