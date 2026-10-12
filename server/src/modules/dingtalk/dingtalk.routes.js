/**
 * 钉钉同步路由与控制器
 */

const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const { success, error } = require('../../utils/response');
const dingtalkService = require('./dingtalk.service');
const userDao = require('../../db/userDao');
const departmentDao = require('../../db/departmentDao');
const userIdentityDao = require('../../db/userIdentityDao');
const userDepartmentDao = require('../../db/userDepartmentDao');
const { getDb } = require('../../db/sqlite');
const logger = require('../../utils/logger');
const { auditDingtalkEvent } = require('../../utils/businessLogger');

const router = Router();

// ── 异步同步任务内存存储 ──
// key: jobId, value: SyncJob
// 进程重启后清空，无需持久化
const syncJobs = new Map();

/**
 * @typedef {{ jobId: string, status: 'running'|'done'|'failed', startedAt: string, finishedAt?: string, result?: object, error?: string }} SyncJob
 */

function createJob() {
  const jobId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    jobId,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  syncJobs.set(jobId, job);
  // 1小时后自动清理，防止内存泄漏
  setTimeout(() => syncJobs.delete(jobId), 60 * 60 * 1000);
  return job;
}

router.get('/jsapi/sign', auth, async (req, res) => {
  const targetUrl = String(req.query.url || '').trim();
  if (!targetUrl) {
    return error(res, 'MISSING_PARAM', '缺少 url 参数');
  }

  try {
    const signedPayload = await dingtalkService.getJsapiSignature(targetUrl);
    return success(res, signedPayload);
  } catch (err) {
    logger.error('生成钉钉 JSAPI 签名失败', {
      action: 'dingtalk.jsapi.sign',
      error: err instanceof Error ? err.message : String(err),
    });
    return error(
      res,
      'EXTERNAL_SERVICE_ERROR',
      err instanceof Error ? err.message : '生成钉钉 JSAPI 签名失败'
    );
  }
});

function buildSyncDeps(overrides = {}) {
  return {
    dingtalkService,
    userDao,
    departmentDao,
    userIdentityDao,
    userDepartmentDao,
    getDb,
    logger,
    auditDingtalkEvent,
    ...overrides,
  };
}

/**
 * POST /api/dingtalk/sync — 触发组织同步（异步，立即返回 jobId）
 * 临时管理员判断 (P2 后切换到正式权限)
 */
router.post('/sync', auth, async (req, res) => {
  const startedAt = Date.now();

  try {
    const db = getDb();
    const userRoles = db.prepare(`
      SELECT gr.code FROM user_global_roles ugr
      JOIN global_roles gr ON ugr.role_id = gr.id
      WHERE ugr.user_id = ?
    `).all(req.user.id);

    const isAdmin = userRoles.some(r => r.code === 'super_admin');

    if (!isAdmin) {
      auditDingtalkEvent({
        action: 'org.sync',
        reqId: req.requestId,
        result: 'failed',
        level: 'warn',
        errorCode: 'FORBIDDEN',
        durationMs: Date.now() - startedAt,
        operatorId: req.user.id,
      });
      return error(res, 'FORBIDDEN', '仅管理员可执行同步');
    }

    const job = createJob();

    // 后台异步执行，不阻塞响应
    syncOrganization(req.requestId, req.user.id)
      .then((result) => {
        const syncResult = result.failedDepartmentsCount > 0 ? 'partial' : 'success';
        job.status = 'done';
        job.finishedAt = new Date().toISOString();
        job.result = result;
        auditDingtalkEvent({
          action: 'org.sync',
          reqId: req.requestId,
          result: syncResult,
          level: syncResult === 'partial' ? 'warn' : 'info',
          durationMs: Date.now() - startedAt,
          operatorId: req.user.id,
          ...result,
        });
      })
      .catch((err) => {
        job.status = 'failed';
        job.finishedAt = new Date().toISOString();
        job.error = err.message;
        logger.error('组织同步失败', { action: 'org.sync', error: err.message });
        auditDingtalkEvent({
          action: 'org.sync',
          reqId: req.requestId,
          result: 'failed',
          level: 'error',
          durationMs: Date.now() - startedAt,
          operatorId: req.user.id,
          errorCode: 'EXTERNAL_SERVICE_ERROR',
          errorMessage: err.message,
        });
      });

    return success(res, { jobId: job.jobId, status: job.status }, '同步已启动');
  } catch (err) {
    logger.error('启动同步任务失败', { action: 'org.sync', error: err.message });
    return error(res, 'EXTERNAL_SERVICE_ERROR', '启动同步失败: ' + err.message);
  }
});

/**
 * GET /api/dingtalk/sync/status/:jobId — 查询同步任务状态
 */
router.get('/sync/status/:jobId', auth, (req, res) => {
  const job = syncJobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({ code: 40401, message: '任务不存在或已过期' });
  }

  return success(res, {
    jobId: job.jobId,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
    result: job.result || null,
    error: job.error || null,
  });
});

/**
 * T01.06 组织同步服务
 * 递归同步部门、分页同步用户、失活标记
 */
async function syncOrganization(reqId, operatorId, deps = buildSyncDeps()) {
  return syncOrganizationWithDeps(reqId, operatorId, deps);
}

async function syncOrganizationWithDeps(reqId, operatorId, deps) {
  const startedAt = Date.now();
  const stats = {
    departmentsSynced: 0,
    usersSynced: 0,
    usersDisabled: 0,
    failedDepartments: [],
    failedDepartmentsCount: 0,
  };

  // 1. 递归同步部门
  const syncedDeptIds = new Set();
  await syncDepartmentsRecursive('1', null, syncedDeptIds, stats, deps);

  // 2. 同步每个部门的用户
  const syncedUserIds = new Set();

  for (const deptId of syncedDeptIds) {
    try {
      await syncDepartmentUsers(deptId, syncedUserIds, stats, deps);
    } catch (error) {
      stats.failedDepartments.push({
        departmentId: String(deptId),
        message: error.message,
        providerCode: error.providerCode || error.code || null,
        providerMessage: error.providerMessage || null,
      });
      deps.logger.warn('部门用户同步失败，已跳过该部门', {
        action: 'org.sync',
        departmentId: String(deptId),
        error: error.message,
        providerCode: error.providerCode || error.code || null,
        providerMessage: error.providerMessage || null,
      });
    }
  }
  stats.failedDepartmentsCount = stats.failedDepartments.length;

  // 3. 失活标记
  const db = deps.getDb();
  if (stats.failedDepartmentsCount > 0 || syncedUserIds.size === 0) {
    deps.logger.warn('存在失败部门或未同步到任何用户，已跳过失活标记', {
      action: 'org.sync.summary',
      failedDepartmentsCount: stats.failedDepartmentsCount,
      syncedUserCount: syncedUserIds.size,
    });
  } else {
    const localSyncedUsers = db.prepare(`
      SELECT DISTINCT u.id
      FROM users u
      JOIN user_identities ui ON ui.user_id = u.id AND ui.provider = 'dingtalk'
      WHERE u.status = 1
    `).all().map(u => u.id);

    const usersToDisable = localSyncedUsers.filter(id => !syncedUserIds.has(id));

    if (usersToDisable.length > 0) {
      stats.usersDisabled = deps.userDao.disableUsers(usersToDisable);
    }
  }

  deps.auditDingtalkEvent({
    action: 'org.sync.summary',
    reqId,
    result: stats.failedDepartmentsCount > 0 ? 'partial' : 'success',
    level: stats.failedDepartmentsCount > 0 ? 'warn' : 'info',
    durationMs: Date.now() - startedAt,
    operatorId,
    ...stats,
  });

  deps.logger.info('组织同步完成', {
    action: 'org.sync.summary',
    ...stats,
  });
  return stats;
}

async function syncDepartmentsRecursive(parentId, parentLocalId, syncedDeptIds, stats, deps) {
  const departments = await deps.dingtalkService.getDepartmentList(parentId);

  for (const dept of departments) {
    const deptId = String(dept.dept_id);
    syncedDeptIds.add(deptId);

    deps.departmentDao.upsertDepartment({
      id: deptId,
      name: dept.name,
      parent_id: parentLocalId || (parentId === '1' ? null : parentId),
      sort_order: dept.order || 0,
    });

    stats.departmentsSynced++;

    // 递归子部门
    await syncDepartmentsRecursive(deptId, deptId, syncedDeptIds, stats, deps);
  }
}

async function syncDepartmentUsers(departmentId, syncedUserIds, stats, deps = buildSyncDeps()) {
  let cursor = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await deps.dingtalkService.getDepartmentUsers(departmentId, cursor);

    for (const simpleUser of result.list) {
      const userid = simpleUser.userid;

      if (syncedUserIds.has(userid)) {
        // 只补部门关系
        deps.userDepartmentDao.upsertRelation({
          user_id: userid,
          department_id: departmentId,
        });
        continue;
      }

      syncedUserIds.add(userid);

      // 获取详细信息
      let detail = {};
      try {
        detail = await deps.dingtalkService.getUserDetailById(userid);
      } catch (_err) {
        deps.logger.warn('获取用户详情失败，使用简单信息', {
          action: 'dingtalk.user.detail',
          userid,
        });
        detail = { name: simpleUser.name || '', userid };
      }

      deps.userDao.upsertUser({
        id: userid,
        name: detail.realname || detail.name || simpleUser.name || '',
        avatar: detail.avatar || '',
        job_number: detail.job_number || '',
        mobile: detail.mobile || '',
        email: detail.email || '',
        department_id: String(detail.dept_id_list?.[0] || departmentId),
        department_name: deps.departmentDao.findById
          ? (deps.departmentDao.findById(String(detail.dept_id_list?.[0] || departmentId))?.name || '')
          : '',
      });

      // 身份映射
      deps.userIdentityDao.upsertIdentity({
        user_id: userid,
        provider: 'dingtalk',
        provider_userid: userid,
        unionid: detail.unionid || null,
        openid: detail.open_id || null,
        raw_profile_json: JSON.stringify(detail),
      });

      // 部门关系
      const deptIdList = detail.dept_id_list || [departmentId];
      if (typeof deps.userDepartmentDao.syncUserDepartments === 'function') {
        deps.userDepartmentDao.syncUserDepartments(
          userid,
          deptIdList.map((deptId, index) => ({
            department_id: String(deptId),
            is_primary: index === 0 ? 1 : 0,
          }))
        );
      } else {
        for (let i = 0; i < deptIdList.length; i++) {
          deps.userDepartmentDao.upsertRelation({
            user_id: userid,
            department_id: String(deptIdList[i]),
            is_primary: i === 0 ? 1 : 0,
          });
        }
      }

      stats.usersSynced++;
    }

    hasMore = result.hasMore;
    cursor = result.nextCursor;
  }
}

module.exports = router;
module.exports.syncOrganization = syncOrganization;
module.exports.syncOrganizationWithDeps = syncOrganizationWithDeps;
module.exports.syncDepartmentUsers = syncDepartmentUsers;
