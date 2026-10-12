/**
 * 迁移：允许 task_attachments.task_id 为 NULL
 *
 * 背景：创建任务时支持预上传附件（pending 状态），附件先上传拿到 ID，
 * 任务创建成功后再关联。原表结构 task_id NOT NULL 导致预上传直接报错。
 *
 * SQLite 不支持 ALTER COLUMN，需重建表。
 */

'use strict';

exports.up = async function (knex) {
  await knex.schema.raw(`
    CREATE TABLE task_attachments_new (
      id           varchar(255) primary key,
      task_id      varchar(255),
      user_id      varchar(255) not null,
      filename     varchar(255) not null,
      original_name varchar(255) not null,
      file_size    integer not null,
      mime_type    varchar(255),
      physical_path varchar(255),
      created_at   text not null,
      foreign key(task_id) references tasks(id) on delete CASCADE
    )
  `);

  await knex.schema.raw(`
    INSERT INTO task_attachments_new
      SELECT id, task_id, user_id, filename, original_name, file_size, mime_type, physical_path, created_at
      FROM task_attachments
  `);

  await knex.schema.raw(`DROP TABLE task_attachments`);
  await knex.schema.raw(`ALTER TABLE task_attachments_new RENAME TO task_attachments`);
  await knex.schema.raw(`CREATE INDEX idx_task_attachments_task ON task_attachments(task_id)`);

  console.log('[migration] task_attachments.task_id 已改为允许 NULL');
};

exports.down = async function (knex) {
  // 回滚：把 task_id 改回 NOT NULL（会删除所有 pending 附件记录）
  await knex.schema.raw(`
    DELETE FROM task_attachments WHERE task_id IS NULL
  `);

  await knex.schema.raw(`
    CREATE TABLE task_attachments_old (
      id           varchar(255) primary key,
      task_id      varchar(255) not null,
      user_id      varchar(255) not null,
      filename     varchar(255) not null,
      original_name varchar(255) not null,
      file_size    integer not null,
      mime_type    varchar(255),
      physical_path varchar(255),
      created_at   text not null,
      foreign key(task_id) references tasks(id) on delete CASCADE
    )
  `);

  await knex.schema.raw(`
    INSERT INTO task_attachments_old
      SELECT id, task_id, user_id, filename, original_name, file_size, mime_type, physical_path, created_at
      FROM task_attachments
  `);

  await knex.schema.raw(`DROP TABLE task_attachments`);
  await knex.schema.raw(`ALTER TABLE task_attachments_old RENAME TO task_attachments`);
  await knex.schema.raw(`CREATE INDEX idx_task_attachments_task ON task_attachments(task_id)`);
};
