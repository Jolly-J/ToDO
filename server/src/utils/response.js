/**
 * 统一响应工具
 *
 * 基线文档：docs/backend-foundation/spac.md
 * 所有 API 返回统一结构：{ code, data, message }
 */

/**
 * 成功响应
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message='ok']
 * @param {number} [httpStatus=200]
 */
function success(res, data = null, message = 'ok', httpStatus = 200) {
  return res.status(httpStatus).json({
    code: 0,
    data,
    message,
  });
}

/**
 * 分页成功响应
 * @param {import('express').Response} res
 * @param {{ list: Array, total: number, page: number, pageSize: number }} pagination
 * @param {string} [message='ok']
 */
function paginated(res, pagination, message = 'ok') {
  return res.status(200).json({
    code: 0,
    data: {
      list: pagination.list,
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    },
    message,
  });
}

// ──────────────────────────────────────────
// 错误码定义
// ──────────────────────────────────────────

const ERROR_CODES = {
  // 认证类 (401xx)
  UNAUTHORIZED: { code: 40100, message: '未登录或登录已过期', status: 401 },
  TOKEN_EXPIRED: { code: 40101, message: 'Token 已过期', status: 401 },
  TOKEN_INVALID: { code: 40102, message: 'Token 无效', status: 401 },
  USER_DISABLED: { code: 40103, message: '账号已被禁用', status: 401 },

  // 权限类 (403xx)
  FORBIDDEN: { code: 40300, message: '无权限访问', status: 403 },
  FORBIDDEN_GLOBAL: { code: 40301, message: '缺少系统权限', status: 403 },
  FORBIDDEN_TEAM: { code: 40302, message: '缺少 Team 权限', status: 403 },
  FORBIDDEN_DATA_SCOPE: { code: 40303, message: '超出数据范围', status: 403 },

  // 资源类 (404xx)
  NOT_FOUND: { code: 40400, message: '资源不存在', status: 404 },
  USER_NOT_FOUND: { code: 40401, message: '用户不存在', status: 404 },
  TEAM_NOT_FOUND: { code: 40402, message: 'Team 不存在', status: 404 },
  TASK_NOT_FOUND: { code: 40403, message: '任务不存在', status: 404 },

  // 参数类 (400xx)
  BAD_REQUEST: { code: 40000, message: '请求参数错误', status: 400 },
  MISSING_PARAM: { code: 40001, message: '缺少必要参数', status: 400 },
  INVALID_PARAM: { code: 40002, message: '参数格式不正确', status: 400 },
  DUPLICATE: { code: 40900, message: '数据已存在', status: 409 },

  // 服务器类 (500xx)
  INTERNAL_ERROR: { code: 50000, message: '服务器内部错误', status: 500 },
  DB_ERROR: { code: 50001, message: '数据库操作失败', status: 500 },
  EXTERNAL_SERVICE_ERROR: { code: 50002, message: '外部服务调用失败', status: 500 },
};

/**
 * 发送错误响应
 * @param {import('express').Response} res
 * @param {keyof typeof ERROR_CODES | { code: number, message: string, status: number }} errorType
 * @param {string} [customMessage]
 */
function error(res, errorType, customMessage) {
  const errorDef = typeof errorType === 'string' ? ERROR_CODES[errorType] : errorType;

  if (!errorDef) {
    return res.status(500).json({
      code: 50000,
      data: null,
      message: customMessage || '未知错误',
    });
  }

  return res.status(errorDef.status).json({
    code: errorDef.code,
    data: null,
    message: customMessage || errorDef.message,
  });
}

/**
 * 创建业务异常 (可被 errorHandler 捕获)
 * @param {keyof typeof ERROR_CODES} errorType
 * @param {string} [customMessage]
 * @returns {Error}
 */
function createError(errorType, customMessage) {
  const errorDef = ERROR_CODES[errorType] || ERROR_CODES.INTERNAL_ERROR;
  const err = new Error(customMessage || errorDef.message);
  err.status = errorDef.status;
  err.code = errorDef.code;
  return err;
}

module.exports = {
  success,
  paginated,
  error,
  createError,
  ERROR_CODES,
};
