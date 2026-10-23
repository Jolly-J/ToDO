/** CLI 与服务启动共用安全迁移入口，不使用通用 rollback 恢复备份。 */
const { runMigrations, closeKnex } = require('./migrationRunner');

async function main() {
  try {
    const result = await runMigrations();
    if (!result.success) throw result.error;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await closeKnex();
  }
}

main();
