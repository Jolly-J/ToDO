/**
 * 团队群聊机器人每日提醒
 *
 * 保存团队钉钉群机器人配置、发送规则、选中任务和中国工作日缓存。
 */

exports.up = async function (knex) {
  if (!await knex.schema.hasTable('team_group_robot_configs')) {
    await knex.schema.createTable('team_group_robot_configs', (table) => {
      table.string('id').primary();
      table.string('team_id').notNullable().unique();
      table.text('webhook_url').notNullable().defaultTo('');
      table.text('secret').notNullable().defaultTo('');
      table.integer('enabled').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
      table.foreign('team_id').references('teams.id').onDelete('CASCADE');
    });
  }

  if (!await knex.schema.hasTable('team_group_reminder_rules')) {
    await knex.schema.createTable('team_group_reminder_rules', (table) => {
      table.string('id').primary();
      table.string('team_id').notNullable().unique();
      table.string('config_id').notNullable();
      table.integer('enabled').notNullable().defaultTo(0);
      table.string('send_time', 10).notNullable().defaultTo('09:30');
      table.integer('workday_only').notNullable().defaultTo(1);
      table.text('heading').notNullable().defaultTo('请各位负责人关注未完成任务：');
      table.string('last_sent_date', 10);
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
      table.foreign('team_id').references('teams.id').onDelete('CASCADE');
      table.foreign('config_id').references('team_group_robot_configs.id').onDelete('CASCADE');
    });
  }

  if (!await knex.schema.hasTable('team_group_reminder_tasks')) {
    await knex.schema.createTable('team_group_reminder_tasks', (table) => {
      table.string('id').primary();
      table.string('rule_id').notNullable();
      table.string('task_id').notNullable();
      table.text('created_at').notNullable();
      table.unique(['rule_id', 'task_id']);
      table.foreign('rule_id').references('team_group_reminder_rules.id').onDelete('CASCADE');
      table.foreign('task_id').references('tasks.id').onDelete('CASCADE');
    });
  }

  if (!await knex.schema.hasTable('team_group_workday_calendar_cache')) {
    await knex.schema.createTable('team_group_workday_calendar_cache', (table) => {
      table.string('date', 10).primary();
      table.integer('is_workday').notNullable();
      table.text('name').notNullable().defaultTo('');
      table.text('source').notNullable().defaultTo('chinese-days');
      table.text('synced_at').notNullable();
    });
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_team_group_rules_due ON team_group_reminder_rules(enabled, send_time, last_sent_date)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_team_group_tasks_rule ON team_group_reminder_tasks(rule_id)');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_team_group_tasks_rule');
  await knex.raw('DROP INDEX IF EXISTS idx_team_group_rules_due');
  await knex.schema.dropTableIfExists('team_group_workday_calendar_cache');
  await knex.schema.dropTableIfExists('team_group_reminder_tasks');
  await knex.schema.dropTableIfExists('team_group_reminder_rules');
  await knex.schema.dropTableIfExists('team_group_robot_configs');
};
