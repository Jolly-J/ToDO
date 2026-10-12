/**
 * 评论督办流机制扩展 — 为 comments 表新增强制进展审核支持
 *
 * audit_status: 针对 'progress' 类型的留言，审核状态 ( pending | approved | rejected )
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('comments', (table) => {
    table.string('audit_status', 20); // nullable
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('comments', (table) => {
    table.dropColumn('audit_status');
  });
};
