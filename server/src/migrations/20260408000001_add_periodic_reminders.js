/**
 * 任务提醒功能扩展 — 给 tasks 表新增周期性提醒相关字段
 *
 * periodic_interval_days: 周期天数（如 1 代表每天，2 代表每2天）
 * periodic_time: 当天提醒的具体时刻（如 09:30）
 * next_periodic_at: 后台计算的下次触发的绝对 ISO 时戳，用于高效打捞
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('tasks', (table) => {
    table.integer('periodic_interval_days');
    table.string('periodic_time', 10);
    table.string('next_periodic_at');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tasks', (table) => {
    table.dropColumn('periodic_interval_days');
    table.dropColumn('periodic_time');
    table.dropColumn('next_periodic_at');
  });
};
