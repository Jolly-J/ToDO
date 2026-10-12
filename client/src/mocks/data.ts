/** Mock 数据定义，提供本地开发所需的用户、团队、任务等静态数据 */
import type {
  User,
  Team,
  Task,
  Notification,
  TaskAttachment,
  CommentAttachment,
  TaskMemberProfile,
  Comment,
  MyTaskScope,
  MyTaskStatusFilter,
  TaskPriority,
  CreateTeamPayload,
} from '@/types';

// ===== Mock 数据工厂 =====

// 用户列表
export const mockUsers: User[] = [
  {
    id: 'u1',
    name: '张三',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan',
    mobile: '13800138000',
    email: 'zhangsan@company.com',
    department_id: 'd1',
    department_name: '研发中心',
    is_dept_manager: 1,
    status: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'u2',
    name: '李四',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisi',
    mobile: '13800138001',
    email: 'lisi@company.com',
    department_id: 'd1',
    department_name: '电池工艺部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
  {
    id: 'u3',
    name: '王五',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangwu',
    mobile: '13800138002',
    email: 'wangwu@company.com',
    department_id: 'd2',
    department_name: '计划运营部',
    is_dept_manager: 1,
    status: 1,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  },
  {
    id: 'u4',
    name: '赵六',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhaoliu',
    mobile: '13800138003',
    email: 'zhaoliu@company.com',
    department_id: 'd2',
    department_name: '组件制造部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-04T00:00:00Z',
    updated_at: '2024-01-04T00:00:00Z',
  },
  {
    id: 'u5',
    name: '钱七',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=qianqi',
    mobile: '13800138004',
    email: 'qianqi@company.com',
    department_id: 'd3',
    department_name: '质量管理部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
  },
  {
    id: 'u6',
    name: '孙八',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sunba',
    mobile: '13800138005',
    email: 'sunba@company.com',
    department_id: 'd4',
    department_name: '国内销售部',
    is_dept_manager: 1,
    status: 1,
    created_at: '2024-01-06T00:00:00Z',
    updated_at: '2024-01-06T00:00:00Z',
  },
  {
    id: 'u7',
    name: '周九',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhoujiu',
    mobile: '13800138006',
    email: 'zhoujiu@company.com',
    department_id: 'd5',
    department_name: '海外销售部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-07T00:00:00Z',
    updated_at: '2024-01-07T00:00:00Z',
  },
  {
    id: 'u8',
    name: '吴十',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wushi',
    mobile: '13800138007',
    email: 'wushi@company.com',
    department_id: 'd4',
    department_name: '设备工程部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-08T00:00:00Z',
    updated_at: '2024-01-08T00:00:00Z',
  },
  {
    id: 'u9',
    name: '郑十一',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhengshiyi',
    mobile: '13800138008',
    email: 'zhengshiyi@company.com',
    department_id: 'd6',
    department_name: '供应链管理部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-09T00:00:00Z',
    updated_at: '2024-01-09T00:00:00Z',
  },
  {
    id: 'u10',
    name: '王十二',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangshier',
    mobile: '13800138009',
    email: 'wangshier@company.com',
    department_id: 'd5',
    department_name: '财务管理部',
    is_dept_manager: 0,
    status: 1,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  },
];

// 当前登录用户（模拟）
export const mockCurrentUser = mockUsers[0];

// Team 列表
export const mockTeams: Team[] = [
  {
    id: 't1',
    name: 'TOPCon 提效攻关组',
    description: '负责 N 型电池片效率、良率和工艺窗口优化',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=frontend',
    level: 'group',
    owner_id: 'u1',
    is_archived: 0,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  },
  {
    id: 't2',
    name: '组件交付保障组',
    description: '负责组件制造、排产执行、设备异常和交付保障',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=backend',
    level: 'group',
    owner_id: 'u2',
    is_archived: 0,
    created_at: '2024-01-11T00:00:00Z',
    updated_at: '2024-01-11T00:00:00Z',
  },
  {
    id: 't3',
    name: '市场产品协同组',
    description: '负责客户需求、认证资料、新品导入与样品评审',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=product',
    level: 'team',
    owner_id: 'u3',
    is_archived: 0,
    created_at: '2024-01-12T00:00:00Z',
    updated_at: '2024-01-12T00:00:00Z',
  },
  {
    id: 't4',
    name: '质量闭环专项组',
    description: '负责来料、制程、客诉和复盘闭环',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=qa',
    level: 'custom',
    owner_id: 'u6',
    is_archived: 0,
    created_at: '2024-01-13T00:00:00Z',
    updated_at: '2024-01-13T00:00:00Z',
  },
  {
    id: 't5',
    name: '产销协同经营组',
    description: '负责销售预测、排产平衡、库存周转和价格审批协同',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=process',
    level: 'company',
    owner_id: 'u1',
    is_archived: 0,
    created_at: '2024-01-14T00:00:00Z',
    updated_at: '2024-01-14T00:00:00Z',
  },
];

// Team 成员
export const mockTeamMembers = [
  { id: 'tm1', team_id: 't1', user_id: 'u1', role_id: 'owner', joined_at: '2024-01-10T00:00:00Z' },
  { id: 'tm2', team_id: 't1', user_id: 'u2', role_id: 'admin', joined_at: '2024-01-10T00:00:00Z' },
  { id: 'tm3', team_id: 't1', user_id: 'u5', role_id: 'member', joined_at: '2024-01-11T00:00:00Z' },
  { id: 'tm4', team_id: 't2', user_id: 'u2', role_id: 'owner', joined_at: '2024-01-11T00:00:00Z' },
  { id: 'tm5', team_id: 't2', user_id: 'u4', role_id: 'member', joined_at: '2024-01-12T00:00:00Z' },
  { id: 'tm5-1', team_id: 't2', user_id: 'u5', role_id: 'member', joined_at: '2024-01-12T00:00:00Z' },
  { id: 'tm5-2', team_id: 't2', user_id: 'u8', role_id: 'member', joined_at: '2024-01-12T00:00:00Z' },
  { id: 'tm5-3', team_id: 't2', user_id: 'u9', role_id: 'member', joined_at: '2024-01-12T00:00:00Z' },
  { id: 'tm6', team_id: 't3', user_id: 'u3', role_id: 'owner', joined_at: '2024-01-12T00:00:00Z' },
  { id: 'tm7', team_id: 't3', user_id: 'u4', role_id: 'member', joined_at: '2024-01-13T00:00:00Z' },
  { id: 'tm8', team_id: 't3', user_id: 'u7', role_id: 'member', joined_at: '2024-01-13T00:00:00Z' },
  { id: 'tm8-1', team_id: 't3', user_id: 'u5', role_id: 'member', joined_at: '2024-01-13T00:00:00Z' },
  { id: 'tm9', team_id: 't4', user_id: 'u6', role_id: 'owner', joined_at: '2024-01-13T00:00:00Z' },
  { id: 'tm10', team_id: 't4', user_id: 'u8', role_id: 'admin', joined_at: '2024-01-14T00:00:00Z' },
  { id: 'tm11', team_id: 't4', user_id: 'u2', role_id: 'member', joined_at: '2024-01-14T00:00:00Z' },
  { id: 'tm12', team_id: 't5', user_id: 'u1', role_id: 'owner', joined_at: '2024-01-14T00:00:00Z' },
  { id: 'tm13', team_id: 't5', user_id: 'u3', role_id: 'admin', joined_at: '2024-01-14T00:00:00Z' },
  { id: 'tm14', team_id: 't5', user_id: 'u6', role_id: 'member', joined_at: '2024-01-15T00:00:00Z' },
  { id: 'tm15', team_id: 't5', user_id: 'u9', role_id: 'member', joined_at: '2024-01-15T00:00:00Z' },
];

// Task 列表（多样化的测试数据）
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

const rawMockTasks: Task[] = [
  {
    id: 'task1',
    title: '183N 电池片良率异常分析与提效验证',
    description: '针对 183N 电池片 A 班批次良率下滑问题，联合研发、工艺、质量和设备团队完成异常归因、参数复核和提效验证，输出可用于量产切换的处置建议。',
    status: 'in_progress',
    priority: 'high',
    team_id: 't1',
    creator_id: 'u1',
    assignee_id: 'u2',
    participant_ids: ['u1', 'u5'],
    due_date: tomorrow.toISOString().split('T')[0],
    sort_order: 1,
    created_at: lastWeek.toISOString(),
    updated_at: lastWeek.toISOString(),
  },
  {
    id: 'task2',
    title: 'PECVD 镀膜参数窗口复核与批次跟踪',
    description: '复核 PECVD 镀膜关键参数窗口，跟踪近三天异常批次的膜厚、折射率和良率波动，确认是否需要收窄工艺上下限并调整首件放行标准。',
    status: 'in_progress',
    priority: 'urgent',
    team_id: 't1',
    creator_id: 'u1',
    assignee_id: 'u2',
    participant_ids: ['u1', 'u5'],
    due_date: today.toISOString().split('T')[0],
    sort_order: 2,
    created_at: lastWeek.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task3',
    title: 'SE 激光开槽工艺周报归档',
    description: '整理 SE 激光开槽工艺一周的效率、碎片率和返修数据，归档周报并同步给工艺例会，作为下周量产参数调整的依据。',
    status: 'done',
    priority: 'medium',
    team_id: 't1',
    creator_id: 'u2',
    assignee_id: 'u5',
    participant_ids: ['u1', 'u2'],
    due_date: yesterday.toISOString().split('T')[0],
    completed_at: yesterday.toISOString(),
    sort_order: 3,
    created_at: lastWeek.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task4',
    title: '银浆单耗降低试验批排期确认',
    description: '协调试验线排出银浆单耗优化批次，确认投产节拍、试验配方、抽检要求和样品留存方式，避免试验批与正常排产冲突。',
    status: 'in_progress',
    priority: 'high',
    team_id: 't1',
    creator_id: 'u1',
    assignee_id: 'u2',
    participant_ids: ['u1', 'u5'],
    due_date: nextWeek.toISOString().split('T')[0],
    sort_order: 4,
    created_at: yesterday.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task5',
    title: 'TOPCon A5 批次良率复盘结案',
    description: '对 TOPCon A5 批次的效率损失、外观不良和复判差异进行结案复盘，形成已确认根因、纠正动作和后续监控项。',
    status: 'done',
    priority: 'low',
    team_id: 't1',
    creator_id: 'u1',
    assignee_id: 'u2',
    participant_ids: ['u1', 'u5'],
    due_date: lastWeek.toISOString().split('T')[0],
    completed_at: lastWeek.toISOString(),
    sort_order: 5,
    created_at: lastWeek.toISOString(),
    updated_at: lastWeek.toISOString(),
  },
  {
    id: 'task6',
    title: '扩散炉温漂超限紧急处置',
    description: '针对扩散炉 3 号机温漂超限导致的方阻波动，完成停机确认、批次隔离、设备点检和临时处置方案发布，避免异常继续扩散到后段工序。',
    status: 'in_progress',
    priority: 'urgent',
    team_id: 't1',
    creator_id: 'u1',
    assignee_id: 'u2',
    participant_ids: ['u1', 'u5'],
    due_date: yesterday.toISOString().split('T')[0],
    sort_order: 6,
    created_at: lastWeek.toISOString(),
    updated_at: lastWeek.toISOString(),
  },
  {
    id: 'task7',
    title: '欧洲订单装柜清单复核',
    description: '复核欧洲客户本周发运订单的装柜清单、托盘数、外箱标签和并柜策略，确保计划、制造和物流使用同一版装柜数据。',
    status: 'in_progress',
    priority: 'medium',
    team_id: 't2',
    creator_id: 'u2',
    assignee_id: 'u4',
    participant_ids: ['u2'],
    due_date: nextWeek.toISOString().split('T')[0],
    sort_order: 1,
    created_at: lastWeek.toISOString(),
    updated_at: lastWeek.toISOString(),
  },
  {
    id: 'task8',
    title: '层压机真空异常停线排查',
    description: '针对层压机真空值波动引发的短时停线问题，完成设备点检、胶膜批次排查和停机损失统计，给出恢复生产的确认条件。',
    status: 'in_progress',
    priority: 'high',
    team_id: 't2',
    creator_id: 'u2',
    assignee_id: 'u4',
    participant_ids: ['u2'],
    due_date: tomorrow.toISOString().split('T')[0],
    sort_order: 2,
    created_at: lastWeek.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task9',
    title: '巴西客户 182R 认证资料补齐',
    description: '按照巴西客户的准入要求补齐 182R 组件认证资料、测试报告和包装说明，确保销售签约前完成版本统一和资料盖章。',
    status: 'in_progress',
    priority: 'high',
    team_id: 't3',
    creator_id: 'u7',
    assignee_id: 'u3',
    participant_ids: ['u4', 'u7'],
    due_date: today.toISOString().split('T')[0],
    sort_order: 1,
    created_at: yesterday.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task10',
    title: '新客户样品 BOM 评审完成',
    description: '围绕新客户样品订单的 BOM 版本、辅材替代和交期要求完成一次性评审，确认报价、打样和量产切换所需的前置条件。',
    status: 'done',
    priority: 'medium',
    team_id: 't3',
    creator_id: 'u3',
    assignee_id: 'u4',
    participant_ids: ['u3', 'u7'],
    due_date: yesterday.toISOString().split('T')[0],
    completed_at: yesterday.toISOString(),
    sort_order: 2,
    created_at: lastWeek.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task11',
    title: '欧洲客户 182 组件新包装方案联审',
    description: '围绕欧洲渠道客户的外箱标识、托盘摆放、追溯标签和装柜约束进行联审，确保销售承诺、制造执行和质量要求使用同一版包装方案。',
    status: 'in_progress',
    priority: 'medium',
    team_id: 't3',
    creator_id: 'u7',
    assignee_id: 'u4',
    participant_ids: ['u3', 'u5', 'u7'],
    due_date: nextWeek.toISOString().split('T')[0],
    sort_order: 4,
    created_at: yesterday.toISOString(),
    updated_at: today.toISOString(),
  },
  {
    id: 'task12',
    title: '双面率试验数据复核与口径确认',
    description: '复核双面率试验线近两周的测试数据、样品条件和统计口径，确认对外汇报时使用的统一算法和版本，避免销售与研发口径不一致。',
    status: 'in_progress',
    priority: 'low',
    team_id: 't1',
    creator_id: 'u2',
    assignee_id: 'u1',
    participant_ids: ['u2', 'u5'],
    due_date: yesterday.toISOString().split('T')[0],
    sort_order: 8,
    created_at: yesterday.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task13',
    title: '组件 EL 复判流程修订完成',
    description: '完成组件 EL 复判流程、判定口径和复判记录模板的修订，同步生产、质量和销售支持团队，保证客诉批次复判方式一致。',
    status: 'done',
    priority: 'urgent',
    team_id: 't2',
    creator_id: 'u2',
    assignee_id: 'u4',
    participant_ids: ['u2', 'u5'],
    due_date: today.toISOString().split('T')[0],
    completed_at: today.toISOString(),
    sort_order: 3,
    created_at: lastWeek.toISOString(),
    updated_at: today.toISOString(),
  },
  {
    id: 'task14',
    title: 'EVA 胶膜短缺替代料评估',
    description: '评估 EVA 胶膜短缺情况下的替代料可行性，结合库存、到料周期和客户认证限制，给出短期保供方案与风险提示。',
    status: 'in_progress',
    priority: 'high',
    team_id: 't2',
    creator_id: 'u4',
    assignee_id: 'u2',
    participant_ids: ['u4', 'u9'],
    due_date: nextWeek.toISOString().split('T')[0],
    sort_order: 4,
    created_at: yesterday.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task15',
    title: '分销渠道 6 月需求滚动评审',
    description: '基于分销渠道最新提报的滚动需求，校准 6 月销量预测、区域备货节奏和营销资源投放优先级，为月度产销平衡会提供输入。',
    status: 'in_progress',
    priority: 'medium',
    team_id: 't3',
    creator_id: 'u7',
    assignee_id: 'u3',
    participant_ids: ['u4', 'u7'],
    due_date: nextWeek.toISOString().split('T')[0],
    sort_order: 3,
    created_at: lastWeek.toISOString(),
    updated_at: today.toISOString(),
  },
  {
    id: 'task16',
    title: '海外客诉复现与抽检清单刷新',
    description: '针对海外客户反馈的外观异常和微裂问题，刷新复现步骤、抽检清单和留样要求，确保售后、质量和制造使用同一套闭环资料。',
    status: 'in_progress',
    priority: 'high',
    team_id: 't4',
    creator_id: 'u6',
    assignee_id: 'u8',
    participant_ids: ['u6', 'u2'],
    due_date: tomorrow.toISOString().split('T')[0],
    sort_order: 1,
    created_at: yesterday.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task17',
    title: '热斑异常复盘模板沉淀',
    description: '沉淀热斑异常复盘模板，统一问题背景、批次信息、根因分析和客户回复结构，为后续客诉闭环提供标准化模板。',
    status: 'done',
    priority: 'low',
    team_id: 't4',
    creator_id: 'u6',
    assignee_id: 'u8',
    participant_ids: ['u6', 'u2'],
    due_date: lastWeek.toISOString().split('T')[0],
    completed_at: yesterday.toISOString(),
    sort_order: 2,
    created_at: lastWeek.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task18',
    title: '海外大单排产与交期协同',
    description: '围绕海外大单交付窗口组织销售、计划、制造和供应链协同，确认锁单节奏、投产批次、关键物料到位时间和客户承诺交期。',
    status: 'in_progress',
    priority: 'urgent',
    team_id: 't5',
    creator_id: 'u6',
    assignee_id: 'u3',
    participant_ids: ['u1', 'u6', 'u9'],
    due_date: tomorrow.toISOString().split('T')[0],
    sort_order: 1,
    created_at: yesterday.toISOString(),
    updated_at: today.toISOString(),
  },
  {
    id: 'task19',
    title: '销售预测与产能平衡复核',
    description: '基于最新销售预测复核产能平衡方案，确认瓶颈工序、库存消耗和回款目标之间的匹配关系，输出经营周会使用的统一测算版本。',
    status: 'in_progress',
    priority: 'high',
    team_id: 't5',
    creator_id: 'u9',
    assignee_id: 'u1',
    participant_ids: ['u3', 'u6', 'u9'],
    due_date: nextWeek.toISOString().split('T')[0],
    sort_order: 2,
    created_at: today.toISOString(),
    updated_at: today.toISOString(),
  },
  {
    id: 'task20',
    title: '渠道库存周转预警规则梳理',
    description: '梳理渠道库存周转预警规则、区域阈值和责任分工，形成销售、计划和财务都认可的预警口径，减少高库存积压风险。',
    status: 'in_progress',
    priority: 'medium',
    team_id: 't5',
    creator_id: 'u3',
    assignee_id: undefined,
    participant_ids: ['u1', 'u6', 'u9'],
    due_date: undefined,
    sort_order: 3,
    created_at: today.toISOString(),
    updated_at: today.toISOString(),
  },
  {
    id: 'task21',
    title: '旧版产销协调草案归档',
    description: '旧版产销协调草案已经被新版经营周会机制替代，但仍需保留评审意见、锁单逻辑和排产说明作为回溯材料，因此转入回收站备查。',
    status: 'in_progress',
    priority: 'medium',
    team_id: 't5',
    creator_id: 'u1',
    assignee_id: 'u3',
    participant_ids: ['u6', 'u9'],
    due_date: nextWeek.toISOString().split('T')[0],
    deleted_at: today.toISOString(),
    deleted_by: 'u1',
    sort_order: 4,
    created_at: yesterday.toISOString(),
    updated_at: today.toISOString(),
  },
  {
    id: 'task22',
    title: '老版价格审批口径归档',
    description: '老版价格审批口径已被新报价策略替换，但仍需保留审批门槛、折扣边界和区域差异说明，用于交付演示和历史追溯。',
    status: 'done',
    priority: 'low',
    team_id: 't5',
    creator_id: 'u1',
    assignee_id: 'u6',
    participant_ids: ['u9'],
    due_date: lastWeek.toISOString().split('T')[0],
    completed_at: lastWeek.toISOString(),
    deleted_at: yesterday.toISOString(),
    deleted_by: 'u1',
    sort_order: 5,
    created_at: lastWeek.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: 'task23',
    title: '层压工艺试验旧记录',
    description: '这条删除记录属于其他成员，用于模拟历史试验记录已下线但仍保留备查，不应出现在当前用户的个人回收站视图中。',
    status: 'in_progress',
    priority: 'high',
    team_id: 't2',
    creator_id: 'u2',
    assignee_id: 'u4',
    participant_ids: ['u2', 'u8'],
    due_date: tomorrow.toISOString().split('T')[0],
    deleted_at: today.toISOString(),
    deleted_by: 'u2',
    sort_order: 5,
    created_at: yesterday.toISOString(),
    updated_at: today.toISOString(),
  },
];

const toDateOnly = (value: Date) => value.toISOString().split('T')[0];

const resolveStartDate = (task: Task, index: number) => {
  if (task.start_date) {
    return task.start_date;
  }

  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    if (!Number.isNaN(dueDate.getTime())) {
      const offsetDays = task.status === 'done' ? -5 : task.status === 'in_progress' ? -3 : -2;
      dueDate.setDate(dueDate.getDate() + offsetDays);
      return toDateOnly(dueDate);
    }
  }

  const createdDate = new Date(task.created_at);
  if (!Number.isNaN(createdDate.getTime())) {
    return toDateOnly(createdDate);
  }

  const fallbackDate = new Date(today);
  fallbackDate.setDate(fallbackDate.getDate() - (index % 7));
  return toDateOnly(fallbackDate);
};

export const mockTasks: Task[] = rawMockTasks.map((task, index) => ({
  ...task,
  start_date: resolveStartDate(task, index),
  is_deleted: task.is_deleted ?? Boolean(task.deleted_at),
  deleted_at: task.deleted_at ?? null,
  deleted_by: task.deleted_by ?? null,
}));

// 我的任务（兼容旧 mock 引用，默认返回当前用户被分派的任务）
export const mockMyTasks = mockTasks.filter((task) => task.assignee_id === mockCurrentUser.id && !task.is_deleted);

// Notification 列表
export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    user_id: 'u1',
    type: 'assigned',
    task_id: 'task1',
    title: '良率异常任务分配',
    content: '张三分配了“183N 电池片良率异常分析与提效验证”给你，请尽快确认首批异常批次。',
    is_read: 0,
    dingtalk_sent: 1,
    created_at: yesterday.toISOString(),
  },
  {
    id: 'n2',
    user_id: 'u1',
    type: 'status_changed',
    task_id: 'task19',
    title: '经营测算已更新',
    content: '“销售预测与产能平衡复核”已更新为进行中，最新测算版本已同步。',
    is_read: 0,
    dingtalk_sent: 0,
    created_at: today.toISOString(),
  },
  {
    id: 'n3',
    user_id: 'u1',
    type: 'overdue',
    task_id: 'task12',
    title: '试验数据超期提醒',
    content: '“双面率试验数据复核与口径确认”已超期，请尽快完成统一口径确认。',
    is_read: 1,
    dingtalk_sent: 1,
    created_at: today.toISOString(),
  },
  {
    id: 'n4',
    user_id: 'u1',
    type: 'comment',
    task_id: 'task11',
    title: '包装方案有新评论',
    content: '王五在“欧洲客户 182 组件新包装方案联审”下补充了装柜约束说明。',
    is_read: 1,
    dingtalk_sent: 0,
    created_at: lastWeek.toISOString(),
  },
  {
    id: 'n5',
    user_id: 'u1',
    type: 'mentioned',
    task_id: 'task18',
    title: '你被提及',
    content: '周九在“海外大单排产与交期协同”中提到了你，请确认锁单窗口。',
    is_read: 0,
    dingtalk_sent: 1,
    created_at: today.toISOString(),
  },
  {
    id: 'n6',
    user_id: 'u1',
    type: 'status_changed',
    task_id: 'task13',
    title: '复判流程已完成',
    content: '“组件 EL 复判流程修订完成”已更新为已完成，可以开始执行新版流程。',
    is_read: 0,
    dingtalk_sent: 0,
    created_at: today.toISOString(),
  },
  {
    id: 'n7',
    user_id: 'u1',
    type: 'assigned',
    task_id: 'task18',
    title: '产销协同任务加入',
    content: '你已加入“海外大单排产与交期协同”的协作名单，请关注产能测算和锁单节奏。',
    is_read: 1,
    dingtalk_sent: 1,
    created_at: yesterday.toISOString(),
  },
  {
    id: 'n8',
    user_id: 'u1',
    type: 'overdue',
    task_id: 'task12',
    title: '口径确认再次提醒',
    content: '“双面率试验数据复核与口径确认”仍未处理，经营例会前请补齐最终版本。',
    is_read: 0,
    dingtalk_sent: 1,
    created_at: today.toISOString(),
  },
];

export const mockComments: Comment[] = [
  {
    id: 'c1',
    task_id: 'task1',
    user_id: 'u1',
    content: '早会确认过了，这次先锁定 A 班 183N 异常批次做提效验证。研发这边需要在今天下班前给出首版异常归因，避免影响明天的批次切换。',
    parent_id: null,
    created_at: '2026-03-17T09:30:00.000Z',
    updated_at: '2026-03-17T09:30:00.000Z',
  },
  {
    id: 'c2',
    task_id: 'task1',
    user_id: 'u2',
    content: '工艺这边已经把扩散、PECVD 和 SE 三段参数拉出来了，初步看 PECVD 膜厚波动比较明显。我会把异常批次和正常批次的对照表一并发出来。',
    parent_id: null,
    created_at: '2026-03-17T10:15:00.000Z',
    updated_at: '2026-03-17T10:15:00.000Z',
  },
  {
    id: 'c3',
    task_id: 'task1',
    user_id: 'u5',
    content: '质量复判完三片异常样本了，主要问题集中在边缘区域 EL 暗斑。建议这次验证除了效率，还要把外观和复判结果一起挂出来，不然后面不好闭环。',
    parent_id: null,
    created_at: '2026-03-17T11:00:00.000Z',
    updated_at: '2026-03-17T11:00:00.000Z',
  },
  {
    id: 'c4',
    task_id: 'task1',
    user_id: 'u8',
    content: '设备工程这边刚复核过 PECVD 2 号机和扩散炉 3 号机的点检记录，晚上会安排一次漂移校准。只要校准完成，明天一早可以安排验证批次投片。',
    parent_id: null,
    created_at: '2026-03-17T11:26:00.000Z',
    updated_at: '2026-03-17T11:26:00.000Z',
  },
  {
    id: 'c5',
    task_id: 'task2',
    user_id: 'u5',
    content: '质检室会先盯今天下午两批片子的膜厚复测结果，如果 PECVD 参数窗口还是偏离，我建议今晚就冻结异常批次，避免继续流到后段。',
    parent_id: null,
    created_at: '2026-03-17T11:45:00.000Z',
    updated_at: '2026-03-17T11:45:00.000Z',
  },
  {
    id: 'c6',
    task_id: 'task11',
    user_id: 'u7',
    content: '客户今天补了一版包装要求，重点是外箱条码位置、托盘堆高和角护条规格。海外销售这边希望今晚能先把版本统一下来，明天直接回客户。',
    parent_id: null,
    created_at: '2026-03-17T12:20:00.000Z',
    updated_at: '2026-03-17T12:20:00.000Z',
  },
  {
    id: 'c7',
    task_id: 'task11',
    user_id: 'u4',
    content: '制造端确认过了，现有托盘方案如果不调整箱唛位置，现场扫码会被护角遮挡。建议追溯标签和箱唛拆成上下两段，不然出货时容易返工。',
    parent_id: null,
    created_at: '2026-03-17T12:36:00.000Z',
    updated_at: '2026-03-17T12:36:00.000Z',
  },
  {
    id: 'c8',
    task_id: 'task11',
    user_id: 'u5',
    content: '质量这边补一个要求：新包装方案里必须明确角护条、缠绕膜和防潮标识的判定照片，不然客户现场验货时争议会比较大。',
    parent_id: null,
    created_at: '2026-03-17T13:02:00.000Z',
    updated_at: '2026-03-17T13:02:00.000Z',
  },
  {
    id: 'c9',
    task_id: 'task11',
    user_id: 'u3',
    content: '计划这边看过装柜约束了，如果包装尺寸调整，会影响本周五那批柜子的装载数量。我建议包装方案确认后同步更新装柜清单和交期承诺。',
    parent_id: null,
    created_at: '2026-03-17T13:18:00.000Z',
    updated_at: '2026-03-17T13:18:00.000Z',
  },
  {
    id: 'c10',
    task_id: 'task16',
    user_id: 'u8',
    content: '我先把海外客诉对应的复现工位、抽检数量和拍照要求整理出来，今晚会补一版可执行的抽检清单，方便质量和售后统一动作。',
    parent_id: null,
    created_at: '2026-03-17T13:05:00.000Z',
    updated_at: '2026-03-17T13:05:00.000Z',
  },
  {
    id: 'c11',
    task_id: 'task18',
    user_id: 'u3',
    content: '计划这边先把锁单窗口和排产节奏拉出来了，当前最紧张的是下周三前的产能。只要物料到位，我们可以优先插单两天，把核心客户的首批出货顶上去。',
    parent_id: null,
    created_at: '2026-03-17T14:10:00.000Z',
    updated_at: '2026-03-17T14:10:00.000Z',
  },
  {
    id: 'c12',
    task_id: 'task18',
    user_id: 'u9',
    content: '供应链确认过了，玻璃和边框没有问题，风险集中在胶膜和接线盒。今晚我会把到料风险表发出来，大家按风险高低决定哪些订单优先锁单。',
    parent_id: null,
    created_at: '2026-03-17T15:00:00.000Z',
    updated_at: '2026-03-17T15:00:00.000Z',
  },
  {
    id: 'c13',
    task_id: 'task18',
    user_id: 'u7',
    content: '客户这边接受分批交付，但希望首批至少覆盖 60% 数量。海外销售建议这次不要只给内部节奏，要把对客户的承诺版本也一并锁住。',
    parent_id: null,
    created_at: '2026-03-17T15:22:00.000Z',
    updated_at: '2026-03-17T15:22:00.000Z',
  },
  {
    id: 'c14',
    task_id: 'task18',
    user_id: 'u4',
    content: '制造端这边能配合提前锁两条线，但前提是包装方案、接线盒和辅材版本今晚要一起定下来，否则明天投产后还会反复返工。',
    parent_id: null,
    created_at: '2026-03-17T15:40:00.000Z',
    updated_at: '2026-03-17T15:40:00.000Z',
  },
  {
    id: 'c15',
    task_id: 'task14',
    user_id: 'u2',
    content: '现有胶膜库存最多还能支撑两天，如果替代料要上，必须先确认客户认证限制和层压参数调整窗口，不然有交付风险。',
    parent_id: null,
    created_at: '2026-03-17T15:30:00.000Z',
    updated_at: '2026-03-17T15:30:00.000Z',
  },
  {
    id: 'c16',
    task_id: 'task21',
    user_id: 'u1',
    content: '这份旧版产销协调草案虽然停用了，但里面保留了第一次经营会讨论的锁单逻辑和库存分摊方式，交付演示时可以用来对比新旧方案。',
    parent_id: null,
    created_at: '2026-03-19T09:20:00.000Z',
    updated_at: '2026-03-19T09:20:00.000Z',
  },
  {
    id: 'c17',
    task_id: 'task21',
    user_id: 'u9',
    content: '我把供应链当时那版意见也留在这里了，特别是安全库存、锁料时间和来料风险分层的部分，后面如果要回溯决策过程可以直接看。',
    parent_id: null,
    created_at: '2026-03-19T10:05:00.000Z',
    updated_at: '2026-03-19T10:05:00.000Z',
  },
  {
    id: 'c18',
    task_id: 'task19',
    user_id: 'u9',
    content: '供应链已经把下周边框、玻璃和接线盒到料测算更新了，当前最大问题还是部分区域销量预测偏乐观，建议经营会上把风险和保守版本一起展示。',
    parent_id: null,
    created_at: '2026-03-19T11:10:00.000Z',
    updated_at: '2026-03-19T11:10:00.000Z',
  },
];

export const mockTaskAttachments: TaskAttachment[] = [
  {
    id: 'att-task1-1',
    task_id: 'task1',
    user_id: 'u1',
    original_name: '183N 良率异常分析日报.xlsx',
    filename: 'task1-yield-analysis.xlsx',
    file_size: 16384,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-17T09:40:00.000Z',
  },
  {
    id: 'att-task1-2',
    task_id: 'task1',
    user_id: 'u2',
    original_name: 'PECVD 参数追踪表.xlsx',
    filename: 'task1-pecvd-tracking.xlsx',
    file_size: 12288,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-17T10:48:00.000Z',
  },
  {
    id: 'att-task1-3',
    task_id: 'task1',
    user_id: 'u5',
    original_name: '电池片 EL 异常分布图.png',
    filename: 'task1-el-map.png',
    file_size: 245760,
    mime_type: 'image/png',
    created_at: '2026-03-17T11:32:00.000Z',
  },
  {
    id: 'att-task11-1',
    task_id: 'task11',
    user_id: 'u7',
    original_name: '欧洲客户包装规范.pdf',
    filename: 'task11-packaging-spec.pdf',
    file_size: 20480,
    mime_type: 'application/pdf',
    created_at: '2026-03-17T12:08:00.000Z',
  },
  {
    id: 'att-task11-2',
    task_id: 'task11',
    user_id: 'u4',
    original_name: '箱唛与追溯标签对照表.xlsx',
    filename: 'task11-label-map.xlsx',
    file_size: 28672,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-17T13:10:00.000Z',
  },
  {
    id: 'att-task16-1',
    task_id: 'task16',
    user_id: 'u8',
    original_name: '海外客诉抽检清单.xlsx',
    filename: 'task16-sampling-checklist.xlsx',
    file_size: 18432,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-17T13:16:00.000Z',
  },
  {
    id: 'att-task16-2',
    task_id: 'task16',
    user_id: 'u6',
    original_name: '客户异常照片打包.zip',
    filename: 'task16-customer-photos.zip',
    file_size: 3145728,
    mime_type: 'application/zip',
    created_at: '2026-03-17T14:02:00.000Z',
  },
  {
    id: 'att-task18-1',
    task_id: 'task18',
    user_id: 'u3',
    original_name: '海外订单交付节奏表.xlsx',
    filename: 'task18-delivery-schedule.xlsx',
    file_size: 14336,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-17T14:04:00.000Z',
  },
  {
    id: 'att-task18-2',
    task_id: 'task18',
    user_id: 'u9',
    original_name: '关键物料锁料清单.pdf',
    filename: 'task18-material-lock.pdf',
    file_size: 11264,
    mime_type: 'application/pdf',
    created_at: '2026-03-17T14:52:00.000Z',
  },
  {
    id: 'att-task18-3',
    task_id: 'task18',
    user_id: 'u7',
    original_name: '客户要货变更记录.docx',
    filename: 'task18-customer-change.docx',
    file_size: 9216,
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    created_at: '2026-03-17T15:28:00.000Z',
  },
  {
    id: 'att-task19-1',
    task_id: 'task19',
    user_id: 'u9',
    original_name: '产能平衡测算表.xlsx',
    filename: 'task19-capacity-balance.xlsx',
    file_size: 15360,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-19T11:02:00.000Z',
  },
  {
    id: 'att-task21-1',
    task_id: 'task21',
    user_id: 'u1',
    original_name: '旧版产销协调方案说明.pdf',
    filename: 'task21-plan.pdf',
    file_size: 4096,
    mime_type: 'application/pdf',
    created_at: '2026-03-19T10:30:00.000Z',
  },
  {
    id: 'att-task21-2',
    task_id: 'task21',
    user_id: 'u9',
    original_name: '节点映射.xlsx',
    filename: 'task21-flow.xlsx',
    file_size: 8192,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-19T11:15:00.000Z',
  },
  {
    id: 'att-task22-1',
    task_id: 'task22',
    user_id: 'u6',
    original_name: '老版价格审批口径说明.md',
    filename: 'task22-price-guide.md',
    file_size: 2048,
    mime_type: 'text/markdown',
    created_at: '2026-03-18T16:20:00.000Z',
  },
  {
    id: 'att-task22-2',
    task_id: 'task22',
    user_id: 'u9',
    original_name: '价格审批矩阵旧版.xlsx',
    filename: 'task22-price-matrix.xlsx',
    file_size: 7168,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-18T16:42:00.000Z',
  },
];

export const mockCommentAttachments: CommentAttachment[] = [
  {
    id: 'comment-att-c2-1',
    task_id: 'task1',
    comment_id: 'c2',
    user_id: 'u2',
    original_name: 'PECVD 异常批次对照表.xlsx',
    filename: 'c2-pecvd-batch.xlsx',
    file_size: 10240,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-17T10:20:00.000Z',
  },
  {
    id: 'comment-att-c3-1',
    task_id: 'task1',
    comment_id: 'c3',
    user_id: 'u5',
    original_name: 'EL 异常分布图.png',
    filename: 'c3-el-map.png',
    file_size: 196608,
    mime_type: 'image/png',
    created_at: '2026-03-17T11:02:00.000Z',
  },
  {
    id: 'comment-att-c4-1',
    task_id: 'task1',
    comment_id: 'c4',
    user_id: 'u8',
    original_name: '设备校准记录.xlsx',
    filename: 'c4-device-calibration.xlsx',
    file_size: 9216,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-17T11:28:00.000Z',
  },
  {
    id: 'comment-att-c8-1',
    task_id: 'task11',
    comment_id: 'c8',
    user_id: 'u5',
    original_name: '包装判定示意图.png',
    filename: 'c8-packaging-reference.png',
    file_size: 184320,
    mime_type: 'image/png',
    created_at: '2026-03-17T13:04:00.000Z',
  },
  {
    id: 'comment-att-c11-1',
    task_id: 'task18',
    comment_id: 'c11',
    user_id: 'u3',
    original_name: '锁单排产节奏表.xlsx',
    filename: 'c11-lock-schedule.xlsx',
    file_size: 6144,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-17T14:15:00.000Z',
  },
  {
    id: 'comment-att-c13-1',
    task_id: 'task18',
    comment_id: 'c13',
    user_id: 'u7',
    original_name: '客户分批交付确认函.pdf',
    filename: 'c13-customer-confirmation.pdf',
    file_size: 7168,
    mime_type: 'application/pdf',
    created_at: '2026-03-17T15:25:00.000Z',
  },
  {
    id: 'comment-att-c16-1',
    task_id: 'task21',
    comment_id: 'c16',
    user_id: 'u1',
    original_name: '旧方案评审标注截图.png',
    filename: 'c16-old-plan-note.png',
    file_size: 172032,
    mime_type: 'image/png',
    created_at: '2026-03-19T09:24:00.000Z',
  },
];

// ===== 辅助函数 =====

export const getUserById = (id: string) => mockUsers.find(u => u.id === id);
export const getTeamById = (id: string) => mockTeams.find(t => t.id === id);
export const getTaskById = (id: string) => mockTasks.find(t => t.id === id);
export const getCommentById = (id: string) => mockComments.find(comment => comment.id === id);
export const isTaskDeleted = (task: Task) => Boolean(task.is_deleted || task.deleted_at);
export const getTaskAttachments = (taskId: string) =>
  mockTaskAttachments
    .filter((attachment) => attachment.task_id === taskId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
export const getCommentAttachments = (commentId: string) =>
  mockCommentAttachments
    .filter((attachment) => attachment.comment_id === commentId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
export const getAttachmentById = (attachmentId: string) => (
  mockTaskAttachments.find((attachment) => attachment.id === attachmentId) ||
  mockCommentAttachments.find((attachment) => attachment.id === attachmentId) ||
  null
);
export const getTeamMembers = (teamId: string) => {
  const memberIds = mockTeamMembers.filter(m => m.team_id === teamId).map(m => m.user_id);
  return mockUsers.filter(u => memberIds.includes(u.id));
};
export const getTeamTasks = (teamId: string) => mockTasks.filter((task) => task.team_id === teamId && !isTaskDeleted(task));
export const getUserTasks = (userId: string) => mockTasks.filter((task) => task.assignee_id === userId && !isTaskDeleted(task));
const getMyTaskRelationKeys = (task: Task, userId: string) => {
  const participantIds = uniqueIds(task.participant_ids);

  return [
    task.creator_id === userId ? 'created' : null,
    task.assignee_id === userId ? 'assigned' : null,
    participantIds.includes(userId) && task.creator_id !== userId && task.assignee_id !== userId ? 'participating' : null,
  ].filter(Boolean) as Array<Exclude<MyTaskScope, 'all'>>;
};

export const getMyTaskScopeCollection = (userId: string, scope: MyTaskScope) => {
  const visibleTasks = mockTasks.filter((task) => !isTaskDeleted(task));

  if (scope === 'shared') {
    return [];
  }

  return visibleTasks.filter((task) => {
    const relationKeys = getMyTaskRelationKeys(task, userId);

    if (scope === 'all') {
      return relationKeys.length > 0;
    }

    return relationKeys.includes(scope as any);
  });
};

export const filterMyTaskCollectionByStatus = (tasks: Task[], status: MyTaskStatusFilter) => {
  if (status === 'all') {
    return tasks;
  }

  if (status === 'overdue') {
    return tasks.filter((task) => task.due_date && task.due_date < toDateOnly(today) && task.status !== 'done' && task.status !== 'canceled');
  }

  return tasks.filter((task) => task.status === status);
};

export const getMyTaskSummary = (userId: string) => ({
  all: getMyTaskScopeCollection(userId, 'all').length,
  assigned: getMyTaskScopeCollection(userId, 'assigned').length,
  participating: getMyTaskScopeCollection(userId, 'participating').length,
  created: getMyTaskScopeCollection(userId, 'created').length,
  shared: 0,
});

const compareMyTasks = (left: Task, right: Task) => {
  const leftOverdue = left.due_date && left.due_date < toDateOnly(today) && left.status !== 'done' && left.status !== 'canceled';
  const rightOverdue = right.due_date && right.due_date < toDateOnly(today) && right.status !== 'done' && right.status !== 'canceled';

  if (leftOverdue !== rightOverdue) {
    return leftOverdue ? -1 : 1;
  }

  if (left.due_date && right.due_date && left.due_date !== right.due_date) {
    return left.due_date.localeCompare(right.due_date);
  }

  if (left.due_date && !right.due_date) return -1;
  if (!left.due_date && right.due_date) return 1;

  return right.updated_at.localeCompare(left.updated_at);
};

export const getMyTasksView = (
  userId: string,
  scope: MyTaskScope,
  status: MyTaskStatusFilter = 'all',
  priority?: TaskPriority,
  keyword?: string
) => {
  let tasks = getMyTaskScopeCollection(userId, scope);
  tasks = filterMyTaskCollectionByStatus(tasks, status);

  if (priority) {
    tasks = tasks.filter((task) => task.priority === priority);
  }

  if (keyword) {
    tasks = tasks.filter((task) => task.title.includes(keyword) || task.description?.includes(keyword));
  }

  return tasks
    .slice()
    .sort(compareMyTasks)
    .map((task) => {
      const relationKeys = getMyTaskRelationKeys(task, userId);

      return {
        ...enrichTaskMembers(task),
        my_relation_keys: relationKeys,
        my_role_labels: relationKeys.map((key) => {
          if (key === 'created') return '发起人';
          if (key === 'assigned') return '负责人';
          return '协作者';
        }),
      };
    });
};

export const getTrashTasksView = (userId: string, keyword?: string) => {
  let tasks = mockTasks.filter((task) => isTaskDeleted(task) && task.deleted_by === userId);

  if (keyword) {
    tasks = tasks.filter((task) => task.title.includes(keyword) || task.description?.includes(keyword));
  }

  return tasks
    .slice()
    .sort((left, right) => (right.deleted_at || '').localeCompare(left.deleted_at || ''))
    .map(enrichTaskMembers);
};
export const getTaskComments = (taskId: string) =>
  mockComments.filter(comment => comment.task_id === taskId).sort((a, b) => a.created_at.localeCompare(b.created_at));

export const getTrashTaskDetail = (taskId: string, userId: string) => {
  const task = mockTasks.find((item) => item.id === taskId && isTaskDeleted(item) && item.deleted_by === userId);

  if (!task) {
    return null;
  }

  return {
    ...enrichTaskMembers(task),
    attachments: getTaskAttachments(task.id),
  };
};

const uniqueIds = (ids: string[] = []) => [...new Set(ids.filter(Boolean))];
const isOpenTask = (task: Task) => task.status !== 'done' && task.status !== 'canceled';
const isTeamMember = (teamId: string, userId: string) =>
  mockTeamMembers.some((member) => member.team_id === teamId && member.user_id === userId);
const normalizeUserIds = (userIds: string[] = []) =>
  uniqueIds(userIds).filter((userId) => Boolean(getUserById(userId)));

type MockUploadFile = {
  name: string;
  size: number;
  type?: string;
};

export const createTaskAttachments = (taskId: string, userId: string, files: MockUploadFile[]) => {
  const createdAt = new Date().toISOString();
  const attachments = files.map((file, index) => ({
    id: `task-att-${Date.now()}-${index}`,
    task_id: taskId,
    user_id: userId,
    original_name: file.name,
    filename: `${taskId}-${Date.now()}-${index}-${file.name.replace(/\s+/g, '-').toLowerCase()}`,
    file_size: file.size,
    mime_type: file.type || 'application/octet-stream',
    created_at: createdAt,
  }));

  mockTaskAttachments.push(...attachments);
  return attachments;
};

export const createCommentAttachments = (taskId: string, commentId: string, userId: string, files: MockUploadFile[]) => {
  const createdAt = new Date().toISOString();
  const attachments = files.map((file, index) => ({
    id: `comment-att-${Date.now()}-${index}`,
    task_id: taskId,
    comment_id: commentId,
    user_id: userId,
    original_name: file.name,
    filename: `${commentId}-${Date.now()}-${index}-${file.name.replace(/\s+/g, '-').toLowerCase()}`,
    file_size: file.size,
    mime_type: file.type || 'application/octet-stream',
    created_at: createdAt,
  }));

  mockCommentAttachments.push(...attachments);
  return attachments;
};

export const deleteAttachmentById = (attachmentId: string) => {
  const taskAttachmentIndex = mockTaskAttachments.findIndex((attachment) => attachment.id === attachmentId);
  if (taskAttachmentIndex !== -1) {
    return mockTaskAttachments.splice(taskAttachmentIndex, 1)[0];
  }

  const commentAttachmentIndex = mockCommentAttachments.findIndex((attachment) => attachment.id === attachmentId);
  if (commentAttachmentIndex !== -1) {
    return mockCommentAttachments.splice(commentAttachmentIndex, 1)[0];
  }

  return null;
};

const getTaskPreviewItem = (task: Task) => ({
  id: task.id,
  title: task.title,
  status: task.status,
});

export const createTeamWithMembers = (
  payload: CreateTeamPayload & { owner_id: string }
) => {
  const nowIso = new Date().toISOString();
  const teamId = `t${Date.now()}`;
  const team: Team = {
    id: teamId,
    name: payload.name,
    description: payload.description,
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(payload.name)}`,
    level: payload.level,
    owner_id: payload.owner_id,
    is_archived: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const adminUserIds = normalizeUserIds(payload.admin_user_ids).filter((userId) => userId !== payload.owner_id);
  const memberUserIds = normalizeUserIds(payload.member_user_ids).filter(
    (userId) => userId !== payload.owner_id && !adminUserIds.includes(userId)
  );

  mockTeams.push(team);
  mockTeamMembers.push(
    {
      id: `tm-${teamId}-owner`,
      team_id: teamId,
      user_id: payload.owner_id,
      role_id: 'owner',
      joined_at: nowIso,
    },
    ...adminUserIds.map((userId, index) => ({
      id: `tm-${teamId}-admin-${index}`,
      team_id: teamId,
      user_id: userId,
      role_id: 'admin',
      joined_at: nowIso,
    })),
    ...memberUserIds.map((userId, index) => ({
      id: `tm-${teamId}-member-${index}`,
      team_id: teamId,
      user_id: userId,
      role_id: 'member',
      joined_at: nowIso,
    }))
  );

  return team;
};

export const buildMemberTaskCheck = (teamId: string, userId: string) => {
  const teamTasks = getTeamTasks(teamId);
  const responsibleTasks = teamTasks.filter((task) => isOpenTask(task) && task.assignee_id === userId);
  const participantTasks = teamTasks.filter((task) => {
    if (!isOpenTask(task)) {
      return false;
    }

    const participantIds = uniqueIds(task.participant_ids);
    return participantIds.includes(userId) && task.assignee_id !== userId;
  });
  const createdTasks = teamTasks.filter((task) => isOpenTask(task) && task.creator_id === userId);
  const previewMap = new Map<string, Task>();

  [...responsibleTasks, ...participantTasks].forEach((task) => {
    previewMap.set(task.id, task);
  });

  return {
    canRemove: responsibleTasks.length === 0 && participantTasks.length === 0,
    mode: responsibleTasks.length === 0 && participantTasks.length === 0 ? 'direct' : 'task_resolution_required',
    openTaskCount: previewMap.size,
    responsibleTaskCount: responsibleTasks.length,
    participantTaskCount: participantTasks.length,
    createdTaskCount: createdTasks.length,
    reason:
      responsibleTasks.length > 0
        ? '该成员仍有未完成负责人任务，需要先转交。'
        : participantTasks.length > 0
          ? '该成员仍有未完成参与任务，需要先处理参与关系。'
          : '',
    taskPreview: [...previewMap.values()].map(getTaskPreviewItem),
  };
};

export const buildSelfExitCheck = (teamId: string, userId: string) => {
  const team = getTeamById(teamId);

  if (team?.owner_id === userId) {
    return {
      canExit: false,
      mode: 'forbidden',
      openTaskCount: 0,
      responsibleTaskCount: 0,
      participantTaskCount: 0,
      createdTaskCount: 0,
      reason: '团队创建者不能直接退出团队。',
      taskPreview: [],
    };
  }

  const check = buildMemberTaskCheck(teamId, userId);

  return {
    canExit: check.responsibleTaskCount === 0 && check.participantTaskCount === 0,
    mode: check.responsibleTaskCount === 0 && check.participantTaskCount === 0 ? 'direct' : 'blocked',
    openTaskCount: check.openTaskCount,
    responsibleTaskCount: check.responsibleTaskCount,
    participantTaskCount: check.participantTaskCount,
    createdTaskCount: check.createdTaskCount,
    reason:
      check.responsibleTaskCount > 0
        ? '你仍有未完成负责人任务，请先完成任务或转交职责。'
        : check.participantTaskCount > 0
          ? '你仍有未完成参与任务，请先完成任务或请管理员处理参与关系。'
          : '',
    taskPreview: check.taskPreview,
  };
};

export const removeMemberFromTeam = (
  teamId: string,
  userId: string,
  options?: { transferToUserId?: string; removeParticipantAssignments?: boolean }
) => {
  const team = getTeamById(teamId);
  if (!team) {
    throw new Error('Team not found');
  }

  if (team.owner_id === userId) {
    throw new Error('不能移除团队创建者');
  }

  const check = buildMemberTaskCheck(teamId, userId);
  const nowIso = new Date().toISOString();

  if (check.responsibleTaskCount > 0) {
    if (!options?.transferToUserId) {
      throw new Error('仍有未完成负责人任务，需要先转交');
    }

    if (options.transferToUserId === userId) {
      throw new Error('转交对象不能是当前成员');
    }

    if (!isTeamMember(teamId, options.transferToUserId)) {
      throw new Error('转交对象必须属于当前团队');
    }

    mockTasks.forEach((task) => {
      if (task.team_id === teamId && isOpenTask(task) && task.assignee_id === userId) {
        task.assignee_id = options.transferToUserId;
        task.updated_at = nowIso;
      }
    });
  }

  if (check.participantTaskCount > 0) {
    if (!options?.removeParticipantAssignments) {
      throw new Error('仍有未完成参与任务，需要先处理参与关系');
    }

    mockTasks.forEach((task) => {
      if (task.team_id === teamId && isOpenTask(task) && uniqueIds(task.participant_ids).includes(userId)) {
        task.participant_ids = uniqueIds(task.participant_ids).filter((participantId) => participantId !== userId);
        task.updated_at = nowIso;
      }
    });
  }

  const memberIndex = mockTeamMembers.findIndex((member) => member.team_id === teamId && member.user_id === userId);
  if (memberIndex !== -1) {
    mockTeamMembers.splice(memberIndex, 1);
  }
};

export const exitTeamById = (teamId: string, userId: string) => {
  const check = buildSelfExitCheck(teamId, userId);

  if (!check.canExit) {
    throw new Error(check.reason || '当前无法退出团队');
  }

  const memberIndex = mockTeamMembers.findIndex((member) => member.team_id === teamId && member.user_id === userId);
  if (memberIndex !== -1) {
    mockTeamMembers.splice(memberIndex, 1);
  }
};

export const buildTeamDissolveCheck = (teamId: string, userId: string) => {
  const team = getTeamById(teamId);
  const unfinishedTaskCount = getTeamTasks(teamId).filter((task) => isOpenTask(task)).length;
  const isOwner = team?.owner_id === userId;

  return {
    canDissolve: Boolean(team) && isOwner && unfinishedTaskCount === 0,
    unfinishedTaskCount,
    isOwner,
    reason:
      !team
        ? '团队不存在'
        : !isOwner
          ? '仅团队创建者可以解散团队。'
          : unfinishedTaskCount > 0
            ? '当前团队仍有未完成任务，暂时不能解散。'
            : '',
  };
};

export const dissolveTeamById = (teamId: string, userId: string) => {
  const check = buildTeamDissolveCheck(teamId, userId);

  if (!check.canDissolve) {
    throw new Error(check.reason || '当前无法解散团队');
  }

  const nowIso = new Date().toISOString();

  mockTasks.forEach((task) => {
    if (task.team_id === teamId) {
      task.team_id = '';
      task.updated_at = nowIso;
    }
  });

  for (let index = mockTeamMembers.length - 1; index >= 0; index -= 1) {
    if (mockTeamMembers[index].team_id === teamId) {
      mockTeamMembers.splice(index, 1);
    }
  }

  const teamIndex = mockTeams.findIndex((team) => team.id === teamId);
  if (teamIndex !== -1) {
    mockTeams.splice(teamIndex, 1);
  }
};

export const shareTaskToDingTalk = (taskId: string, userId: string, receiverIds: string[] = []) => {
  const task = getTaskById(taskId);

  if (!task || isTaskDeleted(task)) {
    throw new Error('Task not found');
  }

  const canShare =
    task.creator_id === userId ||
    task.assignee_id === userId ||
    uniqueIds(task.participant_ids).includes(userId);

  if (!canShare) {
    throw new Error('当前成员没有分享该任务的权限');
  }

  return {
    taskId,
    channel: 'dingtalk-card',
    receiverIds,
    sharedBy: userId,
    message: '已通过钉钉卡片消息发起分享（Mock）',
  };
};

export const buildTaskMemberProfile = (userId: string): TaskMemberProfile | null => {
  const user = getUserById(userId);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
  };
};

export const enrichTaskMembers = (task: Task): Task => {
  const creator = getUserById(task.creator_id);
  const deletedBy = task.deleted_by ? getUserById(task.deleted_by) : null;
  const assignee = task.assignee_id ? buildTaskMemberProfile(task.assignee_id) : null;
  const participants = uniqueIds(task.participant_ids).map(buildTaskMemberProfile).filter(Boolean) as TaskMemberProfile[];
  const attachments = getTaskAttachments(task.id);
  const comments = getTaskComments(task.id);

  return {
    ...task,
    creator_name: creator?.name,
    creator_avatar: creator?.avatar,
    assignee_name: assignee?.name,
    assignee_avatar: assignee?.avatar,
    team_name: task.team_id ? getTeamById(task.team_id)?.name : undefined,
    participant_ids: participants.map((participant) => participant.id),
    participants,
    is_deleted: isTaskDeleted(task),
    deleted_by_name: deletedBy?.name,
    attachment_count: attachments.length,
    comment_count: comments.length,
  };
};

export const enrichTaskCollectionMembers = (tasks: Task[]) => tasks.map(enrichTaskMembers);

export const enrichCommentAuthor = (comment: Comment): Comment => {
  const author = getUserById(comment.user_id);

  return {
    ...comment,
    message_type: comment.message_type || 'message',
    user_name: author?.name,
    user_avatar: author?.avatar,
    department_name: author?.department_name,
    attachments: getCommentAttachments(comment.id),
  };
};

export const enrichCommentCollection = (comments: Comment[]) => comments.map(enrichCommentAuthor);

// 驾驶舱统计数据
export const getDashboardStats = (teamId?: string) => {
  const tasks = teamId ? getTeamTasks(teamId) : mockTasks.filter((task) => !isTaskDeleted(task));
  const total = tasks.length;
  const unfinished = tasks.filter(t => !['done', 'delayed_done', 'canceled'].includes(t.status)).length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const delayedInProgress = tasks.filter(t => t.status === 'delayed_in_progress').length;
  const done = tasks.filter(t => t.status === 'done' || t.status === 'delayed_done').length;
  const delayedDone = tasks.filter(t => t.status === 'delayed_done').length;
  const canceled = tasks.filter(t => t.status === 'canceled').length;
  const overdue = tasks.filter(t => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    return due < today && !['done', 'delayed_done', 'canceled'].includes(t.status);
  }).length;

  return {
    total,
    unfinished,
    todo: unfinished,
    inProgress,
    delayedInProgress,
    done,
    delayedDone,
    canceled,
    overdue,
  };
};

// 趋势数据（30天）
export const getTrendData = (teamId?: string) => {
  const data = [];
  
  // 1. 获取基础数据源：判断是否按团队（teamId）过滤全局 Mock 的可见任务
  const visibleTasks = mockTasks.filter(t => !isTaskDeleted(t));
  const tasksToAggregate = teamId ? visibleTasks.filter((task) => task.team_id === teamId) : visibleTasks;
  
  // 2. 为了折线图美观和坐标体系的完整，我们依然提供最近 30 天的每日坐标桶
  for (let i = 29; i >= 0; i--) {
    const dateObj = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = dateObj.toISOString().split('T')[0];
    
    // 3. 统计该日的新增任务数（根据真实的 created_at 前缀匹配到日）
    const createdCount = tasksToAggregate.filter((task) => {
      return task.created_at && task.created_at.startsWith(dateStr);
    }).length;
    
    // 4. 统计该日的已完成任务数（基于 status状态 以及真实的 completed_at 截取匹配）
    const completedCount = tasksToAggregate.filter((task) => {
      return task.status === 'done' && task.completed_at && task.completed_at.startsWith(dateStr);
    }).length;

    // 5. 不再采用 Math.random() 造假，每一天的量都来源于系统底层遍历的运算
    data.push({
      date: dateStr,
      created: createdCount,
      completed: completedCount,
    });
  }
  
  return data;
};

// --- 动态数据生成引擎（2026年1-3月丰富业务流假数据） ---
const generateRichMockData = () => {
  const subjects = ['TOPCon 183N', 'HJT 210', '欧洲区', '拉美区', '银浆', '接线盒', '逆变器', '组件包装', '电池片', '硅片代工', '海外仓', '光伏支架'];
  const actions = ['良率异常排查', '产能测算与排布', '客诉预警处理', '价格特批流程', '到料追踪与催交', '排产首件确认', '巡检报告审查', '供应商现场稽核', '商务合同对齐'];
  const teams = mockTeams.map(t => t.id);
  const users = mockUsers.map(u => u.id);

  // 1-3月的随机时间区间（2026-01-01 到 2026-03-31）
  const startTimestamp = new Date('2026-01-01T08:00:00Z').getTime();
  const endTimestamp = new Date('2026-03-31T18:00:00Z').getTime();

  const generatedTasks: Task[] = [];
  const generatedComments: Comment[] = [];

  for (let i = 0; i < 120; i++) {
    const taskId = `task-gen-${i}`;
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    // 随机分配人员与团队
    const creatorId = users[Math.floor(Math.random() * users.length)];
    const assigneeId = users[Math.floor(Math.random() * users.length)];
    const teamId = teams[Math.floor(Math.random() * teams.length)];
    
    const createdTimestamp = startTimestamp + Math.random() * (endTimestamp - startTimestamp);
    const createdAt = new Date(createdTimestamp).toISOString();
    
    // 权重分配：60%完成，30%进行中，10%延期进行中。（为了模拟一季度的真实沉淀）
    const r = Math.random();
    let status: Task['status'] = 'done';
    if (r > 0.6 && r <= 0.9) status = 'in_progress';
    else if (r > 0.9) status = 'delayed_in_progress';
    
    const priorities: Task['priority'][] = ['high', 'medium', 'low', 'medium', 'urgent']; // 提高中高优先级的分布
    const priority = priorities[Math.floor(Math.random() * priorities.length)];

    let completedAt: string | undefined = undefined;
    let dueDateObj = new Date(createdTimestamp + (Math.random() * 14 + 1) * 24 * 3600 * 1000); // 1-15天的周期
    const dueDate = dueDateObj.toISOString().split('T')[0];

    if (status === 'done') {
      // 完成时间一定要早于月底，且在创建时间之后 1-7 天
      completedAt = new Date(createdTimestamp + (Math.random() * 7 + 0.5) * 24 * 3600 * 1000).toISOString();
    }

    // 唯一的参与人集合
    const participantIds = Array.from(new Set([creatorId, assigneeId, users[Math.floor(Math.random() * users.length)]]));

    generatedTasks.push({
      id: taskId,
      title: `【${subject}】${action}`,
      description: `关于${subject}的${action}，请大家密切关注。如果遇到卡点，请及时在评论区对齐进度。目标是在期限前完成所有相关的交付物审查与确认。`,
      team_id: teamId,
      sort_order: i,
      status,
      priority,
      creator_id: creatorId,
      assignee_id: assigneeId,
      participant_ids: participantIds,
      start_date: new Date(createdTimestamp).toISOString().split('T')[0],
      due_date: dueDate,
      completed_at: completedAt,
      is_deleted: false,
      created_at: createdAt,
      updated_at: completedAt || createdAt,
    });

    // 为每个任务生成 1-4 条职场语气的评论
    const commentCount = Math.floor(Math.random() * 4) + 1;
    const commentTexts = [
      '麻烦确认一下这部分的数据，客户那边催得很急！',
      '已经看过了，部分指标有点偏差，请再核查一下供应链的反馈。',
      '收到，今天下班前我把更新后的版本传上来。',
      '进度卡在哪里了？需要我协调工艺经理的资源吗？',
      '这个方案没问题了，直接走 OA 流程特批吧。',
      '物料还没到齐，可能要延期两天，辛苦跟进一下采购。',
      '现场排查发现这是偶尔出现的设备抖动导致的，不用过度恐慌。',
      '跟进结论：同意当前排产计划，已同步车间。',
      '老板早上刚问了这件事，请务必保证今天出结果。',
      '资料已归档到共享盘，辛苦大家 check 一下。'
    ];

    let lastCommentTime = createdTimestamp;
    for (let c = 0; c < commentCount; c++) {
      lastCommentTime += Math.random() * 12 * 3600 * 1000; // 0-12小时后的追评
      const commentUserId = participantIds[c % participantIds.length]; // 参与人互相评论的模拟
      generatedComments.push({
        id: `comment-gen-${i}-${c}`,
        task_id: taskId,
        user_id: commentUserId,
        content: commentTexts[Math.floor(Math.random() * commentTexts.length)],
        parent_id: null,
        created_at: new Date(lastCommentTime).toISOString(),
        updated_at: new Date(lastCommentTime).toISOString(),
      });
    }
  }

  return { generatedTasks, generatedComments };
};

// 自动注入数据池
const { generatedTasks, generatedComments } = generateRichMockData();
mockTasks.push(...generatedTasks);
mockComments.push(...generatedComments);
