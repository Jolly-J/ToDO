/** 管理后台任务治理：提供完整分页、稳定筛选与无副作用的只读详情。 */
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useDebounce } from '@/hooks';
import { fetchAdminTasks } from './api';
import {
  AdminFilterSelect,
  AdminPageHeader,
  AdminPagination,
  AdminTruncatedText,
  EmptyPanel,
  formatDateTime,
} from './shared';
import type { AdminTaskFeed } from './types';
import PriorityTag from '@/components/task/meta/PriorityTag';
import StatusTag from '@/components/task/meta/StatusTag';
import { getPriorityLabel, getStatusLabel } from '@/config/taskSemanticColors';
import TaskDetailDrawer from '@/components/task/detail/TaskDetailDrawer';
import { cn } from '@/lib/utils';
import styles from './Admin.module.css';

const PAGE_SIZE = 50;

export default function AdminDataPage() {
  const [keywordInput, setKeywordInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<AdminTaskFeed | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const debouncedKeyword = useDebounce(keywordInput.trim(), 300);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);

    void fetchAdminTasks({
      keyword: debouncedKeyword || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      teamId: teamFilter !== 'all' ? teamFilter : undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((payload) => {
        if (sequence === requestSequence.current) setFeed(payload);
      })
      .catch((nextError) => {
        if (sequence === requestSequence.current) {
          setError(String((nextError as Error)?.message || '任务列表加载失败'));
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false);
      });
  }, [debouncedKeyword, page, priorityFilter, refreshVersion, statusFilter, teamFilter]);

  const resetPage = () => setPage(1);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <AdminPageHeader
        title="任务治理"
        description="跨团队查看任务分布和责任信息。此页面只用于治理核查，打开详情不会修改任务或评论状态。"
        actions={(
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => setRefreshVersion((value) => value + 1)}>
            <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
            刷新列表
          </Button>
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={keywordInput}
              onChange={(event) => {
                setKeywordInput(event.target.value);
                resetPage();
              }}
              placeholder="搜索任务、描述或人员"
              className="h-9 w-60"
            />
            <AdminFilterSelect
              value={teamFilter}
              onValueChange={(value) => { setTeamFilter(value); resetPage(); }}
              ariaLabel="任务团队"
              triggerClassName="h-9 w-[148px]"
              options={[
                { value: 'all', label: '全部团队' },
                ...((feed?.facets.teams || []).map((team) => ({ value: team.id, label: team.name }))),
              ]}
            />
            <AdminFilterSelect
              value={statusFilter}
              onValueChange={(value) => { setStatusFilter(value); resetPage(); }}
              ariaLabel="任务状态"
              triggerClassName="h-9 w-[132px]"
              options={[
                { value: 'all', label: '全部状态' },
                ...((feed?.facets.statuses || []).map((status) => ({ value: status, label: getStatusLabel(status) }))),
              ]}
            />
            <AdminFilterSelect
              value={priorityFilter}
              onValueChange={(value) => { setPriorityFilter(value); resetPage(); }}
              ariaLabel="任务优先级"
              triggerClassName="h-9 w-[132px]"
              options={[
                { value: 'all', label: '全部优先级' },
                ...((feed?.facets.priorities || []).map((priority) => ({ value: priority, label: getPriorityLabel(priority) }))),
              ]}
            />
          </div>
          <span className="text-xs text-muted-foreground">点击任务行查看只读详情</span>
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
          ) : feed?.list.length ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background">
              <div className="min-h-0 flex-1 overflow-auto">
                <Table className="min-w-[1180px] table-fixed">
                <colgroup>
                  <col />
                  <col className="w-[190px]" />
                  <col className="w-[110px]" />
                  <col className="w-[110px]" />
                  <col className="w-[130px]" />
                  <col className="w-[90px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">任务</TableHead>
                    <TableHead className="whitespace-nowrap">团队</TableHead>
                    <TableHead className="whitespace-nowrap">负责人</TableHead>
                    <TableHead className="whitespace-nowrap">发起人</TableHead>
                    <TableHead className="whitespace-nowrap">状态</TableHead>
                    <TableHead className="whitespace-nowrap">优先级</TableHead>
                    <TableHead className="whitespace-nowrap">更新时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {feed.list.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => setSelectedTaskId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedTaskId(item.id);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <AdminTruncatedText className="font-medium text-foreground">{item.title}</AdminTruncatedText>
                        <AdminTruncatedText className="mt-0.5 text-xs text-muted-foreground">{item.description || '暂无任务描述'}</AdminTruncatedText>
                      </div>
                    </TableCell>
                    <TableCell><AdminTruncatedText className="text-muted-foreground">{item.team_name || '未分配团队'}</AdminTruncatedText></TableCell>
                    <TableCell><AdminTruncatedText className="text-muted-foreground">{item.assignee_name || '尚未指派'}</AdminTruncatedText></TableCell>
                    <TableCell><AdminTruncatedText className="text-muted-foreground">{item.creator_name || '未知发起人'}</AdminTruncatedText></TableCell>
                    <TableCell className="whitespace-nowrap"><StatusTag status={item.status} /></TableCell>
                    <TableCell className="whitespace-nowrap"><PriorityTag priority={item.priority} /></TableCell>
                    <TableCell className={cn(styles.mono, 'whitespace-nowrap text-muted-foreground')}>{formatDateTime(item.updated_at)}</TableCell>
                  </TableRow>
                ))}
                </TableBody>
                </Table>
              </div>
              <AdminPagination page={page} pageSize={PAGE_SIZE} total={feed.total} onPageChange={setPage} />
            </div>
          ) : (
            <EmptyPanel message="当前筛选条件下没有任务，请调整条件后重试" />
          )}
      </div>

      <TaskDetailDrawer
        taskId={selectedTaskId}
        visible={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        readOnly
      />
    </div>
  );
}
