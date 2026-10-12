/** 钉钉宣传推送发送记录与批次持久化。 */

const { randomBytes } = require('node:crypto');
const { getDb } = require('../../db/sqlite');
const { nowIso } = require('../../utils/datetime');
const { generatePrefixedId } = require('../../utils/uuid');

const RECALL_WINDOW_MS = 24 * 60 * 60 * 1000;

function createViewTrackingToken() {
  return randomBytes(24).toString('base64url');
}

function parseJson(value, fallback = []) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function asJson(value) {
  return JSON.stringify(value || []);
}

function hydrateBatch(row) {
  if (!row) return null;
  return {
    ...row,
    recipients: parseJson(row.recipients_json),
    failures: parseJson(row.failures_json),
  };
}

function hydrateRecord(row) {
  if (!row) return null;
  const processKeyCount = Number(row.process_key_count || 0);
  const recalledKeyCount = Number(row.recalled_key_count || 0);
  const recallExpired = Date.parse(row.recall_deadline_at) <= Date.now();
  const retryableCount = parseJson(row.failures_json)
    .filter((failure) => failure?.kind === 'flow_controlled' && failure?.providerUserId)
    .length;

  return {
    ...row,
    recipients: parseJson(row.recipients_json),
    initialFailures: parseJson(row.initial_failures_json),
    failures: parseJson(row.failures_json),
    processKeyCount,
    recalledKeyCount,
    recallExpired,
    canRecall: processKeyCount > recalledKeyCount
      && !recallExpired
      && !['queued', 'sending'].includes(row.status)
      && row.recall_status !== 'recalling',
    retryableCount,
    canRetry: retryableCount > 0 && !['queued', 'sending'].includes(row.status),
  };
}

function recordSelectSql() {
  return `
    SELECT r.*,
           u.name AS requested_by_name,
           (SELECT COUNT(*) FROM dingtalk_broadcast_send_batches b
             WHERE b.record_id = r.id AND b.process_query_key IS NOT NULL) AS process_key_count,
           (SELECT COUNT(*) FROM dingtalk_broadcast_send_batches b
             WHERE b.record_id = r.id AND b.process_query_key IS NOT NULL AND b.recall_status = 'recalled') AS recalled_key_count
    FROM dingtalk_broadcast_send_records r
    LEFT JOIN users u ON u.id = r.requested_by
  `;
}

function findById(id, db = getDb()) {
  const row = db.prepare(recordSelectSql() + ' WHERE r.id = ? LIMIT 1').get(id);
  return hydrateRecord(row);
}

function findByIdempotencyKey(idempotencyKey, db = getDb()) {
  const row = db.prepare(recordSelectSql() + ' WHERE r.idempotency_key = ? LIMIT 1').get(idempotencyKey);
  return hydrateRecord(row);
}

function createSendRecord({
  broadcastId = null,
  parentRecordId = null,
  idempotencyKey,
  payloadHash,
  scope,
  messageType,
  title,
  markdown,
  buttonText = '',
  coverImageUrl = '',
  actionUrl = '',
  viewTrackingToken = null,
  recipients,
  initialFailures = [],
  requestedBy,
  batchSize,
}) {
  const db = getDb();
  return db.transaction(() => {
    const existing = findByIdempotencyKey(idempotencyKey, db);
    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        const error = new Error('相同发送请求标识对应了不同内容');
        error.status = 409;
        error.code = 40900;
        throw error;
      }
      return existing;
    }

    const stamp = nowIso();
    const id = generatePrefixedId('broadcast-send');
    const recallDeadlineAt = new Date(Date.parse(stamp) + RECALL_WINDOW_MS).toISOString();
    const normalizedRecipients = Array.isArray(recipients) ? recipients : [];
    const failures = Array.isArray(initialFailures) ? initialFailures : [];

    db.prepare(`
      INSERT INTO dingtalk_broadcast_send_records (
        id, broadcast_id, parent_record_id, idempotency_key, payload_hash,
        scope, message_type, title, markdown, button_text, cover_image_url,
        action_url, view_tracking_token, view_count,
        recipients_json, initial_failures_json, failures_json,
        recipient_count, deliverable_count, success_count, failure_count,
        status, recall_status, recall_deadline_at, requested_by, created_at, updated_at
      ) VALUES (
        @id, @broadcastId, @parentRecordId, @idempotencyKey, @payloadHash,
        @scope, @messageType, @title, @markdown, @buttonText, @coverImageUrl,
        @actionUrl, @viewTrackingToken, 0,
        @recipientsJson, @initialFailuresJson, @failuresJson,
        @recipientCount, @deliverableCount, 0, @failureCount,
        'queued', 'none', @recallDeadlineAt, @requestedBy, @stamp, @stamp
      )
    `).run({
      id,
      broadcastId,
      parentRecordId,
      idempotencyKey,
      payloadHash,
      scope,
      messageType,
      title,
      markdown,
      buttonText,
      coverImageUrl: coverImageUrl || null,
      actionUrl: actionUrl || null,
      viewTrackingToken: viewTrackingToken || null,
      recipientsJson: asJson(normalizedRecipients),
      initialFailuresJson: asJson(failures),
      failuresJson: asJson(failures),
      recipientCount: normalizedRecipients.length + failures.length,
      deliverableCount: normalizedRecipients.length,
      failureCount: failures.length,
      recallDeadlineAt,
      requestedBy,
      stamp,
    });

    for (let index = 0; index < normalizedRecipients.length; index += batchSize) {
      const batchRecipients = normalizedRecipients.slice(index, index + batchSize);
      db.prepare(`
        INSERT INTO dingtalk_broadcast_send_batches (
          id, record_id, batch_index, recipients_json, status,
          success_count, failures_json, recall_status, created_at, updated_at
        ) VALUES (
          @id, @recordId, @batchIndex, @recipientsJson, 'pending',
          0, '[]', 'none', @stamp, @stamp
        )
      `).run({
        id: generatePrefixedId('broadcast-batch'),
        recordId: id,
        batchIndex: Math.floor(index / batchSize),
        recipientsJson: asJson(batchRecipients),
        stamp,
      });
    }

    return findById(id, db);
  })();
}

function incrementViewCount({ broadcastId, viewTrackingToken }) {
  if (!broadcastId || !viewTrackingToken) return false;
  const result = getDb().prepare(`
    UPDATE dingtalk_broadcast_send_records
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE broadcast_id = @broadcastId
      AND view_tracking_token = @viewTrackingToken
      AND message_type = 'action_card'
  `).run({ broadcastId, viewTrackingToken });
  return result.changes === 1;
}

function listRecords({ page = 1, pageSize = 20 } = {}) {
  const db = getDb();
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const total = Number(db.prepare('SELECT COUNT(*) AS count FROM dingtalk_broadcast_send_records').get().count || 0);
  const rows = db.prepare(
    recordSelectSql() + ' ORDER BY r.created_at DESC, r.rowid DESC LIMIT ? OFFSET ?'
  ).all(safePageSize, (safePage - 1) * safePageSize);

  return {
    list: rows.map(hydrateRecord),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

function getBatches(recordId, db = getDb()) {
  return db.prepare(`
    SELECT * FROM dingtalk_broadcast_send_batches
    WHERE record_id = ?
    ORDER BY batch_index ASC
  `).all(recordId).map(hydrateBatch);
}

function markRecordSending(recordId) {
  const stamp = nowIso();
  getDb().prepare(`
    UPDATE dingtalk_broadcast_send_records
    SET status = 'sending', started_at = COALESCE(started_at, @stamp), updated_at = @stamp, last_error = NULL
    WHERE id = @recordId AND status = 'queued'
  `).run({ recordId, stamp });
  return findById(recordId);
}

function markBatchSending(batchId) {
  const stamp = nowIso();
  const result = getDb().prepare(`
    UPDATE dingtalk_broadcast_send_batches
    SET status = 'sending', updated_at = @stamp, last_error = NULL
    WHERE id = @batchId AND status = 'pending'
  `).run({ batchId, stamp });
  return result.changes === 1;
}

function completeBatch(batchId, { status, processQueryKey, successCount, failures, error }) {
  const stamp = nowIso();
  getDb().prepare(`
    UPDATE dingtalk_broadcast_send_batches
    SET status = @status,
        process_query_key = @processQueryKey,
        success_count = @successCount,
        failures_json = @failuresJson,
        last_error = @error,
        sent_at = CASE WHEN @processQueryKey IS NOT NULL THEN @stamp ELSE sent_at END,
        updated_at = @stamp
    WHERE id = @batchId
  `).run({
    batchId,
    status,
    processQueryKey: processQueryKey || null,
    successCount: Number(successCount) || 0,
    failuresJson: asJson(failures),
    error: error || null,
    stamp,
  });
}

function failActiveBatches(recordId, error) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM dingtalk_broadcast_send_batches
    WHERE record_id = ? AND status = 'sending'
  `).all(recordId);
  const stamp = nowIso();
  for (const row of rows) {
    const recipients = parseJson(row.recipients_json);
    const failure = {
      kind: 'batch_error',
      batch: Number(row.batch_index) + 1,
      count: recipients.length,
      reason: error || '发送批次异常中断，结果不确定',
    };
    db.prepare(`
      UPDATE dingtalk_broadcast_send_batches
      SET status = 'uncertain', failures_json = @failuresJson,
          last_error = @error, updated_at = @stamp
      WHERE id = @id
    `).run({ id: row.id, failuresJson: asJson([failure]), error: failure.reason, stamp });
  }
  return rows.length;
}

function finalizeRecord(recordId, { status, successCount, failures, error }) {
  const current = findById(recordId);
  const stamp = nowIso();
  getDb().prepare(`
    UPDATE dingtalk_broadcast_send_records
    SET status = @status,
        success_count = @successCount,
        failure_count = @failureCount,
        failures_json = @failuresJson,
        last_error = @error,
        finished_at = @stamp,
        updated_at = @stamp
    WHERE id = @recordId
  `).run({
    recordId,
    status,
    successCount: Number(successCount) || 0,
    failureCount: Math.max(0, Number(current?.recipient_count || 0) - (Number(successCount) || 0)),
    failuresJson: asJson(failures),
    error: error || null,
    stamp,
  });
  return findById(recordId);
}

function failRecord(recordId, error) {
  const record = findById(recordId);
  if (!record || ['succeeded', 'partial', 'failed'].includes(record.status)) return record;
  return finalizeRecord(recordId, {
    status: 'failed',
    successCount: record.success_count || 0,
    failures: record.failures || [],
    error,
  });
}

function recoverInterruptedRecords() {
  const db = getDb();
  return db.transaction(() => {
    const interrupted = db.prepare(`
      SELECT * FROM dingtalk_broadcast_send_batches WHERE status = 'sending'
    `).all();
    const stamp = nowIso();
    for (const row of interrupted) {
      const recipients = parseJson(row.recipients_json);
      const failure = {
        kind: 'batch_error',
        batch: Number(row.batch_index) + 1,
        count: recipients.length,
        reason: '服务在发送过程中中断，该批次结果不确定，已停止自动重发以避免重复消息',
      };
      db.prepare(`
        UPDATE dingtalk_broadcast_send_batches
        SET status = 'uncertain', failures_json = @failuresJson,
            last_error = @error, updated_at = @stamp
        WHERE id = @id
      `).run({ id: row.id, failuresJson: asJson([failure]), error: failure.reason, stamp });
    }
    db.prepare(`
      UPDATE dingtalk_broadcast_send_records
      SET status = 'queued', updated_at = @stamp
      WHERE status = 'sending'
    `).run({ stamp });
    return interrupted.length;
  })();
}

function listQueuedRecordIds() {
  return getDb().prepare(`
    SELECT id FROM dingtalk_broadcast_send_records
    WHERE status = 'queued'
    ORDER BY created_at ASC
  `).all().map((row) => row.id);
}

function requestRecall(recordId, operatorId = null) {
  const db = getDb();
  return db.transaction(() => {
    const record = findById(recordId, db);
    if (!record) return { record: null, reason: 'not_found' };
    if (record.recall_status === 'recalled') return { record, reason: 'recalled' };
    if (record.recallExpired) return { record, reason: 'expired' };
    if (record.processKeyCount <= record.recalledKeyCount) return { record, reason: 'no_keys' };
    if (['queued', 'sending'].includes(record.status)) return { record, reason: 'sending' };

    const stamp = nowIso();
    db.prepare(`
      UPDATE dingtalk_broadcast_send_records
      SET recall_status = 'recalling', recall_requested_at = @stamp,
          recall_requested_by = @operatorId, recall_error = NULL, updated_at = @stamp
      WHERE id = @recordId
    `).run({ recordId, operatorId, stamp });
    return { record: findById(recordId, db), reason: null };
  })();
}

function getRecallableBatches(recordId) {
  return getDb().prepare(`
    SELECT * FROM dingtalk_broadcast_send_batches
    WHERE record_id = ?
      AND process_query_key IS NOT NULL
      AND recall_status != 'recalled'
    ORDER BY batch_index ASC
  `).all(recordId).map(hydrateBatch);
}

function completeBatchRecall(batchId, { recalled, error }) {
  const stamp = nowIso();
  getDb().prepare(`
    UPDATE dingtalk_broadcast_send_batches
    SET recall_status = @status,
        recall_error = @error,
        recalled_at = CASE WHEN @recalled = 1 THEN @stamp ELSE recalled_at END,
        updated_at = @stamp
    WHERE id = @batchId
  `).run({
    batchId,
    status: recalled ? 'recalled' : 'failed',
    error: error || null,
    recalled: recalled ? 1 : 0,
    stamp,
  });
}

function failPendingRecallBatches(recordId, error) {
  const stamp = nowIso();
  return getDb().prepare(`
    UPDATE dingtalk_broadcast_send_batches
    SET recall_status = 'failed', recall_error = @error, updated_at = @stamp
    WHERE record_id = @recordId
      AND process_query_key IS NOT NULL
      AND recall_status != 'recalled'
  `).run({ recordId, error: error || '撤回任务异常中断', stamp }).changes;
}

function finalizeRecall(recordId) {
  const db = getDb();
  const batches = db.prepare(`
    SELECT recall_status, recall_error
    FROM dingtalk_broadcast_send_batches
    WHERE record_id = ? AND process_query_key IS NOT NULL
  `).all(recordId);
  const recalledCount = batches.filter((batch) => batch.recall_status === 'recalled').length;
  const failed = batches.filter((batch) => batch.recall_status !== 'recalled');
  const status = batches.length > 0 && recalledCount === batches.length
    ? 'recalled'
    : recalledCount > 0
      ? 'partial'
      : 'failed';
  const error = failed.map((batch) => batch.recall_error).filter(Boolean).join('；') || null;
  const stamp = nowIso();

  db.prepare(`
    UPDATE dingtalk_broadcast_send_records
    SET recall_status = @status,
        recall_error = @error,
        recalled_at = CASE WHEN @status = 'recalled' THEN @stamp ELSE recalled_at END,
        updated_at = @stamp
    WHERE id = @recordId
  `).run({ recordId, status, error, stamp });
  return findById(recordId);
}

function listRecallingRecordIds() {
  return getDb().prepare(`
    SELECT id FROM dingtalk_broadcast_send_records
    WHERE recall_status = 'recalling'
    ORDER BY recall_requested_at ASC
  `).all().map((row) => row.id);
}

function getLatestAllResult() {
  const row = getDb().prepare(
    recordSelectSql() + " WHERE r.scope = 'all' ORDER BY r.created_at DESC, r.rowid DESC LIMIT 1"
  ).get();
  return hydrateRecord(row);
}

module.exports = {
  RECALL_WINDOW_MS,
  completeBatch,
  completeBatchRecall,
  createSendRecord,
  createViewTrackingToken,
  failRecord,
  failActiveBatches,
  failPendingRecallBatches,
  finalizeRecall,
  finalizeRecord,
  findById,
  findByIdempotencyKey,
  getBatches,
  getLatestAllResult,
  getRecallableBatches,
  incrementViewCount,
  listQueuedRecordIds,
  listRecallingRecordIds,
  listRecords,
  markBatchSending,
  markRecordSending,
  parseJson,
  recoverInterruptedRecords,
  requestRecall,
};
