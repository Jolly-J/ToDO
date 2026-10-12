/** 当前浏览器与钉钉容器环境诊断。所有信息仅在本地浏览器中采集和展示。 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleHelp,
  Clipboard,
  Copy,
  MonitorCog,
  RefreshCw,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from './shared';
import {
  collectEnvironmentReport,
  serializeEnvironmentReport,
  type EnvironmentReport,
  type FeatureSupport,
} from './environmentDiagnostics';
import styles from './Admin.module.css';

const supportPresentation: Record<FeatureSupport, {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
}> = {
  supported: {
    label: '支持',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  unsupported: {
    label: '不支持',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: XCircle,
  },
  unavailable: {
    label: '不可检测',
    className: 'border-zinc-200 bg-zinc-50 text-zinc-600',
    icon: CircleHelp,
  },
};

function ValueList({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <dl className="divide-y divide-border">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words text-xs font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SummaryItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 px-4 py-3 lg:border-l lg:border-border lg:first:border-l-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={detail}>{detail}</p>
    </div>
  );
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('当前浏览器拒绝了复制操作');
}

export default function EnvironmentPage() {
  const [report, setReport] = useState<EnvironmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopyState('idle');
    try {
      setReport(await collectEnvironmentReport());
    } catch (nextError) {
      setError(String((nextError as Error)?.message || '环境信息采集失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rawReport = useMemo(() => report ? serializeEnvironmentReport(report) : '', [report]);

  const copyReport = useCallback(async () => {
    if (!rawReport) return;
    try {
      await writeClipboard(rawReport);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }, [rawReport]);

  const supportedCount = report?.features.filter((item) => item.support === 'supported').length || 0;
  const unsupportedCount = report?.features.filter((item) => item.support === 'unsupported').length || 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <AdminPageHeader
        title="环境诊断"
        description="识别当前浏览器、钉钉工作台容器、显示模式与关键前端能力，便于定位不同终端的兼容问题。"
        actions={(
          <>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw data-icon="inline-start" className={cn(loading && 'animate-spin')} />
              重新检测
            </Button>
            <Button type="button" size="sm" disabled={!report || loading} onClick={() => void copyReport()}>
              {copyState === 'copied' ? <CheckCircle2 data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
              {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制报告'}
            </Button>
          </>
        )}
      />

      {loading && !report ? (
        <div className="grid gap-3">
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-52 w-full rounded-md" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>环境检测未完成</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : report ? (
        <>
          <Alert className={cn(
            'py-2.5',
            report.display.scrollbarMode === 'classic' && 'border-amber-200 bg-amber-50/60'
          )}>
            {report.display.scrollbarMode === 'classic' ? <TriangleAlert /> : <MonitorCog />}
            <AlertTitle>
              {report.display.scrollbarMode === 'classic'
                ? `检测到占位式滚动条，实测宽度 ${report.display.scrollbarWidth}px`
                : '当前使用覆盖式或自动隐藏式滚动条'}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {report.display.scrollbarMode === 'classic'
                ? '这与 Windows 工作台中滚动条长期可见的现象一致。网页无法读取系统开关，因此结论来自当前页面的实际占位测量。'
                : '滚动条未占用布局宽度。系统设置或钉钉版本变化后，结果可能不同，可在问题设备上重新检测。'}
            </AlertDescription>
          </Alert>

          <Card className="bg-background">
            <CardContent className="grid p-0 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem
                label="运行容器"
                value={report.dingTalk.detected ? '钉钉工作台' : '普通浏览器'}
                detail={report.dingTalk.detected ? `${report.dingTalk.platform} · ${report.dingTalk.subPlatform}` : report.dingTalk.source}
              />
              <SummaryItem
                label="浏览器 / 内核"
                value={`${report.browser.name} ${report.browser.version}`}
                detail={`${report.browser.engine} · ${report.browser.source}`}
              />
              <SummaryItem
                label="操作系统"
                value={`${report.operatingSystem.name} ${report.operatingSystem.version}`}
                detail={`${report.operatingSystem.architecture} · ${report.operatingSystem.bitness} bit`}
              />
              <SummaryItem
                label="滚动条模式"
                value={report.display.scrollbarModeLabel}
                detail={`页面占位 ${report.display.rootScrollbarWidth}px · 视口 ${report.display.viewport}`}
              />
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3">
              <TabsList className="h-9">
                <TabsTrigger value="overview" className="h-7 text-xs">概览</TabsTrigger>
                <TabsTrigger value="features" className="h-7 text-xs">能力检测</TabsTrigger>
                <TabsTrigger value="raw" className="h-7 text-xs">原始报告</TabsTrigger>
              </TabsList>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                检测于 {new Date(report.generatedAt).toLocaleString('zh-CN', { hour12: false })}
              </span>
            </div>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto">
              <Card className="bg-background">
                <CardContent className="grid gap-0 p-0 lg:grid-cols-2">
                  <section className="p-4 lg:border-r lg:border-border" aria-labelledby="environment-runtime-heading">
                    <h2 id="environment-runtime-heading" className="mb-3 text-xs font-semibold text-foreground">容器与运行环境</h2>
                    <ValueList items={[
                      { label: '钉钉环境', value: report.dingTalk.detected ? '已检测到' : '未检测到' },
                      { label: '钉钉版本', value: report.dingTalk.version },
                      { label: '钉钉平台', value: `${report.dingTalk.platform} / ${report.dingTalk.subPlatform}` },
                      { label: '应用类型', value: report.dingTalk.appType },
                      { label: '浏览器', value: `${report.browser.name} ${report.browser.version}` },
                      { label: '渲染内核', value: report.browser.engine },
                      { label: '系统', value: `${report.operatingSystem.name} ${report.operatingSystem.version}` },
                      { label: '架构', value: `${report.operatingSystem.architecture} / ${report.operatingSystem.bitness} bit` },
                    ]} />
                  </section>

                  <section className="border-t border-border p-4 lg:border-t-0" aria-labelledby="environment-display-heading">
                    <h2 id="environment-display-heading" className="mb-3 text-xs font-semibold text-foreground">显示与浏览器状态</h2>
                    <ValueList items={[
                      { label: '可视区域', value: report.display.viewport },
                      { label: '屏幕分辨率', value: report.display.screen },
                      { label: '像素密度', value: report.display.devicePixelRatio },
                      { label: '滚动条实测', value: `${report.display.scrollbarWidth}px（页面占位 ${report.display.rootScrollbarWidth}px）` },
                      { label: '配色偏好', value: report.display.colorScheme },
                      { label: '减少动态效果', value: report.display.reducedMotion ? '是' : '否' },
                      { label: '语言 / 时区', value: `${report.runtime.language} / ${report.runtime.timezone}` },
                      { label: '安全上下文', value: report.runtime.secureContext ? '是' : '否' },
                    ]} />
                  </section>
                </CardContent>
              </Card>

              <div className="mt-3 rounded-md border border-dashed border-border px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Clipboard className="size-3.5" />
                  数据边界
                </div>
                <ul className="mt-2 grid gap-1 text-[11px] leading-5 text-muted-foreground">
                  {report.notes.map((note) => <li key={note}>· {note}</li>)}
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="features" className="min-h-0 flex-1 overflow-hidden">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background">
                <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
                  <span className="font-medium text-foreground">当前运行时实测</span>
                  <span className="text-muted-foreground">支持 {supportedCount} 项 · 不支持 {unsupportedCount} 项</span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <Table className="min-w-[720px] table-fixed">
                    <colgroup>
                      <col className="w-[150px]" />
                      <col className="w-[220px]" />
                      <col className="w-[120px]" />
                      <col />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="whitespace-nowrap">分类</TableHead>
                        <TableHead className="whitespace-nowrap">能力</TableHead>
                        <TableHead className="whitespace-nowrap">结果</TableHead>
                        <TableHead className="whitespace-nowrap">影响范围</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.features.map((feature) => {
                        const presentation = supportPresentation[feature.support];
                        const Icon = presentation.icon;
                        return (
                          <TableRow key={feature.id}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{feature.category}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs font-medium">{feature.label}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('gap-1 whitespace-nowrap font-normal', presentation.className)}>
                                <Icon className="size-3" />{presentation.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="truncate text-xs text-muted-foreground" title={feature.detail}>{feature.detail}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="raw" className="min-h-0 flex-1 overflow-hidden">
              <Card className="flex h-full min-h-0 flex-col bg-background">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>可复制诊断报告</CardTitle>
                    <p className="mt-1 text-[11px] text-muted-foreground">报告可能包含浏览器 User-Agent 和设备能力，不包含账号、任务或业务数据。</p>
                  </div>
                  <Button type="button" variant="outline" size="xs" onClick={() => void copyReport()}>
                    <Copy data-icon="inline-start" />复制 JSON
                  </Button>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 pt-0">
                  <pre className={cn(styles.mono, 'h-full min-h-48 overflow-auto rounded-md bg-slate-950 p-4 text-[11px] leading-5 text-slate-200')}>
                    {rawReport}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
