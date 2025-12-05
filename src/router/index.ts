import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'TemplateList',
      component: () => import('@/views/TemplateList.vue'),
      meta: { title: '模板列表' }
    },
    {
      path: '/editor',
      name: 'Editor',
      component: () => import('@/views/Editor.vue'),
      meta: { title: '编辑器' }
    },
    {
      path: '/editor/:id',
      name: 'EditorWithId',
      component: () => import('@/views/Editor.vue'),
      meta: { title: '编辑模板' }
    },
    {
      path: '/preview/:id',
      name: 'Preview',
      component: () => import('@/views/Preview.vue'),
      meta: { title: '预览模板' }
    }
  ]
})

router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '打印模板编辑器'} - 打印模板编辑器`
  next()
})

export default router
