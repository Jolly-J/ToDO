/**
 * api.ts - Admin 后台的 API 请求函数
 *
 * 封装了所有 Admin 模块的后端接口调用，包括会话验证、健康度检查、用户管理、
 * 角色权限、任务审计、数据同步等功能的 HTTP 请求方法。
 *
 * @module pages/Admin
 */

import request from '@/api/request';
import type {
  AdminAuditFeed,
  AdminHealthInfo,
  AdminSessionInfo,
  AdminSyncJob,
  AdminTaskFeed,
  AdminUserDirectory,
  AdminUserRole,
  DingtalkHtmlImportResult,
  DingtalkImageUploadResult,
  DingtalkPushPayload,
  DingtalkPushRecordFeed,
  DingtalkPushRecordItem,
  DingtalkPushResult,
  DingtalkPushSummary,
} from './types';

export async function fetchAdminSession() {
  return request.get<AdminSessionInfo>('/admin/session');
}

export async function fetchAdminHealth() {
  return request.get<AdminHealthInfo>('/admin/health');
}

export async function fetchAdminUsers(params?: {
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<AdminUserDirectory>('/admin/users', { params });
}

export async function startDingtalkSync(): Promise<{ jobId: string; status: string }> {
  return request.post('/dingtalk/sync');
}

export async function pollSyncStatus(jobId: string): Promise<AdminSyncJob> {
  return request.get<AdminSyncJob>(`/dingtalk/sync/status/${jobId}`);
}

export async function updateUserAdminRole(userId: string, isAdmin: boolean) {
  return request.put<{ userId: string; isAdmin: boolean; roles: AdminUserRole[] }>(
    `/admin/users/${userId}/admin-role`,
    { isAdmin }
  );
}

export async function updateUserDeptManager(userId: string, isDeptManager: boolean) {
  return request.put(`/admin/users/${userId}/dept-manager`, { isDeptManager });
}

export async function fetchAdminAudit(params?: {
  action?: string;
  result?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<AdminAuditFeed>('/admin/audit', { params });
}

export async function fetchAdminTasks(params?: {
  keyword?: string;
  status?: string;
  priority?: string;
  teamId?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<AdminTaskFeed>('/admin/tasks', { params });
}

export async function fetchDingtalkPushSummary() {
  return request.get<DingtalkPushSummary>('/admin/dingtalk-push/summary');
}

export async function uploadDingtalkHtml(file: File, broadcastId?: string) {
  const formData = new FormData();
  formData.append('file', file);
  if (broadcastId) formData.append('broadcastId', broadcastId);
  return request.post<DingtalkHtmlImportResult>('/admin/dingtalk-push/html', formData, { timeout: 120000 });
}

export async function uploadDingtalkImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post<DingtalkImageUploadResult>('/admin/dingtalk-push/image', formData, { timeout: 30000 });
}

export async function sendDingtalkTestPush(
  payload: DingtalkPushPayload & { recipientUserIds: string[]; idempotencyKey: string }
) {
  return request.post<DingtalkPushResult>('/admin/dingtalk-push/test', payload);
}

export async function sendDingtalkAllPush(
  payload: DingtalkPushPayload & { confirmAll: true; idempotencyKey: string }
) {
  return request.post<DingtalkPushResult>('/admin/dingtalk-push/all', payload);
}

export async function fetchDingtalkPushRecords(params?: { page?: number; pageSize?: number }) {
  return request.get<DingtalkPushRecordFeed>('/admin/dingtalk-push/records', { params });
}

export async function recallDingtalkPushRecord(recordId: string) {
  return request.post<DingtalkPushRecordItem>(`/admin/dingtalk-push/records/${recordId}/recall`);
}

export async function retryDingtalkPushFailures(recordId: string, idempotencyKey: string) {
  return request.post<DingtalkPushResult>(`/admin/dingtalk-push/records/${recordId}/retry-failures`, {
    idempotencyKey,
  });
}
