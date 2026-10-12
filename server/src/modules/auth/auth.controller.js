/**
 * 认证控制器
 */

const { success, error } = require('../../utils/response');
const authService = require('./auth.service');
const dingtalkService = require('../dingtalk/dingtalk.service');
const logger = require('../../utils/logger');
const { auditDingtalkEvent } = require('../../utils/businessLogger');

function createLoginError({ code, message, httpStatus = 500, logLevel = 'error' }) {
  const error = new Error(message);
  error.code = code;
  error.httpStatus = httpStatus;
  error.logLevel = logLevel;
  return error;
}

function logUserDetailFallback(userid, err) {
  logger.warn('获取钉钉用户详情失败，已降级使用基础信息', {
    action: 'dingtalk.user.detail',
    userid,
    errcode: err?.providerCode,
    errmsg: err?.providerMessage,
    subcode: err?.providerSubCode,
    submsg: err?.providerSubMessage,
  });
}

async function executeQrLogin(req) {
  const { authCode } = req.body;
  logger.debug('收到钉钉扫码登录请求', {
    action: 'auth.login.qr',
    hasAuthCode: Boolean(authCode),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  if (!authCode) {
    throw createLoginError({
      code: 'MISSING_PARAM',
      message: '缺少 authCode',
      httpStatus: 400,
      logLevel: 'warn',
    });
  }

  const { accessToken } = await dingtalkService.getUserTokenByCode(authCode);
  const userInfo = await dingtalkService.getUserInfoByToken(accessToken);
  const userid = await dingtalkService.getUserIdByUnionId(userInfo.unionId);

  let detail = {};
  try {
    detail = await dingtalkService.getUserDetailById(userid, { logFailure: false });
  } catch (err) {
    logUserDetailFallback(userid, err);
  }

  const result = authService.handleLogin({
    userid,
    name: detail.name || userInfo.nick || '',
    avatar: detail.avatar || userInfo.avatarUrl || '',
    unionid: userInfo.unionId,
    openid: userInfo.openId,
    job_number: detail.job_number || '',
    mobile: detail.mobile || '',
    email: detail.email || '',
    department_id: detail.dept_id_list?.[0]?.toString() || '',
    department_name: '',
  });

  return {
    action: 'auth.login.qr',
    payload: result,
    userId: userid,
  };
}

async function executeInternalLogin(req) {
  const { authCode } = req.body;
  logger.debug('收到钉钉免登请求', {
    action: 'auth.login.auto',
    hasAuthCode: Boolean(authCode),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  if (!authCode) {
    throw createLoginError({
      code: 'MISSING_PARAM',
      message: '缺少 authCode',
      httpStatus: 400,
      logLevel: 'warn',
    });
  }

  const userid = await dingtalkService.getUserIdByCode(authCode);
  let detail = {};
  try {
    detail = await dingtalkService.getUserDetailById(userid, { logFailure: false });
  } catch (err) {
    logUserDetailFallback(userid, err);
  }

  const result = authService.handleLogin({
    userid,
    name: detail.name || '',
    avatar: detail.avatar || '',
    job_number: detail.job_number || '',
    mobile: detail.mobile || '',
    email: detail.email || '',
    department_id: detail.dept_id_list?.[0]?.toString() || '',
    department_name: '',
  });

  return {
    action: 'auth.login.auto',
    payload: result,
    userId: userid,
  };
}

/**
 * POST /api/auth/dingtalk/login — 统一钉钉登录入口
 */
async function dingtalkLogin(req, res, next) {
  const startedAt = Date.now();
  const loginType = String(req.body?.type || '').trim().toLowerCase();
  const isQr = loginType === 'qr';
  const action = isQr ? 'auth.login.qr' : 'auth.login.auto';

  try {
    const loginResult = isQr ? await executeQrLogin(req) : await executeInternalLogin(req);

    auditDingtalkEvent({
      action: loginResult.action,
      reqId: req.requestId,
      result: 'success',
      durationMs: Date.now() - startedAt,
      userId: loginResult.userId,
      ip: req.ip,
    });

    return success(res, loginResult.payload);
  } catch (err) {
    const level = err.logLevel === 'warn' ? 'warn' : 'error';
    logger[level](isQr ? '钉钉扫码登录失败' : '钉钉免登失败', {
      action,
      error: err.message,
      reqId: req.requestId,
    });

    auditDingtalkEvent({
      action,
      reqId: req.requestId,
      result: 'failed',
      level,
      durationMs: Date.now() - startedAt,
      errorCode: err.code || 'EXTERNAL_SERVICE_ERROR',
      errorMessage: err.message,
      ip: req.ip,
    });

    if (err.code === 'MISSING_PARAM') {
      return error(res, 'MISSING_PARAM', '缺少 authCode');
    }

    if (err.code === 'USER_NOT_REGISTERED' || err.code === 'USER_DISABLED') {
      return error(res, err.code, err.message);
    }

    return error(res, 'EXTERNAL_SERVICE_ERROR', (isQr ? '钉钉登录失败: ' : '钉钉免登失败: ') + err.message);
  }
}

/**
 * POST /api/auth/dingtalk/auto-login — 钉钉内免登
 */
async function dingtalkAutoLogin(req, res, next) {
  req.body = {
    ...(req.body || {}),
    type: 'internal',
  };
  return dingtalkLogin(req, res, next);
}

/**
 * GET /api/auth/me — 恢复当前用户
 */
function me(req, res) {
  const currentUser = authService.getCurrentUser(req.user.id);

  if (!currentUser) {
    return error(res, 'USER_NOT_FOUND');
  }

  return success(res, currentUser.user || currentUser);
}

/**
 * POST /api/auth/logout — 注销
 */
function logout(req, res) {
  return success(res, null, '已注销');
}

module.exports = {
  dingtalkLogin,
  dingtalkAutoLogin,
  me,
  logout,
};
