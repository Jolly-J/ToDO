/** 管理后台运行总览：展示可解释的系统指标与最近运行事件。 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchAdminHealth } from './api';
import {
  AdminPageHeader,
  AdminTruncatedText,
  EmptyPanel,
  StatusInline,
  formatDateTime,
  getToneLabel,
} from './shared';
import type { AdminHealthInfo, AdminHealthMetric } from './types';
import styles from './Admin.module.css';
import { cn } from '@/lib/utils';

function HealthMetric({ metric }: { metric: AdminHealthMetric & { id: string } }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 lg:border-l lg:border-border lg:first:border-l-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-foreground">{metric.label}</p>
          <StatusInline tone={metric.tone} label={getToneLabel(metric.tone)} />
        </div>
        <AdminTruncatedText className="mt-1 text-[11px] text-muted-foreground" >{metric.detail}</AdminTruncatedText>
      </div>
      <div className="text-right">
        <p className={cn(styles.mono, 'text-xl font-semibold tracking-tight text-foreground')}>{metric.value}</p>
        <p className={cn(styles.mono, 'mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground')}>
          {formatDateTime(metric.lastEventAt || metric.lastCreatedAt)}
        </p>
        <AdminTruncatedText className={cn(styles.mono, 'max-w-32 text-[10px] text-muted-foreground')}>
          {metric.source}
        </AdminTruncatedText>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<AdminHealthInfo | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await fetchAdminHealth());
    } catch (nextError) {
      setError(String((nextError as Error)?.message || '运行数据获取失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const metrics = useMemo(() => health ? [
    { id: 'login', ...health.metrics.login },
    { id: 'sync', ...health.metrics.sync },
    { id: 'notifications', ...health.metrics.notifications },
  ] : [], [health]);

  const recentEvents = health?.recentEvents || [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <AdminPageHeader
        title="运行总览"
        description="用真实日志与通知入库数据判断登录、组织同步和消息链路是否正常。每个指标都标明采样时间与来源。"
        actions={(
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadHealth()}>
            <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
            刷新数据
          </Button>
        )}
      />

      <section aria-label="运行状态证据">
        {loading ? (
          <Skeleton className="h-20 w-full rounded-md" />
        ) : error ? (
          <EmptyPanel message={error} />
        ) : (
          <Card className="bg-background">
            <CardContent className="grid p-0 lg:grid-cols-3">
              {metrics.map((metric) => <HealthMetric key={metric.id} metric={metric} />)}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between gap-4 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">最近运行事件</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {health ? `采样窗口 ${health.windowHours} 小时 · 更新于 ${formatDateTime(health.generatedAt)}` : '等待运行数据'}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/audit">查看完整审计 <ArrowRight data-icon="inline-end" /></Link>
          </Button>
        </div>

        <div className="min-h-0">
          {loading ? (
            <div className="flex w-full flex-col gap-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : error ? null : recentEvents.length ? (
            <div className="max-h-[min(55vh,34rem)] overflow-auto rounded-md border border-border bg-background">
              <Table className="min-w-[900px] table-fixed">
                <colgroup>
                  <col className="w-[180px]" />
                  <col />
                  <col className="w-[110px]" />
                  <col className="w-[90px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">事件</TableHead>
                    <TableHead className="whitespace-nowrap">摘要</TableHead>
                    <TableHead className="whitespace-nowrap">结果</TableHead>
                    <TableHead className="whitespace-nowrap">级别</TableHead>
                    <TableHead className="whitespace-nowrap">时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {recentEvents.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell><AdminTruncatedText className="font-medium text-foreground">{item.title}</AdminTruncatedText></TableCell>
                    <TableCell><AdminTruncatedText className="text-muted-foreground">{item.detail}</AdminTruncatedText></TableCell>
                    <TableCell><StatusInline tone={item.level} label={item.label} /></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{getToneLabel(item.level)}</TableCell>
                    <TableCell className={cn(styles.mono, 'whitespace-nowrap text-muted-foreground')}>{formatDateTime(item.time)}</TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyPanel message="当前采样窗口内没有登录或组织同步事件" />
          )}
        </div>
      </section>
    </div>
  );
}
