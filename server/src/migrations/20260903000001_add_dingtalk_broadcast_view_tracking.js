/** 为每次 ActionCard 发送记录增加独立阅读追踪标识与页面打开次数。 */

const TABLE_NAME = 'dingtalk_broadcast_send_records';
const TRACKING_INDEX = 'idx_dingtalk_broadcast_send_records_view_tracking_token';

exports.up = async function (knex) {
  // 使用原生 ADD COLUMN，避免 SQLite 的表重建影响现有发送批次与外键。
  if (!await knex.schema.hasColumn(TABLE_NAME, 'view_tracking_token')) {
    await knex.raw(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN view_tracking_token TEXT`
    );
  }
  if (!await knex.schema.hasColumn(TABLE_NAME, 'view_count')) {
    await knex.raw(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0`
    );
  }
  await knex.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS ${TRACKING_INDEX}
     ON ${TABLE_NAME}(view_tracking_token)
     WHERE view_tracking_token IS NOT NULL`
  );
};

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX IF EXISTS ${TRACKING_INDEX}`);
  if (await knex.schema.hasColumn(TABLE_NAME, 'view_count')) {
    await knex.raw(`ALTER TABLE ${TABLE_NAME} DROP COLUMN view_count`);
  }
  if (await knex.schema.hasColumn(TABLE_NAME, 'view_tracking_token')) {
    await knex.raw(`ALTER TABLE ${TABLE_NAME} DROP COLUMN view_tracking_token`);
  }
};
