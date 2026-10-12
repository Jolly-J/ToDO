/**
 * 配置名称：团队元信息映射
 * 文件作用：统一维护团队层级的中文文案和颜色。
 * 主要功能：为团队列表、团队空间等页面提供一致的层级展示口径。
 */
export const teamLevelLabels: Record<string, string> = {
  company: '公司级',
  department: '部门级',
  team: '团队级',
  group: '小组级',
  project: '项目级',
  custom: '自定义',
};

export const teamLevelColors: Record<string, string> = {
  company: '#2B5A9B',
  department: '#6B7280',
  team: '#10B981',
  group: '#F59E0B',
  project: '#6B7280',
  custom: '#6B7280',
};
