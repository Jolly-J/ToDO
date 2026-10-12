/**
 * 多看板任务管理系统扩展类型定义
 * 定义看板配置、主题、扩展任务字段等多看板模式专用类型
 */

import type { Task, TaskPriority, Team } from './index';

export type MultiBoardValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | MultiBoardValue[]
  | { [key: string]: MultiBoardValue };

// ===== 任务层级类型 =====
export type TaskLevel = 'company' | 'department' | 'group';

// ===== 看板模式类型 =====
export type BoardMode = 'board' | 'list' | 'calendar';

// ===== 任务状态类型（重新导出以避免循环依赖） =====
export type TaskStatus = 'in_progress' | 'delayed_in_progress' | 'done' | 'delayed_done' | 'canceled';

// ===== 任务关联关系类型 =====
export type TaskRelationType = 'dependency' | 'subtask' | 'related';

// ===== 团队成员角色类型 =====
export type TeamMemberRole = 'owner' | 'admin' | 'member';

// ===== 权限级别类型 =====
export type PermissionLevel = 'view' | 'edit' | 'manage';

// ===== 拖拽限制类型 =====
export interface DragRestrictions {
  allowCrossLevel: boolean;
  allowCrossTeam: boolean;
  allowedStatuses: TaskStatus[];
}

// ===== 扩展任务模型 =====
export interface ExtendedTask extends Task {
  // 层级信息
  level: TaskLevel;
  levelColor: string;
  levelMetadata?: {
    canEscalate: boolean;
    escalationPath?: TaskLevel[];
    approvalRequired: boolean;
    approvers?: string[];
  };
  
  // 关联关系
  parentTaskId?: string;
  childTaskIds: string[];
  dependencies: TaskDependency[];
  relations: TaskRelation[];
  
  // 时间估算和跟踪
  estimatedHours?: number;
  actualHours?: number;
  timeTracking?: {
    startedAt?: string;
    pausedAt?: string;
    completedAt?: string;
    totalPausedTime?: number;
  };
  
  // 标签和自定义字段
  tags: string[];
  customFields: Record<string, MultiBoardValue>;
  
  // 协作信息
  collaborators: TaskCollaborator[];
  watchers: string[];
  mentions: string[];
  
  // 位置信息（用于拖拽排序）
  position: {
    columnId: string;
    order: number;
  };
  
  // 审批流程
  approvalFlow?: {
    required: boolean;
    currentStep: number;
    steps: ApprovalStep[];
    status: 'pending' | 'approved' | 'rejected';
  };
  
  // 任务模板信息
  templateId?: string;
  isTemplate?: boolean;
  
  // 重复任务设置
  recurrence?: {
    enabled: boolean;
    pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
    nextDueDate?: string;
  };
}

// ===== 任务依赖关系 =====
export interface TaskDependency {
  id: string;
  type: 'blocks' | 'blocked_by' | 'related';
  targetTaskId: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'resolved' | 'cancelled';
}

// ===== 任务协作者 =====
export interface TaskCollaborator {
  userId: string;
  role: 'assignee' | 'reviewer' | 'collaborator';
  joinedAt: string;
  permissions: PermissionLevel[];
  lastActiveAt?: string;
  contributionHours?: number;
}

// ===== 看板配置模型 =====
export interface BoardConfiguration {
  id: string;
  teamId: string;
  name: string;
  isDefault: boolean;
  
  // 列配置
  columns: BoardColumn[];
  
  // 视图设置
  viewSettings: {
    groupBy?: 'assignee' | 'priority' | 'level';
    sortBy: 'priority' | 'dueDate' | 'created' | 'updated';
    showSubtasks: boolean;
    showDependencies: boolean;
  };
  
  // 过滤器
  defaultFilters: TaskFilters;
  
  // 权限设置
  permissions: {
    canEditColumns: string[]; // 用户ID列表
    canReorderTasks: string[];
    canMoveAcrossLevels: string[];
  };
}

// ===== 看板列配置 =====
export interface BoardColumn {
  id: string;
  title: string;
  status: TaskStatus;
  color: string;
  order: number;
  
  // 列限制
  wipLimit?: number; // Work In Progress 限制
  
  // 自动化规则
  automationRules: ColumnAutomation[];
}

// ===== 列自动化规则 =====
export interface ColumnAutomation {
  trigger: 'task_moved_in' | 'task_moved_out' | 'due_date_approaching';
  action: 'assign_user' | 'set_priority' | 'send_notification';
  parameters: Record<string, MultiBoardValue>;
}

// ===== 任务过滤器 =====
export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  level?: TaskLevel[];
  assignee?: string[];
  tags?: string[];
  dueDateRange?: {
    start?: string;
    end?: string;
  };
  searchKeyword?: string;
}

// ===== 灵活团队模型 =====
export interface FlexibleTeam extends Team {
  // 团队类型
  teamType: 'permanent' | 'project' | 'temporary';
  
  // 成员配置
  memberConfig: {
    maxMembers?: number;
    requiredSkills: string[];
    allowCrossDepartment: boolean;
  };
  
  // 工作负载统计
  workloadStats: {
    totalTasks: number;
    completedTasks: number;
    averageCompletionTime: number;
  };
}

// ===== 扩展团队成员模型 =====
export interface TeamMemberExtended {
  id: string;
  userId: string;
  teamId: string;
  role: TeamMemberRole;
  joinedAt: string;
  
  // 工作负载
  currentWorkload: {
    activeTasks: number;
    totalEstimatedHours: number;
    utilizationRate: number;
  };
  
  // 技能标签
  skills: string[];
  
  // 可用性
  availability: {
    status: 'available' | 'busy' | 'offline';
    nextAvailable?: string;
  };
  
  // 权限
  permissions: PermissionLevel[];
}

// ===== 任务关联关系 =====
export interface TaskRelation {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: TaskRelationType;
  description?: string;
  createdAt: string;
  createdBy: string;
  metadata?: Record<string, MultiBoardValue>;
}

// ===== 任务层级关系管理 =====
export interface TaskHierarchy {
  taskId: string;
  level: TaskLevel;
  parentId?: string;
  childrenIds: string[];
  depth: number;
  path: string[]; // 从根到当前节点的路径
  canMoveToLevel: TaskLevel[];
}

// ===== 任务权限模型 =====
export interface TaskPermissions {
  taskId: string;
  userId: string;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  canChangeLevel: boolean;
  canManageCollaborators: boolean;
  inheritedFrom?: 'team' | 'level' | 'direct';
}

// ===== 拖拽事件类型 =====
export interface DragStartEvent {
  active: {
    id: string;
    data: {
      current: ExtendedTask;
    };
  };
}

export interface DragEndEvent {
  active: {
    id: string;
    data: {
      current: ExtendedTask;
    };
  };
  over: {
    id: string;
    data: {
      current?: unknown;
    };
  } | null;
}

// ===== 视图模式配置 =====
export interface ViewModeConfig {
  key: BoardMode;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<unknown>;
}

// ===== 审批步骤 =====
export interface ApprovalStep {
  id: string;
  stepNumber: number;
  approverIds: string[];
  requiredApprovals: number; // 需要多少人审批通过
  currentApprovals: string[]; // 已审批的用户ID
  status: 'pending' | 'approved' | 'rejected';
  deadline?: string;
  comments?: string;
}

// ===== 层级任务视图 =====
export interface TaskHierarchyNode {
  task: ExtendedTask;
  children: TaskHierarchyNode[];
  level: number;
  expanded: boolean;
  progress: number;
}

// ===== 错误处理类型 =====
export interface DragError {
  type: 'permission_denied' | 'invalid_target' | 'network_error' | 'concurrent_modification';
  message: string;
  targetPosition?: {
    columnId: string;
    order: number;
  };
}

export interface ConflictError {
  type: 'conflict';
  message: string;
  localData: unknown;
  serverData: unknown;
}

// ===== 同步操作类型 =====
export interface SyncOperation {
  id: string;
  type: 'drag' | 'update' | 'create' | 'delete';
  taskId: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
}

// ===== 待处理更新 =====
export interface PendingUpdate {
  key: string;
  data: unknown;
  timestamp: number;
}

// ===== 加载状态 =====
export interface LoadingState {
  global: boolean;
  tasks: boolean;
  teams: boolean;
  dragOperation: boolean;
  saving: boolean;
}

// ===== 性能监控 =====
export interface PerformanceMetrics {
  viewSwitchTime: number;
  dragResponseTime: number;
  dataLoadTime: number;
  renderTime: number;
}

// ===== 可访问性配置 =====
export interface AccessibilityConfig {
  enableKeyboardNavigation: boolean;
  enableScreenReader: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

// ===== 响应式断点 =====
export interface ResponsiveBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
  large: number;
}

// ===== 主题配置 =====
export interface ThemeConfig {
  // 层级标识颜色
  levelColors: {
    company: string;
    department: string;
    group: string;
  };
  
  // 优先级颜色
  priorityColors: {
    urgent: string;
    high: string;
    medium: string;
    low: string;
  };
  
  // 状态颜色
  statusColors: {
    in_progress: string;
    delayed_in_progress: string;
    done: string;
    delayed_done: string;
    canceled: string;
  };
  
  // 间距系统
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  
  // 圆角系统
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}
