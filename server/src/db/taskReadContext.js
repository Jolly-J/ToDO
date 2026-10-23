/** 请求内任务补充数据：分块聚合，不跨请求缓存人员或权限。 */
const { getDb } = require('./sqlite');

function chunks(values, visit) {
  const ids = [...new Set(values.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 400) {
    const part = ids.slice(i, i + 400);
    visit(part, part.map(() => '?').join(','));
  }
}

function createTaskReadContext(tasks, userId) {
  const db = getDb();
  const users = new Map();
  const ancestors = new Map(tasks.map(task => [task.id, task]));
  const counts = new Map(tasks.map(task => [task.id, { comments: 0, attachments: 0, total: 0, done: 0 }]));
  const teams = new Map();
  const flags = new Map();
  const userIds = tasks.flatMap(task => [task.creator_id, task.assignee_id, task.deleted_by,
    ...require('./taskDao').uniqueIds(task.participant_ids)]);
  chunks(userIds, (ids, ph) => {
    for (const row of db.prepare(`SELECT id, name, avatar FROM users WHERE id IN (${ph})`).all(...ids)) users.set(row.id, row);
  });
  chunks(tasks.map(task => task.id), (ids, ph) => {
    for (const row of db.prepare(`SELECT task_id, COUNT(*) AS c FROM comments WHERE deleted_at IS NULL AND task_id IN (${ph}) GROUP BY task_id`).all(...ids)) counts.get(row.task_id).comments = row.c;
    for (const row of db.prepare(`SELECT task_id, COUNT(*) AS c FROM task_attachments WHERE task_id IN (${ph}) GROUP BY task_id`).all(...ids)) counts.get(row.task_id).attachments = row.c;
    for (const row of db.prepare(`SELECT parent_id, COUNT(*) AS total, SUM(CASE WHEN status IN ('done','delayed_done') THEN 1 ELSE 0 END) AS done FROM tasks WHERE is_deleted = 0 AND parent_id IN (${ph}) GROUP BY parent_id`).all(...ids)) Object.assign(counts.get(row.parent_id), { total: row.total, done: row.done });
  });
  chunks(tasks.map(task => task.team_id), (ids, ph) => {
    for (const row of db.prepare(`SELECT id, name FROM teams WHERE id IN (${ph})`).all(...ids)) teams.set(row.id, row.name);
  });
  // 补拉筛选集合之外及已删除的祖先，保持原 breadcrumbs 口径；缺失和循环均终止。
  let pending = tasks.map(task => task.parent_id);
  while (pending.some(id => id && !ancestors.has(id))) {
    const next = [];
    chunks(pending.filter(id => !ancestors.has(id)), (ids, ph) => {
      ids.forEach(id => ancestors.set(id, null));
      for (const row of db.prepare(`SELECT id, title, parent_id FROM tasks WHERE id IN (${ph})`).all(...ids)) {
        ancestors.set(row.id, row);
        next.push(row.parent_id);
      }
    });
    pending = next;
  }
  return {
    profile: id => users.get(id) || null,
    teamName: id => teams.get(id) || '',
    counts: id => counts.get(id),
    breadcrumbs(task) {
      const result = [];
      const visited = new Set([task.id]);
      let id = task.parent_id;
      while (id && !visited.has(id)) {
        visited.add(id);
        const parent = ancestors.get(id);
        if (!parent) break;
        result.unshift({ id: parent.id, title: parent.title });
        id = parent.parent_id;
      }
      return result;
    },
    flags(teamId, load) {
      const key = teamId || '';
      if (!flags.has(key)) flags.set(key, load(userId));
      return flags.get(key);
    },
  };
}

module.exports = { createTaskReadContext, chunks };
