/**
 * 数据表格国际化配置
 * 定义分页、选中计数等文案的中文本地化实现
 */
export interface DataTableLocale {
  rowsPerPage: string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  loading: string;
  formatSelectedCount: (selectedCount: number, totalCount: number) => string;
  formatPageInfo: (pageIndex: number, pageCount: number) => string;
}

export const zhCNDataTableLocale: DataTableLocale = {
  rowsPerPage: '每页条数',
  firstPage: '跳到第一页',
  previousPage: '上一页',
  nextPage: '下一页',
  lastPage: '跳到最后一页',
  loading: '正在加载...',
  formatSelectedCount: (selectedCount, totalCount) => `已选 ${selectedCount} / ${totalCount} 条`,
  formatPageInfo: (pageIndex, pageCount) => `第 ${pageIndex} / ${pageCount} 页`,
};
