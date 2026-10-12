/**
 * 管理后台用户目录加载器
 * 自动分页遍历后端接口，汇总完整的用户目录数据供管理页面使用
 */
import type { AdminUserDirectory } from './types';

export interface LoadAdminUserDirectoryOptions {
  keyword?: string;
  status?: string;
  pageSize?: number;
  maxPages?: number;
}

export type FetchAdminUsersPage = (params: {
  keyword?: string;
  status?: string;
  page: number;
  pageSize: number;
}) => Promise<AdminUserDirectory>;

export async function loadAdminUserDirectory(
  fetchPage: FetchAdminUsersPage,
  options: LoadAdminUserDirectoryOptions = {}
) {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 20;

  const firstPage = await fetchPage({
    keyword: options.keyword,
    status: options.status,
    page: 1,
    pageSize,
  });

  const mergedList = [...firstPage.list];
  const backendPageSize = firstPage.pageSize || pageSize;
  const totalPages = Math.max(1, Math.ceil((firstPage.total || mergedList.length) / backendPageSize));
  const pagesToFetch = Math.min(totalPages, maxPages);

  for (let page = 2; page <= pagesToFetch; page += 1) {
    const nextPage = await fetchPage({
      keyword: options.keyword,
      status: options.status,
      page,
      pageSize,
    });
    mergedList.push(...nextPage.list);
    if (mergedList.length >= nextPage.total) {
      break;
    }
  }

  return {
    ...firstPage,
    page: 1,
    pageSize: mergedList.length || firstPage.pageSize,
    list: mergedList.slice(0, firstPage.total || mergedList.length),
  } satisfies AdminUserDirectory;
}
