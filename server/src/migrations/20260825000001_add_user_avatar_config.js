/**
 * 为 users 表增加 avatar_config 与 avatar_type 字段
 *
 * avatar_config: JSON 格式存储用户 Notion 风格头像各部件配置
 * avatar_type: 头像来源 ('default' | 'dingtalk' | 'custom')
 */

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasAvatarConfig = await knex.schema.hasColumn('users', 'avatar_config');
  if (!hasAvatarConfig) {
    await knex.schema.alterTable('users', (table) => {
      table.text('avatar_config');
    });
  }

  const hasAvatarType = await knex.schema.hasColumn('users', 'avatar_type');
  if (!hasAvatarType) {
    await knex.schema.alterTable('users', (table) => {
      table.string('avatar_type', 32).notNullable().defaultTo('default');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasAvatarType = await knex.schema.hasColumn('users', 'avatar_type');
  if (hasAvatarType) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('avatar_type');
    });
  }

  const hasAvatarConfig = await knex.schema.hasColumn('users', 'avatar_config');
  if (hasAvatarConfig) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('avatar_config');
    });
  }
};
