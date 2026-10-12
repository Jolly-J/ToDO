/**
 * 任务提醒功能 — 给 tasks 表新增提醒相关字段
 *
 * reminder_rule: 提醒规则标识（如 due_15m, due_1h, due_1d 等）
 * reminder_at:   根据 due_date + reminder_rule 计算出的实际触发时间（ISO 字符串）
 * reminder_sent:  是否已发送提醒（0=未发送, 1=已发送）
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('tasks', (table) => {
    table.string('reminder_rule');
    table.string('reminder_at');
    table.integer('reminder_sent').notNullable().defaultTo(0);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('tasks', (table) => {
    table.dropColumn('reminder_rule');
    table.dropColumn('reminder_at');
    table.dropColumn('reminder_sent');
  });
};
