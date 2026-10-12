/**
 * 为 user_identities 增加 provider_userid，统一保存第三方用户 ID。
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('user_identities', 'provider_userid');
  if (!hasColumn) {
    await knex.schema.alterTable('user_identities', (table) => {
      table.string('provider_userid');
    });
  }

  await knex('user_identities')
    .whereNull('provider_userid')
    .update({
      provider_userid: knex.ref('user_id'),
    });

  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_userid ON user_identities(provider, provider_userid)'
  );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_user_identities_provider_userid');

  const hasColumn = await knex.schema.hasColumn('user_identities', 'provider_userid');
  if (hasColumn) {
    await knex.schema.alterTable('user_identities', (table) => {
      table.dropColumn('provider_userid');
    });
  }
};
