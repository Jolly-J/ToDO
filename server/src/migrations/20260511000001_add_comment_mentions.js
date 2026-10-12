/**
 * 评论 @ 人员关系表。
 *
 * 记录每条评论真实提及的用户，以及该用户是否因本次 @ 被自动加入任务协作。
 */

exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable('comment_mentions');
  if (!hasTable) {
    await knex.schema.createTable('comment_mentions', (table) => {
      table.string('comment_id').notNullable();
      table.string('task_id').notNullable();
      table.string('mentioned_user_id').notNullable();
      table.string('created_by').notNullable();
      table.integer('auto_added_to_task').notNullable().defaultTo(0);
      table.text('created_at').notNullable();
      table.primary(['comment_id', 'mentioned_user_id']);
      table.foreign('comment_id').references('comments.id').onDelete('CASCADE');
      table.foreign('task_id').references('tasks.id').onDelete('CASCADE');
      table.foreign('mentioned_user_id').references('users.id').onDelete('CASCADE');
      table.foreign('created_by').references('users.id').onDelete('CASCADE');
    });
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_comment_mentions_task_user ON comment_mentions(task_id, mentioned_user_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_comment_mentions_created_by ON comment_mentions(created_by, created_at)');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('comment_mentions');
};
