/**
 * 迁移：修复提醒时间时区双重偏移 + 清理孤儿附件
 *
 * 背景：
 *   1. computeReminderAt / computeNextPeriodicReminderAt 存在时区双重偏移 bug：
 *      setHours() 已在本地时区（UTC+8）设置时间，又手动 +8h，导致存入的时间比预期晚 8 小时。
 *      例：用户设置 09:00 提醒 → 实际存入 UTC 09:00 → 北京时间 17:00 才触发。
 *   2. 前端 CreateTaskModal 附件预上传取值路径错误（res.data?.id 应为 res.data?.data?.id），
 *      导致 attachmentId 为 undefined，附件物理文件已上传但 task_id 始终为 NULL。
 *
 * 修复内容：
 *   - reminder_at：含 +08:00 后缀的旧格式值，先解析为 UTC 时间戳再减去 8h 偏移，重新存为标准 UTC ISO
 *   - next_periodic_at：同上处理
 *   - 孤儿附件：删除 task_id IS NULL 且创建超过 24 小时的 pending 附件记录（物理文件保留，避免误删）
 *
 * up: 修正时区偏移 + 清理孤儿记录
 * down: 不可逆（原始错误值无法还原）
 */

'use strict';

exports.up = async function (knex) {
  console.log('\n[migration:fix_reminder_tz] ===== 开始修复提醒时间时区偏移 =====');

  const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

  // ── 第一步：修复 reminder_at ──────────────────────────────────────────────
  const reminderRows = await knex('tasks')
    .select('id', 'reminder_at', 'reminder_rule', 'due_date', 'periodic_time')
    .whereNotNull('reminder_at')
    .whereNot('reminder_at', '');

  let reminderFixed = 0;
  for (const row of reminderRows) {
    const val = row.reminder_at;

    // 旧 bug 产生的格式：含 +08:00 后缀但实际值多偏移了 8h
    // 也可能是上次迁移已转为 Z 结尾但值本身就是错的
    // 最可靠的方式：根据当前已修复的算法重新计算
    if (row.due_date && row.reminder_rule && row.reminder_rule !== 'none') {
      const REMINDER_OFFSETS = {
        due_15m: 15 * 60 * 1000,
        due_30m: 30 * 60 * 1000,
        due_1h:  60 * 60 * 1000,
        due_3h:  3 * 60 * 60 * 1000,
        due_1d:  24 * 60 * 60 * 1000,
        due_3d:  3 * 24 * 60 * 60 * 1000,
      };

      const offset = REMINDER_OFFSETS[row.reminder_rule];
      if (offset) {
        const timeStr = row.periodic_time || '09:00:00';
        const [hh = 9, mm = 0, ss = 0] = timeStr.includes(':') ? timeStr.split(':').map(Number) : [9, 0, 0];
        const hhStr = String(hh).padStart(2, '0');
        const mmStr = String(mm).padStart(2, '0');
        const ssStr = String(ss).padStart(2, '0');

        const dueMs = new Date(`${row.due_date}T${hhStr}:${mmStr}:${ssStr}+08:00`).getTime();
        if (!isNaN(dueMs)) {
          const correctValue = new Date(dueMs - offset).toISOString();
          if (correctValue !== val) {
            await knex('tasks').where('id', row.id).update({
              reminder_at: correctValue,
              reminder_sent: 0,  // 重置发送标记，让修正后的时间重新触发
            });
            reminderFixed++;
          }
        }
      }
    }
  }
  console.log(`  reminder_at: 修正 ${reminderFixed} 条`);

  // ── 第二步：修复 next_periodic_at ─────────────────────────────────────────
  const periodicRows = await knex('tasks')
    .select('id', 'next_periodic_at', 'periodic_interval_days', 'periodic_time')
    .whereNotNull('next_periodic_at')
    .whereNot('next_periodic_at', '')
    .where('status', '!=', 'done')
    .where('is_deleted', 0);

  let periodicFixed = 0;
  for (const row of periodicRows) {
    if (!row.periodic_interval_days || !row.periodic_time) continue;

    const [hh, mm] = row.periodic_time.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) continue;

    // 用修复后的算法重新计算
    const now = new Date();
    const baseUtc8 = new Date(now.getTime() + TZ_OFFSET_MS);
    const year = baseUtc8.getUTCFullYear();
    const month = baseUtc8.getUTCMonth();
    const day = baseUtc8.getUTCDate();

    const todayTargetUtc = Date.UTC(year, month, day, hh - 8, mm, 0, 0);
    let nextMs = todayTargetUtc;
    if (nextMs <= Date.now()) {
      nextMs += row.periodic_interval_days * 24 * 60 * 60 * 1000;
      while (nextMs <= Date.now()) {
        nextMs += 24 * 60 * 60 * 1000;
      }
    }

    const correctValue = new Date(nextMs).toISOString();
    if (correctValue !== row.next_periodic_at) {
      await knex('tasks').where('id', row.id).update({ next_periodic_at: correctValue });
      periodicFixed++;
    }
  }
  console.log(`  next_periodic_at: 修正 ${periodicFixed} 条`);

  // ── 第三步：清理孤儿附件记录 ──────────────────────────────────────────────
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const orphanCount = await knex('task_attachments')
    .whereNull('task_id')
    .where('created_at', '<', cutoff)
    .del();

  console.log(`  孤儿附件: 清理 ${orphanCount} 条（task_id IS NULL 且超过 24 小时）`);

  console.log('[migration:fix_reminder_tz] ===== 修复完成 =====\n');
};

exports.down = async function () {
  console.warn('[migration:fix_reminder_tz] 此迁移不支持回滚，错误的时区偏移值已无法还原。');
};
