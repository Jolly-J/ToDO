/**
 * 运行时配置解析器
 *
 * 负责读取环境变量并归一化端口、路径、日志等级等配置项。
 */
const path = require('node:path');
const { loadEnv } = require('../bootstrap/env');

loadEnv();

function resolvePort(value, fallback = 8344) {
  const normalized = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function resolveLogLevel(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'error' || normalized === 'warn' || normalized === 'info') {
    return normalized;
  }

  return 'info';
}

function resolveBoolean(value, fallback = false) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolveBaseUrl(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }

  return normalized.replace(/\/+$/, '');
}

function createConfig() {
  const rootDir = path.resolve(__dirname, '../../..');
  const frontendDistDir = process.env.FRONTEND_DIST_DIR
    ? path.resolve(process.env.FRONTEND_DIST_DIR)
    : path.join(rootDir, 'client', 'dist');

  return {
    appName: process.env.APP_NAME || 'taskflow',
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: (process.env.NODE_ENV || 'development') === 'production',
    port: resolvePort(process.env.PORT || process.env.SERVER_PORT),
    dbPath: process.env.DB_PATH ? path.resolve(rootDir, process.env.DB_PATH) : path.join(rootDir, 'server', 'data', 'taskflow.db'),
    frontendDistDir,
    appBaseUrl: resolveBaseUrl(process.env.APP_BASE_URL),
    imageBedApiKey: String(process.env.IMAGE_BED_API_KEY || '').trim(),
    imageBedApiUrl: resolveBaseUrl(process.env.IMAGE_BED_API_URL || 'https://api.superbed.cn'),
    logLevel: resolveLogLevel(process.env.LOG_LEVEL),
    logSlowMs: resolvePort(process.env.LOG_SLOW_MS, 1200),
    trustProxy: resolveBoolean(process.env.TRUST_PROXY, true),
    dingtalkSyncCron: String(process.env.DINGTALK_SYNC_CRON || '36 9 * * *').trim(),
    dingtalkAutoSyncEnabled: resolveBoolean(process.env.DINGTALK_AUTO_SYNC_ENABLED, true),
  };
}

module.exports = {
  createConfig,
  resolvePort,
};
