import type { DataSource, Template } from '@/types'
import { cloneDeep } from 'lodash-es'

const DB_NAME = 'PrintEditorDB'
const DB_VERSION = 2
const DATA_SOURCE_STORE = 'dataSources'
const TEMPLATE_STORE = 'templates'

let db: IDBDatabase | null = null

export async function openDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('无法打开数据库'))
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = event => {
      const database = (event.target as IDBOpenDBRequest).result

      // 数据源存储
      if (!database.objectStoreNames.contains(DATA_SOURCE_STORE)) {
        database.createObjectStore(DATA_SOURCE_STORE, { keyPath: 'fileName' })
      }

      // 模板存储
      if (!database.objectStoreNames.contains(TEMPLATE_STORE)) {
        const templateStore = database.createObjectStore(TEMPLATE_STORE, { keyPath: 'id' })
        templateStore.createIndex('name', 'name', { unique: false })
        templateStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
  })
}

// ==================== 数据源操作 ====================

export async function saveDataSource(dataSource: DataSource): Promise<void> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DATA_SOURCE_STORE], 'readwrite')
    const store = transaction.objectStore(DATA_SOURCE_STORE)
    // 使用 cloneDeep 去除 Vue 的响应式代理，防止 DataCloneError
    const request = store.put(cloneDeep(dataSource))

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('保存数据源失败'))
  })
}

export async function getDataSource(fileName: string): Promise<DataSource | null> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DATA_SOURCE_STORE], 'readonly')
    const store = transaction.objectStore(DATA_SOURCE_STORE)
    const request = store.get(fileName)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('读取数据源失败'))
  })
}

export async function getAllDataSources(): Promise<DataSource[]> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DATA_SOURCE_STORE], 'readonly')
    const store = transaction.objectStore(DATA_SOURCE_STORE)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(new Error('读取所有数据源失败'))
  })
}

export async function deleteDataSource(fileName: string): Promise<void> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([DATA_SOURCE_STORE], 'readwrite')
    const store = transaction.objectStore(DATA_SOURCE_STORE)
    const request = store.delete(fileName)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('删除数据源失败'))
  })
}

// ==================== 模板操作 ====================

export async function saveTemplate(template: Template): Promise<void> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TEMPLATE_STORE], 'readwrite')
    const store = transaction.objectStore(TEMPLATE_STORE)
    // 使用 cloneDeep 去除 Vue 的响应式代理，防止 DataCloneError
    const request = store.put(cloneDeep(template))

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('保存模板失败'))
  })
}

export async function getTemplate(id: string): Promise<Template | null> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TEMPLATE_STORE], 'readonly')
    const store = transaction.objectStore(TEMPLATE_STORE)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error('读取模板失败'))
  })
}

export async function getAllTemplates(): Promise<Template[]> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TEMPLATE_STORE], 'readonly')
    const store = transaction.objectStore(TEMPLATE_STORE)
    const request = store.getAll()

    request.onsuccess = () => {
      const templates = request.result || []
      // 按更新时间倒序排列
      templates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      resolve(templates)
    }
    request.onerror = () => reject(new Error('读取所有模板失败'))
  })
}

export async function deleteTemplate(id: string): Promise<void> {
  const database = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TEMPLATE_STORE], 'readwrite')
    const store = transaction.objectStore(TEMPLATE_STORE)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(new Error('删除模板失败'))
  })
}
