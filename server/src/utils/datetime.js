/**
 * 日期时间工具
 *
 * 提供 ISO 8601 格式化、日期比较、超期判断等通用能力
 * 所有时间戳统一存储为标准 UTC ISO（Z 结尾），前端负责转换为本地时区显示
 */
const { isTerminalTaskStatus } = require('../constants/taskStatus');

/**
 * 当前时间标准 UTC ISO
 * @returns {string} 例如 2026-04-13T02:00:00.000Z
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * 当前日期 YYYY-MM-DD（UTC+8，用于纯日期字段如 due_date）
 * @returns {string}
 */
function todayDate() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

/**
 * 转为纯日期 YYYY-MM-DD（UTC+8，用于纯日期字段）
 * @param {string|Date} value
 * @returns {string}
 */
function toDateOnly(value) {
  if (!value) return '';
  const d = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

/**
 * N 天前的标准 UTC ISO
 * @param {number} days
 * @returns {string}
 */
function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * N 天前的纯日期 YYYY-MM-DD（UTC+8）
 * @param {number} days
 * @returns {string}
 */
function daysAgoDate(days) {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000 - days * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

/**
 * 判断任务是否超期
 * @param {{ due_date?: string, status?: string }} task
 * @returns {boolean}
 */
function isOverdue(task) {
  if (!task.due_date || isTerminalTaskStatus(task.status)) return false;
  return task.due_date < todayDate();
}

/**
 * 判断日期字符串是否在 N 天内
 * @param {string} dateStr
 * @param {number} days
 * @returns {boolean}
 */
function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return target >= now - days * 24 * 60 * 60 * 1000;
}

/**
 * 格式化为可读的时间描述（相对时间）
 * @param {string} isoStr
 * @returns {string}
 */
function formatRelative(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return toDateOnly(isoStr);
}

module.exports = {
  nowIso,
  todayDate,
  toDateOnly,
  daysAgo,
  daysAgoDate,
  isOverdue,
  isWithinDays,
  formatRelative,
};
