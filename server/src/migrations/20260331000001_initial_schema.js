/**
 * 初始化数据库 Schema
 *
 * 创建所有核心业务表：
 * - users, departments, user_identities, user_departments
 * - global_roles, global_role_permissions, user_global_roles
 * - team_roles, team_role_permissions, teams, team_members
 * - tasks, comments, task_attachments, comment_attachments
 * - notifications, task_activity_log
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. users — 用户主表
  if (!await knex.schema.hasTable('users')) {
    await knex.schema.createTable('users', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('avatar');
      table.string('job_number');
      table.string('mobile');
      table.string('email');
      table.string('department_id');
      table.string('department_name');
      table.integer('is_dept_manager').notNullable().defaultTo(0);
      table.integer('status').notNullable().defaultTo(1);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  // 2. departments — 组织树主表
  if (!await knex.schema.hasTable('departments')) {
    await knex.schema.createTable('departments', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('parent_id');
      table.integer('sort_order').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
    });
  }

  // 3. user_identities — 钉钉身份映射表
  if (!await knex.schema.hasTable('user_identities')) {
    await knex.schema.createTable('user_identities', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable();
      table.string('provider').notNullable().defaultTo('dingtalk');
      table.string('unionid');
      table.string('openid');
      table.text('raw_profile_json');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
    });
  }

  // 4. user_departments — 用户部门关系表
  if (!await knex.schema.hasTable('user_departments')) {
    await knex.schema.createTable('user_departments', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable();
      table.string('department_id').notNullable();
      table.integer('is_primary').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
      table.unique(['user_id', 'department_id']);
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.foreign('department_id').references('departments.id').onDelete('CASCADE');
    });
  }

  // 5. global_roles — 全局角色表
  if (!await knex.schema.hasTable('global_roles')) {
    await knex.schema.createTable('global_roles', (table) => {
      table.string('id').primary();
      table.string('code').notNullable().unique();
      table.string('name').notNullable();
      table.string('description');
      table.string('data_scope').notNullable().defaultTo('self');
      table.integer('is_system').notNullable().defaultTo(0);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  // 6. global_role_permissions — 全局角色权限关系
  if (!await knex.schema.hasTable('global_role_permissions')) {
    await knex.schema.createTable('global_role_permissions', (table) => {
      table.string('id').primary();
      table.string('role_id').notNullable();
      table.string('permission_code').notNullable();
      table.unique(['role_id', 'permission_code']);
      table.foreign('role_id').references('global_roles.id').onDelete('CASCADE');
    });
  }

  // 7. user_global_roles — 用户全局角色关系
  if (!await knex.schema.hasTable('user_global_roles')) {
    await knex.schema.createTable('user_global_roles', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable();
      table.string('role_id').notNullable();
      table.string('assigned_by');
      table.text('assigned_at').notNullable();
      table.unique(['user_id', 'role_id']);
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.foreign('role_id').references('global_roles.id').onDelete('CASCADE');
    });
  }

  // 8. team_roles — Team 角色表
  if (!await knex.schema.hasTable('team_roles')) {
    await knex.schema.createTable('team_roles', (table) => {
      table.string('id').primary();
      table.string('code').notNullable().unique();
      table.string('name').notNullable();
      table.string('description');
      table.integer('is_system').notNullable().defaultTo(0);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  // 9. team_role_permissions — Team 角色权限关系
  if (!await knex.schema.hasTable('team_role_permissions')) {
    await knex.schema.createTable('team_role_permissions', (table) => {
      table.string('id').primary();
      table.string('role_id').notNullable();
      table.string('permission_code').notNullable();
      table.unique(['role_id', 'permission_code']);
      table.foreign('role_id').references('team_roles.id').onDelete('CASCADE');
    });
  }

  // 10. teams — Team 表
  if (!await knex.schema.hasTable('teams')) {
    await knex.schema.createTable('teams', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('description');
      table.string('avatar');
      table.string('level').notNullable();
      table.string('owner_id').notNullable();
      table.integer('is_archived').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });
  }

  // 11. team_members — Team 成员关系表
  if (!await knex.schema.hasTable('team_members')) {
    await knex.schema.createTable('team_members', (table) => {
      table.string('id').primary();
      table.string('team_id').notNullable();
      table.string('user_id').notNullable();
      table.string('role_id').notNullable().defaultTo('member');
      table.text('joined_at').notNullable();
      table.unique(['team_id', 'user_id']);
      table.foreign('team_id').references('teams.id').onDelete('CASCADE');
    });
  }

  // 12. tasks — 任务表
  if (!await knex.schema.hasTable('tasks')) {
    await knex.schema.createTable('tasks', (table) => {
      table.string('id').primary();
      table.string('title').notNullable();
      table.string('description');
      table.string('status').notNullable();
      table.string('priority').notNullable();
      table.string('team_id').notNullable();
      table.string('creator_id').notNullable();
      table.string('assignee_id');
      table.text('participant_ids');
      table.string('start_date');
      table.string('due_date');
      table.string('completed_at');
      table.integer('sort_order').notNullable().defaultTo(1);
      table.integer('is_deleted').notNullable().defaultTo(0);
      table.string('deleted_at');
      table.string('deleted_by');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
      table.foreign('team_id').references('teams.id').onDelete('CASCADE');
    });
  }

  // 13. comments — 评论表
  if (!await knex.schema.hasTable('comments')) {
    await knex.schema.createTable('comments', (table) => {
      table.string('id').primary();
      table.string('task_id').notNullable();
      table.string('user_id').notNullable();
      table.text('content').notNullable();
      table.string('parent_id');
      table.string('request_id');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
      table.string('deleted_at');
      table.foreign('task_id').references('tasks.id').onDelete('CASCADE');
    });
  }

  // 14. task_attachments — 任务附件表
  if (!await knex.schema.hasTable('task_attachments')) {
    await knex.schema.createTable('task_attachments', (table) => {
      table.string('id').primary();
      table.string('task_id').notNullable();
      table.string('user_id').notNullable();
      table.string('filename').notNullable();
      table.string('original_name').notNullable();
      table.integer('file_size').notNullable();
      table.string('mime_type');
      table.string('physical_path');
      table.text('created_at').notNullable();
      table.foreign('task_id').references('tasks.id').onDelete('CASCADE');
    });
  }

  // 15. comment_attachments — 评论附件表
  if (!await knex.schema.hasTable('comment_attachments')) {
    await knex.schema.createTable('comment_attachments', (table) => {
      table.string('id').primary();
      table.string('task_id').notNullable();
      table.string('comment_id'); // 允许 NULL（孤立附件场景）
      table.string('user_id').notNullable();
      table.string('filename').notNullable();
      table.string('original_name').notNullable();
      table.integer('file_size').notNullable();
      table.string('mime_type');
      table.string('physical_path');
      table.text('created_at').notNullable();
      table.foreign('task_id').references('tasks.id').onDelete('CASCADE');
      table.foreign('comment_id').references('comments.id').onDelete('CASCADE');
    });
  }

  // 16. notifications — 通知表
  if (!await knex.schema.hasTable('notifications')) {
    await knex.schema.createTable('notifications', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable();
      table.string('type').notNullable();
      table.string('task_id');
      table.string('title').notNullable();
      table.text('content').notNullable();
      table.integer('is_read').notNullable().defaultTo(0);
      table.integer('dingtalk_sent').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
    });
  }

  // 17. task_activity_log — 任务操作日志表
  if (!await knex.schema.hasTable('task_activity_log')) {
    await knex.schema.createTable('task_activity_log', (table) => {
      table.string('id').primary();
      table.string('task_id').notNullable();
      table.string('user_id').notNullable();
      table.string('action').notNullable();
      table.text('old_value');
      table.text('new_value');
      table.text('created_at').notNullable();
      table.foreign('task_id').references('tasks.id').onDelete('CASCADE');
    });
  }

  // ──────────────────────────────────────────
  // 核心索引
  // ──────────────────────────────────────────

  // tasks 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_team_status ON tasks(team_id, status)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)');

  // team_members 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)');

  // comments 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_comments_task_created ON comments(task_id, created_at)');

  // task_attachments 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id)');

  // comment_attachments 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment ON comment_attachments(comment_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_comment_attachments_task ON comment_attachments(task_id)');

  // notifications 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at)');

  // task_activity_log 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_activity_log_task ON task_activity_log(task_id, created_at)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_activity_log_action ON task_activity_log(action, created_at)');

  // user_global_roles 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_user_global_roles_user ON user_global_roles(user_id)');

  // global_role_permissions 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_global_role_perms_role ON global_role_permissions(role_id)');

  // team_role_permissions 索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_team_role_perms_role ON team_role_permissions(role_id)');

  // user_identities 索引
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_unionid ON user_identities(provider, unionid)');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // 按依赖关系逆序删除
  await knex.schema.dropTableIfExists('task_activity_log');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('comment_attachments');
  await knex.schema.dropTableIfExists('task_attachments');
  await knex.schema.dropTableIfExists('comments');
  await knex.schema.dropTableIfExists('tasks');
  await knex.schema.dropTableIfExists('team_members');
  await knex.schema.dropTableIfExists('teams');
  await knex.schema.dropTableIfExists('team_role_permissions');
  await knex.schema.dropTableIfExists('team_roles');
  await knex.schema.dropTableIfExists('user_global_roles');
  await knex.schema.dropTableIfExists('global_role_permissions');
  await knex.schema.dropTableIfExists('global_roles');
  await knex.schema.dropTableIfExists('user_departments');
  await knex.schema.dropTableIfExists('user_identities');
  await knex.schema.dropTableIfExists('departments');
  await knex.schema.dropTableIfExists('users');
};