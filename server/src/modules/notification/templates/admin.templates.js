/**
 * 管理域通知模板
 *
 * 定义管理员权限变更和同步失败场景的通知内容。
 */
const { formatActionCard } = require('./format');

module.exports = [
  {
    code: 'admin_alert_v2',
    render(variables) {
      let summary = '系统管理状态变更';
      let fields = [];

      if (variables.eventType === 'admin.permission_granted') {
        summary = `${variables.actorName || '系统'} 授予了 ${variables.targetUserName || '用户'} 系统管理员权限`;
      } else if (variables.eventType === 'admin.permission_revoked') {
        summary = `${variables.actorName || '系统'} 移除了 ${variables.targetUserName || '用户'} 的系统管理员权限`;
      } else if (variables.eventType === 'admin.sync_failed') {
        summary = '钉钉组织同步失败';
        fields = [{ key: '错误信息', value: variables.errorMessage || '未知错误' }];
      }

      return {
        robot: formatActionCard({
          title: '系统管理通知',
          summary,
          fields,
          buttonText: '查看详情',
        }),
      };
    },
  },
];
