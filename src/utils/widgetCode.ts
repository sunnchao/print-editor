import type { WidgetType } from '@/types'

const TYPE_LABEL: Record<WidgetType, string> = {
  text: '文本',
  image: '图片',
  table: '表格',
  barcode: '条形码',
  qrcode: '二维码',
  line: '线条',
  rect: '矩形框'
}

const TYPE_ALIAS: Record<WidgetType, string> = {
  text: 'TXT',
  image: 'IMG',
  table: 'TBL',
  barcode: 'BAR',
  qrcode: 'QR',
  line: 'LIN',
  rect: 'REC'
}

export function getWidgetTypeLabel(type: WidgetType): string {
  return TYPE_LABEL[type] ?? type
}

export function getWidgetTypeAlias(type: WidgetType): string {
  return TYPE_ALIAS[type] ?? type.toUpperCase()
}

export function getWidgetCode(widget: { type: WidgetType; id: string }): string {
  const alias = getWidgetTypeAlias(widget.type)
  const suffix = widget.id.replace(/^widget_/, '')
  return `${alias}_${suffix}`
}

