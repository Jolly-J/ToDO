/** 附件写入共用任务授权；路由落盘之前和 DAO 写入之前均验证。 */
const taskDao = require('../../db/taskDao');
const { isShareReadonlyAccess } = require('../notification/shareReadonlyRegistry');

function assertTaskWritable(taskId, userId) {
  const task = taskId && taskDao.findById(taskId, { includeDeleted: true });
  let status;
  let message;
  if (!task || taskDao.isTaskDeleted(task)) { status = 404; message = '任务不存在'; }
  else if (!taskDao.canUserAccessVisibleTask(task, userId) || !taskDao.isTaskRelatedOrAdmin(task, userId) || isShareReadonlyAccess(userId, taskId)) { status = 403; message = '无权限修改该任务附件'; }
  else if (task.status === 'canceled') { status = 409; message = '已取消任务不允许修改附件'; }
  if (status) {
    const error = new Error(message);
    error.status = status;
    error.code = status * 100 + 1;
    throw error;
  }
  return task;
}

function canReadTaskAttachments(task, userId) {
  if (!task || !userId) return false;
  if (taskDao.isTaskDeleted(task)) return task.deleted_by === userId;
  return taskDao.canUserAccessVisibleTask(task, userId) && taskDao.isTaskRelatedOrAdmin(task, userId);
}

module.exports = { assertTaskWritable, canReadTaskAttachments };
