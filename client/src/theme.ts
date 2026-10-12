/**
 * 项目设计 Token
 * 定义全局颜色、间距等设计变量，供 Tailwind CSS 变量和业务代码引用
 * antd ThemeConfig 已移除，改用 CSS 变量体系（见 index.css）
 */

export const taskFlowColors = {
  primary: '#2783DE',
  info: '#2783DE',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  bgBase: '#FFFFFF',
  bgLayout: '#FFFFFF',
  textBase: '#37352F',
  textSecondary: '#787774',
  border: '#E9E9E7',
} as const;
