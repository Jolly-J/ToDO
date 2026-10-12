/**
 * 升级任务状态模型。
 *
 * - 历史 todo 统一迁移为 in_progress。
 * - 增加状态更新时间和延期时间字段，为延期状态生命周期留出结构化字段。
 */

exports.up = async function up(knex) {
  const hasStatusUpdatedAt = await knex.schema.hasColumn('tasks', 'status_updated_at');
  const hasDelayedAt = await knex.schema.hasColumn('tasks', 'delayed_at');

  if (!hasStatusUpdatedAt || !hasDelayedAt) {
    await knex.schema.alterTable('tasks', (table) => {
      if (!hasStatusUpdatedAt) {
        table.text('status_updated_at');
      }
      if (!hasDelayedAt) {
        table.text('delayed_at');
      }
    });
  }

  await knex('tasks')
    .where('status', 'todo')
    .update({
      status: 'in_progress',
      status_updated_at: knex.raw('COALESCE(updated_at, created_at)'),
    });

  await knex('tasks')
    .whereNull('status_updated_at')
    .update({
      status_updated_at: knex.raw('COALESCE(updated_at, created_at)'),
    });
};

exports.down = async function down(knex) {
  const hasStatusUpdatedAt = await knex.schema.hasColumn('tasks', 'status_updated_at');
  const hasDelayedAt = await knex.schema.hasColumn('tasks', 'delayed_at');

  await knex('tasks')
    .where('status', 'delayed_in_progress')
    .update({ status: 'in_progress' });

  await knex('tasks')
    .where('status', 'delayed_done')
    .update({ status: 'done' });

  if (hasStatusUpdatedAt || hasDelayedAt) {
    await knex.schema.alterTable('tasks', (table) => {
      if (hasStatusUpdatedAt) {
        table.dropColumn('status_updated_at');
      }
      if (hasDelayedAt) {
        table.dropColumn('delayed_at');
      }
    });
  }
};
