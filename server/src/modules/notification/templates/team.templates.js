/**
 * 团队域通知模板
 *
 * 定义团队创建、管理员变更和解散场景的通知内容。
 */
const { formatActionCard } = require('./format');

module.exports = [
  {
    code: 'team_broadcast_v2',
    render(variables) {
      const actorName = variables.actorName || '系统';
      let summary = `${actorName} 更新了团队`;
      let buttonText = '查看团队';
      let buttonUrl;

      if (variables.eventType === 'team.created') {
        summary = `${actorName} 创建了团队，你已被加入`;
      } else if (variables.eventType === 'team.admin_changed') {
        if (variables.changeType === 'granted') {
          summary = `${actorName} 授予了你管理员权限`;
        } else if (variables.changeType === 'revoked') {
          summary = `${actorName} 移除了你的管理员权限`;
        }
      } else if (variables.eventType === 'team.dissolved') {
        summary = `${actorName} 解散了团队`;
        buttonText = '';
        buttonUrl = '';
      }

      return {
        robot: formatActionCard({
          title: variables.teamName,
          summary,
          fields: [],
          buttonText,
          buttonUrl,
        }),
      };
    },
  },
];
