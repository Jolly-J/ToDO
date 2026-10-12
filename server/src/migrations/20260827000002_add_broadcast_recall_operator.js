/** 为发送记录补充撤回操作人，兼容已经执行过第一版记录迁移的开发数据库。 */

exports.up = async function (knex) {
  if (!await knex.schema.hasColumn('dingtalk_broadcast_send_records', 'recall_requested_by')) {
    // SQLite 的 Knex alterTable 会重建父表并触发批次表 ON DELETE CASCADE。
    // 原生 ADD COLUMN 不重建表，可完整保留已经发送的 processQueryKey 批次。
    await knex.raw(
      'ALTER TABLE dingtalk_broadcast_send_records ADD COLUMN recall_requested_by TEXT REFERENCES users(id)'
    );
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('dingtalk_broadcast_send_records', 'recall_requested_by')) {
    await knex.raw('ALTER TABLE dingtalk_broadcast_send_records DROP COLUMN recall_requested_by');
  }
};
