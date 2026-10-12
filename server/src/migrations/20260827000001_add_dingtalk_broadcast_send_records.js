/**
 * 钉钉宣传推送发送记录与批次。
 *
 * 内容草稿继续保存在 dingtalk_broadcasts；每一次测试、全员或失败补发
 * 都形成独立发送记录，并逐批保存 processQueryKey，支持异步恢复与 24 小时撤回。
 */

exports.up = async function (knex) {
  if (!await knex.schema.hasTable('dingtalk_broadcast_send_records')) {
    await knex.schema.createTable('dingtalk_broadcast_send_records', (table) => {
      table.string('id').primary();
      table.string('broadcast_id');
      table.string('parent_record_id');
      table.string('idempotency_key').notNullable().unique();
      table.string('payload_hash').notNullable();
      table.string('scope', 32).notNullable();
      table.string('message_type', 32).notNullable();
      table.text('title').notNullable().defaultTo('');
      table.text('markdown').notNullable().defaultTo('');
      table.text('button_text').notNullable().defaultTo('');
      table.text('cover_image_url');
      table.text('action_url');
      table.text('recipients_json').notNullable().defaultTo('[]');
      table.text('initial_failures_json').notNullable().defaultTo('[]');
      table.text('failures_json').notNullable().defaultTo('[]');
      table.integer('recipient_count').notNullable().defaultTo(0);
      table.integer('deliverable_count').notNullable().defaultTo(0);
      table.integer('success_count').notNullable().defaultTo(0);
      table.integer('failure_count').notNullable().defaultTo(0);
      table.string('status', 32).notNullable().defaultTo('queued');
      table.string('recall_status', 32).notNullable().defaultTo('none');
      table.text('recall_deadline_at').notNullable();
      table.text('last_error');
      table.text('recall_error');
      table.string('requested_by').notNullable();
      table.text('created_at').notNullable();
      table.text('started_at');
      table.text('finished_at');
      table.text('recall_requested_at');
      table.text('recalled_at');
      table.text('updated_at').notNullable();

      table.foreign('broadcast_id').references('dingtalk_broadcasts.id');
      table.foreign('parent_record_id').references('dingtalk_broadcast_send_records.id');
      table.foreign('requested_by').references('users.id');
    });
  }

  if (!await knex.schema.hasTable('dingtalk_broadcast_send_batches')) {
    await knex.schema.createTable('dingtalk_broadcast_send_batches', (table) => {
      table.string('id').primary();
      table.string('record_id').notNullable();
      table.integer('batch_index').notNullable();
      table.text('recipients_json').notNullable().defaultTo('[]');
      table.string('status', 32).notNullable().defaultTo('pending');
      table.string('process_query_key');
      table.integer('success_count').notNullable().defaultTo(0);
      table.text('failures_json').notNullable().defaultTo('[]');
      table.text('last_error');
      table.string('recall_status', 32).notNullable().defaultTo('none');
      table.text('recall_error');
      table.text('sent_at');
      table.text('recalled_at');
      table.text('created_at').notNullable();
      table.text('updated_at').notNullable();

      table.unique(['record_id', 'batch_index']);
      table.foreign('record_id').references('dingtalk_broadcast_send_records.id').onDelete('CASCADE');
    });
  }

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_dingtalk_broadcast_send_records_created ON dingtalk_broadcast_send_records(created_at DESC)'
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_dingtalk_broadcast_send_records_status ON dingtalk_broadcast_send_records(status, recall_status)'
  );
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_dingtalk_broadcast_send_batches_record ON dingtalk_broadcast_send_batches(record_id, batch_index)'
  );
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_dingtalk_broadcast_send_batches_record');
  await knex.raw('DROP INDEX IF EXISTS idx_dingtalk_broadcast_send_records_status');
  await knex.raw('DROP INDEX IF EXISTS idx_dingtalk_broadcast_send_records_created');
  await knex.schema.dropTableIfExists('dingtalk_broadcast_send_batches');
  await knex.schema.dropTableIfExists('dingtalk_broadcast_send_records');
};
