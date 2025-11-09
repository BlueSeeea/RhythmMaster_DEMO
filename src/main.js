import App from './App.svelte'
import './assets/styles/global.css'

// 创建应用实例
const app = new App({
  target: document.getElementById('app')
})

export default app