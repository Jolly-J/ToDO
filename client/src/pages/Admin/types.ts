/**
 * types.ts - Admin 模块的 TypeScript 类型定义
 *
 * 定义了 Admin 后台管理系统的核心数据结构，包括会话信息、健康度指标、
 * 审计事件和用户目录等类型定义，为整个 Admin 模块提供类型安全保障。
 *
 * @module pages/Admin
 */

import type { Task, TaskPriority, TaskStatus } from '@/types';

export type StatusTone = 'success' | 'warning' | 'error' | 'neutral';

export interface AdminSessionInfo {
  userId: string;
  isAdmin: boolean;
  roleCodes: string[];
}

export interface OperationItem {
  id: string;
  title: string;
  detail: string;
  level: StatusTone;
  label: string;
  time: string;
}

export interface AdminHealthMetric {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
  progress: number;
  source: string;
  lastEventAt?: string | null;
  lastCreatedAt?: string | null;
}

export interface AdminHealthInfo {
  generatedAt: string;
  windowHours: number;
  metrics: {
    login: AdminHealthMetric;
    sync: AdminHealthMetric;
    notifications: AdminHealthMetric;
  };
  recentEvents: OperationItem[];
}

export interface AdminUserRole {
  id: string;
  code: string;
  name: string;
  data_scope?: string;
  is_system?: number;
}

export interface AdminUserItem {
  id: string;
  name: string;
  avatar?: string;
  job_number?: string;
  mobile?: string;
  email?: string;
  department_id?: string | null;
  department_name?: string;
  is_dept_manager?: number;
  status: number;
  created_at?: string;
  updated_at?: string;
  isDeptManager: boolean;
  statusLabel: string;
  isAdmin: boolean;
  globalRoles: AdminUserRole[];
  roleCodes: string[];
  roleNames: string[];
}

export type DingtalkPushFailureKind =
  | 'invalid_user'
  | 'flow_controlled'
  | 'batch_error'
  | 'missing_identity';

export interface DingtalkPushFailure {
  kind: DingtalkPushFailureKind;
  name?: string;
  providerUserId?: string;
  userId?: string;
  batch?: number;
  count?: number;
  reason: string;
}

export interface DingtalkPushSummary {
  latestAll: DingtalkPushLatestAll | null;
}

export interface DingtalkPushLatestAll {
  recordId: string;
  broadcastId: string | null;
  messageType: DingtalkPushMessageType;
  title: string;
  status: string;
  processKey: string | null;
  submittedAt: string;
  error: string | null;
  failures: DingtalkPushFailure[];
  recallStatus: DingtalkRecallStatus;
}

export interface DingtalkHtmlImportResult {
  broadcastId: string;
  originalName: string;
  htmlSize: number;
  previewUrl: string;
}

export interface DingtalkImageUploadResult {
  url: string;
  filename: string;
  size: number;
}

export type DingtalkPushMessageType = 'markdown' | 'action_card';
export type DingtalkPushOpenType = 'slide' | 'popupWindow' | 'workbench' | 'browser';

export interface DingtalkPushPayload {
  messageType: DingtalkPushMessageType;
  title: string;
  markdown: string;
  buttonText?: string;
  broadcastId?: string;
  coverImageUrl?: string;
  openType?: DingtalkPushOpenType;
}

export interface DingtalkPushResult {
  recordId: string;
  scope: 'test' | 'all' | 'retry';
  messageType: DingtalkPushMessageType;
  status: DingtalkSendStatus;
  recipientCount: number;
  failureCount: number;
}

export type DingtalkSendStatus = 'queued' | 'sending' | 'succeeded' | 'partial' | 'failed';
export type DingtalkRecallStatus = 'none' | 'recalling' | 'recalled' | 'partial' | 'failed';

export interface DingtalkPushRecordItem {
  id: string;
  parentRecordId: string | null;
  scope: 'test' | 'all' | 'retry';
  messageType: DingtalkPushMessageType;
  title: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  viewCount: number;
  viewTrackingEnabled: boolean;
  status: DingtalkSendStatus;
  recallStatus: DingtalkRecallStatus;
  recallDeadlineAt: string;
  createdAt: string;
  finishedAt: string | null;
  requestedByName: string;
  lastError: string | null;
  recallError: string | null;
  failures: DingtalkPushFailure[];
  processKeyCount: number;
  canRecall: boolean;
  recallExpired: boolean;
  canRetry: boolean;
  retryableCount: number;
}

export interface DingtalkPushRecordFeed {
  list: DingtalkPushRecordItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserDirectory {
  list: AdminUserItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    total: number;
    activeCount: number;
    adminCount: number;
    deptManagerCount: number;
  };
}

export interface AdminAuditItem {
  id: string;
  action: string;
  title: string;
  detail: string;
  result: string;
  tone: StatusTone;
  label: string;
  time: string | null;
  reqId: string | null;
  durationMs: number;
  raw: Record<string, unknown>;
}

export interface AdminAuditFeed {
  list: AdminAuditItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    successCount: number;
    failedCount: number;
    skippedCount: number;
    warningCount: number;
  };
  facets: {
    actions: string[];
    results: string[];
  };
}

export interface AdminSyncResult {
  departmentsSynced: number;
  usersSynced: number;
  usersDisabled: number;
  finishedAt: string;
}

export interface AdminSyncJob {
  jobId: string;
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  result: Omit<AdminSyncResult, 'finishedAt'> | null;
  error: string | null;
}

export type AdminTaskItem = Task;

export interface AdminTaskFeed {
  list: AdminTaskItem[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    teams: Array<{ id: string; name: string }>;
    statuses: TaskStatus[];
    priorities: TaskPriority[];
  };
}

export interface AdminLayoutContextValue {
  session: AdminSessionInfo | null;
  sessionLoading: boolean;
  sessionError: string | null;
}
