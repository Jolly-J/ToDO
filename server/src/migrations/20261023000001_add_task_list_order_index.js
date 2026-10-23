/** 团队活动任务顺序索引：避免列表查询创建临时排序树，不重建或删除业务表。 */
exports.up = async function (knex) {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_tasks_team_active_order ON tasks(team_id, sort_order ASC, created_at DESC) WHERE is_deleted = 0');
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_tasks_team_active_order');
};
