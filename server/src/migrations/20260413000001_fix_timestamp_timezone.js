/**
 * 迁移：统一历史时间戳格式为标准 UTC ISO（Z 结尾）
 *
 * 背景：历史数据存在三种格式混用：
 *   1. YYYY-MM-DDTHH:mm:ss.sss+08:00（所有正常操作写入，时间值正确，共约 1000+ 条）
 *   2. YYYY-MM-DD HH:mm:ss（CSV 导入，无时区，假定北京时间，tasks.completed_at 132 条）
 *   3. YYYY-M-D（非法格式，users.created_at 1 条）
 *
 * 转换逻辑（已通过 Node.js 实测验证）：
 *   - +08:00 格式：JS Date 解析带时区字符串会自动处理偏移，直接 toISOString() 得到正确 UTC
 *     例：'2026-04-07T15:31:45.425+08:00' → '2026-04-07T07:31:45.425Z'（北京时间15:31 = UTC 07:31）
 *   - 裸字符串：拼接 +08:00 后解析，按北京时间处理
 *     例：'2025-04-16 15:24:36' → '2025-04-16T07:24:36.000Z'
 *   - 非法格式（YYYY-M-D）：拼接 +08:00 后解析，JS 自动补全
 *     例：'2026-4-7' → '2026-04-06T16:00:00.000Z'（北京时间 2026-04-07 00:00）
 *
 * 安全性：
 *   - 只处理非 Z 结尾的记录，已正确的跳过
 *   - 无法解析的值保持原样并打印警告，不会导致数据丢失
 *   - 迁移在事务中执行（Knex 默认行为），失败自动回滚
 *
 * up: 统一为 UTC ISO（Z 结尾）
 * down: 不可逆，无 down 操作（原始格式已无法还原，建议迁移前手动备份数据库）
 */

'use strict';

/**
 * 需要修正的表和字段
 * 注意：due_date / start_date 是纯日期字段（YYYY-MM-DD），不在此列
 */
const TIME_FIELDS = [
  { table: 'tasks',                              cols: ['created_at', 'updated_at', 'completed_at', 'deleted_at', 'next_periodic_at'] },
  { table: 'teams',                              cols: ['created_at', 'updated_at'] },
  { table: 'team_members',                       cols: ['joined_at'] },
  { table: 'users',                              cols: ['created_at', 'updated_at'] },
  { table: 'comments',                           cols: ['created_at', 'updated_at'] },
  { table: 'notifications',                      cols: ['created_at'] },
  { table: 'notification_events',                cols: ['created_at'] },
  { table: 'notification_aggregation_sessions',  cols: ['created_at', 'updated_at', 'due_at'] },
  { table: 'task_activity_log',                  cols: ['created_at'] },
  { table: 'task_attachments',                   cols: ['created_at'] },
];

/**
 * 将各种历史格式统一转为标准 UTC ISO（Z 结尾）
 *
 * @param {string} val - 原始时间字符串
 * @returns {string} 标准 UTC ISO 字符串，或原值（无法解析时）
 */
function normalizeToUtc(val) {
  if (!val) return val;

  // 已是标准 UTC ISO（Z 结尾），跳过
  if (val.endsWith('Z')) return val;

  // 含 +08:00：JS Date 自动处理时区偏移，直接转 UTC
  // 例：'2026-04-07T15:31:45.425+08:00' → '2026-04-07T07:31:45.425Z'
  if (val.includes('+08:00')) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 裸字符串（无时区标注）：假定为北京时间（UTC+8），拼接时区后解析
  // 覆盖格式：
  //   'YYYY-MM-DD HH:mm:ss'（CSV 导入）→ 拼接 '+08:00' 后 JS 正确解析
  //   'YYYY-M-D'（非法格式）→ 拼接 '+08:00' 后 JS 自动补全日期
  const d = new Date(val + '+08:00');
  if (!isNaN(d.getTime())) return d.toISOString();

  // 无法解析，保持原样并打印警告（不中断迁移）
  console.warn(`[migration:fix_timestamp_timezone] 无法解析的时间格式，跳过: "${val}"`);
  return val;
}

exports.up = async function (knex) {
  // ── 第一步：打印格式分布统计，供执行时人工确认 ──────────────────────────────
  console.log('\n[migration:fix_timestamp_timezone] ===== 格式分布统计 =====');
  for (const { table, cols } of TIME_FIELDS) {
    for (const col of cols) {
      const hasCol = await knex.schema.hasColumn(table, col);
      if (!hasCol) continue;

      const [total, plus8, space, zEnd] = await Promise.all([
        knex(table).whereNotNull(col).count('* as n').first(),
        knex(table).whereNotNull(col).whereLike(col, '%+08:00%').count('* as n').first(),
        knex(table).whereNotNull(col).whereLike(col, '% %').count('* as n').first(),
        knex(table).whereNotNull(col).whereLike(col, '%Z').count('* as n').first(),
      ]);

      const other = Number(total.n) - Number(plus8.n) - Number(space.n) - Number(zEnd.n);
      const otherStr = other > 0 ? `, 其他=${other}` : '';
      console.log(
        `  ${table}.${col}: total=${total.n}, +08:00=${plus8.n}, 裸字符串=${space.n}, Z=${zEnd.n}${otherStr}`
      );
    }
  }

  // ── 第二步：逐表逐列修正 ────────────────────────────────────────────────────
  console.log('\n[migration:fix_timestamp_timezone] ===== 开始修正 =====');
  let totalUpdated = 0;

  for (const { table, cols } of TIME_FIELDS) {
    for (const col of cols) {
      const hasCol = await knex.schema.hasColumn(table, col);
      if (!hasCol) continue;

      // 只取非 Z 结尾的记录，已正确的直接跳过，减少不必要的 UPDATE
      const rows = await knex(table)
        .select('id', col)
        .whereNotNull(col)
        .whereNot(col, '')
        .whereRaw(`${col} NOT LIKE '%Z'`);

      if (rows.length === 0) continue;

      let updated = 0;
      for (const row of rows) {
        const original = row[col];
        const fixed = normalizeToUtc(original);

        // 只在值确实发生变化时才执行 UPDATE
        if (fixed !== original) {
          await knex(table).where('id', row.id).update({ [col]: fixed });
          updated++;
        }
      }

      if (updated > 0) {
        console.log(`  ${table}.${col}: 修正 ${updated} 条`);
        totalUpdated += updated;
      }
    }
  }

  console.log(`\n[migration:fix_timestamp_timezone] ===== 修正完成，共修正 ${totalUpdated} 条 =====\n`);
};

exports.down = async function () {
  // 不可逆操作：原始格式已无法从 UTC 值还原（+08:00 vs 裸字符串 vs 非法格式无法区分）
  // 建议在执行 up 前手动备份数据库：cp data/taskflow.db data/taskflow.db.bak-before-tz-fix
  console.warn('[migration:fix_timestamp_timezone] 此迁移不支持回滚，原始时间格式已无法还原。');
};
