// taskDao 已迁移到 SQLite，不再需要 hydrate
const { BOOTSTRAP_SUPER_ADMINS } = require('../constants/adminUsers');

function nowIso() {
  return new Date().toISOString();
}

function dateBefore(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const baseSeedUsers = [
  { id: 'u1', name: '张三', department_name: '研发中心' },
  { id: 'u2', name: '李四', department_name: '研发中心' },
  { id: 'u3', name: '王五', department_name: '产品中心' },
  { id: 'u4', name: '赵六', department_name: '质量中心' },
  { id: 'u5', name: '钱七', department_name: '流程治理部' },
  { id: 'u6', name: '孙八', department_name: '研发中心' },
  { id: 'u7', name: '周九', department_name: '产品中心' },
  { id: 'u8', name: '吴十', department_name: '质量中心' },
  { id: 'u9', name: '郑十一', department_name: '流程治理部' },
  { id: 'u10', name: '王十二', department_name: '研发中心' },
  { id: 'u11', name: '陈明', department_name: '研发中心' },
  { id: 'u12', name: '刘倩', department_name: '研发中心' },
  { id: 'u13', name: '杨帆', department_name: '产品中心' },
  { id: 'u14', name: '黄蕾', department_name: '产品中心' },
  { id: 'u15', name: '周涛', department_name: '质量中心' },
  { id: 'u16', name: '徐静', department_name: '质量中心' },
  { id: 'u17', name: '孙航', department_name: '流程治理部' },
  { id: 'u18', name: '马宁', department_name: '流程治理部' },
  { id: 'u19', name: '郭峰', department_name: '供应链中心' },
  { id: 'u20', name: '林雨', department_name: '供应链中心' },
  { id: 'u21', name: '何亮', department_name: '制造中心' },
  { id: 'u22', name: '高媛', department_name: '制造中心' },
  { id: 'u23', name: '朱凯', department_name: '营销中心' },
  { id: 'u24', name: '罗敏', department_name: '营销中心' },
  { id: 'u25', name: '宋辰', department_name: '研发中心' },
  { id: 'u26', name: '邓雪', department_name: '产品中心' },
  { id: 'u27', name: '彭博', department_name: '质量中心' },
  { id: 'u28', name: '韩莹', department_name: '流程治理部' },
  { id: 'u29', name: '蒋波', department_name: '供应链中心' },
  { id: 'u30', name: '任佳', department_name: '制造中心' },
];

const bootstrapSeedUsers = BOOTSTRAP_SUPER_ADMINS.map((admin) => ({
  id: admin.id,
  name: admin.name || admin.id,
  department_name: '运营管理部',
}));

const seedUsers = [...baseSeedUsers, ...bootstrapSeedUsers].reduce((acc, user) => {
  if (acc.some((item) => item.id === user.id)) {
    return acc;
  }
  acc.push(user);
  return acc;
}, []);

const seedTeams = [
  { id: 't1', name: '前端开发组', level: 'team', owner_id: 'u1' },
  { id: 't2', name: '后端开发组', level: 'team', owner_id: 'u2' },
  { id: 't3', name: '产品规划组', level: 'group', owner_id: 'u3' },
  { id: 't4', name: '质量保障组', level: 'group', owner_id: 'u4' },
  { id: 't5', name: '流程治理组', level: 'custom', owner_id: 'u5' },
];

const seedTeamMembers = [
  { id: 'tm-1', team_id: 't1', user_id: 'u1', role_id: 'owner' },
  { id: 'tm-2', team_id: 't1', user_id: 'u6', role_id: 'member' },
  { id: 'tm-3', team_id: 't1', user_id: 'u10', role_id: 'member' },
  { id: 'tm-4', team_id: 't2', user_id: 'u2', role_id: 'owner' },
  { id: 'tm-5', team_id: 't2', user_id: 'u1', role_id: 'member' },
  { id: 'tm-6', team_id: 't3', user_id: 'u3', role_id: 'owner' },
  { id: 'tm-7', team_id: 't3', user_id: 'u7', role_id: 'member' },
  { id: 'tm-8', team_id: 't4', user_id: 'u4', role_id: 'owner' },
  { id: 'tm-9', team_id: 't4', user_id: 'u8', role_id: 'member' },
  { id: 'tm-10', team_id: 't5', user_id: 'u5', role_id: 'owner' },
  { id: 'tm-11', team_id: 't5', user_id: 'u9', role_id: 'member' },
  { id: 'tm-12', team_id: 't1', user_id: 'u11', role_id: 'member' },
  { id: 'tm-13', team_id: 't1', user_id: 'u12', role_id: 'member' },
  { id: 'tm-14', team_id: 't1', user_id: 'u25', role_id: 'member' },
  { id: 'tm-15', team_id: 't2', user_id: 'u19', role_id: 'member' },
  { id: 'tm-16', team_id: 't2', user_id: 'u21', role_id: 'member' },
  { id: 'tm-17', team_id: 't2', user_id: 'u29', role_id: 'member' },
  { id: 'tm-18', team_id: 't3', user_id: 'u13', role_id: 'member' },
  { id: 'tm-19', team_id: 't3', user_id: 'u14', role_id: 'member' },
  { id: 'tm-20', team_id: 't3', user_id: 'u26', role_id: 'member' },
  { id: 'tm-21', team_id: 't4', user_id: 'u15', role_id: 'member' },
  { id: 'tm-22', team_id: 't4', user_id: 'u16', role_id: 'member' },
  { id: 'tm-23', team_id: 't4', user_id: 'u27', role_id: 'member' },
  { id: 'tm-24', team_id: 't5', user_id: 'u17', role_id: 'member' },
  { id: 'tm-25', team_id: 't5', user_id: 'u18', role_id: 'member' },
  { id: 'tm-26', team_id: 't5', user_id: 'u28', role_id: 'member' },
  { id: 'tm-27', team_id: 't2', user_id: 'u20', role_id: 'member' },
  { id: 'tm-28', team_id: 't3', user_id: 'u23', role_id: 'member' },
  { id: 'tm-29', team_id: 't3', user_id: 'u24', role_id: 'member' },
  { id: 'tm-30', team_id: 't4', user_id: 'u30', role_id: 'member' },
  { id: 'tm-31', team_id: 't1', user_id: 'u22', role_id: 'member' },
];

const seedTasks = [
  {
    id: 'task21',
    title: '补齐驾驶舱趋势维度',
    description: '梳理趋势口径并补足 API 返回',
    status: 'in_progress',
    priority: 'high',
    team_id: 't2',
    creator_id: 'u2',
    assignee_id: 'u1',
    participant_ids: ['u3', 'u4'],
    start_date: dateBefore(6).slice(0, 10),
    due_date: dateBefore(-2).slice(0, 10),
    completed_at: null,
    sort_order: 1,
    is_deleted: 0,
    deleted_at: null,
    deleted_by: null,
    created_at: dateBefore(7),
    updated_at: dateBefore(1),
  },
  {
    id: 'task22',
    title: '团队统计字段校准',
    description: '确保 team card 与 dashboard 字段一致',
    status: 'in_progress',
    priority: 'medium',
    team_id: 't1',
    creator_id: 'u1',
    assignee_id: 'u6',
    participant_ids: ['u10'],
    start_date: dateBefore(2).slice(0, 10),
    due_date: dateBefore(-1).slice(0, 10),
    completed_at: null,
    sort_order: 2,
    is_deleted: 0,
    deleted_at: null,
    deleted_by: null,
    created_at: dateBefore(2),
    updated_at: nowIso(),
  },
  {
    id: 'task23',
    title: '接口契约回归测试',
    description: '补充 teams/dashboard 契约用例',
    status: 'done',
    priority: 'high',
    team_id: 't4',
    creator_id: 'u4',
    assignee_id: 'u8',
    participant_ids: ['u2'],
    start_date: dateBefore(10).slice(0, 10),
    due_date: dateBefore(4).slice(0, 10),
    completed_at: dateBefore(3),
    sort_order: 3,
    is_deleted: 0,
    deleted_at: null,
    deleted_by: null,
    created_at: dateBefore(11),
    updated_at: dateBefore(3),
  },
  {
    id: 'task24',
    title: '团队主页视觉改版',
    description: '整理团队页布局与信息层级',
    status: 'in_progress',
    priority: 'low',
    team_id: 't3',
    creator_id: 'u3',
    assignee_id: 'u7',
    participant_ids: ['u1'],
    start_date: dateBefore(8).slice(0, 10),
    due_date: dateBefore(1).slice(0, 10),
    completed_at: null,
    sort_order: 4,
    is_deleted: 0,
    deleted_at: null,
    deleted_by: null,
    created_at: dateBefore(8),
    updated_at: nowIso(),
  },
];



function seedDatabase(db) {
  const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (
        id, name, avatar, job_number, mobile, email, department_name, is_dept_manager, status, created_at, updated_at
      ) VALUES (
        @id, @name, @avatar, @job_number, @mobile, @email, @department_name, @is_dept_manager, @status, @created_at, @updated_at
      )
    `);
  const insertTeam = db.prepare(`
      INSERT OR IGNORE INTO teams (
        id, name, description, avatar, level, owner_id, is_archived, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @avatar, @level, @owner_id, @is_archived, @created_at, @updated_at
      )
    `);
  const insertTeamMember = db.prepare(`
      INSERT OR IGNORE INTO team_members (
        id, team_id, user_id, role_id, joined_at
      ) VALUES (
        @id, @team_id, @user_id, @role_id, @joined_at
      )
    `);
  const insertTask = db.prepare(`
      INSERT OR IGNORE INTO tasks (
        id, title, description, status, priority, team_id, creator_id, assignee_id,
        participant_ids, start_date, due_date, completed_at, sort_order, is_deleted,
        deleted_at, deleted_by, created_at, updated_at
      ) VALUES (
        @id, @title, @description, @status, @priority, @team_id, @creator_id, @assignee_id,
        @participant_ids, @start_date, @due_date, @completed_at, @sort_order, @is_deleted,
        @deleted_at, @deleted_by, @created_at, @updated_at
      )
    `);

  const writeSeed = db.transaction(() => {
    for (const user of seedUsers) {
      const stamp = nowIso();
      insertUser.run({
        ...user,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        job_number: user.job_number || '',
        mobile: '',
        email: '',
        is_dept_manager: 0,
        status: 1,
        created_at: stamp,
        updated_at: stamp,
      });
    }

    for (const team of seedTeams) {
      const stamp = nowIso();
      insertTeam.run({
        ...team,
        description: `${team.name}业务协作空间`,
        avatar: '',
        is_archived: 0,
        created_at: stamp,
        updated_at: stamp,
      });
    }

    for (const member of seedTeamMembers) {
      insertTeamMember.run({
        ...member,
        joined_at: dateBefore(15),
      });
    }

    for (const task of seedTasks) {
      insertTask.run({
        ...task,
        participant_ids: JSON.stringify(task.participant_ids || []),
      });
    }

    // ── 为示例用户分配默认全局角色 ──
    const insertUserGlobalRole = db.prepare(`
      INSERT OR IGNORE INTO user_global_roles (id, user_id, role_id, assigned_by, assigned_at)
      VALUES (@id, @user_id, @role_id, @assigned_by, @assigned_at)
    `);

    const findGlobalRoleByCode = db.prepare('SELECT id FROM global_roles WHERE code = ?');
    const superAdminRole = findGlobalRoleByCode.get('super_admin');
    const normalUserRole = findGlobalRoleByCode.get('normal_user');

    const bootstrapSuperAdminIdSet = new Set(['u1', ...BOOTSTRAP_SUPER_ADMINS.map((item) => item.id)]);

    if (superAdminRole && normalUserRole) {
      for (const user of seedUsers) {
        const roleId = bootstrapSuperAdminIdSet.has(user.id) ? superAdminRole.id : normalUserRole.id;
        insertUserGlobalRole.run({
          id: `ugr-${user.id}`,
          user_id: user.id,
          role_id: roleId,
          assigned_by: 'system',
          assigned_at: nowIso(),
        });
      }
    }
  });

  writeSeed();
}

module.exports = {
  seedDatabase,
};
