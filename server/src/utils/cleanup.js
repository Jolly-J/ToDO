/**
 * 附件清理定时任务
 *
 * 定期清理孤立附件（未关联评论的评论附件）
 */

const { commentAttachmentDao } = require('../db/commentDao');
const logger = require('./logger');

// 清理间隔（毫秒）
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1小时

// 孤立附件保留时长（小时）
const ORPHAN_THRESHOLD_HOURS = 24;

// 定时任务引用
let cleanupTimer = null;

/**
 * 执行孤立附件清理
 */
function runCleanup() {
  try {
    const count = commentAttachmentDao.cleanupOrphaned(ORPHAN_THRESHOLD_HOURS);
    if (count > 0) {
      logger.info('孤立附件清理完成', {
        action: 'cleanup.attachments',
        deletedCount: count,
      });
    }
  } catch (err) {
    logger.error('孤立附件清理失败', {
      action: 'cleanup.attachments',
      error: err.message,
    });
  }
}

/**
 * 启动定时清理任务
 */
function startCleanupScheduler() {
  if (cleanupTimer) {
    logger.warn('清理任务已在运行', { action: 'cleanup.scheduler' });
    return;
  }

  // 启动时先执行一次清理
  runCleanup();

  // 注册定时任务
  cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  logger.info('附件清理定时任务已启动', {
    action: 'cleanup.scheduler',
    intervalHours: CLEANUP_INTERVAL_MS / (60 * 60 * 1000),
    thresholdHours: ORPHAN_THRESHOLD_HOURS,
  });
}

/**
 * 停止定时清理任务
 */
function stopCleanupScheduler() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    logger.info('附件清理定时任务已停止', { action: 'cleanup.scheduler' });
  }
}

module.exports = {
  startCleanupScheduler,
  stopCleanupScheduler,
  runCleanup,
  CLEANUP_INTERVAL_MS,
  ORPHAN_THRESHOLD_HOURS,
};