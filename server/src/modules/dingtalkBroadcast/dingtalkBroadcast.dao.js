/** 钉钉宣传推送持久化。 */

const { randomBytes } = require('node:crypto');
const { getDb } = require('../../db/sqlite');
const { nowIso } = require('../../utils/datetime');
const { generatePrefixedId } = require('../../utils/uuid');

function createPublicToken() {
  return randomBytes(24).toString('base64url');
}

function findById(id, db = getDb()) {
  return db.prepare('SELECT * FROM dingtalk_broadcasts WHERE id = ?').get(id) || null;
}

function findByPublicToken(publicToken) {
  return getDb()
    .prepare(`
      SELECT *
      FROM dingtalk_broadcasts
      WHERE public_token = ?
        AND message_type = 'action_card'
        AND html_content IS NOT NULL
      LIMIT 1
    `)
    .get(publicToken) || null;
}

function getEditableActionDraft(id, db = getDb()) {
  const current = findById(id, db);
  if (!current || current.message_type !== 'action_card') {
    return null;
  }
  if (current.status === 'sending' || current.status === 'submitted') {
    const error = new Error('已经提交发送的 ActionCard 不能重新上传承载页');
    error.code = 'BROADCAST_ALREADY_SUBMITTED';
    throw error;
  }
  return current;
}

function createActionDraft({ htmlContent, originalName, htmlSize, createdBy }) {
  const db = getDb();
  const stamp = nowIso();
  const id = generatePrefixedId('broadcast');

  db.prepare(`
    INSERT INTO dingtalk_broadcasts (
      id, public_token, message_type, title, markdown, button_text,
      html_content, html_original_name, html_size, status, created_by,
      created_at, updated_at
    ) VALUES (
      @id, @publicToken, 'action_card', '', '', '查看详情',
      @htmlContent, @originalName, @htmlSize, 'draft', @createdBy,
      @stamp, @stamp
    )
  `).run({
    id,
    publicToken: createPublicToken(),
    htmlContent,
    originalName,
    htmlSize,
    createdBy,
    stamp,
  });

  return findById(id, db);
}

function deleteEmptyDraft(id) {
  if (!id) return false;
  const result = getDb().prepare(`
    DELETE FROM dingtalk_broadcasts
    WHERE id = ? AND status = 'draft' AND COALESCE(html_content, '') = ''
  `).run(id);
  return result.changes === 1;
}

function replaceActionHtml(id, { htmlContent, originalName, htmlSize }) {
  const db = getDb();
  const current = getEditableActionDraft(id, db);
  if (!current) return null;

  db.prepare(`
    UPDATE dingtalk_broadcasts
    SET html_content = @htmlContent,
        html_original_name = @originalName,
        html_size = @htmlSize,
        last_test_process_key = NULL,
        last_test_at = NULL,
        last_error = NULL,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    htmlContent,
    originalName,
    htmlSize,
    updatedAt: nowIso(),
  });

  return findById(id, db);
}

function releaseAllSendReservation(id, error) {
  if (!id) return null;
  const db = getDb();
  const stamp = nowIso();
  db.prepare(`
    UPDATE dingtalk_broadcasts
    SET status = 'failed', last_error = @error, updated_at = @stamp
    WHERE id = @id AND status = 'sending' AND all_process_key IS NULL
  `).run({ id, error: error || '发送任务创建失败', stamp });
  return findById(id, db);
}

function updateActionDraft(id, { title, markdown, buttonText }) {
  const db = getDb();
  const current = findById(id, db);

  if (!current || current.message_type !== 'action_card') {
    return null;
  }

  if (current.status === 'submitted' || current.status === 'sending') {
    const error = new Error('已经全员提交的 ActionCard 不能再次修改');
    error.code = 'BROADCAST_ALREADY_SUBMITTED';
    throw error;
  }

  db.prepare(`
    UPDATE dingtalk_broadcasts
    SET title = @title,
        markdown = @markdown,
        button_text = @buttonText,
        updated_at = @updatedAt,
        last_error = NULL
    WHERE id = @id
  `).run({ id, title, markdown, buttonText, updatedAt: nowIso() });

  return findById(id, db);
}

function markTestResult(id, { processKey, error }) {
  if (!id) return null;

  const db = getDb();
  const stamp = nowIso();
  db.prepare(`
    UPDATE dingtalk_broadcasts
    SET last_test_process_key = @processKey,
        last_test_at = @lastTestAt,
        last_error = @error,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    processKey: processKey ? String(processKey) : null,
    lastTestAt: processKey ? stamp : null,
    error: error || null,
    updatedAt: stamp,
  });

  return findById(id, db);
}

function reserveAllSend({ broadcastId, messageType, title, markdown, buttonText, createdBy }) {
  const db = getDb();

  return db.transaction(() => {
    const stamp = nowIso();

    if (messageType === 'action_card') {
      const current = findById(broadcastId, db);
      if (!current || current.message_type !== 'action_card') {
        return null;
      }
      if (current.status === 'sending' || current.status === 'submitted') {
        const error = new Error('这条 ActionCard 已经提交过全员推送');
        error.code = 'BROADCAST_ALREADY_SUBMITTED';
        throw error;
      }

      db.prepare(`
        UPDATE dingtalk_broadcasts
        SET title = @title,
            markdown = @markdown,
            button_text = @buttonText,
            status = 'sending',
            all_sent_at = @allSentAt,
            last_error = NULL,
            updated_at = @updatedAt
        WHERE id = @id
      `).run({
        id: broadcastId,
        title,
        markdown,
        buttonText,
        allSentAt: stamp,
        updatedAt: stamp,
      });

      return findById(broadcastId, db);
    }

    const id = generatePrefixedId('broadcast');
    db.prepare(`
      INSERT INTO dingtalk_broadcasts (
        id, public_token, message_type, title, markdown, button_text,
        html_content, html_original_name, html_size, status, all_sent_at,
        created_by, created_at, updated_at
      ) VALUES (
        @id, NULL, 'markdown', @title, @markdown, '',
        NULL, NULL, 0, 'sending', @allSentAt,
        @createdBy, @createdAt, @updatedAt
      )
    `).run({
      id,
      title,
      markdown,
      allSentAt: stamp,
      createdBy,
      createdAt: stamp,
      updatedAt: stamp,
    });

    return findById(id, db);
  })();
}

function markAllResult(id, { processKey, resultJson, error }) {
  const db = getDb();
  const stamp = nowIso();
  db.prepare(`
    UPDATE dingtalk_broadcasts
    SET status = @status,
        all_process_key = @processKey,
        all_result_json = @resultJson,
        last_error = @error,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    status: processKey ? 'submitted' : 'failed',
    processKey: processKey ? String(processKey) : null,
    resultJson: resultJson && resultJson.length ? JSON.stringify(resultJson) : null,
    error: error || null,
    updatedAt: stamp,
  });

  return findById(id, db);
}

function parseResultJson(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function getLatestAllResult() {
  const row = getDb().prepare(`
    SELECT id, message_type, title, status, all_process_key, all_result_json, all_sent_at, last_error
    FROM dingtalk_broadcasts
    WHERE all_sent_at IS NOT NULL
    ORDER BY all_sent_at DESC, rowid DESC
    LIMIT 1
  `).get();
  if (!row) return null;

  return {
    broadcastId: row.id,
    messageType: row.message_type,
    title: row.title,
    status: row.status,
    processKey: row.all_process_key || null,
    submittedAt: row.all_sent_at,
    error: row.last_error || null,
    failures: parseResultJson(row.all_result_json),
  };
}

module.exports = {
  createActionDraft,
  deleteEmptyDraft,
  findById,
  findByPublicToken,
  getEditableActionDraft,
  getLatestAllResult,
  markAllResult,
  markTestResult,
  replaceActionHtml,
  releaseAllSendReservation,
  reserveAllSend,
  updateActionDraft,
};
