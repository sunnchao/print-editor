<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { message, Modal } from 'ant-design-vue'
  import {
    PlusOutlined,
    EditOutlined,
    EyeOutlined,
    CopyOutlined,
    DeleteOutlined,
    FileTextOutlined
  } from '@ant-design/icons-vue'
  import { useTemplateStore } from '@/stores/template'

  const router = useRouter()
  const templateStore = useTemplateStore()

  const createModalVisible = ref(false)
  const newTemplateName = ref('')
  const newTemplateDesc = ref('')

  onMounted(() => {
    templateStore.loadTemplates()
  })

  function showCreateModal() {
    newTemplateName.value = ''
    newTemplateDesc.value = ''
    createModalVisible.value = true
  }

  async function handleCreate() {
    if (!newTemplateName.value.trim()) {
      message.warning('请输入模板名称')
      return
    }

    try {
      const template = await templateStore.createTemplate(
        newTemplateName.value.trim(),
        newTemplateDesc.value.trim() || undefined
      )
      createModalVisible.value = false
      message.success('模板创建成功')
      router.push(`/editor/${template.id}`)
    } catch (e) {
      message.error('创建模板失败')
    }
  }

  function handleEdit(id: string) {
    router.push(`/editor/${id}`)
  }

  function handlePreview(id: string) {
    router.push(`/preview/${id}`)
  }

  async function handleDuplicate(id: string) {
    try {
      await templateStore.duplicateTemplate(id)
      message.success('模板复制成功')
    } catch (e) {
      message.error('复制模板失败')
    }
  }

  function handleDelete(id: string, name: string) {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除模板 "${name}" 吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await templateStore.removeTemplate(id)
          message.success('模板已删除')
        } catch (e) {
          message.error('删除模板失败')
        }
      }
    })
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
</script>

<template>
  <div class="template-list-page">
    <div class="page-header">
      <h1>打印模板管理</h1>
      <a-button type="primary" @click="showCreateModal">
        <plus-outlined />
        新建模板
      </a-button>
    </div>

    <a-spin :spinning="templateStore.isLoading">
      <div v-if="templateStore.templates.length === 0" class="empty-state">
        <a-empty description="暂无模板"></a-empty>
      </div>

      <div v-else class="template-grid">
        <a-card
          v-for="template in templateStore.templates"
          :key="template.id"
          hoverable
          class="template-card"
        >
          <template #cover>
            <div class="template-thumbnail" @click="handleEdit(template.id)">
              <file-text-outlined class="thumbnail-icon" />
              <div class="paper-size">{{ template.paperSize.name }}</div>
            </div>
          </template>

          <a-card-meta :title="template.name">
            <template #description>
              <div class="template-info">
                <p v-if="template.description" class="desc">{{ template.description }}</p>
                <p class="time">更新于: {{ formatDate(template.updatedAt) }}</p>
              </div>
            </template>
          </a-card-meta>

          <template #actions>
            <a-tooltip title="设计">
              <edit-outlined @click="handleEdit(template.id)" />
            </a-tooltip>
            <a-tooltip title="预览">
              <eye-outlined @click="handlePreview(template.id)" />
            </a-tooltip>
            <a-tooltip title="复制">
              <copy-outlined @click="handleDuplicate(template.id)" />
            </a-tooltip>
            <a-tooltip title="删除">
              <delete-outlined
                style="color: #ff4d4f"
                @click="handleDelete(template.id, template.name)"
              />
            </a-tooltip>
          </template>
        </a-card>
      </div>
    </a-spin>

    <a-modal
      v-model:open="createModalVisible"
      title="新建模板"
      ok-text="创建"
      cancel-text="取消"
      @ok="handleCreate"
    >
      <a-form layout="vertical">
        <a-form-item label="模板名称" required>
          <a-input v-model:value="newTemplateName" placeholder="请输入模板名称" />
        </a-form-item>
        <a-form-item label="模板描述">
          <a-textarea
            v-model:value="newTemplateDesc"
            placeholder="请输入模板描述（可选）"
            :rows="3"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
  .template-list-page {
    min-height: 100vh;
    background: #f0f2f5;
    padding: 24px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .page-header h1 {
    margin: 0;
    font-size: 24px;
  }

  .empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
    background: #fff;
    border-radius: 8px;
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  .template-card {
    border-radius: 8px;
  }

  .template-thumbnail {
    height: 160px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
  }

  .thumbnail-icon {
    font-size: 48px;
    color: rgba(255, 255, 255, 0.9);
  }

  .paper-size {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.3);
    color: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .template-info .desc {
    margin: 0 0 4px 0;
    color: #666;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .template-info .time {
    margin: 0;
    color: #999;
    font-size: 12px;
  }
</style>
