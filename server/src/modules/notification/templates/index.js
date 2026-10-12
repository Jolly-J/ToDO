/**
 * 通知模板注册表
 *
 * 统一管理所有通知模板，按 templateCode 索引。
 * 每个模板返回各渠道所需的结构化数据。
 */

const taskTemplates = require('./task.templates');
const teamTemplates = require('./team.templates');
const adminTemplates = require('./admin.templates');
const logger = require('../../../utils/logger');

const TEMPLATES = new Map();

// 注册所有模板
for (const tpl of [...taskTemplates, ...teamTemplates, ...adminTemplates]) {
  TEMPLATES.set(tpl.code, tpl);
}

/**
 * 渲染模板
 *
 * @param {string} templateCode - 模板编码
 * @param {object} variables - 模板变量
 * @returns {object|null} { todo?, robot? }
 */
function renderTemplate(templateCode, variables) {
  const tpl = TEMPLATES.get(templateCode);
  if (!tpl) return null;

  try {
    return tpl.render(variables);
  } catch (error) {
    logger.error('模板渲染异常', {
      action: 'template.render.error',
      channel: 'notification',
      templateCode,
      eventType: variables?.eventType,
      bizId: variables?.bizId,
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  renderTemplate,
};
