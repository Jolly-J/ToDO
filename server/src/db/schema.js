/**
 * TaskFlow 数据库 Schema 参考
 *
 * @deprecated 已废弃，数据库 Schema 现由 Knex migrations 管理
 * 详见: src/migrations/ 目录
 *
 * 本文件仅作为 Schema 设计参考保留
 * 实际建表逻辑已迁移至:
 *   - src/migrations/20260331000001_initial_schema.js (初始化)
 *   - src/db/migrationRunner.js (迁移执行器)
 *   - src/db/initDb.js (初始化入口)
 *
 * 新增表或列请创建新的迁移文件：
 *   npm run db:migrate:make -- --name <迁移名称>
 */

// 此模块已废弃，不再导出任何函数
module.exports = {
  // @deprecated applySchema 已迁移至 Knex migrations
  applySchema: () => {
    throw new Error('applySchema 已废弃，请使用 Knex migrations: npm run db:migrate');
  },
};