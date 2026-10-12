/**
 * 用户控制器
 */

const { success, paginated, error } = require('../../utils/response');
const userDao = require('../../db/userDao');
const { getDb } = require('../../db/sqlite');

/**
 * GET /api/users — 用户列表 (分页)
 */
function listUsers(req, res) {
  const { keyword, departmentId, status, page, pageSize } = req.query;

  const result = userDao.listUsers({
    keyword,
    departmentId,
    status: status !== undefined ? Number(status) : undefined,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 20,
  });

  return paginated(res, result);
}

/**
 * GET /api/users/:id — 用户详情 (含部门与角色摘要)
 */
function getUserDetail(req, res) {
  const user = userDao.findById(req.params.id);

  if (!user) {
    return error(res, 'USER_NOT_FOUND');
  }

  const db = getDb();

  // 加载角色摘要
  const roles = db.prepare(`
    SELECT gr.code, gr.name, gr.data_scope
    FROM user_global_roles ugr
    JOIN global_roles gr ON ugr.role_id = gr.id
    WHERE ugr.user_id = ?
  `).all(user.id);

  // 加载部门信息
  const departments = db.prepare(`
    SELECT ud.is_primary, d.id, d.name
    FROM user_departments ud
    JOIN departments d ON ud.department_id = d.id
    WHERE ud.user_id = ?
  `).all(user.id);

  return success(res, {
    ...user,
    roles,
    departments,
  });
}

/**
 * PATCH /api/users/me/avatar — 更新当前登录用户的头像及游乐场配置
 */
function updateMyAvatar(req, res) {
  const { avatar, avatarConfig, avatarType } = req.body;

  if (!avatar || typeof avatar !== 'string') {
    return error(res, 'INVALID_PARAMS', '头像内容不能为空');
  }

  const updatedUser = userDao.updateUserAvatar(req.user.id, {
    avatar,
    avatarConfig: avatarConfig || null,
    avatarType: avatarType || 'custom',
  });

  if (!updatedUser) {
    return error(res, 'USER_NOT_FOUND', '用户不存在');
  }

  return success(res, {
    id: updatedUser.id,
    name: updatedUser.name,
    avatar: updatedUser.avatar,
    avatar_type: updatedUser.avatar_type,
    avatar_config: updatedUser.avatar_config,
  });
}

module.exports = {
  listUsers,
  getUserDetail,
  updateMyAvatar,
};
