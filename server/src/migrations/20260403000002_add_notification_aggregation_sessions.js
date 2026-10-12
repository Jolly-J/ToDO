/**
 * 通知聚合会话表
 *
 * 记录 task + actor 的滑动窗口聚合状态，窗口到期后统一触发一次通知。
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  if (!await knex.schema.hasTable('notification_aggregation_sessions')) {
    await knex.schema.createTable('notification_aggregation_sessions', (table) => {
      table.string('id').primary();
      table.string('biz_type').notNullable();
      table.string('biz_id').notNullable();
      table.string('actor_id').notNullable();
      table.text('change_items').notNullable();
      table.text('due_at').notNullable();
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
    });

    await knex.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_agg_biz_actor ON notification_aggregation_sessions(biz_type, biz_id, actor_id)'
    );
    await knex.raw(
      'CREATE INDEX IF NOT EXISTS idx_notif_agg_due_at ON notification_aggregation_sessions(due_at)'
    );
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('notification_aggregation_sessions');
};
