/** 审计中心：聚合后台运行与业务操作事件，提供稳定筛选、分页和事件详情。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDebounce } from '@/hooks';
import { fetchAdminAudit } from './api';
import {
  AdminFilterSelect,
  AdminPageHeader,
  AdminPagination,
  AdminTruncatedText,
  EmptyPanel,
  StatusInline,
  formatDateTime,
} from './shared';
import type { AdminAuditFeed, AdminAuditItem } from './types';
import { cn } from '@/lib/utils';
import styles from './Admin.module.css';

const PAGE_SIZE = 50;
const resultLabels: Record<string, string> = {
  success: '成功',
  failed: '失败',
  warning: '关注',
  skipped: '跳过',
};

function AuditDetailDialog({ item, onClose }: { item: AdminAuditItem | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(92vw,44rem)] max-w-none">
        <DialogHeader>
          <DialogTitle>{item?.title || '事件详情'}</DialogTitle>
          <DialogDescription>{item?.detail}</DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="grid gap-4">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-lg border border-border bg-accent/30 p-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">动作</dt><dd className={cn(styles.mono, 'mt-1 break-all')}>{item.action}</dd></div>
              <div><dt className="text-xs text-muted-foreground">结果</dt><dd className="mt-1"><StatusInline tone={item.tone} label={item.label} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">时间</dt><dd className={cn(styles.mono, 'mt-1')}>{formatDateTime(item.time)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">耗时</dt><dd className={cn(styles.mono, 'mt-1')}>{item.durationMs || 0} ms</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted-foreground">请求标识</dt><dd className={cn(styles.mono, 'mt-1 break-all')}>{item.reqId || '未记录'}</dd></div>
            </dl>
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">原始事件</p>
              <pre className={cn(styles.mono, 'max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-[11px] leading-5 text-slate-200')}>
                {JSON.stringify(item.raw, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function AuditPage() {
  const [keywordInput, setKeywordInput] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditFeed, setAuditFeed] = useState<AdminAuditFeed | null>(null);
  const [selectedItem, setSelectedItem] = useState<AdminAuditItem | null>(null);
  const requestSequence = useRef(0);
  const debouncedKeyword = useDebounce(keywordInput.trim(), 300);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);

    void fetchAdminAudit({
      keyword: debouncedKeyword || undefined,
      action: actionFilter !== 'all' ? actionFilter : undefined,
      result: resultFilter !== 'all' ? resultFilter : undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((payload) => {
        if (sequence === requestSequence.current) setAuditFeed(payload);
      })
      .catch((nextError) => {
        if (sequence === requestSequence.current) {
          setError(String((nextError as Error)?.message || '审计事件加载失败'));
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false);
      });
  }, [actionFilter, debouncedKeyword, page, refreshVersion, resultFilter]);

  const summary = useMemo(() => ({
    total: auditFeed?.total || 0,
    successCount: auditFeed?.summary.successCount || 0,
    failedCount: auditFeed?.summary.failedCount || 0,
    attentionCount: (auditFeed?.summary.warningCount || 0) + (auditFeed?.summary.skippedCount || 0),
  }), [auditFeed]);

  const resetPage = () => setPage(1);
  const summaryItems = [
    { label: '当前结果', value: summary.total, className: '' },
    { label: '成功', value: summary.successCount, className: '' },
    { label: '失败', value: summary.failedCount, className: 'text-destructive' },
    { label: '需关注', value: summary.attentionCount, className: 'text-amber-600' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <AdminPageHeader
        title="审计中心"
        description="统一查看登录、组织同步、任务、评论、权限与通知事件。点击事件可查看请求标识和原始记录。"
        actions={(
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => setRefreshVersion((value) => value + 1)}>
            <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
            刷新事件
          </Button>
        )}
      />

      <Card className="bg-background">
        <CardContent className="grid grid-cols-2 p-0 lg:grid-cols-4">
          {summaryItems.map((item, index) => (
            <div key={item.label} className={cn('flex items-center justify-between gap-3 px-4 py-2.5', index > 0 && 'border-l border-border')}>
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <strong className={cn(styles.mono, 'text-lg font-semibold tabular-nums text-foreground', item.className)}>{item.value}</strong>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 py-0.5">
          <Input
            value={keywordInput}
            onChange={(event) => { setKeywordInput(event.target.value); resetPage(); }}
            placeholder="搜索动作、用户、任务或错误"
            className="h-9 w-64"
          />
          <AdminFilterSelect
            value={actionFilter}
            onValueChange={(value) => { setActionFilter(value); resetPage(); }}
            ariaLabel="审计动作"
            triggerClassName="h-9 w-[176px]"
            options={[
              { value: 'all', label: '全部动作' },
              ...((auditFeed?.facets.actions || []).map((action) => ({ value: action, label: action }))),
            ]}
          />
          <AdminFilterSelect
            value={resultFilter}
            onValueChange={(value) => { setResultFilter(value); resetPage(); }}
            ariaLabel="审计结果"
            triggerClassName="h-9 w-[132px]"
            options={[
              { value: 'all', label: '全部结果' },
              ...((auditFeed?.facets.results || []).map((result) => ({ value: result, label: resultLabels[result] || result }))),
            ]}
          />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="flex w-full flex-col gap-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : error ? (
            <EmptyPanel message={error} />
          ) : auditFeed?.list.length ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background">
              <div className="min-h-0 flex-1 overflow-auto">
                <Table className="min-w-[1040px] table-fixed">
                <colgroup>
                  <col />
                  <col className="w-[220px]" />
                  <col className="w-[100px]" />
                  <col className="w-[120px]" />
                  <col className="w-[280px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">事件</TableHead>
                    <TableHead className="whitespace-nowrap">动作</TableHead>
                    <TableHead className="whitespace-nowrap">结果</TableHead>
                    <TableHead className="whitespace-nowrap">时间</TableHead>
                    <TableHead className="whitespace-nowrap">REQID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {auditFeed.list.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => setSelectedItem(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedItem(item);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <AdminTruncatedText className="font-medium text-foreground">{item.title}</AdminTruncatedText>
                        <AdminTruncatedText className="mt-0.5 text-xs text-muted-foreground">{item.detail}</AdminTruncatedText>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className={cn(styles.mono, 'max-w-full font-normal')}><span className="truncate">{item.action}</span></Badge></TableCell>
                    <TableCell><StatusInline tone={item.tone} label={item.label} /></TableCell>
                    <TableCell className={cn(styles.mono, 'whitespace-nowrap text-muted-foreground')}>{formatDateTime(item.time)}</TableCell>
                    <TableCell><AdminTruncatedText className={cn(styles.mono, 'text-xs text-muted-foreground')}>{item.reqId || '-'}</AdminTruncatedText></TableCell>
                  </TableRow>
                ))}
                </TableBody>
                </Table>
              </div>
              <AdminPagination page={page} pageSize={PAGE_SIZE} total={auditFeed.total} onPageChange={setPage} />
            </div>
          ) : (
            <EmptyPanel message="当前筛选条件下没有审计事件，请调整条件后重试" />
          )}
      </div>

      <AuditDetailDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
