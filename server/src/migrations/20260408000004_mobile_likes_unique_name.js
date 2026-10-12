/**
 * 为 mobile_likes.name 添加唯一索引，防止同名重复刷榜
 * 建索引前先去重：同名保留 like_count 最高的那条
 */

exports.up = async function (knex) {
  // 找出每个名字应保留的 id（最高分那条）
  const toKeep = await knex('mobile_likes')
    .select('name')
    .max('like_count as max_count')
    .min('id as keep_id')
    .groupBy('name');

  // 删除同名中非最高分的记录
  for (const row of toKeep) {
    await knex('mobile_likes')
      .where('name', row.name)
      .andWhere('id', '!=', row.keep_id)
      .delete();
  }

  await knex.schema.alterTable('mobile_likes', (table) => {
    table.unique(['name']);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('mobile_likes', (table) => {
    table.dropUnique(['name']);
  });
};
