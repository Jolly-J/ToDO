/**
 * 移动端拦截页点赞路由
 * 无需鉴权，提供点赞提交和排行榜查询两个公开接口
 */
const express = require('express');
const { getDb } = require('../db/sqlite');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/mobile-likes — 提交点赞（姓名 + 点赞数）
router.post('/', (req, res) => {
  const { name, like_count } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return error(res, 'MISSING_PARAM', '请填写姓名');
  }

  const count = parseInt(like_count, 10);
  if (!count || count < 1) {
    return error(res, 'INVALID_PARAM', '点赞数无效');
  }

  const trimmedName = name.trim().slice(0, 50);

  try {
    const db = getDb();

    // 同名时只保留更高分：若新分数更高则覆盖，否则保持原记录不变
    const existing = db.prepare('SELECT id, like_count FROM mobile_likes WHERE name = ?').get(trimmedName);

    let id;
    if (existing) {
      if (count > existing.like_count) {
        db.prepare('UPDATE mobile_likes SET like_count = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?').run(count, existing.id);
      }
      id = existing.id;
    } else {
      const result = db.prepare('INSERT INTO mobile_likes (name, like_count) VALUES (?, ?)').run(trimmedName, count);
      id = result.lastInsertRowid;
    }

    logger.info('mobile_like.submitted', { id, name: trimmedName, like_count: count });
    return success(res, { id });
  } catch (err) {
    logger.error('mobile_like.submit.failed', { error: err.message });
    return error(res, 'INTERNAL_ERROR');
  }
});

// GET /api/mobile-likes/leaderboard — 排行榜 top 10
router.get('/leaderboard', (_req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT name, like_count, created_at FROM mobile_likes ORDER BY like_count DESC LIMIT 10'
    ).all();

    return success(res, rows);
  } catch (err) {
    logger.error('mobile_like.leaderboard.failed', { error: err.message });
    return error(res, 'INTERNAL_ERROR');
  }
});

module.exports = router;
