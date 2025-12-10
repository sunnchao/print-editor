export type WidgetType = 'text' | 'image' | 'table' | 'barcode' | 'qrcode' | 'line' | 'rect'

/**
 * 毫米到像素的转换系数 (基于 96 DPI)
 * 1 inch = 25.4 mm, 1 inch = 96 px
 * 所以 1 mm = 96 / 25.4 ≈ 3.78 px
 */
export const MM_TO_PX = 3.78

export interface WidgetBase {
  id: string
  type: WidgetType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  locked?: boolean
  forcePageBreak?: boolean // 是否强制分页（此组件独占一页）
}

export interface BorderStyle {
  width: number
  color: string
  style: 'solid' | 'dashed' | 'dotted' | 'none'
}

export interface TextWidget extends WidgetBase {
  type: 'text'
  title?: string // 固定标题文字
  showTitle?: boolean // 是否显示标题，默认为 true
  content: string // 数据内容
  showContent?: boolean // 是否显示数据内容，默认为 true
  fontSize: number
  fontFamily: string
  fontWeight: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  dataSource?: string // Excel 列绑定
  dataRowIndex?: number | 'all' // 数据行选择：'all' 表示所有行，数字表示具体行索引
  // 四边边框设置
  borderTop?: BorderStyle
  borderRight?: BorderStyle
  borderBottom?: BorderStyle
  borderLeft?: BorderStyle
}

export interface ImageWidget extends WidgetBase {
  type: 'image'
  src: string
  fit: 'contain' | 'cover' | 'fill'
}

export interface TableCell {
  content: string
  rowSpan?: number
  colSpan?: number
  dataSource?: string
  // 单元格文本样式
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  backgroundColor?: string
}

export interface TableWidget extends WidgetBase {
  type: 'table'
  tableMode?: 'simple' | 'complex' | 'legacy'
  rows: number
  cols: number
  cells: TableCell[][]
  headerRows: number
  showHeader?: boolean
  borderWidth: number
  borderColor: string
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  tableBorderWidth?: number
  tableBorderColor?: string
  tableBorderStyle?: 'solid' | 'dashed' | 'dotted'
  cellBorderWidth?: number
  cellBorderColor?: string
  cellBorderStyle?: 'solid' | 'dashed' | 'dotted'
  dataSource?: string // 整体数据源绑定
  columnBindings?: Record<number, string>
  columnWidths?: number[]
  rowHeights?: number[]
}

export interface BarcodeWidget extends WidgetBase {
  type: 'barcode'
  value: string
  format: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8'
  dataSource?: string
  dataRowIndex?: number | 'all' // 数据行选择：'all' 表示所有行，数字表示具体行索引
}

export interface QRCodeWidget extends WidgetBase {
  type: 'qrcode'
  value: string
  dataSource?: string
  dataRowIndex?: number | 'all' // 数据行选择：'all' 表示所有行，数字表示具体行索引
}

export interface LineWidget extends WidgetBase {
  type: 'line'
  direction: 'horizontal' | 'vertical'
  lineWidth: number
  lineColor: string
  lineStyle: 'solid' | 'dashed' | 'dotted'
}

export interface RectWidget extends WidgetBase {
  type: 'rect'
  borderWidth: number
  borderColor: string
  borderStyle: 'solid' | 'dashed' | 'dotted'
  backgroundColor: string
  borderRadius: number
}

export type Widget = TextWidget | ImageWidget | TableWidget | BarcodeWidget | QRCodeWidget | LineWidget | RectWidget

export interface DataSource {
  fileName: string
  columns: DataColumn[]
}

export interface DataColumn {
  name: string
  data: (string | number)[]
  mergedRanges?: MergedRange[]
}

export interface MergedRange {
  startRow: number
  endRow: number
  value: string | number
}

export interface PaperSize {
  name: string
  width: number
  height: number
  // 装订线宽度（mm）
  gutterLeft?: number
  gutterRight?: number
  // 页眉页脚内容
  header?: string
  footer?: string
  // 水印设置
  watermark?: {
    text: string
    color: string
    opacity: number // 0-1
    angle: number // 旋转角度 -180 到 180
    fontSize: number // 字体大小
  }
}

export const PAPER_SIZES: PaperSize[] = [
  // A 系列
  // { name: 'A3', width: 297, height: 420 },
  { name: 'A4', width: 210, height: 297 },
  // { name: 'A5', width: 148, height: 210 },
  // { name: 'A6', width: 105, height: 148 },
  // B 系列
  // { name: 'B4', width: 250, height: 353 },
  // { name: 'B5', width: 176, height: 250 },
  // { name: 'B6', width: 125, height: 176 },
  // 其他常用尺寸
  //   三联纸：215 x 93
  // 四联纸：215 x 70
  { name: '三联纸', width: 215, height: 93 },
  { name: '四联纸', width: 215, height: 70 },
  // { name: '自定义', width: 210, height: 297 }
]

/**
 * 批量打印配置
 * 用于将模板与数据源结合，生成多份打印内容
 */
export interface BatchPrintConfig {
  enabled: boolean              // 是否启用批量打印
  dataSourceFile?: string       // 关联的数据源文件名
  printRange: 'all' | 'range'   // 打印范围：全部 或 指定范围
  rangeStart?: number           // 起始行索引（从 0 开始）
  rangeEnd?: number             // 结束行索引
}

export interface Template {
  id: string
  name: string
  description?: string
  paperSize: PaperSize
  widgets: Widget[]
  thumbnail?: string
  createdAt: string
  updatedAt: string
  globalForcePageBreak?: boolean // 全局强制分页（每个组件独占一页）
  batchPrint?: BatchPrintConfig  // 批量打印配置
}

export interface SnapLine {
  type: 'vertical' | 'horizontal'
  position: number
}

export interface TableSelection {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}
