/** 应用入口，挂载 React 根节点并初始化全局配置 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import updateLocale from 'dayjs/plugin/updateLocale'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import clientLogger from './utils/clientLogger'
import './index.css'
import App from './App'

dayjs.extend(updateLocale)
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.updateLocale('zh-cn', { weekStart: 1 })
dayjs.locale('zh-cn')
dayjs.tz.setDefault('Asia/Shanghai')

// [MOBILE ADAPTATION] 允许移动端进入 React 应用，不再拦截
// 初始化日志SDK
clientLogger.init()

async function bootstrap() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Toaster position="top-right" richColors />
    </StrictMode>,
  )
}

bootstrap()
