/**
 * 前端日志上报路由
 *
 * 接收前端批量上报的日志，写入独立文件
 * 路由: POST /api/logs/frontend
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// 频率控制配置
const RATE_LIMIT = {
  maxBatchSize: 50,       // 单次最大上报条数
  maxRequestSize: '1mb',  // 请求体大小限制
};

/**
 * POST /api/logs/frontend
 * 接收前端批量上报日志
 *
 * Request Body:
 * {
 *   logs: [
 *     { time, level, action, result, reqId, userId, ... }
 *   ]
 * }
 */
router.post('/frontend', (req, res) => {
  const logs = req.body?.logs || [];

  // 校验批量大小
  if (!Array.isArray(logs)) {
    return res.status(400).json({
      code: 40001,
      message: 'logs 必须是数组格式',
      data: null,
    });
  }

  if (logs.length === 0) {
    return res.json({
      code: 0,
      message: 'ok',
      data: { accepted: 0 },
    });
  }

  if (logs.length > RATE_LIMIT.maxBatchSize) {
    return res.status(400).json({
      code: 40001,
      message: `批量上报超过限制（最大${RATE_LIMIT.maxBatchSize}条）`,
      data: { rejected: logs.length },
    });
  }

  // 校验每条日志的基本字段
  const validLogs = [];
  const invalidLogs = [];

  for (const entry of logs) {
    if (!entry.action) {
      invalidLogs.push({ index: logs.indexOf(entry), reason: '缺少 action 字段' });
      continue;
    }
    validLogs.push(entry);
  }

  // 批量写入前端日志文件
  try {
    logger.frontendBatch(validLogs);
  } catch (err) {
    // 写入失败不阻塞，返回部分成功
    console.error('前端日志批量写入失败:', err.message);
  }

  // 返回处理结果
  res.json({
    code: 0,
    message: 'ok',
    data: {
      accepted: validLogs.length,
      rejected: invalidLogs.length,
      rejectedDetails: invalidLogs.length > 0 ? invalidLogs : undefined,
    },
  });
});

/**
 * GET /api/logs/health
 * 日志系统健康检查
 */
router.get('/health', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const LOG_DIR = logger.LOG_DIR;

  const status = {
    logDir: LOG_DIR,
    logDirExists: fs.existsSync(LOG_DIR),
    activeLevel: logger.getLogLevel(),
    files: {},
  };

  // 检查各日志文件状态
  for (const [type, filename] of Object.entries(logger.LOG_FILES)) {
    const filePath = path.join(LOG_DIR, filename);
    const exists = fs.existsSync(filePath);
    status.files[type] = {
      filename,
      exists,
      size: exists ? fs.statSync(filePath).size : 0,
    };
  }

  res.json({
    code: 0,
    message: 'ok',
    data: status,
  });
});

module.exports = router;