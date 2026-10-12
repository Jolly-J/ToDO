/**
 * 钉钉宣传推送切换发送通道：工作通知 → 单聊机器人
 *
 * 机器人发送没有钉钉 task_id 和发送进度查询，返回的是 processQueryKey；
 * 发送失败明细（无效用户、被限流用户、失败批次）需要持久化，供后台随时查看。
 *
 * 变更内容：
 * - all_task_id → all_process_key（全员发送主 processQueryKey）
 * - last_test_task_id → last_test_process_key（测试发送 processQueryKey）
 * - 新增 all_result_json（全员发送失败明细 JSON）
 * - 删除每日全员发送计数索引（机器人无每日限额）
 */

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE dingtalk_broadcasts RENAME COLUMN all_task_id TO all_process_key');
  await knex.raw('ALTER TABLE dingtalk_broadcasts RENAME COLUMN last_test_task_id TO last_test_process_key');
  await knex.raw('ALTER TABLE dingtalk_broadcasts ADD COLUMN all_result_json TEXT');
  await knex.raw('DROP INDEX IF EXISTS idx_dingtalk_broadcasts_daily');
};

exports.down = async function (knex) {
  const hasResultColumn = await knex.schema.hasColumn('dingtalk_broadcasts', 'all_result_json');
  if (hasResultColumn) {
    await knex.raw('ALTER TABLE dingtalk_broadcasts DROP COLUMN all_result_json');
  }
  await knex.raw('ALTER TABLE dingtalk_broadcasts RENAME COLUMN last_test_process_key TO last_test_task_id');
  await knex.raw('ALTER TABLE dingtalk_broadcasts RENAME COLUMN all_process_key TO all_task_id');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_dingtalk_broadcasts_daily ON dingtalk_broadcasts(status, all_sent_at)');
};
