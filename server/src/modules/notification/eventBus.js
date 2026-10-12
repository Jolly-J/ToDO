/**
 * 领域事件总线
 *
 * 基于 Node.js EventEmitter 的单例事件总线，用于业务模块与通知模块解耦。
 * 业务模块在操作成功后 emit 标准领域事件，NotificationOrchestrator 监听并编排通知。
 *
 * 事件命名规范：domain.action（如 task.created、team.dissolved）
 */

const { EventEmitter } = require('node:events');
const logger = require('../../utils/logger');

const bus = new EventEmitter();

// 避免监听器过多时的警告（通知系统会注册多个事件监听）
bus.setMaxListeners(50);

/**
 * 发布领域事件
 *
 * @param {string} eventType - 事件类型，如 'task.created'
 * @param {object} payload - 标准化事件载荷
 * @param {string} payload.bizType - 'task' | 'team' | 'admin'
 * @param {string} payload.bizId - 业务实体 ID
 * @param {string} payload.actorId - 操作人 ID
 * @param {object} payload.data - 事件相关业务数据
 * @param {string} [payload.reqId] - 请求追踪 ID
 */
function emit(eventType, payload) {
  try {
    bus.emit(eventType, { ...payload, eventType });
  } catch (error) {
    logger.error('EventBus emit 失败', {
      action: 'eventbus.emit.error',
      eventType,
      bizId: payload?.bizId,
      error: error.message,
    });
  }
}

/**
 * 监听领域事件
 *
 * @param {string} eventType - 事件类型
 * @param {function} handler - 处理函数
 */
function on(eventType, handler) {
  bus.on(eventType, handler);
}

/**
 * 监听所有事件（通配符模式，用于 orchestrator 统一入口）
 * 由于 EventEmitter 不支持通配符，这里提供批量注册的便捷方法
 *
 * @param {string[]} eventTypes - 事件类型列表
 * @param {function} handler - 统一处理函数
 */
function onMany(eventTypes, handler) {
  for (const eventType of eventTypes) {
    bus.on(eventType, handler);
  }
}

module.exports = {
  emit,
  on,
  onMany,
};
