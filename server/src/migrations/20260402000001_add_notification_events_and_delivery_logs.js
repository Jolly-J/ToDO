/**
 * 通知系统升级 — 新增 notification_events 和 delivery_logs 表
 *
 * notification_events: 记录每次业务动作产生的通知事件（结构化、可追溯）
 * delivery_logs: 记录每条通知在各渠道的投递状态（待办/机器人/工作通知/站内）
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. notification_events — 通知事件表
  if (!await knex.schema.hasTable('notification_events')) {
    await knex.schema.createTable('notification_events', (table) => {
      table.string('id').primary();
      table.string('biz_type').notNullable();
      table.string('biz_id').notNullable();
      table.string('event_type').notNullable();
      table.string('actor_id').notNullable();
      table.text('recipient_ids').notNullable();
      table.text('channels').notNullable();
      table.string('template_code').notNullable();
      table.text('template_variables');
      table.text('jump_url').notNullable();
      table.text('created_at').notNullable();
    });

    await knex.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_events_biz_event_actor ON notification_events(biz_id, event_type, actor_id)'
    );
    await knex.raw(
      'CREATE INDEX IF NOT EXISTS idx_notif_events_biz_type ON notification_events(biz_type, created_at)'
    );
  }

  // 2. delivery_logs — 投递记录表
  if (!await knex.schema.hasTable('delivery_logs')) {
    await knex.schema.createTable('delivery_logs', (table) => {
      table.string('id').primary();
      table.string('event_id').notNullable();
      table.string('channel').notNullable();
      table.string('receiver_id').notNullable();
      table.string('provider_message_id');
      table.string('status').notNullable().defaultTo('pending');
      table.text('error_message');
      table.text('sent_at');
      table.text('created_at').notNullable();
      table.foreign('event_id').references('notification_events.id').onDelete('CASCADE');
    });

    await knex.raw(
      'CREATE INDEX IF NOT EXISTS idx_delivery_logs_event ON delivery_logs(event_id)'
    );
    await knex.raw(
      'CREATE INDEX IF NOT EXISTS idx_delivery_logs_receiver ON delivery_logs(receiver_id, status)'
    );
    await knex.raw(
      'CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON delivery_logs(status, created_at)'
    );
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('delivery_logs');
  await knex.schema.dropTableIfExists('notification_events');
};
