import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import 'ant-design-vue/dist/reset.css'
import './style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(Antd)
app.mount('#app')

// 初始化数据源 store，从 IndexedDB 加载已保存的数据
import { useDataSourceStore } from './stores/datasource'
const dataSourceStore = useDataSourceStore()
dataSourceStore.initFromDB()
