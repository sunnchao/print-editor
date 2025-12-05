export type WidgetType = 'text' | 'image' | 'table' | 'barcode' | 'qrcode' | 'line' | 'rect'

export interface WidgetBase {
  id: string
  type: WidgetType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  locked?: boolean
}

export interface TextWidget extends WidgetBase {
  type: 'text'
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  dataSource?: string // Excel 列绑定
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
}

export interface QRCodeWidget extends WidgetBase {
  type: 'qrcode'
  value: string
  dataSource?: string
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
}

export const PAPER_SIZES: PaperSize[] = [
  { name: 'A4', width: 210, height: 297 },
  { name: 'A5', width: 148, height: 210 },
  { name: 'A6', width: 105, height: 148 },
  { name: '自定义', width: 200, height: 300 }
]

export interface Template {
  id: string
  name: string
  description?: string
  paperSize: PaperSize
  widgets: Widget[]
  thumbnail?: string
  createdAt: string
  updatedAt: string
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
