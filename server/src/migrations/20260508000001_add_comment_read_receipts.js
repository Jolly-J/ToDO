/**
 * 评论已读回执表
 *
 * comment_recipients 保存评论发布时的应读人快照；
 * comment_reads 保存每个应读人的实际已读时间。
 */

function buildRecipientRows(comment, task) {
  const seen = new Set();
  const rows = [];
  const createdAt = comment.created_at || new Date().toISOString();

  const add = (userId, role) => {
    if (!userId || seen.has(userId)) return;
    seen.add(userId);
    rows.push({
      comment_id: comment.id,
      task_id: comment.task_id,
      user_id: userId,
      role,
      created_at: createdAt,
    });
  };

  add(task.creator_id, 'creator');
  add(task.assignee_id, 'assignee');

  let participantIds = [];
  try {
    participantIds = task.participant_ids ? JSON.parse(task.participant_ids) : [];
  } catch {
    participantIds = [];
  }

  for (const userId of participantIds) {
    add(userId, 'participant');
  }

  return rows;
}

exports.up = async function (knex) {
  const hasRecipients = await knex.schema.hasTable('comment_recipients');
  if (!hasRecipients) {
    await knex.schema.createTable('comment_recipients', (table) => {
      table.string('comment_id').notNullable();
      table.string('task_id').notNullable();
      table.string('user_id').notNullable();
      table.string('role', 20).notNullable();
      table.text('created_at').notNullable();
      table.primary(['comment_id', 'user_id']);
      table.foreign('comment_id').references('comments.id').onDelete('CASCADE');
      table.foreign('task_id').references('tasks.id').onDelete('CASCADE');
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
    });
  }

  const hasReads = await knex.schema.hasTable('comment_reads');
  if (!hasReads) {
    await knex.schema.createTable('comment_reads', (table) => {
      table.string('comment_id').notNullable();
      table.string('user_id').notNullable();
      table.text('read_at').notNullable();
      table.primary(['comment_id', 'user_id']);
      table.foreign('comment_id').references('comments.id').onDelete('CASCADE');
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
    });
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_comment_recipients_task ON comment_recipients(task_id, user_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_comment_reads_user ON comment_reads(user_id, read_at)');

  const comments = await knex('comments as c')
    .leftJoin('tasks as t', 'c.task_id', 't.id')
    .select(
      'c.id',
      'c.task_id',
      'c.user_id',
      'c.created_at',
      't.creator_id',
      't.assignee_id',
      't.participant_ids'
    )
    .whereNull('c.deleted_at');

  for (const comment of comments) {
    if (!comment.creator_id && !comment.assignee_id && !comment.participant_ids) {
      continue;
    }

    const recipients = buildRecipientRows(comment, comment);
    for (const recipient of recipients) {
      await knex('comment_recipients').insert(recipient).onConflict(['comment_id', 'user_id']).ignore();
    }

    if (recipients.some((recipient) => recipient.user_id === comment.user_id)) {
      await knex('comment_reads')
        .insert({
          comment_id: comment.id,
          user_id: comment.user_id,
          read_at: comment.created_at || new Date().toISOString(),
        })
        .onConflict(['comment_id', 'user_id'])
        .ignore();
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('comment_reads');
  await knex.schema.dropTableIfExists('comment_recipients');
};
