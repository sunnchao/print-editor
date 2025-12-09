<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useDataSourceStore } from '@/stores/datasource'
import type { TextWidget, BorderStyle } from '@/types'

const props = defineProps<{
  widget: TextWidget
}>()

const editorStore = useEditorStore()
const dataSourceStore = useDataSourceStore()

const fontFamilies = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'SimSun',
  'SimHei',
  'Microsoft YaHei',
  'KaiTi'
]

const fontWeights = [
  { label: '正常', value: 'normal' },
  { label: '粗体', value: 'bold' }
]

const textAligns = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' }
]

const borderStyles = [
  { label: '无', value: 'none' },
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
]

// 计算可选的数据行选项
const rowIndexOptions = computed(() => {
  if (!props.widget.dataSource) return []
  const columnData = dataSourceStore.getColumnData(props.widget.dataSource)
  const options: Array<{ label: string; value: number | 'all' }> = [{ label: '所有数据', value: 'all' }]
  for (let i = 0; i < columnData.length; i++) {
    options.push({ label: `第 ${i + 1} 行`, value: i })
  }
  return options
})

function update(key: keyof TextWidget, value: any) {
  // 防止 undefined 或 null 值破坏组件数据
  if (value === undefined) return
  editorStore.updateWidget(props.widget.id, { [key]: value })
}

function updateBorder(position: 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft', key: keyof BorderStyle, value: any) {
  if (value === undefined) return
  const currentBorder = props.widget[position] || { width: 1, color: '#000000', style: 'solid' }
  update(position, { ...currentBorder, [key]: value })
}

// 处理输入框变化的辅助函数
function handleInputChange(key: keyof TextWidget, e: Event) {
  const value = (e.target as HTMLInputElement)?.value
  if (value !== undefined) {
    update(key, value)
  }
}

function handleColorChange(key: keyof TextWidget, e: Event) {
  const value = (e.target as HTMLInputElement)?.value
  if (value !== undefined) {
    update(key, value)
  }
}

function handleBorderColorChange(position: 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft', e: Event) {
  const value = (e.target as HTMLInputElement)?.value
  if (value !== undefined) {
    updateBorder(position, 'color', value)
  }
}
</script>

<template>
  <a-divider orientation="left" style="font-size: 12px">文本属性</a-divider>

  <a-form :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }" size="small">
    <a-form-item label="标题">
      <a-input
        :value="widget.title || ''"
        @change="e => handleInputChange('title', e)"
        placeholder="固定标题（可选）"
      />
    </a-form-item>

    <a-form-item label="数据内容">
      <a-input
        :value="widget.content"
        @change="e => handleInputChange('content', e)"
        placeholder="数据内容"
      />
    </a-form-item>

    <a-form-item label="字体">
      <a-select :value="widget.fontFamily" @change="v => update('fontFamily', v)">
        <a-select-option v-for="font in fontFamilies" :key="font" :value="font">
          {{ font }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item label="字号">
      <a-input-number
        :value="widget.fontSize"
        @change="v => update('fontSize', v)"
        :min="8"
        :max="72"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item label="字重">
      <a-select :value="widget.fontWeight" @change="v => update('fontWeight', v)">
        <a-select-option v-for="w in fontWeights" :key="w.value" :value="w.value">
          {{ w.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item label="颜色">
      <a-input type="color" :value="widget.color" @change="e => handleColorChange('color', e)" />
    </a-form-item>

    <a-form-item label="对齐">
      <a-select :value="widget.textAlign" @change="v => update('textAlign', v)">
        <a-select-option v-for="align in textAligns" :key="align.value" :value="align.value">
          {{ align.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-divider orientation="left" style="font-size: 12px">数据绑定</a-divider>

    <a-form-item label="数据源">
      <a-select
        :value="widget.dataSource"
        @change="v => update('dataSource', v)"
        allowClear
        placeholder="选择数据列"
      >
        <a-select-option v-for="col in dataSourceStore.columnOptions" :key="col.value" :value="col.value">
          {{ col.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item v-if="widget.dataSource" label="数据行">
      <a-select
        :value="widget.dataRowIndex ?? 'all'"
        @change="v => update('dataRowIndex', v)"
        placeholder="选择数据行"
      >
        <a-select-option v-for="option in rowIndexOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-divider orientation="left" style="font-size: 12px">边框设置</a-divider>

    <!-- 上边框 -->
    <a-form-item label="上边框样式">
      <a-select
        :value="widget.borderTop?.style || 'none'"
        @change="v => updateBorder('borderTop', 'style', v)"
      >
        <a-select-option v-for="s in borderStyles" :key="s.value" :value="s.value">
          {{ s.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item v-if="widget.borderTop && widget.borderTop.style !== 'none'" label="上边框宽度">
      <a-input-number
        :value="widget.borderTop.width"
        @change="v => updateBorder('borderTop', 'width', v)"
        :min="1"
        :max="10"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item v-if="widget.borderTop && widget.borderTop.style !== 'none'" label="上边框颜色">
      <a-input
        type="color"
        :value="widget.borderTop.color"
        @change="e => handleBorderColorChange('borderTop', e)"
      />
    </a-form-item>

    <!-- 右边框 -->
    <a-form-item label="右边框样式">
      <a-select
        :value="widget.borderRight?.style || 'none'"
        @change="v => updateBorder('borderRight', 'style', v)"
      >
        <a-select-option v-for="s in borderStyles" :key="s.value" :value="s.value">
          {{ s.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item v-if="widget.borderRight && widget.borderRight.style !== 'none'" label="右边框宽度">
      <a-input-number
        :value="widget.borderRight.width"
        @change="v => updateBorder('borderRight', 'width', v)"
        :min="1"
        :max="10"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item v-if="widget.borderRight && widget.borderRight.style !== 'none'" label="右边框颜色">
      <a-input
        type="color"
        :value="widget.borderRight.color"
        @change="e => handleBorderColorChange('borderRight', e)"
      />
    </a-form-item>

    <!-- 下边框 -->
    <a-form-item label="下边框样式">
      <a-select
        :value="widget.borderBottom?.style || 'none'"
        @change="v => updateBorder('borderBottom', 'style', v)"
      >
        <a-select-option v-for="s in borderStyles" :key="s.value" :value="s.value">
          {{ s.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item v-if="widget.borderBottom && widget.borderBottom.style !== 'none'" label="下边框宽度">
      <a-input-number
        :value="widget.borderBottom.width"
        @change="v => updateBorder('borderBottom', 'width', v)"
        :min="1"
        :max="10"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item v-if="widget.borderBottom && widget.borderBottom.style !== 'none'" label="下边框颜色">
      <a-input
        type="color"
        :value="widget.borderBottom.color"
        @change="e => handleBorderColorChange('borderBottom', e)"
      />
    </a-form-item>

    <!-- 左边框 -->
    <a-form-item label="左边框样式">
      <a-select
        :value="widget.borderLeft?.style || 'none'"
        @change="v => updateBorder('borderLeft', 'style', v)"
      >
        <a-select-option v-for="s in borderStyles" :key="s.value" :value="s.value">
          {{ s.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item v-if="widget.borderLeft && widget.borderLeft.style !== 'none'" label="左边框宽度">
      <a-input-number
        :value="widget.borderLeft.width"
        @change="v => updateBorder('borderLeft', 'width', v)"
        :min="1"
        :max="10"
        style="width: 100%"
      />
    </a-form-item>

    <a-form-item v-if="widget.borderLeft && widget.borderLeft.style !== 'none'" label="左边框颜色">
      <a-input
        type="color"
        :value="widget.borderLeft.color"
        @change="e => handleBorderColorChange('borderLeft', e)"
      />
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
