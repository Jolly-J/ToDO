/**
 * 配置名称：任务工具栏样式配置
 * 文件作用：统一维护任务工作区头部与工具栏的尺寸和布局样式。
 * 主要功能：为列表、看板、日历三种任务视图提供一致的工具栏视觉规范。
 */
import type { CSSProperties } from 'react';

export const TASK_TOOLBAR_CONTROL_HEIGHT = 32;

export const taskHeaderRowStyle: CSSProperties = {
  marginBottom: 'var(--tf-density-dashboard-section-gap, 20px)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'var(--tf-density-toolbar-gap, 16px)',
  flexWrap: 'wrap',
};

export const taskHeaderActionGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 'var(--tf-density-toolbar-gap, 10px)',
  flexWrap: 'wrap',
};

export const taskToolbarRowStyle: CSSProperties = {
  marginBottom: 'var(--tf-density-toolbar-margin-bottom, 14px)',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 'var(--tf-density-toolbar-gap, 12px)',
  alignItems: 'center',
  flexWrap: 'wrap',
};

export const taskToolbarFiltersStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--tf-density-toolbar-gap, 10px)',
  flexWrap: 'wrap',
  alignItems: 'stretch',
};

export const taskToolbarLeadingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 'var(--tf-density-toolbar-gap, 10px)',
  flexWrap: 'wrap',
};

export const taskToolbarMiddleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--tf-density-toolbar-gap, 10px)',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  flex: 1,
  minWidth: 280,
};

export const taskToolbarTrailingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexShrink: 0,
  minHeight: 'var(--tf-density-toolbar-control-height, 32px)',
};

export const taskToolbarHintStyle: CSSProperties = {
  color: '#9B9A97',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  minHeight: 'var(--tf-density-toolbar-control-height, 32px)',
};

export const taskToolbarPrimaryActionStyle: CSSProperties = {
  height: 'var(--tf-density-toolbar-control-height, 32px)',
  paddingInline: 16,
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 500,
  background: '#FFFFFF',
  borderColor: '#D9D9D9',
  color: '#262626',
  boxShadow: 'none',
};
