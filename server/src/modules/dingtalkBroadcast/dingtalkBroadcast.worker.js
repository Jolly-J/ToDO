/** 进程内调度器：实际状态持久化在 SQLite，进程重启后可恢复未完成任务。 */

const logger = require('../../utils/logger');

const activeSends = new Set();
const activeRecalls = new Set();

function schedule(activeSet, recordId, handlerName) {
  if (!recordId || activeSet.has(recordId)) return;
  activeSet.add(recordId);
  setImmediate(async () => {
    try {
      const service = require('./dingtalkBroadcast.service');
      await service[handlerName](recordId);
    } catch (error) {
      logger.error('钉钉宣传推送后台任务异常', {
        action: 'dingtalk.broadcast.worker_error',
        recordId,
        handlerName,
        error: error.message,
      });
    } finally {
      activeSet.delete(recordId);
    }
  });
}

function scheduleSend(recordId) {
  schedule(activeSends, recordId, 'processSendRecord');
}

function scheduleRecall(recordId) {
  schedule(activeRecalls, recordId, 'processRecallRecord');
}

module.exports = {
  scheduleRecall,
  scheduleSend,
};
