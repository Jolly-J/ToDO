/**
 * Auth 鉴权中间件
 *
 * 1. 解析 Authorization: Bearer <token>
 * 2. 校验 JWT，加载当前用户
 * 3. 拦截失活用户
 * 4. 注入 req.user
 */

const jwtUtil = require('../utils/jwt');
const { error } = require('../utils/response');
const userDao = require('../db/userDao');

/**
 * 鉴权中间件 — 受保护路由必须挂载
 */
function auth(req, res, next) {
  // 1. 提取 token
  const token = jwtUtil.extractBearerToken(req.headers.authorization);

  if (!token) {
    return error(res, 'UNAUTHORIZED');
  }

  // 2. 校验 JWT
  let payload;

  try {
    payload = jwtUtil.verify(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'TOKEN_EXPIRED');
    }

    return error(res, 'TOKEN_INVALID');
  }

  // 3. 加载当前用户
  const userId = payload.sub;
  const user = userDao.findById(userId);

  if (!user) {
    return error(res, 'USER_NOT_FOUND', '用户不存在');
  }

  // 4. 检查用户状态
  if (user.status !== 1) {
    return error(res, 'USER_DISABLED');
  }

  // 5. 注入 req.user
  req.user = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    job_number: user.job_number,
    department_id: user.department_id,
    department_name: user.department_name,
    is_dept_manager: user.is_dept_manager,
    status: user.status,
  };

  next();
}

/**
 * 可选鉴权 — 有 token 则解析，无 token 不拦截
 */
function optionalAuth(req, res, next) {
  const token = jwtUtil.extractBearerToken(req.headers.authorization);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwtUtil.verify(token);
    const user = userDao.findById(payload.sub);

    if (user && user.status === 1) {
      req.user = {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        job_number: user.job_number,
        department_id: user.department_id,
        department_name: user.department_name,
        is_dept_manager: user.is_dept_manager,
        status: user.status,
      };
    } else {
      req.user = null;
    }
  } catch (_err) {
    req.user = null;
  }

  next();
}

module.exports = {
  auth,
  optionalAuth,
};
