/**
 * 路由注册中心
 *
 * 统一管理所有 API 路由挂载点
 * 基线文档：docs/backend-foundation/design.md
 */

const { error } = require('../utils/response');

const { auth } = require('../middlewares/auth');

// ── 正式业务模块路由 ──
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/user/user.routes');
const departmentRoutes = require('../modules/department/department.routes');
const dingtalkRoutes = require('../modules/dingtalk/dingtalk.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const notificationRoutes = require('../modules/notification/notification.routes');
const attachmentRoutes = require('../modules/attachment/attachment.routes');
const dingtalkBroadcastPublicRoutes = require('../modules/dingtalkBroadcast/dingtalkBroadcast.public.routes');

// ── 日志上报路由 ──
const logsRoutes = require('./logs');

// ── 移动端拦截页点赞路由 ──
const mobileLikesRoutes = require('./mobileLikes');

// ── 现有业务路由 (过渡态) ──
const taskRoutes = require('./tasks');
const taskCollectionRoutes = require('./taskCollections');
const commentRoutes = require('./comments');
const teamRoutes = require('../modules/team/team.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const teamGroupReminderRoutes = require('../modules/teamGroupReminder/teamGroupReminder.routes');

function registerApiRoutes(app) {
  // ──────────────────────────────────────────
  // 公开接口 (无需鉴权)
  // ──────────────────────────────────────────

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({
      code: 0,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
      message: 'ok',
    });
  });

  // 前端日志上报 (无需鉴权)
  app.use('/api/logs', logsRoutes);

  // ActionCard 宣传页使用不可枚举 token 公开访问，不依赖业务端登录态。
  app.use('/p', dingtalkBroadcastPublicRoutes);

  // 移动端拦截页点赞 (无需鉴权)
  app.use('/api/mobile-likes', mobileLikesRoutes);

  // ──────────────────────────────────────────
  // 正式模块
  // ──────────────────────────────────────────

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/dingtalk', dingtalkRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/attachments', attachmentRoutes);

  // ──────────────────────────────────────────
  // 现有业务路由 (过渡态, P3 完成后迁移)
  // ──────────────────────────────────────────

  app.use('/api', auth);
  app.use('/api', taskCollectionRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api', teamRoutes);
  app.use('/api', teamGroupReminderRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // ──────────────────────────────────────────
  // API 兜底 404
  // ──────────────────────────────────────────

  app.use('/api', (_req, res) => {
    error(res, 'NOT_FOUND', '接口不存在');
  });
}

module.exports = {
  registerApiRoutes,
};
