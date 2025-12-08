import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { Template } from '@/types'

/**
 * 将 HTML 元素导出为 PDF
 * @param template 模板数据
 * @param element 要导出的 DOM 元素
 * @param options 导出选项
 */
export async function exportAsPdf(
  template: Template,
  element: HTMLElement,
  options?: {
    filename?: string
    quality?: number
    scale?: number
  }
) {
  const { paperSize, name } = template
  const filename = options?.filename || name
  const quality = options?.quality || 2
  const scale = options?.scale || 2

  try {
    // 使用 html2canvas 将 DOM 转换为 canvas
    const canvas = await html2canvas(element, {
      scale: scale, // 提高分辨率，2 倍清晰度
      useCORS: true, // 支持跨域图片
      logging: false, // 关闭日志
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      // 忽略某些元素
      ignoreElements: (element) => {
        return element.classList?.contains('no-print') || false
      }
    })

    // 获取 canvas 数据
    const imgData = canvas.toDataURL('image/jpeg', quality / 10) // 0.2 = 20% 质量

    // 创建 PDF
    const orientation = paperSize.width > paperSize.height ? 'landscape' : 'portrait'
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [paperSize.width, paperSize.height],
      compress: true
    })

    // 计算图片在 PDF 中的尺寸
    const imgWidth = paperSize.width
    const imgHeight = paperSize.height

    // 添加图片到 PDF（从左上角开始，铺满整个页面）
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST')

    // 保存 PDF
    pdf.save(`${filename}.pdf`)

    return true
  } catch (error) {
    console.error('PDF 导出失败:', error)
    throw error
  }
}

/**
 * 将多个页面导出为 PDF（多页模板）
 * @param template 模板数据
 * @param elements 多个页面元素
 * @param options 导出选项
 */
export async function exportMultiPagePdf(
  template: Template,
  elements: HTMLElement[],
  options?: {
    filename?: string
    quality?: number
    scale?: number
  }
) {
  const { paperSize, name } = template
  const filename = options?.filename || name
  const quality = options?.quality || 2
  const scale = options?.scale || 2

  try {
    const orientation = paperSize.width > paperSize.height ? 'landscape' : 'portrait'
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [paperSize.width, paperSize.height],
      compress: true
    })

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]

      // 转换为 canvas
      const canvas = await html2canvas(element, {
        scale: scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 0
      })

      const imgData = canvas.toDataURL('image/jpeg', quality / 10)

      // 如果不是第一页，添加新页
      if (i > 0) {
        pdf.addPage([paperSize.width, paperSize.height], orientation)
      }

      // 添加图片
      pdf.addImage(
        imgData,
        'JPEG',
        0,
        0,
        paperSize.width,
        paperSize.height,
        undefined,
        'FAST'
      )
    }

    // 保存 PDF
    pdf.save(`${filename}.pdf`)

    return true
  } catch (error) {
    console.error('多页 PDF 导出失败:', error)
    throw error
  }
}

/**
 * 快速导出（使用浏览器打印功能）
 * 这个方法会直接调用浏览器的打印对话框，用户可以选择"另存为 PDF"
 * 优点：渲染质量高，速度快，文件小
 * 缺点：需要用户手动操作
 */
export function exportPdfByPrint() {
  window.print()
}
