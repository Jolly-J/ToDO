/**
 * 多看板任务管理系统主题配置
 * 定义层级标识颜色、优先级/状态语义色等全局主题 token
 */

import type { ThemeConfig } from '@/types/multi-board';
import { priorityConfig, statusConfig } from './taskSemanticColors';

// ===== 主题配置 =====
export const multiBoardTheme: ThemeConfig = {
  // 层级标识颜色
  levelColors: {
    company: '#1890FF',    // 蓝色 - 公司级
    department: '#52C41A', // 绿色 - 部门级
    group: '#FA8C16',      // 橙色 - 小组级
  },
  
  // 优先级颜色
  priorityColors: {
    urgent: priorityConfig.urgent.color, // 红色 - 紧急
    high: priorityConfig.high.color, // 橙色 - 高优先级
    medium: priorityConfig.medium.color, // 蓝色 - 中优先级
    low: priorityConfig.low.color, // 绿色 - 低优先级
  },
  
  // 状态颜色
  statusColors: {
    in_progress: statusConfig.in_progress.color,
    delayed_in_progress: statusConfig.delayed_in_progress.color,
    done: statusConfig.done.color,
    delayed_done: statusConfig.delayed_done.color,
    canceled: statusConfig.canceled.color,
  },
  
  // 间距系统
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  
  // 圆角系统
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
};

// ===== 响应式断点 =====
export const responsiveBreakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
  large: 1600,
};

// ===== 可访问性配置 =====
export const defaultAccessibilityConfig = {
  enableKeyboardNavigation: true,
  enableScreenReader: true,
  highContrast: false,
  reducedMotion: false,
};

// ===== CSS 变量生成 =====
export const generateCSSVariables = (theme: ThemeConfig) => {
  return {
    // 层级颜色
    '--level-company-color': theme.levelColors.company,
    '--level-department-color': theme.levelColors.department,
    '--level-group-color': theme.levelColors.group,
    
    // 优先级颜色
    '--priority-urgent-color': theme.priorityColors.urgent,
    '--priority-high-color': theme.priorityColors.high,
    '--priority-medium-color': theme.priorityColors.medium,
    '--priority-low-color': theme.priorityColors.low,
    
    // 状态颜色
    '--status-in-progress-color': theme.statusColors.in_progress,
    '--status-delayed-in-progress-color': theme.statusColors.delayed_in_progress,
    '--status-done-color': theme.statusColors.done,
    '--status-delayed-done-color': theme.statusColors.delayed_done,
    '--status-canceled-color': theme.statusColors.canceled,
    
    // 间距
    '--spacing-xs': theme.spacing.xs,
    '--spacing-sm': theme.spacing.sm,
    '--spacing-md': theme.spacing.md,
    '--spacing-lg': theme.spacing.lg,
    '--spacing-xl': theme.spacing.xl,
    '--spacing-xxl': theme.spacing.xxl,
    
    // 圆角
    '--border-radius-sm': theme.borderRadius.sm,
    '--border-radius-md': theme.borderRadius.md,
    '--border-radius-lg': theme.borderRadius.lg,
    '--border-radius-xl': theme.borderRadius.xl,
  };
};

// ===== 工具函数 =====
export const getLevelColor = (level: 'company' | 'department' | 'group') => {
  return multiBoardTheme.levelColors[level];
};

export const getPriorityColor = (priority: 'urgent' | 'high' | 'medium' | 'low') => {
  return priorityConfig[priority].color;
};

export const getStatusColor = (status: 'in_progress' | 'delayed_in_progress' | 'done' | 'delayed_done' | 'canceled') => {
  return statusConfig[status].color;
};

// ===== 暗色主题配置 =====
export const darkMultiBoardTheme: ThemeConfig = {
  ...multiBoardTheme,
  
  // 暗色模式下的状态颜色调整
  statusColors: {
    in_progress: '#177ddc', // 深蓝色 - 进行中
    delayed_in_progress: '#DC2626',
    done: '#389e0d',       // 深绿色 - 已完成
    delayed_done: '#0F766E',
    canceled: '#64748B',    // 灰蓝色 - 已取消
  },
};
