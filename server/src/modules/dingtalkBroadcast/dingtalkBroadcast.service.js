/** 钉钉宣传推送业务服务。
 *
 * 发送通道为钉钉单聊机器人（企业内部应用机器人）：
 * - 测试推送：指定人员（最多 20 人）发送
 * - 全员推送：收集全部启用用户，按每批最多 20 人串行分批发送，汇总失败明细
 *
 * 与任务通知链路（Todo / Robot 任务消息）相互独立，不复用其编排。
 */

const { createHash } = require('node:crypto');
const { createConfig } = require('../../config');
const userDao = require('../../db/userDao');
const {
  getIdentitiesByUserIds,
  getUserIdsByProviderUserIds,
} = require('../dingtalk/dingtalk.identity.dao');
const robotAdapter = require('../dingtalk/dingtalk.robot.adapter');
const { auditDingtalkEvent } = require('../../utils/businessLogger');
const { createError } = require('../../utils/response');
const broadcastDao = require('./dingtalkBroadcast.dao');
const sendRecordDao = require('./dingtalkBroadcast.sendRecord.dao');
const broadcastWorker = require('./dingtalkBroadcast.worker');

const MESSAGE_TYPES = new Set(['markdown', 'action_card']);
const OPEN_TYPES = new Set(['slide', 'popupWindow', 'workbench', 'browser']);
const MAX_TITLE_LENGTH = 100;
const MAX_MARKDOWN_LENGTH = 5000;
const MAX_ACTION_MARKDOWN_LENGTH = 1000;
const MAX_BUTTON_LENGTH = 20;
const MAX_TEST_RECIPIENTS = 20;
const MAX_ACTION_URL_LENGTH = 500;
const MAX_COVER_URL_LENGTH = 500;
const ROBOT_BATCH_SIZE = 20;
const RECALL_BATCH_SIZE = 20;

function normalizeRequiredText(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw createError('INVALID_PARAM', label + '不能为空');
  }
  return normalized;
}

function normalizeIdempotencyKey(value) {
  const normalized = String(value || '').trim();
  if (normalized.length < 8 || normalized.length > 128) {
    throw createError('INVALID_PARAM', '发送请求标识无效，请刷新页面后重试');
  }
  return normalized;
}

function hashPayload(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertIdempotentPayload(existing, payloadHash) {
  if (!existing) return null;
  if (existing.payload_hash !== payloadHash) {
    throw createError('DUPLICATE', '相同发送请求标识对应了不同内容，请刷新页面后重试');
  }
  return existing;
}

function asEnqueueResult(record) {
  return {
    recordId: record.id,
    scope: record.scope,
    messageType: record.message_type,
    status: record.status,
    recipientCount: Number(record.recipient_count) || 0,
    failureCount: Number(record.failure_count) || 0,
  };
}

function validateMessage(input = {}) {
  const messageType = String(input.messageType || '').trim();
  if (!MESSAGE_TYPES.has(messageType)) {
    throw createError('INVALID_PARAM', '消息类型必须是 markdown 或 action_card');
  }

  const title = normalizeRequiredText(input.title, '消息标题');
  const markdown = normalizeRequiredText(input.markdown, '消息正文');

  if (title.length > MAX_TITLE_LENGTH) {
    throw createError('INVALID_PARAM', '消息标题不能超过 ' + MAX_TITLE_LENGTH + ' 个字符');
  }

  const markdownLimit = messageType === 'action_card'
    ? MAX_ACTION_MARKDOWN_LENGTH
    : MAX_MARKDOWN_LENGTH;
  if (markdown.length > markdownLimit) {
    throw createError('INVALID_PARAM', '消息正文不能超过 ' + markdownLimit + ' 个字符');
  }

  let buttonText = '';
  let broadcastId = '';
  let coverImageUrl = '';
  let openType = 'slide';
  if (messageType === 'action_card') {
    buttonText = normalizeRequiredText(input.buttonText || '查看详情', '按钮文字');
    broadcastId = normalizeRequiredText(input.broadcastId, 'HTML承载页');
    if (buttonText.length > MAX_BUTTON_LENGTH) {
      throw createError('INVALID_PARAM', '按钮文字不能超过 ' + MAX_BUTTON_LENGTH + ' 个字符');
    }

    if (input.openType !== undefined && input.openType !== null && String(input.openType).trim() !== '') {
      const rawOpenType = String(input.openType).trim();
      if (!OPEN_TYPES.has(rawOpenType)) {
        throw createError('INVALID_PARAM', '无效的打开窗口类型');
      }
      openType = rawOpenType;
    }

    if (input.coverImageUrl !== undefined && input.coverImageUrl !== null && String(input.coverImageUrl).trim() !== '') {
      coverImageUrl = String(input.coverImageUrl).trim();
      if (!/^https?:\/\//i.test(coverImageUrl)) {
        throw createError('INVALID_PARAM', '封面图片地址必须以 http(s) 开头');
      }
      if (coverImageUrl.length > MAX_COVER_URL_LENGTH) {
        throw createError('INVALID_PARAM', '封面图片地址不能超过 ' + MAX_COVER_URL_LENGTH + ' 个字符');
      }
    }
  }

  const actionMarkdown = messageType === 'action_card'
    ? buildActionCardText({ markdown, coverImageUrl })
    : markdown;
  if (actionMarkdown.length > markdownLimit) {
    throw createError('INVALID_PARAM', '卡片正文（含封面图片）不能超过 ' + markdownLimit + ' 个字符');
  }

  return { messageType, title, markdown: actionMarkdown, buttonText, broadcastId, coverImageUrl, openType };
}

/**
 * 组装 ActionCard 卡片正文：封面图片语法前置 + 摘要 Markdown。
 */
function buildActionCardText({ markdown, coverImageUrl }) {
  if (!coverImageUrl) {
    return markdown;
  }
  return '![图片](' + coverImageUrl + ')\n\n' + markdown;
}

function buildPublicPageUrl(publicToken, appBaseUrl = createConfig().appBaseUrl, viewTrackingToken = '') {
  if (!appBaseUrl) {
    throw createError('EXTERNAL_SERVICE_ERROR', 'APP_BASE_URL 未配置，无法生成 ActionCard 承载页地址');
  }
  const pageUrl = String(appBaseUrl).replace(/\/+$/, '') + '/p/' + encodeURIComponent(publicToken);
  return viewTrackingToken
    ? pageUrl + '?view=' + encodeURIComponent(viewTrackingToken)
    : pageUrl;
}

function buildDingtalkPageLink({ publicToken, appBaseUrl, openType = 'slide', viewTrackingToken = '' }) {
  const publicUrl = buildPublicPageUrl(publicToken, appBaseUrl, viewTrackingToken);
  const pageLink = 'https://applink.dingtalk.com/page/link?url='
    + encodeURIComponent(publicUrl)
    + '&target=fullScreen&targetDesktop=' + encodeURIComponent(openType);

  if (pageLink.length > MAX_ACTION_URL_LENGTH) {
    throw createError('INVALID_PARAM', 'ActionCard 跳转地址超过钉钉500字符限制，请缩短 APP_BASE_URL');
  }

  return pageLink;
}

function resolveDingtalkOpenType(actionUrl) {
  try {
    const link = new URL(String(actionUrl || ''));
    const targetDesktop = link.searchParams.get('targetDesktop');
    if (OPEN_TYPES.has(targetDesktop)) return targetDesktop;

    const legacyPcLink = link.searchParams.get('pcLink') || '';
    if (legacyPcLink.includes('ddtab=true')) return 'workbench';
    if (legacyPcLink.includes('pc_slide=false')) return 'popupWindow';
    if (legacyPcLink.includes('pc_slide=true')) return 'slide';
  } catch (_error) {
    // 旧记录 URL 无法解析时保持历史默认侧边栏行为。
  }
  return 'slide';
}

function getTestRecipients(recipientUserIds) {
  const uniqueUserIds = [...new Set(
    (Array.isArray(recipientUserIds) ? recipientUserIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];

  if (uniqueUserIds.length === 0) {
    throw createError('INVALID_PARAM', '请至少选择一名测试人员');
  }
  if (uniqueUserIds.length > MAX_TEST_RECIPIENTS) {
    throw createError('INVALID_PARAM', '测试人员最多选择 ' + MAX_TEST_RECIPIENTS + ' 人');
  }

  const activeUserIds = new Set(
    userDao.findByIds(uniqueUserIds)
      .filter((user) => Number(user.status) === 1)
      .map((user) => String(user.id))
  );
  const inactiveOrMissing = uniqueUserIds.filter((id) => !activeUserIds.has(id));
  if (inactiveOrMissing.length > 0) {
    throw createError('INVALID_PARAM', '测试人员中包含不存在或已停用的用户');
  }

  const identities = getIdentitiesByUserIds(uniqueUserIds);
  const missingIdentities = uniqueUserIds.filter((id) => !identities.get(id)?.providerUserId);
  if (missingIdentities.length > 0) {
    throw createError('INVALID_PARAM', '测试人员中存在未同步钉钉 userid 的用户');
  }

  const usersById = new Map(
    userDao.findByIds(uniqueUserIds).map((user) => [String(user.id), user])
  );
  return uniqueUserIds.map((id) => {
    const user = usersById.get(id);
    return {
      userId: id,
      name: user?.name || user?.username || id,
      providerUserId: identities.get(id).providerUserId,
    };
  });
}

function saveActionMessage(message) {
  let draft;
  try {
    draft = broadcastDao.updateActionDraft(message.broadcastId, {
      title: message.title,
      markdown: message.markdown,
      buttonText: message.buttonText,
    });
  } catch (error) {
    if (error.code === 'BROADCAST_ALREADY_SUBMITTED') {
      throw createError('DUPLICATE', error.message);
    }
    throw error;
  }
  if (!draft) {
    throw createError('NOT_FOUND', 'HTML承载页不存在，请重新导入');
  }
  return draft;
}

/**
 * 收集全员收件人：全部启用用户 + 钉钉 userid 映射。
 * 未同步钉钉身份的用户单独列出，作为失败明细返回。
 */
function collectAllRecipients() {
  const activeUsers = userDao.findActiveUsers();
  const identities = getIdentitiesByUserIds(activeUsers.map((user) => String(user.id)));
  const recipients = [];
  const missingIdentities = [];

  for (const user of activeUsers) {
    const userId = String(user.id);
    const name = user.name || user.username || userId;
    const identity = identities.get(userId);
    if (identity?.providerUserId) {
      recipients.push({ userId, name, providerUserId: identity.providerUserId });
    } else {
      missingIdentities.push({ userId, name });
    }
  }

  return { recipients, missingIdentities };
}

/**
 * 钉钉 userid → 姓名 反查，用于失败明细展示。
 */
function resolveRecipientNames(providerUserIds) {
  const names = new Map();
  const userIdMap = getUserIdsByProviderUserIds(providerUserIds);
  const userIds = [...userIdMap.values()];
  const usersById = new Map(userDao.findByIds(userIds).map((user) => [String(user.id), user]));

  for (const [providerUserId, userId] of userIdMap.entries()) {
    const user = usersById.get(userId);
    names.set(providerUserId, user ? (user.name || user.username || userId) : userId);
  }
  return names;
}

/**
 * 将单批发送结果转成失败明细。
 * 成功批次里钉钉仍可能返回无效用户与限流用户列表，需要分别记录。
 */
function buildBatchFailures({ batchIndex, providerUserIds, result, recipientNames }) {
  const failures = [];

  function recipientDetail(providerUserId) {
    const value = recipientNames.get(providerUserId);
    if (value && typeof value === 'object') {
      return { name: value.name || providerUserId, userId: value.userId };
    }
    return { name: value || providerUserId, userId: undefined };
  }

  if (!result.success) {
    failures.push({
      kind: 'batch_error',
      batch: batchIndex + 1,
      count: providerUserIds.length,
      reason: result.error || '机器人发送失败',
    });
    return failures;
  }

  for (const providerUserId of result.invalidStaffIdList || []) {
    const detail = recipientDetail(providerUserId);
    failures.push({
      kind: 'invalid_user',
      providerUserId,
      ...(detail.userId ? { userId: detail.userId } : {}),
      name: detail.name,
      reason: '无效的钉钉用户ID',
    });
  }
  for (const providerUserId of result.flowControlledStaffIdList || []) {
    const detail = recipientDetail(providerUserId);
    failures.push({
      kind: 'flow_controlled',
      providerUserId,
      ...(detail.userId ? { userId: detail.userId } : {}),
      name: detail.name,
      reason: '被钉钉限流，请稍后重试',
    });
  }
  return failures;
}

async function sendRobotMessage({ messageType, providerUserIds, title, markdown, buttonText, singleUrl, reqId }) {
  return messageType === 'markdown'
    ? robotAdapter.sendMarkdown({ userIds: providerUserIds, title, text: markdown, reqId })
    : robotAdapter.sendActionCard({
      userIds: providerUserIds,
      title,
      markdown,
      singleTitle: buttonText,
      singleURL: singleUrl,
      reqId,
    });
}

function chunkList(list, size) {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

/**
 * 全员分批串行发送：单批失败不中断，继续发送后续批次，最终统一汇总。
 */
async function sendAllInBatches({ messageType, recipients, title, markdown, buttonText, singleUrl, reqId }) {
  const batches = chunkList(recipients, ROBOT_BATCH_SIZE);
  const failures = [];
  const recipientNames = resolveRecipientNames(recipients.map((recipient) => recipient.providerUserId));
  let primaryProcessKey = null;
  let successCount = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const providerUserIds = batch.map((recipient) => recipient.providerUserId);
    const result = await sendRobotMessage({
      messageType,
      providerUserIds,
      title,
      markdown,
      buttonText,
      singleUrl,
      reqId,
    });

    if (result.success) {
      if (!primaryProcessKey) {
        primaryProcessKey = result.processQueryKey;
      }
      const invalidCount = (result.invalidStaffIdList || []).length;
      const flowControlledCount = (result.flowControlledStaffIdList || []).length;
      successCount += Math.max(0, batch.length - invalidCount - flowControlledCount);
    }

    failures.push(...buildBatchFailures({
      batchIndex: index,
      providerUserIds,
      result,
      recipientNames,
    }));
  }

  return { primaryProcessKey, recipientCount: recipients.length, successCount, failures };
}

function enqueueTest({ payload, operatorId, reqId }) {
  const message = validateMessage(payload);
  const idempotencyKey = normalizeIdempotencyKey(payload.idempotencyKey);
  const payloadHash = hashPayload({
    scope: 'test',
    message,
    recipientUserIds: [...new Set(payload.recipientUserIds || [])].sort(),
  });
  const existing = assertIdempotentPayload(
    sendRecordDao.findByIdempotencyKey(idempotencyKey),
    payloadHash,
  );
  if (existing) {
    broadcastWorker.scheduleSend(existing.id);
    return asEnqueueResult(existing);
  }

  const recipients = getTestRecipients(payload.recipientUserIds);
  let draft = null;
  if (message.messageType === 'action_card') {
    draft = saveActionMessage(message);
  }
  const viewTrackingToken = draft ? sendRecordDao.createViewTrackingToken() : null;
  const actionUrl = draft
    ? buildDingtalkPageLink({
      publicToken: draft.public_token,
      openType: message.openType,
      viewTrackingToken,
    })
    : '';
  const record = sendRecordDao.createSendRecord({
    broadcastId: draft?.id || null,
    idempotencyKey,
    payloadHash,
    scope: 'test',
    messageType: message.messageType,
    title: message.title,
    markdown: message.markdown,
    buttonText: message.buttonText,
    coverImageUrl: message.coverImageUrl,
    actionUrl,
    viewTrackingToken,
    recipients,
    requestedBy: operatorId,
    batchSize: ROBOT_BATCH_SIZE,
  });
  auditDingtalkEvent({
    action: 'dingtalk.broadcast.test.queued',
    result: 'success',
    reqId,
    operatorId,
    recordId: record.id,
    recipientCount: record.recipient_count,
  });
  broadcastWorker.scheduleSend(record.id);
  return asEnqueueResult(record);
}

function enqueueAll({ payload, operatorId, reqId }) {
  if (payload?.confirmAll !== true) {
    throw createError('INVALID_PARAM', '全员推送必须完成二次确认');
  }

  const message = validateMessage(payload);
  const idempotencyKey = normalizeIdempotencyKey(payload.idempotencyKey);
  const payloadHash = hashPayload({ scope: 'all', message });
  const existing = assertIdempotentPayload(
    sendRecordDao.findByIdempotencyKey(idempotencyKey),
    payloadHash,
  );
  if (existing) {
    broadcastWorker.scheduleSend(existing.id);
    return asEnqueueResult(existing);
  }

  let draft = null;
  let actionUrl = '';
  let viewTrackingToken = null;

  if (message.messageType === 'action_card') {
    draft = broadcastDao.findById(message.broadcastId);
    if (!draft || draft.message_type !== 'action_card') {
      throw createError('NOT_FOUND', 'HTML承载页不存在，请重新导入');
    }
    viewTrackingToken = sendRecordDao.createViewTrackingToken();
    actionUrl = buildDingtalkPageLink({
      publicToken: draft.public_token,
      openType: message.openType,
      viewTrackingToken,
    });
  }

  let reserved;
  try {
    reserved = broadcastDao.reserveAllSend({
      broadcastId: message.broadcastId,
      messageType: message.messageType,
      title: message.title,
      markdown: message.markdown,
      buttonText: message.buttonText,
      createdBy: operatorId,
    });
  } catch (error) {
    if (error.code === 'BROADCAST_ALREADY_SUBMITTED') {
      throw createError('DUPLICATE', error.message);
    }
    throw error;
  }

  if (!reserved) {
    throw createError('NOT_FOUND', 'HTML承载页不存在，请重新导入');
  }

  const { recipients, missingIdentities } = collectAllRecipients();
  const initialFailures = missingIdentities.map((item) => ({
      kind: 'missing_identity',
      userId: item.userId,
      name: item.name,
      reason: '未同步钉钉身份，无法接收机器人消息',
    }));

  let record;
  try {
    record = sendRecordDao.createSendRecord({
      broadcastId: reserved.id,
      idempotencyKey,
      payloadHash,
      scope: 'all',
      messageType: message.messageType,
      title: message.title,
      markdown: message.markdown,
      buttonText: message.buttonText,
      coverImageUrl: message.coverImageUrl,
      actionUrl,
      viewTrackingToken,
      recipients,
      initialFailures,
      requestedBy: operatorId,
      batchSize: ROBOT_BATCH_SIZE,
    });
  } catch (error) {
    broadcastDao.releaseAllSendReservation(reserved.id, error.message);
    throw error;
  }

  auditDingtalkEvent({
    action: 'dingtalk.broadcast.all.queued',
    result: 'success',
    reqId,
    operatorId,
    broadcastId: reserved.id,
    recordId: record.id,
    recipientCount: record.recipient_count,
    batchCount: Math.ceil(recipients.length / ROBOT_BATCH_SIZE),
  });
  broadcastWorker.scheduleSend(record.id);
  return asEnqueueResult(record);
}

function recipientMap(recipients) {
  return new Map((recipients || []).map((recipient) => [recipient.providerUserId, recipient]));
}

async function processSendRecord(recordId) {
  let record = sendRecordDao.findById(recordId);
  if (!record || ['succeeded', 'partial', 'failed'].includes(record.status)) return record;

  try {
    record = sendRecordDao.markRecordSending(recordId) || record;
    const batches = sendRecordDao.getBatches(recordId);
    const recipientsByProviderId = recipientMap(record.recipients);

    for (const batch of batches) {
      if (batch.status !== 'pending' || !sendRecordDao.markBatchSending(batch.id)) continue;
      const providerUserIds = batch.recipients.map((recipient) => recipient.providerUserId);
      const result = await sendRobotMessage({
        messageType: record.message_type,
        providerUserIds,
        title: record.title,
        markdown: record.markdown,
        buttonText: record.button_text,
        singleUrl: record.action_url || '',
        reqId: record.id,
      });
      const failures = buildBatchFailures({
        batchIndex: batch.batch_index,
        providerUserIds,
        result,
        recipientNames: recipientsByProviderId,
      });
      const successCount = result.success
        ? Math.max(0, providerUserIds.length
          - (result.invalidStaffIdList || []).length
          - (result.flowControlledStaffIdList || []).length)
        : 0;
      sendRecordDao.completeBatch(batch.id, {
        status: result.success ? (failures.length ? 'partial' : 'succeeded') : 'failed',
        processQueryKey: result.processQueryKey,
        successCount,
        failures,
        error: result.error,
      });
    }

    const settledBatches = sendRecordDao.getBatches(recordId);
    const failures = [
      ...(record.initialFailures || []),
      ...settledBatches.flatMap((batch) => batch.failures || []),
    ];
    const successCount = settledBatches.reduce(
      (total, batch) => total + (Number(batch.success_count) || 0),
      0,
    );
    const status = successCount === Number(record.recipient_count) && failures.length === 0
      ? 'succeeded'
      : successCount > 0
        ? 'partial'
        : 'failed';
    const error = status === 'failed'
      ? (failures[0]?.reason || '钉钉机器人发送失败')
      : null;
    const finalized = sendRecordDao.finalizeRecord(recordId, { status, successCount, failures, error });
    const primaryProcessKey = settledBatches.find((batch) => batch.process_query_key)?.process_query_key;

    if (record.scope === 'test' && record.broadcast_id) {
      broadcastDao.markTestResult(record.broadcast_id, { processKey: primaryProcessKey, error });
    }
    if (record.scope === 'all' && record.broadcast_id) {
      broadcastDao.markAllResult(record.broadcast_id, {
        processKey: primaryProcessKey,
        resultJson: failures,
        error,
      });
    }

    auditDingtalkEvent({
      action: `dingtalk.broadcast.${record.scope}`,
      result: status === 'succeeded' ? 'success' : status === 'partial' ? 'warning' : 'failed',
      level: status === 'failed' ? 'error' : status === 'partial' ? 'warn' : 'info',
      reqId: record.id,
      operatorId: record.requested_by,
      recordId,
      broadcastId: record.broadcast_id,
      messageType: record.message_type,
      recipientCount: record.recipient_count,
      successCount,
      failureCount: failures.length,
      batchCount: settledBatches.length,
      processQueryKey: primaryProcessKey,
      errorMessage: error,
    });
    return finalized;
  } catch (error) {
    sendRecordDao.failActiveBatches(recordId, error.message);
    const settledBatches = sendRecordDao.getBatches(recordId);
    const failures = [
      ...(record?.initialFailures || []),
      ...settledBatches.flatMap((batch) => batch.failures || []),
    ];
    const successCount = settledBatches.reduce(
      (total, batch) => total + (Number(batch.success_count) || 0),
      0,
    );
    const status = successCount > 0 ? 'partial' : 'failed';
    const finalized = sendRecordDao.finalizeRecord(recordId, {
      status,
      successCount,
      failures,
      error: error.message,
    });
    if (record?.scope === 'all' && record.broadcast_id) {
      const primaryProcessKey = settledBatches.find((batch) => batch.process_query_key)?.process_query_key;
      broadcastDao.markAllResult(record.broadcast_id, {
        processKey: primaryProcessKey,
        resultJson: failures,
        error: error.message,
      });
    }
    return finalized;
  }
}

function retryFailures({ recordId, idempotencyKey, operatorId, reqId }) {
  const parent = sendRecordDao.findById(recordId);
  if (!parent) throw createError('NOT_FOUND', '发送记录不存在');
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const retryProviderIds = [...new Set(
    (parent.failures || [])
      .filter((failure) => failure.kind === 'flow_controlled' && failure.providerUserId)
      .map((failure) => failure.providerUserId)
  )].sort();
  if (retryProviderIds.length === 0) {
    throw createError('INVALID_PARAM', '这条记录没有可安全补发的限流人员');
  }
  const payloadHash = hashPayload({ scope: 'retry', parentRecordId: parent.id, retryProviderIds });
  const existing = assertIdempotentPayload(sendRecordDao.findByIdempotencyKey(normalizedKey), payloadHash);
  if (existing) {
    broadcastWorker.scheduleSend(existing.id);
    return asEnqueueResult(existing);
  }
  const retrySet = new Set(retryProviderIds);
  const recipients = (parent.recipients || []).filter((recipient) => retrySet.has(recipient.providerUserId));
  let retryActionUrl = parent.action_url || '';
  let viewTrackingToken = null;
  if (parent.message_type === 'action_card' && parent.broadcast_id) {
    const broadcast = broadcastDao.findById(parent.broadcast_id);
    if (broadcast?.public_token) {
      viewTrackingToken = sendRecordDao.createViewTrackingToken();
      retryActionUrl = buildDingtalkPageLink({
        publicToken: broadcast.public_token,
        openType: resolveDingtalkOpenType(parent.action_url),
        viewTrackingToken,
      });
    }
  }
  const record = sendRecordDao.createSendRecord({
    broadcastId: parent.broadcast_id,
    parentRecordId: parent.id,
    idempotencyKey: normalizedKey,
    payloadHash,
    scope: 'retry',
    messageType: parent.message_type,
    title: parent.title,
    markdown: parent.markdown,
    buttonText: parent.button_text,
    coverImageUrl: parent.cover_image_url,
    actionUrl: retryActionUrl,
    viewTrackingToken,
    recipients,
    requestedBy: operatorId,
    batchSize: ROBOT_BATCH_SIZE,
  });
  auditDingtalkEvent({
    action: 'dingtalk.broadcast.retry.queued',
    result: 'success',
    reqId,
    operatorId,
    recordId: record.id,
    parentRecordId: parent.id,
    recipientCount: recipients.length,
  });
  broadcastWorker.scheduleSend(record.id);
  return asEnqueueResult(record);
}

function requestRecall({ recordId, operatorId, reqId }) {
  const requested = sendRecordDao.requestRecall(recordId, operatorId);
  if (!requested.record) throw createError('NOT_FOUND', '发送记录不存在');
  if (requested.reason === 'expired') throw createError('INVALID_PARAM', '消息已超过24小时撤回期限');
  if (requested.reason === 'sending') throw createError('INVALID_PARAM', '消息仍在发送中，暂时不能撤回');
  if (requested.reason === 'no_keys') throw createError('INVALID_PARAM', '这条记录没有可撤回的成功批次');
  if (requested.reason === 'recalled') return asRecordItem(requested.record);
  auditDingtalkEvent({
    action: 'dingtalk.broadcast.recall.queued',
    result: 'success',
    reqId,
    operatorId,
    recordId,
  });
  broadcastWorker.scheduleRecall(recordId);
  return asRecordItem(requested.record);
}

async function processRecallRecord(recordId) {
  const record = sendRecordDao.findById(recordId);
  if (!record || record.recall_status === 'recalled') return record;
  try {
    const batches = sendRecordDao.getRecallableBatches(recordId);

    for (const group of chunkList(batches, RECALL_BATCH_SIZE)) {
      const keys = group.map((batch) => batch.process_query_key);
      const result = await robotAdapter.batchRecall({ processQueryKeys: keys, reqId: recordId });
      const successes = new Set(result.successResult || []);
      for (const batch of group) {
        const key = batch.process_query_key;
        const recalled = successes.has(key);
        sendRecordDao.completeBatchRecall(batch.id, {
          recalled,
          error: recalled
            ? null
            : (result.failedResult?.[key] || result.error || '钉钉未确认该批次撤回成功'),
        });
      }
    }

    const finalized = sendRecordDao.finalizeRecall(recordId);
    auditDingtalkEvent({
      action: 'dingtalk.broadcast.recall',
      result: finalized.recall_status === 'recalled' ? 'success' : 'failed',
      level: finalized.recall_status === 'recalled' ? 'info' : 'error',
      reqId: recordId,
      operatorId: record.recall_requested_by || record.requested_by,
      recordId,
      recallStatus: finalized.recall_status,
      errorMessage: finalized.recall_error,
    });
    return finalized;
  } catch (error) {
    sendRecordDao.failPendingRecallBatches(recordId, error.message);
    return sendRecordDao.finalizeRecall(recordId);
  }
}

function asRecordItem(record) {
  return {
    id: record.id,
    parentRecordId: record.parent_record_id || null,
    scope: record.scope,
    messageType: record.message_type,
    title: record.title,
    recipientCount: Number(record.recipient_count) || 0,
    successCount: Number(record.success_count) || 0,
    failureCount: Number(record.failure_count) || 0,
    viewCount: Number(record.view_count) || 0,
    viewTrackingEnabled: Boolean(record.view_tracking_token),
    status: record.status,
    recallStatus: record.recall_status,
    recallDeadlineAt: record.recall_deadline_at,
    createdAt: record.created_at,
    finishedAt: record.finished_at || null,
    requestedByName: record.requested_by_name || record.requested_by,
    lastError: record.last_error || null,
    recallError: record.recall_error || null,
    failures: record.failures || [],
    processKeyCount: Number(record.processKeyCount) || 0,
    canRecall: Boolean(record.canRecall),
    recallExpired: Boolean(record.recallExpired),
    canRetry: Boolean(record.canRetry),
    retryableCount: Number(record.retryableCount) || 0,
  };
}

function getRecordFeed(params) {
  const feed = sendRecordDao.listRecords(params);
  return { ...feed, list: feed.list.map(asRecordItem) };
}

function getPushSummary() {
  const latest = sendRecordDao.getLatestAllResult();
  if (!latest) return { latestAll: null };
  const batches = sendRecordDao.getBatches(latest.id);
  return {
    latestAll: {
      recordId: latest.id,
      broadcastId: latest.broadcast_id,
      messageType: latest.message_type,
      title: latest.title,
      status: latest.status,
      processKey: batches.find((batch) => batch.process_query_key)?.process_query_key || null,
      submittedAt: latest.created_at,
      error: latest.last_error || null,
      failures: latest.failures || [],
      recallStatus: latest.recall_status,
    },
  };
}

function resumePendingRecords() {
  sendRecordDao.recoverInterruptedRecords();
  for (const recordId of sendRecordDao.listQueuedRecordIds()) {
    broadcastWorker.scheduleSend(recordId);
  }
  for (const recordId of sendRecordDao.listRecallingRecordIds()) {
    broadcastWorker.scheduleRecall(recordId);
  }
}

module.exports = {
  MAX_TEST_RECIPIENTS,
  RECALL_BATCH_SIZE,
  ROBOT_BATCH_SIZE,
  asRecordItem,
  buildActionCardText,
  buildBatchFailures,
  buildDingtalkPageLink,
  buildPublicPageUrl,
  chunkList,
  collectAllRecipients,
  enqueueAll,
  enqueueTest,
  getPushSummary,
  getRecordFeed,
  processRecallRecord,
  processSendRecord,
  requestRecall,
  resolveDingtalkOpenType,
  resumePendingRecords,
  retryFailures,
  sendAll: enqueueAll,
  sendAllInBatches,
  sendTest: enqueueTest,
  validateMessage,
};
