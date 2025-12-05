import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Template } from '@/types'
import { saveTemplate, getTemplate, getAllTemplates, deleteTemplate as deleteFromDB } from '@/utils/indexedDB'

export const useTemplateStore = defineStore('template', () => {
  const templates = ref<Template[]>([])
  const currentTemplate = ref<Template | null>(null)
  const isLoading = ref(false)

  function generateId(): string {
    return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async function loadTemplates() {
    try {
      isLoading.value = true
      templates.value = await getAllTemplates()
      console.log(`加载了 ${templates.value.length} 个模板`)
    } catch (error) {
      console.error('加载模板列表失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function loadTemplate(id: string): Promise<Template | null> {
    try {
      isLoading.value = true
      const template = await getTemplate(id)
      if (template) {
        currentTemplate.value = template
      }
      return template
    } catch (error) {
      console.error('加载模板失败:', error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function createTemplate(name: string, description?: string): Promise<Template> {
    const now = new Date().toISOString()
    const template: Template = {
      id: generateId(),
      name,
      description,
      paperSize: { name: 'A4', width: 210, height: 297 },
      widgets: [],
      createdAt: now,
      updatedAt: now
    }
    
    await saveTemplate(template)
    templates.value.unshift(template)
    currentTemplate.value = template
    return template
  }

  async function updateTemplate(template: Template): Promise<void> {
    template.updatedAt = new Date().toISOString()
    await saveTemplate(template)
    
    const index = templates.value.findIndex(t => t.id === template.id)
    if (index !== -1) {
      templates.value[index] = template
    }
    
    if (currentTemplate.value?.id === template.id) {
      currentTemplate.value = template
    }
  }

  async function duplicateTemplate(id: string): Promise<Template | null> {
    const original = await getTemplate(id)
    if (!original) return null
    
    const now = new Date().toISOString()
    const duplicate: Template = {
      ...original,
      id: generateId(),
      name: `${original.name} (副本)`,
      createdAt: now,
      updatedAt: now
    }
    
    await saveTemplate(duplicate)
    templates.value.unshift(duplicate)
    return duplicate
  }

  async function removeTemplate(id: string): Promise<void> {
    await deleteFromDB(id)
    const index = templates.value.findIndex(t => t.id === id)
    if (index !== -1) {
      templates.value.splice(index, 1)
    }
    if (currentTemplate.value?.id === id) {
      currentTemplate.value = null
    }
  }

  function setCurrentTemplate(template: Template | null) {
    currentTemplate.value = template
  }

  return {
    templates,
    currentTemplate,
    isLoading,
    loadTemplates,
    loadTemplate,
    createTemplate,
    updateTemplate,
    duplicateTemplate,
    removeTemplate,
    setCurrentTemplate
  }
})
