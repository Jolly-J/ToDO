/**
 * 迁移：允许 tasks.team_id 为 NULL
 *
 * 背景：支持任务与团队解耦，允许创建不绑定团队的个人任务/独立任务。
 * SQLite 不支持 ALTER COLUMN，需安全重建 tasks 表并保留现有索引与级联关联。
 */

'use strict';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 临时关闭外键检查，防止重建 tasks 表时触发依赖表（如 comments、task_attachments）的 ON DELETE CASCADE 误删
  await knex.raw('PRAGMA foreign_keys = OFF');

  await knex.schema.raw(`
    CREATE TABLE tasks_new (
      id varchar(255) primary key,
      title varchar(255) not null,
      description text,
      status varchar(255) not null,
      priority varchar(255) not null,
      team_id varchar(255) references teams(id) on delete set null,
      creator_id varchar(255) not null,
      assignee_id varchar(255),
      participant_ids text,
      start_date varchar(255),
      due_date varchar(255),
      completed_at varchar(255),
      sort_order integer not null default 1,
      is_deleted integer not null default 0,
      deleted_at varchar(255),
      deleted_by varchar(255),
      created_at text not null,
      updated_at text not null,
      reminder_rule text,
      reminder_at text,
      reminder_sent integer not null default 0,
      periodic_interval_days integer,
      periodic_time text,
      next_periodic_at text,
      status_updated_at text,
      delayed_at text
    )
  `);

  await knex.schema.raw(`
    INSERT INTO tasks_new (
      id, title, description, status, priority, team_id, creator_id, assignee_id,
      participant_ids, start_date, due_date, completed_at, sort_order, is_deleted,
      deleted_at, deleted_by, created_at, updated_at, reminder_rule, reminder_at,
      reminder_sent, periodic_interval_days, periodic_time, next_periodic_at,
      status_updated_at, delayed_at
    )
    SELECT
      id, title, description, status, priority, team_id, creator_id, assignee_id,
      participant_ids, start_date, due_date, completed_at, sort_order, is_deleted,
      deleted_at, deleted_by, created_at, updated_at, reminder_rule, reminder_at,
      reminder_sent, periodic_interval_days, periodic_time, next_periodic_at,
      status_updated_at, delayed_at
    FROM tasks
  `);

  await knex.schema.raw('DROP TABLE tasks');
  await knex.schema.raw('ALTER TABLE tasks_new RENAME TO tasks');

  // 重建 tasks 表的所有索引
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_team_status ON tasks(team_id, status)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)');

  await knex.raw('PRAGMA foreign_keys = ON');

  console.log('[migration] tasks.team_id 已成功变更为允许 NULL (支持个人任务)');
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw('PRAGMA foreign_keys = OFF');

  // 回滚前确保无 NULL team_id（若有则兜底删除或补默认值）
  await knex.raw("UPDATE tasks SET team_id = 'default' WHERE team_id IS NULL");

  await knex.schema.raw(`
    CREATE TABLE tasks_old (
      id varchar(255) primary key,
      title varchar(255) not null,
      description text,
      status varchar(255) not null,
      priority varchar(255) not null,
      team_id varchar(255) not null references teams(id) on delete cascade,
      creator_id varchar(255) not null,
      assignee_id varchar(255),
      participant_ids text,
      start_date varchar(255),
      due_date varchar(255),
      completed_at varchar(255),
      sort_order integer not null default 1,
      is_deleted integer not null default 0,
      deleted_at varchar(255),
      deleted_by varchar(255),
      created_at text not null,
      updated_at text not null,
      reminder_rule text,
      reminder_at text,
      reminder_sent integer not null default 0,
      periodic_interval_days integer,
      periodic_time text,
      next_periodic_at text,
      status_updated_at text,
      delayed_at text
    )
  `);

  await knex.schema.raw(`
    INSERT INTO tasks_old SELECT * FROM tasks
  `);

  await knex.schema.raw('DROP TABLE tasks');
  await knex.schema.raw('ALTER TABLE tasks_old RENAME TO tasks');

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_team_status ON tasks(team_id, status)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)');

  await knex.raw('PRAGMA foreign_keys = ON');
};
