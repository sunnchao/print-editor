import type {
  Template,
  Widget,
  TextWidget,
  ImageWidget,
  TableWidget,
  LineWidget,
  RectWidget,
  BarcodeWidget,
  QRCodeWidget
} from '@/types'

const MM_TO_PX = 3.78

/**
 * 将模板导出为可编辑的 HTML 文件
 * @param template 模板数据
 * @param dataSourceStore 数据源 store（可选，用于填充数据）
 */
export function exportAsHtml(template: Template, dataSourceStore?: any) {
  const { paperSize, widgets, name } = template
  const width = paperSize.width * MM_TO_PX
  const height = paperSize.height * MM_TO_PX

  // 生成所有组件的 HTML
  const widgetsHtml = widgets
    .map(widget => generateWidgetHtml(widget, dataSourceStore))
    .join('\n    ')

  // 生成完整的 HTML 文档
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
      background: #f5f5f5;
      padding: 20px;
      min-height: 100vh;
    }

    .container {
      max-width: ${width + 40}px;
      margin: 0 auto;
    }

    .toolbar {
      background: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .toolbar button {
      padding: 8px 16px;
      background: #1890ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.3s;
    }

    .toolbar button:hover {
      background: #40a9ff;
    }

    .toolbar button.secondary {
      background: #52c41a;
    }

    .toolbar button.secondary:hover {
      background: #73d13d;
    }

    .toolbar .info {
      margin-left: auto;
      display: flex;
      align-items: center;
      color: #666;
      font-size: 14px;
    }

    .page {
      width: ${width}px;
      height: ${height}px;
      background: white;
      position: relative;
      margin: 0 auto;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    }

    .widget {
      position: absolute;
      transition: outline 0.2s;
    }

    .widget.selected {
      outline: 2px solid #1890ff;
      outline-offset: 1px;
    }

    .widget.dragging {
      opacity: 0.8;
      cursor: move;
    }

    .editable-text {
      outline: none;
      cursor: text;
    }

    .editable-text:focus {
      outline: 2px dashed #52c41a;
      outline-offset: 2px;
    }

    /* 打印样式 */
    @media print {
      body {
        background: white;
        padding: 0;
      }

      .toolbar {
        display: none !important;
      }

      .page {
        box-shadow: none;
        margin: 0;
      }

      .widget.selected {
        outline: none;
      }
    }

    @page {
      size: ${paperSize.width}mm ${paperSize.height}mm;
      margin: 0;
    }

    /* 表格样式 */
    .table-widget {
      border-collapse: collapse;
      width: 100%;
      height: 100%;
    }

    .table-widget td {
      border: 1px solid #d9d9d9;
      padding: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <button onclick="window.print()">🖨️ 打印</button>
      <button onclick="toggleEditMode()">✏️ <span id="edit-btn-text">编辑模式</span></button>
      <button class="secondary" onclick="saveToFile()">💾 保存为HTML</button>
      <div class="info">
        <span id="status-text">只读模式</span>
      </div>
    </div>

    <div class="page" id="page">
      ${widgetsHtml}
    </div>
  </div>

  <script>
    let editMode = false;
    const widgets = [];

    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
      const widgetElements = document.querySelectorAll('.widget');
      widgetElements.forEach(el => {
        widgets.push({
          element: el,
          originalX: parseInt(el.style.left),
          originalY: parseInt(el.style.top)
        });
      });
    });

    // 切换编辑模式
    function toggleEditMode() {
      editMode = !editMode;
      const statusText = document.getElementById('status-text');
      const btnText = document.getElementById('edit-btn-text');

      if (editMode) {
        statusText.textContent = '编辑模式';
        btnText.textContent = '退出编辑';
        enableEditing();
      } else {
        statusText.textContent = '只读模式';
        btnText.textContent = '编辑模式';
        disableEditing();
      }
    }

    // 启用编辑
    function enableEditing() {
      widgets.forEach(({ element }) => {
        element.classList.add('selected');

        // 文本可编辑
        if (element.classList.contains('text-widget')) {
          element.contentEditable = 'true';
          element.classList.add('editable-text');
        }

        // 启用拖拽
        makeDraggable(element);
      });
    }

    // 禁用编辑
    function disableEditing() {
      widgets.forEach(({ element }) => {
        element.classList.remove('selected', 'dragging');

        if (element.classList.contains('text-widget')) {
          element.contentEditable = 'false';
          element.classList.remove('editable-text');
        }

        element.onmousedown = null;
      });
    }

    // 使元素可拖拽
    function makeDraggable(element) {
      let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

      element.onmousedown = dragMouseDown;

      function dragMouseDown(e) {
        if (!editMode) return;

        // 如果点击的是文本元素本身，不触发拖拽
        if (element.classList.contains('text-widget') && e.target === element) {
          return;
        }

        e.preventDefault();
        element.classList.add('dragging');

        pos3 = e.clientX;
        pos4 = e.clientY;

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }

      function elementDrag(e) {
        e.preventDefault();

        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        const newTop = element.offsetTop - pos2;
        const newLeft = element.offsetLeft - pos1;

        element.style.top = Math.max(0, newTop) + 'px';
        element.style.left = Math.max(0, newLeft) + 'px';
      }

      function closeDragElement() {
        element.classList.remove('dragging');
        document.onmouseup = null;
        document.onmousemove = null;
      }
    }

    // 保存为 HTML 文件
    function saveToFile() {
      const html = document.documentElement.outerHTML;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${escapeHtml(name)}_edited.html';
      a.click();
      URL.revokeObjectURL(url);

      alert('✅ HTML 文件已保存到下载文件夹！');
    }
  </script>
</body>
</html>`

  return html
}

/**
 * 生成单个组件的 HTML
 */
function generateWidgetHtml(widget: Widget, dataSourceStore?: any): string {
  const baseStyle = `left: ${widget.x}px; top: ${widget.y}px; width: ${widget.width}px; height: ${widget.height}px; z-index: ${widget.zIndex || 1};`

  switch (widget.type) {
    case 'text':
      return generateTextWidgetHtml(widget as TextWidget, baseStyle, dataSourceStore)

    case 'image':
      return generateImageWidgetHtml(widget as ImageWidget, baseStyle)

    case 'table':
      return generateTableWidgetHtml(widget as TableWidget, baseStyle, dataSourceStore)

    case 'line':
      return generateLineWidgetHtml(widget as LineWidget, baseStyle)

    case 'rect':
      return generateRectWidgetHtml(widget as RectWidget, baseStyle)

    case 'barcode':
      return generateBarcodeWidgetHtml(widget as BarcodeWidget, baseStyle, dataSourceStore)

    case 'qrcode':
      return generateQRCodeWidgetHtml(widget as QRCodeWidget, baseStyle, dataSourceStore)

    default:
      return ''
  }
}

// 生成文本组件 HTML
function generateTextWidgetHtml(
  widget: TextWidget,
  baseStyle: string,
  dataSourceStore?: any
): string {
  let content = widget.content

  // 如果有数据源绑定，尝试获取数据
  if (widget.dataSource && dataSourceStore) {
    try {
      const rowIndex = typeof widget.dataRowIndex === 'number' ? widget.dataRowIndex : 0
      const value = dataSourceStore.getColumnValue(widget.dataSource, rowIndex)
      if (value !== '' && value !== null && value !== undefined) {
        content = String(value)
      }
    } catch (e) {
      // 忽略错误，使用默认内容
    }
  }

  const textStyle = `font-size: ${widget.fontSize}px; font-family: ${widget.fontFamily}; font-weight: ${widget.fontWeight}; color: ${widget.color}; text-align: ${widget.textAlign}; line-height: 1.5;`

  return `<div class="widget text-widget" style="${baseStyle} ${textStyle}">${escapeHtml(content)}</div>`
}

// 生成图片组件 HTML
function generateImageWidgetHtml(widget: ImageWidget, baseStyle: string): string {
  return `<img class="widget image-widget" src="${escapeHtml(widget.src)}" style="${baseStyle} object-fit: ${widget.fit};" alt="image" />`
}

// 生成表格组件 HTML
function generateTableWidgetHtml(
  widget: TableWidget,
  baseStyle: string,
  dataSourceStore?: any
): string {
  const borderStyle = `border: ${widget.borderWidth}px ${widget.borderStyle || 'solid'} ${widget.borderColor};`

  let tableHtml = '<table class="table-widget">'

  // 简单模式：直接渲染 cells
  for (let i = 0; i < widget.rows; i++) {
    tableHtml += '<tr>'
    for (let j = 0; j < widget.cols; j++) {
      const cell = widget.cells[i]?.[j]
      if (!cell) {
        tableHtml += '<td></td>'
        continue
      }

      let content = cell.content || ''

      // 数据绑定
      if (cell.dataSource && dataSourceStore) {
        try {
          const value = dataSourceStore.getColumnValue(cell.dataSource, 0)
          if (value !== '' && value !== null && value !== undefined) {
            content = String(value)
          }
        } catch (e) {
          // 忽略
        }
      }

      const cellStyle = [
        cell.fontSize ? `font-size: ${cell.fontSize}px` : '',
        cell.fontFamily ? `font-family: ${cell.fontFamily}` : '',
        cell.fontWeight ? `font-weight: ${cell.fontWeight}` : '',
        cell.color ? `color: ${cell.color}` : '',
        cell.textAlign ? `text-align: ${cell.textAlign}` : '',
        cell.backgroundColor ? `background-color: ${cell.backgroundColor}` : ''
      ]
        .filter(Boolean)
        .join('; ')

      const rowSpan = cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ''
      const colSpan = cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ''

      tableHtml += `<td${rowSpan}${colSpan} style="${cellStyle}">${escapeHtml(content)}</td>`
    }
    tableHtml += '</tr>'
  }

  tableHtml += '</table>'

  return `<div class="widget table-widget-container" style="${baseStyle} ${borderStyle}">${tableHtml}</div>`
}

// 生成线条组件 HTML
function generateLineWidgetHtml(widget: LineWidget, baseStyle: string): string {
  const isHorizontal = widget.direction === 'horizontal'
  const borderProp = isHorizontal ? 'border-bottom' : 'border-right'
  const lineStyle = `${borderProp}: ${widget.lineWidth}px ${widget.lineStyle} ${widget.lineColor};`

  return `<div class="widget line-widget" style="${baseStyle} ${lineStyle}"></div>`
}

// 生成矩形组件 HTML
function generateRectWidgetHtml(widget: RectWidget, baseStyle: string): string {
  const rectStyle = `border: ${widget.borderWidth}px ${widget.borderStyle} ${widget.borderColor}; background-color: ${widget.backgroundColor}; border-radius: ${widget.borderRadius}px;`

  return `<div class="widget rect-widget" style="${baseStyle} ${rectStyle}"></div>`
}

// 生成条形码组件 HTML
function generateBarcodeWidgetHtml(
  widget: BarcodeWidget,
  baseStyle: string,
  dataSourceStore?: any
): string {
  let value = widget.value

  if (widget.dataSource && dataSourceStore) {
    try {
      const rowIndex = typeof widget.dataRowIndex === 'number' ? widget.dataRowIndex : 0
      const dataValue = dataSourceStore.getColumnValue(widget.dataSource, rowIndex)
      if (dataValue !== '' && dataValue !== null && dataValue !== undefined) {
        value = String(dataValue)
      }
    } catch (e) {
      // 忽略
    }
  }

  return `<div class="widget barcode-widget" style="${baseStyle} display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; font-size: 12px; color: #999;">
    [条形码: ${escapeHtml(value)} - ${widget.format}]
  </div>`
}

// 生成二维码组件 HTML
function generateQRCodeWidgetHtml(
  widget: QRCodeWidget,
  baseStyle: string,
  dataSourceStore?: any
): string {
  let value = widget.value

  if (widget.dataSource && dataSourceStore) {
    try {
      const rowIndex = typeof widget.dataRowIndex === 'number' ? widget.dataRowIndex : 0
      const dataValue = dataSourceStore.getColumnValue(widget.dataSource, rowIndex)
      if (dataValue !== '' && dataValue !== null && dataValue !== undefined) {
        value = String(dataValue)
      }
    } catch (e) {
      // 忽略
    }
  }

  return `<div class="widget qrcode-widget" style="${baseStyle} display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; font-size: 12px; color: #999;">
    [二维码: ${escapeHtml(value)}]
  </div>`
}

// HTML 转义
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 下载 HTML 文件
 */
export function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.html`
  a.click()
  URL.revokeObjectURL(url)
}
