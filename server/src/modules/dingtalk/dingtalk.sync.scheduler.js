/**
 * 钉钉组织与人员定时自动同步调度器
 *
 * 功能：
 * - 读取配置中的 Cron 表达式（默认为每天上海时间 09:36 即 '36 9 * * *'）
 * - 严格按照 Asia/Shanghai 时区执行
 * - 支持防重入互斥锁，避免并发重复触发
 * - 自动记录审计与系统日志
 */

const cron = require('node-cron');
const { createConfig } = require('../../config');
const { syncOrganization } = require('./dingtalk.routes');
const logger = require('../../utils/logger');
const { auditDingtalkEvent } = require('../../utils/businessLogger');

let scheduledTask = null;
let isSyncing = false;

/**
 * 执行一次自动同步
 */
async function runAutoSync() {
  if (isSyncing) {
    logger.warn('上一次自动钉钉同步仍在进行中，跳过本次执行', {
      action: 'org.sync.auto.skip',
    });
    return;
  }

  isSyncing = true;
  const startedAt = Date.now();
  const reqId = `auto-sync-${Date.now()}`;
  const operatorId = 'system:auto-sync';

  logger.info('触发钉钉人员自动定时同步', {
    action: 'org.sync.auto.start',
    reqId,
    operatorId,
  });

  try {
    const result = await syncOrganization(reqId, operatorId);
    const syncResult = result.failedDepartmentsCount > 0 ? 'partial' : 'success';

    auditDingtalkEvent({
      action: 'org.sync',
      reqId,
      result: syncResult,
      level: syncResult === 'partial' ? 'warn' : 'info',
      durationMs: Date.now() - startedAt,
      operatorId,
      ...result,
    });

    logger.info('钉钉人员自动定时同步成功', {
      action: 'org.sync.auto.success',
      reqId,
      departmentsSynced: result.departmentsSynced,
      usersSynced: result.usersSynced,
      usersDisabled: result.usersDisabled,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error('钉钉人员自动定时同步异常', {
      action: 'org.sync.auto.error',
      reqId,
      error: error.message,
      durationMs: Date.now() - startedAt,
    });

    auditDingtalkEvent({
      action: 'org.sync',
      reqId,
      result: 'failed',
      level: 'error',
      durationMs: Date.now() - startedAt,
      operatorId,
      errorCode: 'EXTERNAL_SERVICE_ERROR',
      errorMessage: error.message,
    });
  } finally {
    isSyncing = false;
  }
}

/**
 * 启动调度器
 */
function start() {
  if (scheduledTask) {
    return;
  }

  const config = createConfig();

  if (!config.dingtalkAutoSyncEnabled) {
    logger.info('钉钉人员自动同步功能已在配置中禁用', {
      action: 'org.sync.auto.disabled',
    });
    return;
  }

  const cronExpression = config.dingtalkSyncCron || '36 9 * * *';

  if (!cron.validate(cronExpression)) {
    logger.error('钉钉人员自动同步 Cron 表达式无效，无法启动调度器', {
      action: 'org.sync.auto.invalid_cron',
      cron: cronExpression,
    });
    return;
  }

  scheduledTask = cron.schedule(
    cronExpression,
    () => {
      void runAutoSync();
    },
    {
      timezone: 'Asia/Shanghai',
    }
  );

  logger.info('钉钉人员自动定时同步调度器已启动', {
    action: 'org.sync.auto.started',
    cron: cronExpression,
    timezone: 'Asia/Shanghai',
  });
}

/**
 * 停止调度器
 */
function stop() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('钉钉人员自动定时同步调度器已停止', {
      action: 'org.sync.auto.stopped',
    });
  }
}

module.exports = {
  start,
  stop,
  runAutoSync,
};
