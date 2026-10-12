/**
 * 任务参考数据集
 *
 * 提供任务演示所需的用户、团队和附件参考数据访问函数。
 */
const users = [
  { id: 'u1', name: '张三', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan' },
  { id: 'u2', name: '李四', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lisi' },
  { id: 'u3', name: '王五', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangwu' },
  { id: 'u4', name: '赵六', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhaoliu' },
  { id: 'u5', name: '钱七', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=qianqi' },
  { id: 'u6', name: '孙八', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sunba' },
  { id: 'u7', name: '周九', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhoujiu' },
  { id: 'u8', name: '吴十', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wushi' },
  { id: 'u9', name: '郑十一', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=zhengshiyi' },
  { id: 'u10', name: '王十二', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=wangshier' },
];

const teams = [
  { id: 't1', name: '前端开发组' },
  { id: 't2', name: '后端开发组' },
  { id: 't3', name: '产品规划组' },
  { id: 't4', name: '质量保障组' },
  { id: 't5', name: '流程治理组' },
];

const attachments = [
  {
    id: 'att-task21-1',
    task_id: 'task21',
    user_id: 'u1',
    original_name: '方案说明.pdf',
    filename: 'task21-plan.pdf',
    file_size: 4096,
    mime_type: 'application/pdf',
    created_at: '2026-03-19T10:30:00.000Z',
  },
  {
    id: 'att-task21-2',
    task_id: 'task21',
    user_id: 'u9',
    original_name: '节点映射.xlsx',
    filename: 'task21-flow.xlsx',
    file_size: 8192,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    created_at: '2026-03-19T11:15:00.000Z',
  },
  {
    id: 'att-task22-1',
    task_id: 'task22',
    user_id: 'u2',
    original_name: '字段口径说明.md',
    filename: 'task22-metrics.md',
    file_size: 2048,
    mime_type: 'text/markdown',
    created_at: '2026-03-18T16:20:00.000Z',
  },
];

function getUserById(userId) {
  return users.find((user) => user.id === userId) || null;
}

function getTeamById(teamId) {
  return teams.find((team) => team.id === teamId) || null;
}

function listAttachmentsByTaskId(taskId, options = {}) {
  const taskAttachments = attachments
    .filter((attachment) => attachment.task_id === taskId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));

  if (taskAttachments.length > 0 || !options.fallback) {
    return taskAttachments;
  }

  return [
    {
      id: `att-${taskId}-fallback`,
      task_id: taskId,
      user_id: 'u1',
      original_name: '任务说明.txt',
      filename: `${taskId}-note.txt`,
      file_size: 1024,
      mime_type: 'text/plain',
      created_at: '2026-03-19T12:00:00.000Z',
    },
  ];
}

function getAttachmentById(attachmentId) {
  const attachment = attachments.find((item) => item.id === attachmentId);

  if (attachment) {
    return attachment;
  }

  const fallbackMatch = /^att-(.+)-fallback$/.exec(String(attachmentId));

  if (!fallbackMatch) {
    return null;
  }

  const taskId = fallbackMatch[1];
  return listAttachmentsByTaskId(taskId, { fallback: true }).find((item) => item.id === attachmentId) || null;
}

module.exports = {
  getAttachmentById,
  getTeamById,
  getUserById,
  listAttachmentsByTaskId,
};
