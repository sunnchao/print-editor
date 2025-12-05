import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DataSource, DataColumn, MergedRange } from '@/types'
import * as XLSX from 'xlsx'
import { saveDataSource, getAllDataSources, deleteDataSource as deleteFromDB } from '@/utils/indexedDB'

export const useDataSourceStore = defineStore('datasource', () => {
  const dataSources = ref<DataSource[]>([])
  const currentDataSource = ref<DataSource | null>(null)
  const isLoading = ref(false)

  const columnOptions = computed(() => {
    if (!currentDataSource.value) return []
    return currentDataSource.value.columns.map(col => ({
      label: col.name,
      value: col.name
    }))
  })

  // 初始化：从 IndexedDB 加载所有数据源
  async function initFromDB() {
    try {
      isLoading.value = true
      const sources = await getAllDataSources()
      dataSources.value = sources
      if (sources.length > 0) {
        currentDataSource.value = sources[0]
      }
      console.log(`从 IndexedDB 加载了 ${sources.length} 个数据源`)
    } catch (error) {
      console.error('从 IndexedDB 加载数据源失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 格式化单元格值，处理日期等特殊类型
  function formatCellValue(cell: XLSX.CellObject | undefined): string | number {
    if (!cell) return ''
    
    // 处理日期类型
    // Excel 日期以数字存储（距离1900-01-01的天数）
    // t='d' 表示日期，t='n' 可能也是日期（如果有日期格式）
    if (cell.t === 'd' && cell.v instanceof Date) {
      // 直接是日期对象
      return formatDate(cell.v)
    }
    
    if (cell.t === 'n' && typeof cell.v === 'number') {
      // 检查是否是日期格式（通过格式字符串判断）
      const fmt = cell.z ? String(cell.z) : ''
      if (isDateFormat(fmt) || (cell.v > 25569 && cell.v < 47483)) {
        // 25569 是 1970-01-01 在 Excel 中的数值
        // 47483 是 2030-01-01 在 Excel 中的数值
        // 如果数值在这个合理范围内，且看起来像日期序号，尝试转换
        if (fmt && isDateFormat(fmt)) {
          const date = XLSX.SSF.parse_date_code(cell.v)
          if (date) {
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
          }
        }
      }
    }
    
    // 如果有格式化后的文本 w，优先使用（保留 Excel 中显示的格式）
    if (cell.w !== undefined) {
      return cell.w
    }
    
    // 处理其他类型
    const value = cell.v
    if (value === undefined || value === null) return ''
    if (typeof value === 'boolean') return value ? '是' : '否'
    if (typeof value === 'string' || typeof value === 'number') return value
    if (value instanceof Date) return formatDate(value)
    return String(value)
  }
  
  // 判断格式字符串是否是日期格式
  function isDateFormat(fmt: string): boolean {
    if (!fmt) return false
    // 常见的日期格式标识
    const datePatterns = [
      /y+/i, /m+/i, /d+/i, /h+/i, /s+/i,
      /\[.*\]/, // 如 [红色]
      /年/, /月/, /日/
    ]
    // 排除纯数字格式
    if (/^[#0,.%]+$/.test(fmt)) return false
    return datePatterns.some(p => p.test(fmt))
  }
  
  // 格式化日期为字符串
  function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function parseExcel(file: File): Promise<DataSource> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          if (!data) {
            reject(new Error('文件读取失败'))
            return
          }
          
          console.log('开始解析 Excel 文件:', file.name)
          // 使用 cellDates 选项让 xlsx 自动解析日期
          const workbook = XLSX.read(data, { 
            type: 'array',
            cellDates: true,  // 启用日期解析
            cellNF: true,     // 保留数字格式
            cellText: true    // 生成格式化文本
          })
          console.log('工作表列表:', workbook.SheetNames)
          
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          
          if (!sheet['!ref']) {
            reject(new Error('Excel 文件为空'))
            return
          }
          
          const range = XLSX.utils.decode_range(sheet['!ref'])
          const merges = sheet['!merges'] || []
          
          console.log('数据范围:', range, '合并单元格:', merges.length)
          
          const columns: DataColumn[] = []
          
          // 获取列标题（第一行）
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
            const cell = sheet[cellAddress]
            const columnName = cell ? String(formatCellValue(cell)) : `列${col + 1}`
            
            const columnData: (string | number)[] = []
            const mergedRanges: MergedRange[] = []
            
            // 解析该列数据（从第二行开始）
            for (let row = 1; row <= range.e.r; row++) {
              const dataCellAddress = XLSX.utils.encode_cell({ r: row, c: col })
              const dataCell = sheet[dataCellAddress]
              
              // 检查是否在合并单元格范围内
              let mergedValue: string | number | null = null
              for (const merge of merges) {
                if (col >= merge.s.c && col <= merge.e.c && 
                    row >= merge.s.r && row <= merge.e.r) {
                  // 获取合并单元格的起始值
                  const mergeStartCell = sheet[XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })]
                  mergedValue = formatCellValue(mergeStartCell)
                  
                  // 记录合并范围（仅记录该列的合并信息）
                  if (col === merge.s.c) {
                    const existingRange = mergedRanges.find(
                      r => r.startRow === merge.s.r - 1 && r.endRow === merge.e.r - 1
                    )
                    if (!existingRange) {
                      mergedRanges.push({
                        startRow: merge.s.r - 1,
                        endRow: merge.e.r - 1,
                        value: mergedValue ?? ''
                      })
                    }
                  }
                  break
                }
              }
              
              if (mergedValue !== null) {
                columnData.push(mergedValue)
              } else {
                columnData.push(formatCellValue(dataCell))
              }
            }
            
            columns.push({
              name: columnName,
              data: columnData,
              mergedRanges: mergedRanges.length > 0 ? mergedRanges : undefined
            })
          }
          
          const dataSource: DataSource = {
            fileName: file.name,
            columns
          }
          
          console.log('Excel 解析完成，列数:', columns.length, '行数:', columns[0]?.data.length || 0)
          resolve(dataSource)
        } catch (error) {
          console.error('Excel 解析错误:', error)
          reject(error)
        }
      }
      
      reader.onerror = (error) => {
        console.error('文件读取错误:', error)
        reject(new Error('文件读取失败'))
      }
      
      reader.readAsArrayBuffer(file)
    })
  }

  async function uploadExcel(file: File) {
    try {
      isLoading.value = true
      console.log('开始上传文件:', file.name, '大小:', file.size)
      
      // 检查是否已存在同名文件
      const existingIndex = dataSources.value.findIndex(ds => ds.fileName === file.name)
      
      const dataSource = await parseExcel(file)
      
      // 保存到 IndexedDB（以文件名为 key，实现数据隔离）
      await saveDataSource(dataSource)
      console.log('数据已保存到 IndexedDB:', file.name)
      
      // 更新内存中的数据
      if (existingIndex !== -1) {
        dataSources.value[existingIndex] = dataSource
      } else {
        dataSources.value.push(dataSource)
      }
      currentDataSource.value = dataSource
      
      return dataSource
    } catch (error) {
      console.error('Excel 上传处理失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function setCurrentDataSource(fileName: string) {
    currentDataSource.value = dataSources.value.find(ds => ds.fileName === fileName) || null
  }

  function getColumnData(columnName: string): (string | number)[] {
    if (!currentDataSource.value) return []
    const column = currentDataSource.value.columns.find(col => col.name === columnName)
    return column ? column.data : []
  }

  function getColumnValue(columnName: string, rowIndex: number): string | number {
    const data = getColumnData(columnName)
    return data[rowIndex] ?? ''
  }

  async function removeDataSource(fileName: string) {
    try {
      // 从 IndexedDB 删除
      await deleteFromDB(fileName)
      console.log('从 IndexedDB 删除数据源:', fileName)
      
      // 从内存中删除
      const index = dataSources.value.findIndex(ds => ds.fileName === fileName)
      if (index !== -1) {
        dataSources.value.splice(index, 1)
        if (currentDataSource.value?.fileName === fileName) {
          currentDataSource.value = dataSources.value[0] || null
        }
      }
    } catch (error) {
      console.error('删除数据源失败:', error)
      throw error
    }
  }

  return {
    dataSources,
    currentDataSource,
    columnOptions,
    isLoading,
    initFromDB,
    uploadExcel,
    setCurrentDataSource,
    getColumnData,
    getColumnValue,
    removeDataSource
  }
})
