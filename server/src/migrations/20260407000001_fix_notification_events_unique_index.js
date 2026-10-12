/**
 * 修复 notification_events 唯一索引过于严格的问题
 *
 * 原唯一索引 (biz_id, event_type, actor_id) 导致同一操作者对同一业务实体
 * 的同类事件只能写入一条记录，后续全部被 INSERT OR IGNORE 静默吞掉。
 * 改为普通索引，幂等控制由 scheduler 的 eventExists + 时间窗口负责。
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_notif_events_biz_event_actor');
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_notif_events_biz_event_actor ON notification_events(biz_id, event_type, actor_id)'
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_notif_events_biz_event_actor');
  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_events_biz_event_actor ON notification_events(biz_id, event_type, actor_id)'
  );
};
