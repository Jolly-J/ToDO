/**
 * 全局类型定义
 * 定义任务、团队、用户等核心业务实体的 TypeScript 类型与联合类型
 */

export type TaskStatus = 'in_progress' | 'delayed_in_progress' | 'done' | 'delayed_done' | 'canceled';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type MyTaskScope = 'all' | 'assigned' | 'participating' | 'created' | 'shared';
export type MyTaskRelationKey = Exclude<MyTaskScope, 'all' | 'shared'>;
export type MyTaskStatusFilter = TaskStatus | 'unfinished' | 'overdue' | 'all';
export type TaskDetailSource = 'default' | 'trash' | 'share';
export type TeamLevel = 'company' | 'department' | 'team' | 'group' | 'project' | 'custom';
export type TeamMemberRole = 'owner' | 'admin' | 'member';
export type TeamMemberTaskVisibilityScope = 'all' | 'self';
export type NotificationType = 'assigned' | 'status_changed' | 'overdue' | 'comment' | 'mentioned';
export type DataScope = 'all' | 'dept' | 'self' | 'custom';
export type ActivityAction = 'created' | 'status_changed' | 'assigned' | 'completed';
export type CommentMessageType = 'message' | 'progress';
export type TaskReminderRule = 'due_15m' | 'due_30m' | 'due_1h' | 'due_3h' | 'due_1d' | 'due_3d' | 'none';

// ===== 实体接口 =====

export interface User {
  id: string;
  name: string;
  avatar?: string;
  avatar_type?: 'custom' | 'dingtalk' | 'default';
  avatar_config?: string | null;
  job_number?: string;
  mobile?: string;
  email?: string;
  department_id?: string;
  department_name?: string;
  globalRoleCodes?: string[];
  is_dept_manager: number;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  level: TeamLevel;
  owner_id: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTeamPayload {
  name: string;
  level: TeamLevel;
  description?: string;
  admin_user_ids?: string[];
  member_user_ids?: string[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role_id: string;
  task_visibility_scope?: TeamMemberTaskVisibilityScope;
  joined_at: string;
}

export interface TeamGroupReminderConfig {
  webhook_url: string;
  secret?: string | null;
  enabled: boolean;
}

export interface TeamGroupReminderRule {
  enabled: boolean;
  send_time: string;
  workday_only: boolean;
  heading?: string | null;
  task_ids?: string[];
}

export interface TeamGroupReminderCalendarSummary {
  status?: string | null;
  source?: string | null;
  synced_at?: string | null;
  last_synced_at?: string | null;
  lastSyncedAt?: string | null;
  override_count?: number | null;
  overrideCount?: number | null;
  workday_count?: number | null;
  message?: string | null;
}

export interface TeamGroupReminderSettings {
  config: TeamGroupReminderConfig | null;
  rule: TeamGroupReminderRule | null;
  selectedTaskIds: string[];
  calendarSummary: TeamGroupReminderCalendarSummary | null;
}

export interface TeamGroupReminderTaskPoolItem {
  id: string;
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  assignee_name?: string | null;
  dingtalk_user_id?: string | null;
  due_date?: string | null;
  can_mention: boolean;
}

export interface SaveTeamGroupReminderPayload {
  config: TeamGroupReminderConfig;
  rule: TeamGroupReminderRule & {
    task_ids: string[];
  };
}

export interface TaskMemberProfile {
  id: string;
  name: string;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  start_date?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  team_id?: string | null;
  task_scope?: 'personal' | 'team';
  parent_id?: string | null;
  subtask_count?: number;
  subtask_done_count?: number;
  subtasks?: Task[];
  breadcrumbs?: Array<{ id: string; title: string }>;
  creator_id: string;
  creator_name?: string;
  creator_avatar?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  team_name?: string;
  my_role_labels?: string[];
  is_team_admin?: boolean;
  can_view_team_members?: boolean;
  participant_ids?: string[];
  participants?: TaskMemberProfile[];
  my_relation_keys?: MyTaskRelationKey[];
  due_date?: string | null;
  completed_at?: string;
  status_updated_at?: string | null;
  delayed_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_name?: string;
  attachment_count?: number;
  comment_count?: number;
  attachments?: TaskAttachment[];
  sort_order: number;
  reminder_rule?: TaskReminderRule | null;
  reminder_at?: string | null;
  periodic_interval_days?: number | null;
  periodic_time?: string | null;
  next_periodic_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  department_name?: string;
  content: string;
  message_type?: CommentMessageType;
  parent_id?: string | null;
  audit_status?: 'pending' | 'approved' | 'rejected' | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  attachments?: CommentAttachment[];
  mentioned_users?: CommentMentionUser[];
  read_state?: CommentReadState;
}

export interface CommentMentionUser {
  id: string;
  name: string;
  avatar?: string | null;
  department_name?: string | null;
  auto_added_to_task?: boolean;
}

export interface CommentReadState {
  recipient_count: number;
  read_count: number;
  unread_count: number;
  has_read: boolean;
}

export interface CommentReadParticipant {
  id: string;
  name?: string | null;
  avatar?: string | null;
  department_name?: string | null;
  role: 'creator' | 'assignee' | 'participant';
  read_at?: string | null;
}

export interface CommentReadStatus {
  read: CommentReadParticipant[];
  unread: CommentReadParticipant[];
}

export interface AttachmentBase {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type?: string;
  created_at: string;
}

export interface TaskAttachment extends AttachmentBase {
  task_id: string;
}

export interface CommentAttachment extends AttachmentBase {
  task_id: string;
  comment_id: string;
}

export type Attachment = TaskAttachment | CommentAttachment;

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  task_id?: string;
  title: string;
  content: string;
  is_read: number;
  dingtalk_sent: number;
  created_at: string;
}

export interface TaskActivityLog {
  id: string;
  task_id: string;
  user_id: string;
  action: ActivityAction;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

// ===== 权限相关 =====

export interface GlobalRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  data_scope: DataScope;
  is_system: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GlobalRolePermission {
  id: string;
  role_id: string;
  permission_code: string;
}

export interface UserGlobalRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by?: string;
  assigned_at: string;
}

export interface TeamRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TeamRolePermission {
  id: string;
  role_id: string;
  permission_code: string;
}

// ===== 泛型 =====

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskPreviewItem {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TeamMemberTaskCheck {
  canRemove?: boolean;
  canExit?: boolean;
  mode: 'direct' | 'task_resolution_required' | 'blocked' | 'forbidden';
  openTaskCount: number;
  responsibleTaskCount: number;
  participantTaskCount: number;
  createdTaskCount: number;
  reason?: string;
  taskPreview: TaskPreviewItem[];
}

export interface TeamDissolveCheck {
  canDissolve: boolean;
  unfinishedTaskCount: number;
  isOwner: boolean;
  reason?: string;
}

export interface TaskShareResult {
  taskId: string;
  channel: string;
  receiverIds: string[];
  sharedBy: string;
  message: string;
}

export interface TaskShareLink {
  url: string;
  title: string;
  content: string;
}
// ===== 导出多看板系统类型 =====
export * from './multi-board';
