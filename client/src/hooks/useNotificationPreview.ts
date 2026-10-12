/**
 * 通知预览状态 Hook
 *
 * 管理任务详情抽屉中字段修改的聚合预览。
 * 30 秒倒计时到期后自动发送通知，期间继续修改会重置倒计时。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChangeItem {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  count?: number;
}

/** 字段中文标签 */
const FIELD_LABELS: Record<string, string> = {
  title: '标题',
  description: '描述',
  status: '状态',
  assignee_id: '负责人',
  participant_ids: '参与人',
  priority: '优先级',
  due_date: '截止时间',
  start_date: '开始时间',
  reminder_rule: '一次性提醒',
  periodic_interval_days: '循环周期提醒',
  periodic_time: '提醒时刻',
  comment: '新评论',
};

/** 字段 → 通知角色 */
const FIELD_ROLES: Record<string, string[]> = {
  title: ['负责人', '参与人', '发起人'],
  description: ['负责人', '参与人', '发起人'],
  status: ['负责人', '参与人', '发起人'],
  assignee_id: ['负责人', '参与人', '发起人'],
  participant_ids: ['负责人', '发起人'],
  priority: ['负责人', '参与人', '发起人'],
  due_date: ['负责人', '参与人', '发起人'],
  start_date: ['负责人', '参与人', '发起人'],
  reminder_rule: ['负责人', '发起人'],
  periodic_interval_days: ['负责人', '发起人'],
  periodic_time: ['负责人', '发起人'],
  comment: ['负责人', '参与人', '发起人'],
};

const COUNTDOWN_SECONDS = 30;

interface UseNotificationPreviewOptions {
  /** 当前任务范围，用于隔离不同任务的聚合通知状态 */
  scopeId?: string | null;
  onSend?: (changes: ChangeItem[], scopeId: string | null) => void | Promise<void>;
}

export function useNotificationPreview(options?: UseNotificationPreviewOptions) {
  const [changes, setChanges] = useState<Map<string, ChangeItem>>(new Map());
  const [countdown, setCountdown] = useState(0);
  const [visible, setVisible] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewScopeId, setPreviewScopeId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef(0);
  const changesRef = useRef<Map<string, ChangeItem>>(new Map());
  const previewScopeIdRef = useRef<string | null>(null);
  const currentScopeIdRef = useRef<string | null>(options?.scopeId ?? null);
  const onSendRef = useRef(options?.onSend);
  currentScopeIdRef.current = options?.scopeId ?? null;
  onSendRef.current = options?.onSend;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const doSend = useCallback(async () => {
    clearTimer();
    const items = [...changesRef.current.values()];
    const sourceScopeId = previewScopeIdRef.current;
    if (items.length > 0) {
      await onSendRef.current?.(items, sourceScopeId);
    }
    changesRef.current = new Map();
    setChanges(new Map());
    setCountdown(0);
    if (sourceScopeId && sourceScopeId === currentScopeIdRef.current) {
      setSent(true);
      setVisible(true);
    } else {
      previewScopeIdRef.current = null;
      setPreviewScopeId(null);
      setSent(false);
      setVisible(false);
    }
  }, [clearTimer]);

  const startTimer = useCallback(() => {
    clearTimer();
    setSent(false);
    countdownRef.current = COUNTDOWN_SECONDS;
    setCountdown(COUNTDOWN_SECONDS);
    setVisible(true);

    timerRef.current = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);

      if (countdownRef.current <= 0) {
        void doSend();
      }
    }, 1000);
  }, [clearTimer, doSend]);

  const dismiss = useCallback(() => {
    changesRef.current = new Map();
    previewScopeIdRef.current = null;
    setChanges(new Map());
    setPreviewScopeId(null);
    setSent(false);
    setVisible(false);
  }, []);

  /**
   * 追踪字段变更
   * comment 字段特殊处理：累计计数而非覆盖
   */
  const trackChange = useCallback(
    (field: string, oldValue: unknown, newValue: unknown): boolean => {
      const activeScopeId = currentScopeIdRef.current;
      if (!activeScopeId) return false;

      const existing = changesRef.current.get(field);

      const item: ChangeItem = field === 'comment'
        ? {
            field,
            label: FIELD_LABELS[field],
            oldValue: null,
            newValue: null,
            count: (existing?.count ?? 0) + 1,
          }
        : {
            field,
            label: FIELD_LABELS[field] || field,
            oldValue,
            newValue,
          };

      changesRef.current.set(field, item);
      previewScopeIdRef.current = activeScopeId;
      setPreviewScopeId(activeScopeId);
      setChanges(new Map(changesRef.current));
      startTimer(); // 重置倒计时
      return true;
    },
    [startTimer]
  );

  const send = useCallback(async () => {
    await doSend();
  }, [doSend]);

  // 计算通知角色
  const recipients = [...changes.values()].reduce<Set<string>>((acc, item) => {
    const roles = FIELD_ROLES[item.field] || [];
    roles.forEach((r) => acc.add(r));
    return acc;
  }, new Set());

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  useEffect(() => {
    const sourceScopeId = previewScopeIdRef.current;
    const currentScopeId = options?.scopeId ?? null;
    if (!sourceScopeId || sourceScopeId === currentScopeId || changesRef.current.size > 0) return;

    previewScopeIdRef.current = null;
    setPreviewScopeId(null);
    setSent(false);
    setVisible(false);
  }, [options?.scopeId]);

  return {
    visible: visible && Boolean(previewScopeId) && previewScopeId === (options?.scopeId ?? null),
    sent,
    scopeId: previewScopeId,
    changes: [...changes.values()],
    recipients: [...recipients],
    countdown,
    countdownMax: COUNTDOWN_SECONDS,
    trackChange,
    send,
    /** 抽屉关闭时调用：如果有 pending changes 则立即发送 */
    flush: doSend,
    /** 发送成功后手动关闭面板 */
    dismiss,
  };
}
