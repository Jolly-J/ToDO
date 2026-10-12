/**
 * 钉钉宣传推送
 *
 * 仅保存 ActionCard HTML 承载内容和全员工作通知提交结果，
 * 不承担品牌内容中心、模板或运营流程。
 */

exports.up = async function (knex) {
  if (!await knex.schema.hasTable('dingtalk_broadcasts')) {
    await knex.schema.createTable('dingtalk_broadcasts', (table) => {
      table.string('id').primary();
      table.string('public_token').unique();
      table.string('message_type', 32).notNullable();
      table.text('title').notNullable().defaultTo('');
      table.text('markdown').notNullable().defaultTo('');
      table.text('button_text').notNullable().defaultTo('');
      table.text('html_content');
      table.text('html_original_name');
      table.integer('html_size').notNullable().defaultTo(0);
      table.string('status', 32).notNullable().defaultTo('draft');
      table.string('last_test_task_id');
      table.text('last_test_at');
      table.string('all_task_id');
      table.text('all_sent_at');
      table.text('last_error');
      table.string('created_by').notNullable();
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();
      table.foreign('created_by').references('users.id');
    });
  }

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_dingtalk_broadcasts_daily ON dingtalk_broadcasts(status, all_sent_at)'
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_dingtalk_broadcasts_daily');
  await knex.schema.dropTableIfExists('dingtalk_broadcasts');
};
