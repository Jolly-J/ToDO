/**
 * 为团队成员增加任务可见范围。
 *
 * all：沿用团队内任务基础信息透明。
 * self：仅可见自己创建、负责或参与的任务。
 */

exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('team_members', 'task_visibility_scope');
  if (!hasColumn) {
    await knex.schema.alterTable('team_members', (table) => {
      table.string('task_visibility_scope').notNullable().defaultTo('all');
    });
  }

  await knex('team_members')
    .whereNull('task_visibility_scope')
    .update({ task_visibility_scope: 'all' });
};

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('team_members', 'task_visibility_scope');
  if (hasColumn) {
    await knex.schema.alterTable('team_members', (table) => {
      table.dropColumn('task_visibility_scope');
    });
  }
};
