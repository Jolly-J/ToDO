/**
 * TaskFlow 统一日志系统
 *
 * 功能特性：
 * - 分级日志：error/warn/info/debug
 * - 终端彩色输出（中文友好）
 * - 文件持久化（JSON结构化，UTC+8时区）
 * - 错误堆栈捕获
 * - 中文动作标签映射
 * - 日志分层：
 *     taskflow.log         全量（info + warn + error）
 *     taskflow-error.log   快速定位（warn + error）
 *     taskflow-frontend.log 前端上报
 */

const fs = require('fs');
const path = require('path');
const ACTION_LABELS = require('./actionLabels');

// ==================== 配置常量 ====================

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
let activeLevel = 'info';

const COLORS = {
  error: '\x1b[31m',
  warn:  '\x1b[33m',
  info:  '\x1b[32m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
};

const LOG_DIR = path.resolve(__dirname, '../../..', 'logs');
const LOG_FILES = {
  main:         'taskflow.log',
  notification: 'notification.log',
  error:        'taskflow-error.log',
  frontend:     'taskflow-frontend.log',
};

const NOTIFICATION_CHANNELS = new Set(['notification', 'dingtalk-business']);

const SENSITIVE_KEYS = ['authCode', 'accessToken', 'token', 'secret', 'password', 'Authorization'];

// ==================== 工具函数 ====================

function setLogLevel(level) {
  if (LEVELS[level] !== undefined) activeLevel = level;
}

function canWrite(level) {
  return LEVELS[level] <= LEVELS[activeLevel];
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getActionLabel(action) {
  return ACTION_LABELS[action] || action || '未知操作';
}

function sanitizeMeta(meta = {}) {
  const sanitized = { ...meta };
  for (const key of SENSITIVE_KEYS) {
    if (sanitized[key] !== undefined) sanitized[key] = '[REDACTED]';
  }
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeMeta(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * 返回 UTC+8 的 ISO 格式时间字符串
 * 例：2026-04-07T10:47:44.123+08:00
 */
function nowCst() {
  const now = new Date();
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  // 去掉 Z 和时区后缀，直接显示东八区本地时间
  return local.toISOString().slice(0, 23);
}

/**
 * 从 ISO 字符串截取 "YYYY-MM-DD HH:mm:ss" 用于终端显示
 */
function formatTimestamp(isoStr) {
  return isoStr.slice(0, 19).replace('T', ' ');
}

function formatLevelTag(level) {
  const color = COLORS[level] || '';
  return `${color}${COLORS.bold}[${level.toUpperCase().padEnd(5)}]${COLORS.reset}`;
}

function formatParams(meta) {
  const items = [];

  if (meta.reqId)                          items.push(`reqId=${meta.reqId}`);
  if (meta.userName)                       items.push(`用户=${meta.userName}`);
  if (meta.name && !meta.userName)         items.push(`用户=${meta.name}`);
  if (meta.userId && !meta.userName && !meta.name) items.push(`userId=${meta.userId}`);
  if (meta.taskId)                         items.push(`taskId=${meta.taskId}`);
  if (meta.commentId)                      items.push(`commentId=${meta.commentId}`);
  if (meta.durationMs !== undefined)       items.push(`耗时${meta.durationMs}ms`);
  if (meta.departmentsSynced !== undefined) items.push(`部门${meta.departmentsSynced}`);
  if (meta.usersSynced !== undefined)      items.push(`用户${meta.usersSynced}`);
  if (meta.usersDisabled !== undefined)    items.push(`失活${meta.usersDisabled}`);
  if (meta.failedDepartmentsCount)         items.push(`失败部门${meta.failedDepartmentsCount}`);
  if (meta.error?.message)                 items.push(`error=${meta.error.message.slice(0, 50)}`);
  if (meta.statusCode !== undefined)       items.push(`status=${meta.statusCode}`);
  if (meta.status !== undefined)           items.push(`status=${meta.status}`);
  if (meta.port)                           items.push(`port=${meta.port}`);
  if (meta.env)                            items.push(`env=${meta.env}`);
  if (meta.method)                         items.push(`method=${meta.method}`);
  if (meta.path)                           items.push(`path=${meta.path}`);

  const boolFields = ['hasClientId', 'hasClientSecret', 'hasQrClientId', 'hasInternalAppKey'];
  for (const key of boolFields) {
    if (meta[key] === true) items.push(key.replace(/([A-Z])/g, (m) => m.toLowerCase()));
  }

  if (items.length === 0) {
    const skipKeys = new Set(['time', 'level', 'message', 'action', 'actionLabel', 'channel', 'ip', 'bodyKeys']);
    for (const [key, value] of Object.entries(meta)) {
      if (skipKeys.has(key) || value == null || typeof value === 'object') continue;
      items.push(`${key}=${String(value).slice(0, 30)}`);
      if (items.length >= 3) break;
    }
  }

  return items.length > 0 ? items.join(', ') : '-';
}

function formatTerminalOutput(level, payload) {
  const timestamp = formatTimestamp(payload.time);
  const levelTag = formatLevelTag(level);
  const actionLabel = payload.actionLabel || getActionLabel(payload.action);
  const result = payload.result || '';
  const paramsStr = formatParams(payload);

  let output;
  if (result) {
    output = `${COLORS.dim}${timestamp}${COLORS.reset} ${levelTag} [${actionLabel}] ${result} | ${paramsStr}`;
  } else {
    output = `${COLORS.dim}${timestamp}${COLORS.reset} ${levelTag} [${actionLabel}]${paramsStr !== '-' ? ' | ' + paramsStr : ''}`;
  }

  if (level === 'error' && payload.error?.stack) {
    const stackLines = payload.error.stack.split('\n').slice(0, 3);
    output += `\n${COLORS.dim}${stackLines.map(l => '  ' + l.trim()).join('\n')}${COLORS.reset}`;
  }

  return output;
}

function writeToFile(filename, line) {
  ensureLogDir();
  try {
    fs.appendFileSync(path.join(LOG_DIR, filename), line + '\n', 'utf8');
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`日志文件写入失败: ${err.message}`);
    }
  }
}

// ==================== 核心写入 ====================

function write(level, message, meta = {}) {
  if (!canWrite(level)) return;

  const time = nowCst();
  const payload = { time, level, message, ...sanitizeMeta(meta) };

  if (payload.action) {
    payload.actionLabel = getActionLabel(payload.action);
  }

  if (level === 'error' && meta.error instanceof Error) {
    payload.error = {
      message: meta.error.message,
      stack:   meta.error.stack,
      code:    meta.error.code,
    };
  }

  // 终端输出
  const terminalLine = formatTerminalOutput(level, payload);
  if (level === 'error') {
    console.error(terminalLine);
  } else if (level === 'warn') {
    console.warn(terminalLine);
  } else {
    console.log(terminalLine);
  }

  // 文件输出（按 channel 路由）
  const isNotification = NOTIFICATION_CHANNELS.has(payload.channel);
  const fileLine = JSON.stringify(payload);

  if (level !== 'debug') {
    writeToFile(isNotification ? LOG_FILES.notification : LOG_FILES.main, fileLine);
  }

  // 错误日志（warn + error，快速定位用）
  if (level === 'error' || level === 'warn') {
    writeToFile(LOG_FILES.error, fileLine);
  }
}

// ==================== 基础日志方法 ====================

function info(message, meta)  { write('info',  message, meta); }
function warn(message, meta)  { write('warn',  message, meta); }
function error(message, meta) { write('error', message, meta); }
function debug(message, meta) { write('debug', message, meta); }

// ==================== 业务日志方法 ====================

function business(action, result, meta = {}) {
  const level = result === 'failed' ? 'error' : 'info';
  write(level, action, { action, result, channel: 'business', ...meta });
}

function frontend(payload) {
  const time = nowCst();
  const sanitizedPayload = sanitizeMeta(payload);
  const {
    time: payloadTime,
    clientTime,
    level,
    action,
    actionLabel: _actionLabel,
    result,
    channel: _channel,
    ...rest
  } = sanitizedPayload;
  const entry = {
    time,
    level:       level || 'info',
    action,
    actionLabel: getActionLabel(action),
    result:      result || 'success',
    channel:     'frontend',
    ...(clientTime || payloadTime ? { clientTime: clientTime || payloadTime } : {}),
    ...rest,
  };

  console.log(formatTerminalOutput(entry.level, entry));
  writeToFile(LOG_FILES.frontend, JSON.stringify(entry));
}

function frontendBatch(entries) {
  for (const entry of entries) frontend(entry);
}

// ==================== 导出 ====================

module.exports = {
  setLogLevel,
  getLogLevel: () => activeLevel,
  info,
  warn,
  error,
  debug,
  business,
  frontend,
  frontendBatch,
  nowCst,
  formatTimestamp,
  getActionLabel,
};
