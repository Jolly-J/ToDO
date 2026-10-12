/**
 * 服务启动入口
 *
 * 流程：
 * 1. 执行数据库初始化（迁移 + 种子数据）
 * 2. 启动 HTTP 服务
 */

const { startServer } = require('../app');
const logger = require('../utils/logger');
const { initDb } = require('../db/initDb');
const notificationOrchestrator = require('../modules/notification/notification.orchestrator');
const notificationScheduler = require('../modules/notification/notification.scheduler');
const notificationAggregation = require('../modules/notification/notification.aggregation');
const reminderScanner = require('../modules/notification/reminder.scanner');
const teamGroupReminderScanner = require('../modules/teamGroupReminder/teamGroupReminder.scanner');
const dingtalkBroadcastService = require('../modules/dingtalkBroadcast/dingtalkBroadcast.service');
const dingtalkSyncScheduler = require('../modules/dingtalk/dingtalk.sync.scheduler');

async function bootstrap() {
  try {
    // 0. 校验 JWT 密钥配置
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'taskflow-jwt-secret-change-in-production') {
      throw new Error('JWT_SECRET 环境变量未设置或使用了默认值，请在生产环境中设置安全的密钥');
    }

    // 1. 初始化数据库（迁移 + 种子）
    await initDb();

    // 2. 初始化通知编排层（注册 EventBus 监听）
    notificationOrchestrator.init();
    notificationAggregation.start();
    dingtalkBroadcastService.resumePendingRecords();

    // 3. 启动 HTTP 服务
    const server = await startServer();
    const port = server.address()?.port;

    // 4. 启动通知定时任务（临期/逾期扫描）
    notificationScheduler.start();

    // 5. 启动任务提醒扫描器
    reminderScanner.start();

    // 6. 启动团队群聊机器人每日提醒扫描器
    teamGroupReminderScanner.start();

    // 7. 启动钉钉组织与人员定时自动同步调度器
    dingtalkSyncScheduler.start();

    server.on('error', (error) => {
      logger.error('服务运行异常', {
        action: 'system.shutdown',
        error: { message: error.message },
      });
    });

    // 汇总启动信息
    const { getAllEventTypes } = require('../modules/notification/notification.rules');
    logger.info('服务就绪', {
      action: 'system.start',
      port,
      registeredEvents: getAllEventTypes().length,
    });
  } catch (error) {
    logger.error('服务启动失败', {
      action: 'system.start',
      error: { message: error.message, stack: error.stack },
    });
    process.exitCode = 1;
  }
}

bootstrap();
