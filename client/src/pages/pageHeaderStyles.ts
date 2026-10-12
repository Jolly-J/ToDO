/**
 * 配置名称：页面顶部样式配置
 * 文件作用：统一维护页面轻页头、详情头和面包屑的内联样式。
 * 主要功能：为多个页面复用相同的标题、操作区和辅助信息样式。
 */
import type { CSSProperties } from 'react';

export const pageHeaderStyles = {
  toolbar: {
    marginBottom: 'var(--tf-density-dashboard-section-gap, 20px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--tf-density-toolbar-gap, 16px)',
    flexWrap: 'wrap',
    paddingBottom: 12,
    borderBottom: '1px solid #F1F1EF',
  } satisfies CSSProperties,
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } satisfies CSSProperties,
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: '#37352F',
  } satisfies CSSProperties,
  meta: {
    margin: 0,
    color: '#9B9A97',
    fontSize: 12,
  } satisfies CSSProperties,
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--tf-density-toolbar-gap, 12px)',
    flexWrap: 'wrap',
  } satisfies CSSProperties,
  roundedActionButton: {
    borderRadius: 999,
    boxShadow: 'none',
    fontWeight: 500,
  } satisfies CSSProperties,
  detailLeading: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--tf-density-toolbar-gap, 12px)',
    flexWrap: 'wrap',
  } satisfies CSSProperties,
  detailBackButton: {
    borderRadius: 999,
    boxShadow: 'none',
  } satisfies CSSProperties,
  detailTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  } satisfies CSSProperties,
  breadcrumb: {
    margin: 0,
    color: '#9B9A97',
    fontSize: 12,
  } satisfies CSSProperties,
  breadcrumbLink: {
    color: '#787774',
    cursor: 'pointer',
  } satisfies CSSProperties,
} as const;
