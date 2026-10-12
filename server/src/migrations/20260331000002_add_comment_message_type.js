/**
 * 数据库迁移：补充评论消息类型字段
 *
 * 为 `comments` 表新增 `message_type` 字段并回填默认值。
 */
exports.up = async function up(knex) {
  const hasCommentsTable = await knex.schema.hasTable('comments');

  if (!hasCommentsTable) {
    return;
  }

  const hasMessageTypeColumn = await knex.schema.hasColumn('comments', 'message_type');

  if (!hasMessageTypeColumn) {
    await knex.schema.alterTable('comments', (table) => {
      table.string('message_type').notNullable().defaultTo('message');
    });
  }

  await knex('comments')
    .whereNull('message_type')
    .update({ message_type: 'message' });
};

exports.down = async function down(knex) {
  const hasCommentsTable = await knex.schema.hasTable('comments');

  if (!hasCommentsTable) {
    return;
  }

  const hasMessageTypeColumn = await knex.schema.hasColumn('comments', 'message_type');

  if (hasMessageTypeColumn) {
    await knex.schema.alterTable('comments', (table) => {
      table.dropColumn('message_type');
    });
  }
};
