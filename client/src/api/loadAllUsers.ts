/**
 * 用户列表全量加载工具
 * 支持分页自动遍历，将后端分页接口的数据合并为完整用户列表
 */
import type { User } from '@/types';

export type UserListPayload =
  | User[]
  | {
      list?: User[];
      total?: number;
      page?: number;
      pageSize?: number;
    };

export type FetchUsersPage = (params: { keyword?: string; page: number; pageSize: number }) => Promise<UserListPayload>;

export interface LoadAllUsersOptions {
  keyword?: string;
  pageSize?: number;
  maxPages?: number;
}

function normalizeUsers(payload: UserListPayload): User[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload.list ?? [];
}

function getPaginationMeta(payload: UserListPayload) {
  if (Array.isArray(payload)) {
    return null;
  }
  const total = Number(payload.total);
  const pageSize = Number(payload.pageSize);
  if (!Number.isFinite(total) || !Number.isFinite(pageSize) || total <= 0 || pageSize <= 0) {
    return null;
  }
  return { total, pageSize };
}

export async function loadAllUsers(fetchPage: FetchUsersPage, options: LoadAllUsersOptions = {}) {
  const requestPageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 50;

  const firstPage = await fetchPage({
    keyword: options.keyword,
    page: 1,
    pageSize: requestPageSize,
  });

  const merged = [...normalizeUsers(firstPage)];
  const meta = getPaginationMeta(firstPage);
  if (!meta) {
    return merged;
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const pagesToFetch = Math.min(totalPages, maxPages);

  for (let page = 2; page <= pagesToFetch; page += 1) {
    const nextPage = await fetchPage({
      keyword: options.keyword,
      page,
      pageSize: requestPageSize,
    });
    merged.push(...normalizeUsers(nextPage));
    if (merged.length >= meta.total) {
      break;
    }
  }

  return merged.slice(0, meta.total);
}
