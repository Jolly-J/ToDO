/**
 * MSW Mock 数据 - 多看板任务管理系统
 * 提供开发/测试环境下的模拟任务、团队、看板配置等数据
 */

import type {
  ExtendedTask, 
  FlexibleTeam, 
  TeamMemberExtended, 
  BoardConfiguration,
  TaskRelation,
  TaskHierarchy,
  TaskPermissions,
} from '@/types/multi-board';
import type { User } from '@/types';

// ===== Mock 用户数据 =====
export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: '张三',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang',
    email: 'zhangsan@company.com',
    mobile: '13800138001',
    department_id: 'dept-1',
    department_name: '产品部',
    is_dept_manager: 1,
    status: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    name: '李四',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Li',
    email: 'lisi@company.com',
    mobile: '13800138002',
    department_id: 'dept-2',
    department_name: '技术部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-3',
    name: '王五',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wang',
    email: 'wangwu@company.com',
    mobile: '13800138003',
    department_id: 'dept-3',
    department_name: '设计部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// ===== Mock 扩展任务数据 =====
export const mockExtendedTasks: ExtendedTask[] = [
  {
    id: 'task-1',
    title: '公司级战略规划项目',
    description: '制定2024年公司整体战略规划，包括市场分析、竞争对手分析等',
    status: 'in_progress',
    priority: 'urgent',
    team_id: 'team-1',
    creator_id: 'user-1',
    assignee_id: 'user-1',
    due_date: '2024-03-31T23:59:59Z',
    sort_order: 1,
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-20T14:30:00Z',
    
    // 扩展字段
    level: 'company',
    levelColor: '#1890FF',
    levelMetadata: {
      canEscalate: false,
      escalationPath: [],
      approvalRequired: true,
      approvers: ['user-ceo', 'user-cto'],
    },
    parentTaskId: undefined,
    childTaskIds: ['task-2', 'task-3'],
    dependencies: [],
    relations: [
      { id: 'rel-1', fromTaskId: 'task-1', toTaskId: 'task-2', type: 'subtask', description: '产品需求分析', createdAt: '2024-01-15T09:00:00Z', createdBy: 'user-1' },
      { id: 'rel-2', fromTaskId: 'task-1', toTaskId: 'task-3', type: 'subtask', description: '技术架构评估', createdAt: '2024-01-15T09:00:00Z', createdBy: 'user-1' },
    ],
    estimatedHours: 120,
    actualHours: 45,
    timeTracking: {
      startedAt: '2024-01-15T09:00:00Z',
      totalPausedTime: 0,
    },
    tags: ['战略', '规划', '重要'],
    customFields: {
      budget: 500000,
      stakeholders: ['CEO', 'CTO', '产品总监'],
    },
    collaborators: [
      { userId: 'user-1', role: 'assignee', joinedAt: '2024-01-15T09:00:00Z', permissions: ['manage', 'edit', 'view'], contributionHours: 45 },
      { userId: 'user-2', role: 'reviewer', joinedAt: '2024-01-16T10:00:00Z', permissions: ['edit', 'view'], contributionHours: 8 },
    ],
    watchers: ['user-3'],
    mentions: [],
    position: {
      columnId: 'column-in-progress',
      order: 1,
    },
    approvalFlow: {
      required: true,
      currentStep: 1,
      steps: [
        {
          id: 'step-1',
          stepNumber: 1,
          approverIds: ['user-ceo'],
          requiredApprovals: 1,
          currentApprovals: [],
          status: 'pending',
          deadline: '2024-02-01T23:59:59Z',
        },
      ],
      status: 'pending',
    },
  },
  {
    id: 'task-2',
    title: '产品部门需求分析',
    description: '分析产品部门在战略规划中的具体需求和目标',
    status: 'in_progress',
    priority: 'high',
    team_id: 'team-1',
    creator_id: 'user-1',
    assignee_id: 'user-2',
    due_date: '2024-02-28T23:59:59Z',
    sort_order: 2,
    created_at: '2024-01-16T10:00:00Z',
    updated_at: '2024-01-16T10:00:00Z',
    
    // 扩展字段
    level: 'department',
    levelColor: '#52C41A',
    levelMetadata: {
      canEscalate: true,
      escalationPath: ['company'],
      approvalRequired: false,
      approvers: [],
    },
    parentTaskId: 'task-1',
    childTaskIds: [],
    dependencies: [
      { id: 'dep-1', type: 'blocked_by', targetTaskId: 'task-1', description: '需要等待战略框架确定', createdAt: '2024-01-16T10:00:00Z', createdBy: 'user-1', status: 'active' }
    ],
    relations: [],
    estimatedHours: 40,
    actualHours: 0,
    timeTracking: {
      totalPausedTime: 0,
    },
    tags: ['需求分析', '产品'],
    customFields: {},
    collaborators: [
      { userId: 'user-2', role: 'assignee', joinedAt: '2024-01-16T10:00:00Z', permissions: ['edit', 'view'], contributionHours: 0 },
    ],
    watchers: ['user-1'],
    mentions: [],
    position: {
      columnId: 'column-in-progress',
      order: 1,
    },
  },
  {
    id: 'task-3',
    title: '技术架构评估',
    description: '评估当前技术架构，为战略规划提供技术支撑建议',
    status: 'in_progress',
    priority: 'medium',
    team_id: 'team-2',
    creator_id: 'user-1',
    assignee_id: 'user-3',
    due_date: '2024-02-15T23:59:59Z',
    sort_order: 3,
    created_at: '2024-01-17T11:00:00Z',
    updated_at: '2024-01-17T11:00:00Z',
    
    // 扩展字段
    level: 'group',
    levelColor: '#FA8C16',
    levelMetadata: {
      canEscalate: true,
      escalationPath: ['department', 'company'],
      approvalRequired: false,
      approvers: [],
    },
    parentTaskId: 'task-1',
    childTaskIds: [],
    dependencies: [],
    relations: [],
    estimatedHours: 24,
    actualHours: 0,
    timeTracking: {
      totalPausedTime: 0,
    },
    tags: ['技术', '架构', '评估'],
    customFields: {
      techStack: ['React', 'Node.js', 'SQLite'],
    },
    collaborators: [
      { userId: 'user-3', role: 'assignee', joinedAt: '2024-01-17T11:00:00Z', permissions: ['edit', 'view'], contributionHours: 0 },
    ],
    watchers: [],
    mentions: [],
    position: {
      columnId: 'column-in-progress',
      order: 2,
    },
  },
];

// ===== Mock 灵活团队数据 =====
export const mockFlexibleTeams: FlexibleTeam[] = [
  {
    id: 'team-1',
    name: '战略规划项目组',
    description: '负责公司整体战略规划的跨部门项目团队',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Strategy',
    level: 'custom',
    owner_id: 'user-1',
    is_archived: 0,
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-20T14:30:00Z',
    
    // 扩展字段
    teamType: 'project',
    memberConfig: {
      maxMembers: 10,
      requiredSkills: ['战略规划', '数据分析', '项目管理'],
      allowCrossDepartment: true,
    },
    workloadStats: {
      totalTasks: 15,
      completedTasks: 3,
      averageCompletionTime: 7.5,
    },
  },
  {
    id: 'team-2',
    name: '技术创新小组',
    description: '专注于技术创新和架构优化的技术团队',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Tech',
    level: 'team',
    owner_id: 'user-2',
    is_archived: 0,
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-18T16:00:00Z',
    
    // 扩展字段
    teamType: 'permanent',
    memberConfig: {
      maxMembers: 8,
      requiredSkills: ['前端开发', '后端开发', '系统架构'],
      allowCrossDepartment: false,
    },
    workloadStats: {
      totalTasks: 25,
      completedTasks: 18,
      averageCompletionTime: 5.2,
    },
  },
];

// ===== Mock 团队成员数据 =====
export const mockTeamMembers: TeamMemberExtended[] = [
  {
    id: 'member-1',
    userId: 'user-1',
    teamId: 'team-1',
    role: 'owner',
    joinedAt: '2024-01-15T09:00:00Z',
    currentWorkload: {
      activeTasks: 3,
      totalEstimatedHours: 120,
      utilizationRate: 0.85,
    },
    skills: ['战略规划', '项目管理', '团队领导'],
    availability: {
      status: 'available',
    },
    permissions: ['manage', 'edit', 'view'],
  },
  {
    id: 'member-2',
    userId: 'user-2',
    teamId: 'team-1',
    role: 'admin',
    joinedAt: '2024-01-16T10:00:00Z',
    currentWorkload: {
      activeTasks: 2,
      totalEstimatedHours: 64,
      utilizationRate: 0.70,
    },
    skills: ['数据分析', '技术架构', '产品设计'],
    availability: {
      status: 'busy',
      nextAvailable: '2024-01-25T09:00:00Z',
    },
    permissions: ['edit', 'view'],
  },
];

// ===== Mock 看板配置数据 =====
export const mockBoardConfiguration: BoardConfiguration = {
  id: 'board-1',
  teamId: 'team-1',
  name: '战略规划看板',
  isDefault: true,
  columns: [
    {
      id: 'column-delayed',
      title: '已延期',
      status: 'delayed_in_progress',
      color: '#DC2626',
      order: 0,
      wipLimit: 10,
      automationRules: [],
    },
    {
      id: 'column-in-progress',
      title: '进行中',
      status: 'in_progress',
      color: '#1890FF',
      order: 1,
      wipLimit: 5,
      automationRules: [
        {
          trigger: 'task_moved_in',
          action: 'send_notification',
          parameters: { notifyAssignee: true },
        },
      ],
    },
    {
      id: 'column-done',
      title: '已完成',
      status: 'done',
      color: '#52C41A',
      order: 2,
      automationRules: [
        {
          trigger: 'task_moved_in',
          action: 'set_priority',
          parameters: { priority: 'low' },
        },
      ],
    },
  ],
  viewSettings: {
    groupBy: 'level',
    sortBy: 'priority',
    showSubtasks: true,
    showDependencies: true,
  },
  defaultFilters: {
    level: ['company', 'department', 'group'],
  },
  permissions: {
    canEditColumns: ['user-1'],
    canReorderTasks: ['user-1', 'user-2'],
    canMoveAcrossLevels: ['user-1'],
  },
};

// ===== Mock 任务关联关系数据 =====
export const mockTaskRelations: TaskRelation[] = [
  {
    id: 'relation-1',
    fromTaskId: 'task-1',
    toTaskId: 'task-2',
    type: 'subtask',
    description: '产品需求分析是战略规划的子任务',
    createdAt: '2024-01-15T09:00:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'relation-2',
    fromTaskId: 'task-1',
    toTaskId: 'task-3',
    type: 'subtask',
    description: '技术架构评估是战略规划的子任务',
    createdAt: '2024-01-15T09:00:00Z',
    createdBy: 'user-1',
  },
];

// ===== Mock 任务权限数据 =====
export const mockTaskPermissions: TaskPermissions[] = [
  {
    taskId: 'task-1',
    userId: 'user-1',
    canView: true,
    canEdit: true,
    canDelete: true,
    canAssign: true,
    canChangeLevel: false,
    canManageCollaborators: true,
    inheritedFrom: 'direct',
  },
  {
    taskId: 'task-1',
    userId: 'user-2',
    canView: true,
    canEdit: true,
    canDelete: false,
    canAssign: false,
    canChangeLevel: false,
    canManageCollaborators: false,
    inheritedFrom: 'team',
  },
  {
    taskId: 'task-2',
    userId: 'user-2',
    canView: true,
    canEdit: true,
    canDelete: true,
    canAssign: true,
    canChangeLevel: true,
    canManageCollaborators: true,
    inheritedFrom: 'direct',
  },
];

// ===== Mock 任务层级关系数据 =====
export const mockTaskHierarchies: TaskHierarchy[] = [
  {
    taskId: 'task-1',
    level: 'company',
    parentId: undefined,
    childrenIds: ['task-2', 'task-3'],
    depth: 0,
    path: ['task-1'],
    canMoveToLevel: [],
  },
  {
    taskId: 'task-2',
    level: 'department',
    parentId: 'task-1',
    childrenIds: [],
    depth: 1,
    path: ['task-1', 'task-2'],
    canMoveToLevel: ['group'],
  },
  {
    taskId: 'task-3',
    level: 'group',
    parentId: 'task-1',
    childrenIds: [],
    depth: 1,
    path: ['task-1', 'task-3'],
    canMoveToLevel: ['department'],
  },
];

// ===== 生成随机数据的工具函数 =====
export const generateMockTask = (overrides: Partial<ExtendedTask> = {}): ExtendedTask => {
  const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    title: `Mock 任务 ${id.slice(-4)}`,
    description: '这是一个模拟任务',
    status: 'in_progress',
    priority: 'medium',
    team_id: 'team-1',
    creator_id: 'user-1',
    assignee_id: 'user-2',
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    
    // 扩展字段
    level: 'group',
    levelColor: '#FA8C16',
    levelMetadata: {
      canEscalate: true,
      escalationPath: ['department', 'company'],
      approvalRequired: false,
      approvers: [],
    },
    parentTaskId: undefined,
    childTaskIds: [],
    dependencies: [],
    relations: [],
    estimatedHours: 8,
    actualHours: 0,
    timeTracking: {
      totalPausedTime: 0,
    },
    tags: ['模拟', '测试'],
    customFields: {},
    collaborators: [],
    watchers: [],
    mentions: [],
    position: {
      columnId: 'column-in-progress',
      order: 1,
    },
    
    ...overrides,
  };
};

export const generateMockTeam = (overrides: Partial<FlexibleTeam> = {}): FlexibleTeam => {
  const id = `team-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    name: `Mock 团队 ${id.slice(-4)}`,
    description: '这是一个模拟团队',
    level: 'custom',
    owner_id: 'user-1',
    is_archived: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    
    // 扩展字段
    teamType: 'project',
    memberConfig: {
      maxMembers: 5,
      requiredSkills: [],
      allowCrossDepartment: true,
    },
    workloadStats: {
      totalTasks: 0,
      completedTasks: 0,
      averageCompletionTime: 0,
    },
    
    ...overrides,
  };
};
