/**
 * 移动端拦截页点赞记录表
 * 存储用户自填姓名和累计点赞数，用于排行榜展示
 */

exports.up = async function (knex) {
  await knex.schema.createTable('mobile_likes', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable();
    table.integer('like_count').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTable('mobile_likes');
};
