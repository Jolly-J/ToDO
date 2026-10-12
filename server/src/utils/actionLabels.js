/**
 * TaskFlow 动作中文标签映射表
 *
 * 用于日志输出时将 action 代码转换为中文友好描述
 */

module.exports = {
  // ========== 用户认证类 ==========
  'user.login': '用户登录',
  'user.logout': '用户注销',
  'user.login.success': '登录成功',
  'user.login.failed': '登录失败',
  'user.session.check': '会话校验',
  'user.me': '获取用户信息',
  'auth.login.qr': '扫码登录',
  'auth.login.auto': '免登登录',

  // ========== 任务管理类 ==========
  'task.create': '任务创建',
  'task.update': '任务更新',
  'task.delete': '任务删除',
  'task.restore': '任务恢复',
  'task.share': '任务分享',
  'task.status_change': '任务状态变更',
  'task.move': '任务移动',
  'task.assign': '任务指派',
  'task.detail': '任务详情查询',
  'task.list': '任务列表查询',
  'task.update_status': '任务状态更新',

  // ========== 评论管理类 ==========
  'comment.create': '评论创建',
  'comment.update': '评论更新',
  'comment.delete': '评论删除',
  'comment.list': '评论列表查询',

  // ========== 附件管理类 ==========
  'attachment.upload': '附件上传',
  'attachment.download': '附件下载',
  'attachment.delete': '附件删除',
  'attachment.list': '附件列表查询',

  // ========== 权限管理类 ==========
  'permission.change': '权限变更',
  'permission.check': '权限校验',
  'permission.cache.clear_user': '权限缓存清理',
  'permission.cache.clear_all': '权限缓存全量清理',
  'role.assign': '角色分配',
  'role.remove': '角色移除',
  'dept.manager.set': '设置部门经理',

  // ========== 部门组织类 ==========
  'department.sync': '部门同步',
  'department.list': '部门列表查询',
  'org.sync': '组织同步',
  'org.sync.summary': '组织同步汇总',
  'team.create': '团队创建',
  'team.update': '团队更新',
  'team.delete': '团队删除',
  'team.member.role_change': '团队角色变更',
  'team.member.remove': '团队成员移除',
  'team.member.exit': '退出团队',
  'team.dissolve': '团队解散',

  // ========== 钉钉集成类 ==========
  'dingtalk.auth': '钉钉认证',
  'dingtalk.sync': '钉钉同步',
  'dingtalk.callback': '钉钉回调',
  'dingtalk.notify': '钉钉通知',
  'dingtalk.config': '钉钉配置',
  'dingtalk.auth.access_token': '钉钉应用令牌',
  'dingtalk.auth.qr.token': '扫码登录换取用户令牌',
  'dingtalk.auth.qr.profile': '扫码登录获取用户信息',
  'dingtalk.auth.qr.userid': '扫码登录换取用户ID',
  'dingtalk.auth.auto.userid': '免登换取用户ID',
  'dingtalk.department.list': '钉钉部门列表',
  'dingtalk.department.users': '钉钉部门用户',
  'dingtalk.user.detail': '钉钉用户详情',
  'dingtalk.identity.missing': '钉钉身份缺失',
  'dingtalk.todo.create': '钉钉待办创建',
  'dingtalk.todo.update': '钉钉待办更新',
  'dingtalk.todo.delete': '钉钉待办删除',
  'dingtalk.todo.lifecycle.close': '钉钉待办关闭同步',
  'dingtalk.todo.lifecycle.close_failed': '钉钉待办关闭失败',
  'dingtalk.todo.lifecycle.close_error': '钉钉待办关闭异常',
  'dingtalk.robot.send': '钉钉机器人发送',
  'dingtalk.robot.config_missing': '钉钉机器人配置缺失',
  'dingtalk.work.send': '钉钉工作通知发送',
  'dingtalk.work.config_missing': '钉钉工作通知配置缺失',
  'dingtalk.broadcast.test': '钉钉宣传测试推送',
  'dingtalk.broadcast.all': '钉钉宣传全员推送',
  'dingtalk.broadcast.test.queued': '钉钉测试推送排队',
  'dingtalk.broadcast.all.queued': '钉钉全员推送排队',
  'dingtalk.broadcast.retry.queued': '钉钉失败人员补发排队',
  'dingtalk.broadcast.retry': '钉钉失败人员补发',
  'dingtalk.broadcast.recall.queued': '钉钉消息撤回排队',
  'dingtalk.broadcast.recall': '钉钉消息撤回',
  'dingtalk.broadcast.worker_error': '钉钉推送后台任务异常',
  'dingtalk.robot.recall': '钉钉机器人撤回',

  // ========== 请求生命周期类 ==========
  'request.start': '请求开始',
  'request.complete': '请求完成',
  'request.error': '请求异常',
  'request.client_error': '客户端错误',
  'request.auth_probe': '登录态探测',
  'request.slow': '慢请求',
  'request.timeout': '请求超时',

  // ========== 前端上报类 ==========
  'frontend.login.success': '前端登录成功',
  'frontend.login.failed': '前端登录失败',
  'frontend.task.create.success': '前端任务创建成功',
  'frontend.task.create.failed': '前端任务创建失败',
  'frontend.task.update.success': '前端任务更新成功',
  'frontend.task.update.failed': '前端任务更新失败',
  'frontend.task.delete.success': '前端任务删除成功',
  'frontend.task.delete.failed': '前端任务删除失败',
  'frontend.comment.submit.success': '前端评论提交成功',
  'frontend.comment.submit.failed': '前端评论提交失败',
  'frontend.error.js': '前端JS异常',
  'frontend.error.api': '前端API异常',
  'frontend.error.network': '前端网络异常',
  'frontend.performance': '前端性能上报',

  // ========== 通知调度类 ==========
  'scheduler.start': '通知调度启动',
  'scheduler.due_soon': '临期任务扫描',
  'scheduler.overdue': '逾期任务扫描',
  'scheduler.error': '通知调度异常',
  'notify.task': '任务通知',
  'notify.dispatch.error': '通知派发异常',
  'notify.dispatch.todo': '待办派发',
  'notify.dispatch.robot': '机器人派发',
  'notify.emit.error': '通知事件发布异常',
  'notify.in_app.error': '站内通知写入异常',
  'notify.aggregate.enqueue': '聚合入队',
  'notify.aggregate.flush': '聚合发送',
  'notify.aggregate.flush.error': '聚合发送失败',
  'notify.aggregate.scan.error': '聚合扫描异常',
  'orchestrator.init': '通知编排初始化',
  'orchestrator.event_received': '通知事件接收',
  'orchestrator.complete': '通知编排完成',
  'orchestrator.dispatch.error': '通知编排派发异常',
  'orchestrator.handle.error': '通知编排处理异常',
  'orchestrator.event_exists': '通知事件已存在',
  'orchestrator.no_rule': '通知规则缺失',
  'orchestrator.no_recipients': '通知接收人为空',
  'orchestrator.template_failed': '通知模板渲染失败',
  'orchestrator.jumpurl_missing_base': '通知跳转地址配置缺失',
  'orchestrator.jumpurl_failed': '通知跳转地址生成失败',
  'orchestrator.reassign.close_old_todo': '关闭旧待办',
  'orchestrator.reassign.close_old_todo.error': '关闭旧待办失败',
  'template.render.error': '模板渲染异常',
  'eventbus.emit.error': '事件总线派发异常',
  'reminder.scanner.start': '提醒扫描启动',
  'reminder.fired': '任务提醒触发',
  'reminder.fire.error': '任务提醒失败',
  'reminder.scan.error': '提醒扫描异常',

  // ========== 系统运维类 ==========
  'system.start': '系统启动',
  'system.shutdown': '系统关闭',
  'system.health': '健康检查',
  'system.frontend': '前端托管',
  'system.db.init': '数据库初始化',
  'system.db.backup': '数据库备份',
  'system.db.maintenance': '数据库维护',
  'system.cache.clear': '缓存清理',
  'cleanup.attachments': '附件清理',
  'cleanup.scheduler': '附件清理调度',
  'link.decrypt.failed': '链接令牌解密失败',

  // ========== 数据库迁移类 ==========
  'db.migration.start': '迁移开始',
  'db.migration.complete': '迁移完成',
  'db.migration.file': '迁移文件执行',
  'db.migration.skip': '迁移跳过',
  'db.migration.error': '迁移失败',
  'db.migration.rollback': '迁移回滚',
};

// 扩展函数：动态添加映射
function extendActionLabels(newLabels) {
  const labels = module.exports;
  for (const [action, label] of Object.entries(newLabels)) {
    labels[action] = label;
  }
}

module.exports.extendActionLabels = extendActionLabels;
