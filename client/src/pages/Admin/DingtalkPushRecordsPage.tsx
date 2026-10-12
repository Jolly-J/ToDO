/** 钉钉推送发送记录：展示测试、全员和失败补发，并支持24小时内撤回。 */

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  fetchDingtalkPushRecords,
  recallDingtalkPushRecord,
  retryDingtalkPushFailures,
} from './api';
import {
  AdminPageHeader,
  AdminPagination,
  AdminTruncatedText,
  EmptyPanel,
  StatusInline,
  formatDateTime,
} from './shared';
import type { DingtalkPushRecordFeed, DingtalkPushRecordItem, StatusTone } from './types';

const PAGE_SIZE = 20;

const sendStatus: Record<string, { label: string; tone: StatusTone }> = {
  queued: { label: '排队中', tone: 'neutral' },
  sending: { label: '发送中', tone: 'warning' },
  succeeded: { label: '发送成功', tone: 'success' },
  partial: { label: '部分成功', tone: 'warning' },
  failed: { label: '发送失败', tone: 'error' },
};

const recallLabels: Record<string, string> = {
  none: '未撤回',
  recalling: '撤回中',
  recalled: '已撤回',
  partial: '部分撤回',
  failed: '撤回失败',
};

const scopeLabels: Record<string, string> = {
  test: '测试',
  all: '全员',
  retry: '失败补发',
};

type PendingAction = { type: 'recall' | 'retry'; record: DingtalkPushRecordItem } | null;

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.()
    || `broadcast-retry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function DingtalkPushRecordsPage() {
  const [feed, setFeed] = useState<DingtalkPushRecordFeed | null>(null);
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const requestSequence = useRef(0);
  const hasLoaded = useRef(false);
  const retryKeys = useRef(new Map<string, string>());

  useEffect(() => {
    const sequence = ++requestSequence.current;
    if (!hasLoaded.current) setLoading(true);
    setError(null);
    void fetchDingtalkPushRecords({ page, pageSize: PAGE_SIZE })
      .then((payload) => {
        if (sequence === requestSequence.current) {
          hasLoaded.current = true;
          setFeed(payload);
        }
      })
      .catch((nextError) => {
        if (sequence === requestSequence.current && !hasLoaded.current) {
          setError(String((nextError as Error)?.message || '发送记录加载失败'));
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) {
          setLoading(false);
        }
      });
  }, [page, refreshVersion]);

  const hasActiveRecord = feed?.list.some(
    (record) => ['queued', 'sending'].includes(record.status) || record.recallStatus === 'recalling'
  );

  useEffect(() => {
    if (document.visibilityState === 'hidden') return undefined;
    const refreshDelay = hasActiveRecord ? 2000 : 5000;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        setRefreshVersion((value) => value + 1);
      }
    }, refreshDelay);
    return () => window.clearTimeout(timer);
  }, [hasActiveRecord, refreshVersion]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        setRefreshVersion((value) => value + 1);
      }
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, []);

  const runPendingAction = async () => {
    if (!pendingAction) return;
    const { type, record } = pendingAction;
    setActionBusy(true);
    try {
      if (type === 'recall') {
        await recallDingtalkPushRecord(record.id);
        toast.success('撤回任务已提交');
      } else {
        const key = retryKeys.current.get(record.id) || createIdempotencyKey();
        retryKeys.current.set(record.id, key);
        await retryDingtalkPushFailures(record.id, key);
        retryKeys.current.delete(record.id);
        toast.success('限流人员补发任务已提交');
      }
      setPendingAction(null);
      setRefreshVersion((value) => value + 1);
    } catch {
      // 请求层已经显示错误信息；补发失败时保留同一幂等键供安全重试。
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <AdminPageHeader
        title="钉钉发送记录"
        description="查看测试、全员和失败补发记录；阅读量按承载页打开次数统计，机器人单聊消息只能在发送后24小时内撤回。"
        actions={(
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => setRefreshVersion((value) => value + 1)}>
            <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
            刷新记录
          </Button>
        )}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {loading && !feed ? (
          <div className="flex w-full flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error ? (
          <EmptyPanel message={error} />
        ) : feed?.list.length ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background">
            <div className="min-h-0 flex-1 overflow-auto">
              <Table className="min-w-[1220px] table-fixed">
                <colgroup>
                  <col />
                  <col className="w-[90px]" />
                  <col className="w-[110px]" />
                  <col className="w-[100px]" />
                  <col className="w-[120px]" />
                  <col className="w-[150px]" />
                  <col className="w-[140px]" />
                  <col className="w-[220px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>消息</TableHead>
                    <TableHead>范围</TableHead>
                    <TableHead>人数</TableHead>
                    <TableHead title="承载页打开次数，重复打开会重复计数">阅读量</TableHead>
                    <TableHead>发送状态</TableHead>
                    <TableHead>撤回状态</TableHead>
                    <TableHead>发送时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feed.list.map((record) => {
                    const status = sendStatus[record.status] || { label: record.status, tone: 'neutral' as const };
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          <AdminTruncatedText className="font-medium text-foreground">{record.title}</AdminTruncatedText>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {record.messageType === 'action_card' ? 'ActionCard' : 'Markdown'} · {record.requestedByName}
                          </span>
                          {record.recallError || record.lastError ? (
                            <AdminTruncatedText className="mt-0.5 text-xs text-destructive">
                              {record.recallError || record.lastError || ''}
                            </AdminTruncatedText>
                          ) : null}
                        </TableCell>
                        <TableCell><Badge variant="secondary">{scopeLabels[record.scope] || record.scope}</Badge></TableCell>
                        <TableCell className="tabular-nums">
                          {record.successCount}/{record.recipientCount}
                          {record.failureCount ? <span className="block text-xs text-destructive">失败 {record.failureCount}</span> : null}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {record.viewTrackingEnabled
                            ? record.viewCount
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><StatusInline tone={status.tone} label={status.label} /></TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {record.processKeyCount === 0
                              ? '不可撤回'
                              : record.recallExpired && record.recallStatus !== 'recalled'
                                ? '已过期'
                                : recallLabels[record.recallStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(record.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {record.canRecall ? (
                              <Button type="button" size="sm" variant="destructive" onClick={() => setPendingAction({ type: 'recall', record })}>
                                <Undo2 data-icon="inline-start" />
                                {record.recallStatus === 'partial' || record.recallStatus === 'failed' ? '重试撤回' : '撤回'}
                              </Button>
                            ) : null}
                            {record.canRetry ? (
                              <Button type="button" size="sm" variant="outline" onClick={() => setPendingAction({ type: 'retry', record })}>
                                <RotateCcw data-icon="inline-start" />
                                补发 {record.retryableCount} 人
                              </Button>
                            ) : null}
                            {!record.canRecall && !record.canRetry && ['queued', 'sending'].includes(record.status) ? (
                              <span className="text-xs text-muted-foreground">处理中</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <AdminPagination page={page} pageSize={PAGE_SIZE} total={feed.total} onPageChange={setPage} />
          </div>
        ) : (
          <EmptyPanel message="暂无钉钉发送记录" />
        )}
      </div>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open && !actionBusy) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.type === 'recall' ? '确认撤回这次消息？' : '确认补发限流人员？'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'recall'
                ? '系统会撤回这条记录下所有仍可撤回的成功批次。钉钉聊天框中不会显示撤回提示。'
                : `系统只会补发钉钉明确返回为限流的 ${pendingAction?.record.retryableCount || 0} 人，不会自动重发结果不确定的批次。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button type="button" variant="outline" disabled={actionBusy}>取消</Button></AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant={pendingAction?.type === 'recall' ? 'destructive' : 'default'} disabled={actionBusy} onClick={() => void runPendingAction()}>
                {actionBusy
                  ? <Spinner data-icon="inline-start" />
                  : pendingAction?.type === 'recall'
                    ? <Undo2 data-icon="inline-start" />
                    : <RotateCcw data-icon="inline-start" />}
                {actionBusy ? '处理中...' : pendingAction?.type === 'recall' ? '确认撤回' : '确认补发'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
