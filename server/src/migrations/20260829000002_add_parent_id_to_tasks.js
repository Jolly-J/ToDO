/**
 * 任务关联与无限层级子任务（WBS）— 给 tasks 表新增 parent_id 字段及索引
 *
 * parent_id: 父级任务 ID（指向 tasks.id，顶层根任务为 NULL）
 */

exports.up = async function (knex) {
  const hasParentId = await knex.schema.hasColumn('tasks', 'parent_id');
  if (!hasParentId) {
    await knex.schema.alterTable('tasks', (table) => {
      table.string('parent_id').references('id').inTable('tasks').onDelete('CASCADE');
      table.index('parent_id', 'idx_tasks_parent_id');
    });
  }
};

exports.down = async function (knex) {
  const hasParentId = await knex.schema.hasColumn('tasks', 'parent_id');
  if (hasParentId) {
    await knex.schema.alterTable('tasks', (table) => {
      table.dropIndex('parent_id', 'idx_tasks_parent_id');
      table.dropColumn('parent_id');
    });
  }
};
