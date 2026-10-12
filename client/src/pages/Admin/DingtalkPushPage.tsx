import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCode2, History, ImagePlus, Megaphone, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';
import MarkdownContent from '@/components/shared/markdown/MarkdownContent';
import UserSelect from '@/components/shared/form/UserSelect';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchAdminUsers,
  fetchDingtalkPushSummary,
  sendDingtalkAllPush,
  sendDingtalkTestPush,
  uploadDingtalkHtml,
  uploadDingtalkImage,
} from './api';
import { loadAdminUserDirectory } from './userDirectoryLoader';
import { AdminPageHeader } from './shared';
import type {
  DingtalkHtmlImportResult,
  DingtalkPushFailure,
  DingtalkPushFailureKind,
  DingtalkPushLatestAll,
  DingtalkPushMessageType,
  DingtalkPushOpenType,
  DingtalkPushPayload,
  DingtalkPushResult,
  DingtalkPushSummary,
} from './types';

const MARKDOWN_LIMIT = 5000;
const ACTION_MARKDOWN_LIMIT = 1000;

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.()
    || `broadcast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateIdempotencyKey(storageKey: string, signature: string) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as { key?: string; signature?: string } | null;
    if (stored?.key && stored.signature === signature) return stored.key;
    const key = createIdempotencyKey();
    sessionStorage.setItem(storageKey, JSON.stringify({ key, signature }));
    return key;
  } catch {
    return createIdempotencyKey();
  }
}

function clearIdempotencyKey(storageKey: string) {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // 浏览器禁用存储时仍由当前请求的随机 key 提供基础幂等保护。
  }
}

const FAILURE_GROUP_LABELS: { kind: DingtalkPushFailureKind; label: string }[] = [
  { kind: 'invalid_user', label: '无效用户' },
  { kind: 'flow_controlled', label: '被限流用户' },
  { kind: 'missing_identity', label: '未同步钉钉身份' },
  { kind: 'batch_error', label: '发送失败批次' },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function FailureList({ failures }: { failures: DingtalkPushFailure[] }) {
  const groups = FAILURE_GROUP_LABELS
    .map(({ kind, label }) => ({
      label,
      items: failures.filter((failure) => failure.kind === kind),
    }))
    .filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return <span className="text-sm">无失败记录</span>;
  }

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {groups.map((group) => (
        <li key={group.label}>
          <span className="font-medium">{group.label}：</span>
          {group.items.map((failure, index) => (
            <span key={failure.kind + '-' + index}>
              {failure.kind === 'batch_error'
                ? '第' + failure.batch + '批（' + failure.count + '人）：' + failure.reason
                : (failure.name || failure.providerUserId || failure.userId) + '（' + failure.reason + '）'}
              {index < group.items.length - 1 ? '；' : ''}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function SubmissionPanel({ submission }: { submission: DingtalkPushResult }) {
  const { scope, recordId, recipientCount, failureCount } = submission;
  return (
    <Alert>
      <Send />
      <AlertTitle>
        {scope === 'all' ? '全员推送' : scope === 'test' ? '测试推送' : '失败补发'}已加入发送队列
      </AlertTitle>
      <AlertDescription>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>记录：{recordId}</span>
          <span>目标 {recipientCount} 人</span>
          {failureCount > 0 ? <span>入队前已识别 {failureCount} 人无法发送</span> : null}
          <Link className="underline underline-offset-4" to="/admin/dingtalk-push-records">查看发送记录</Link>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function LatestAllPanel({ latest }: { latest: DingtalkPushLatestAll }) {
  const statusLabel: Record<string, string> = {
    queued: '排队中',
    sending: '发送中',
    succeeded: '发送成功',
    partial: '部分成功',
    failed: '发送失败',
  };
  return (
    <Alert>
      <Send />
      <AlertTitle>
        最近一次全员推送：{statusLabel[latest.status] || latest.status}
      </AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>标题：{latest.title}</span>
            <span>processQueryKey：{latest.processKey || '无'}</span>
            <span>提交时间：{latest.submittedAt}</span>
          </div>
          {latest.error ? <span className="text-sm text-destructive">{latest.error}</span> : null}
          <FailureList failures={latest.failures} />
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default function DingtalkPushPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [messageType, setMessageType] = useState<DingtalkPushMessageType>('markdown');
  const [markdownTitle, setMarkdownTitle] = useState('');
  const [markdownText, setMarkdownText] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionMarkdown, setActionMarkdown] = useState('');
  const [buttonText, setButtonText] = useState('查看详情');
  const [openType, setOpenType] = useState<DingtalkPushOpenType>('slide');
  const [htmlDraft, setHtmlDraft] = useState<DingtalkHtmlImportResult | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [testRecipientIds, setTestRecipientIds] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [summary, setSummary] = useState<DingtalkPushSummary | null>(null);
  const [busyAction, setBusyAction] = useState<'upload' | 'test' | 'all' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<DingtalkPushResult | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await fetchDingtalkPushSummary());
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    let cancelled = false;
    setUsersLoading(true);
    void loadAdminUserDirectory(fetchAdminUsers, { status: '1' })
      .then((directory) => {
        if (!cancelled) {
          setActiveUsers(directory.list.map((item) => ({
            ...item,
            department_id: item.department_id ?? undefined,
            is_dept_manager: item.is_dept_manager ?? 0,
            created_at: item.created_at ?? '',
            updated_at: item.updated_at ?? '',
          })));
        }
      })
      .catch(() => {
        if (!cancelled) setActiveUsers([]);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadSummary]);

  const currentPayload = useMemo<DingtalkPushPayload>(() => (
    messageType === 'markdown'
      ? {
        messageType,
        title: markdownTitle,
        markdown: markdownText,
      }
      : {
        messageType,
        title: actionTitle,
        markdown: actionMarkdown,
        buttonText,
        broadcastId: htmlDraft?.broadcastId,
        coverImageUrl: coverImageUrl || undefined,
        openType,
      }
  ), [actionMarkdown, actionTitle, buttonText, coverImageUrl, htmlDraft?.broadcastId, markdownText, markdownTitle, messageType, openType]);

  const messageReady = messageType === 'markdown'
    ? Boolean(markdownTitle.trim() && markdownText.trim() && markdownText.length <= MARKDOWN_LIMIT)
    : Boolean(
      actionTitle.trim()
      && actionMarkdown.trim()
      && actionMarkdown.length <= ACTION_MARKDOWN_LIMIT
      && buttonText.trim()
      && buttonText.length <= 20
      && coverImageUrl.length <= 500
      && htmlDraft
    );

  const handleCoverImage = async (file?: File) => {
    if (!file) return;
    setCoverUploading(true);
    try {
      const uploaded = await uploadDingtalkImage(file);
      setCoverImageUrl(uploaded.url);
      setLastSubmission(null);
      toast.success('封面图片已上传到图床');
    } catch {
      // 请求层已经显示错误提示。
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleHtmlFile = async (file?: File) => {
    if (!file) return;
    setBusyAction('upload');
    try {
      const imported = await uploadDingtalkHtml(file, htmlDraft?.broadcastId);
      setHtmlDraft(imported);
      setPreviewNonce((value) => value + 1);
      setLastSubmission(null);
      toast.success('HTML已导入，可以在右侧预览');
    } catch {
      // 请求层已经显示错误提示。
    } finally {
      setBusyAction(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTestPush = async () => {
    if (!messageReady || testRecipientIds.length === 0) return;
    setBusyAction('test');
    try {
      const idempotencyKey = getOrCreateIdempotencyKey(
        'dingtalk-push-test-request',
        JSON.stringify({ currentPayload, testRecipientIds }),
      );
      const push = await sendDingtalkTestPush({
        ...currentPayload,
        recipientUserIds: testRecipientIds,
        idempotencyKey,
      });
      clearIdempotencyKey('dingtalk-push-test-request');
      setLastSubmission(push);
      toast.success('测试推送已加入发送队列');
    } catch {
      // 请求层已经显示错误提示。
    } finally {
      setBusyAction(null);
    }
  };

  const handleAllPush = async () => {
    if (!messageReady) return;
    setConfirmOpen(false);
    setBusyAction('all');
    try {
      const idempotencyKey = getOrCreateIdempotencyKey(
        'dingtalk-push-all-request',
        JSON.stringify(currentPayload),
      );
      const push = await sendDingtalkAllPush({
        ...currentPayload,
        confirmAll: true,
        idempotencyKey,
      });
      clearIdempotencyKey('dingtalk-push-all-request');
      setLastSubmission(push);
      toast.success('全员推送已加入发送队列');
    } catch {
      // 请求层已经显示错误提示。
    } finally {
      setBusyAction(null);
    }
  };

  const allDisabled = !messageReady || busyAction !== null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <AdminPageHeader
        title="钉钉推送"
        description="通过钉钉单聊机器人发送 Markdown 或带HTML承载页的 ActionCard。"
        actions={(
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/dingtalk-push-records">
              <History data-icon="inline-start" />
              发送记录
            </Link>
          </Button>
        )}
      />

      {lastSubmission ? (
        <SubmissionPanel submission={lastSubmission} />
      ) : null}
      {!lastSubmission && summary?.latestAll ? (
        <LatestAllPanel latest={summary.latestAll} />
      ) : null}

      <Tabs
        value={messageType}
        onValueChange={(value) => {
          setMessageType(value as DingtalkPushMessageType);
          setLastSubmission(null);
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="markdown">Markdown 推送</TabsTrigger>
          <TabsTrigger value="action_card">ActionCard 推送</TabsTrigger>
        </TabsList>

        <TabsContent value="markdown" className="min-h-0 flex-1">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
            <Card>
              <CardHeader>
                <CardTitle>消息内容</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="markdown-title">通知标题</FieldLabel>
                    <Input
                      id="markdown-title"
                      value={markdownTitle}
                      maxLength={100}
                      placeholder="请输入通知标题"
                      onChange={(event) => setMarkdownTitle(event.target.value)}
                    />
                  </Field>
                  <Field data-invalid={markdownText.length > MARKDOWN_LIMIT || undefined}>
                    <FieldLabel htmlFor="markdown-content">Markdown 正文</FieldLabel>
                    <Textarea
                      id="markdown-content"
                      value={markdownText}
                      aria-invalid={markdownText.length > MARKDOWN_LIMIT || undefined}
                      className="min-h-64 resize-y font-mono"
                      placeholder="# 标题\n\n请输入宣传内容"
                      onChange={(event) => setMarkdownText(event.target.value)}
                    />
                    <FieldDescription>{markdownText.length}/{MARKDOWN_LIMIT} 字符</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>测试人员</FieldLabel>
                    <UserSelect
                      value={testRecipientIds}
                      mode="multiple"
                      users={activeUsers}
                      disabled={usersLoading || busyAction !== null}
                      placeholder={usersLoading ? '正在加载人员...' : '选择测试接收人'}
                      notFoundContent="没有可用人员"
                      onChange={(value) => setTestRecipientIds(Array.isArray(value) ? value : value ? [value] : [])}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!messageReady || testRecipientIds.length === 0 || busyAction !== null}
                  onClick={() => void handleTestPush()}
                >
                  {busyAction === 'test' ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                  测试推送
                </Button>
                <Button type="button" disabled={allDisabled} onClick={() => setConfirmOpen(true)}>
                  <Megaphone data-icon="inline-start" />
                  全员推送
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Markdown 预览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="min-h-96 rounded-md border border-border bg-background p-5">
                  <MarkdownContent markdown={markdownText} emptyText="输入正文后在此预览" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="action_card" className="min-h-0 flex-1">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>ActionCard 内容</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <Field>
                  <FieldLabel htmlFor="action-title">卡片标题</FieldLabel>
                  <Input
                    id="action-title"
                    value={actionTitle}
                    maxLength={100}
                    placeholder="请输入卡片标题"
                    onChange={(event) => setActionTitle(event.target.value)}
                  />
                </Field>
                <div className={`flex flex-col gap-3 rounded-md border bg-background p-4 ${actionMarkdown.length > ACTION_MARKDOWN_LIMIT || buttonText.length > 20 ? 'border-destructive' : 'border-border'}`}>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleCoverImage(event.target.files?.[0])}
                  />
                  {coverImageUrl ? (
                    <div className="relative">
                      <img
                        src={coverImageUrl}
                        alt="封面图片预览"
                        className="w-full rounded-md"
                      />
                      <div className="absolute right-2 top-2 flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={coverUploading || busyAction !== null}
                          onClick={() => coverInputRef.current?.click()}
                        >
                          {coverUploading ? <Spinner data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
                          更换
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busyAction !== null}
                          onClick={() => setCoverImageUrl('')}
                        >
                          <X data-icon="inline-start" />
                          清除
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={coverUploading || busyAction !== null}
                      onClick={() => coverInputRef.current?.click()}
                      className="flex h-24 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
                    >
                      {coverUploading ? <Spinner data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
                      添加封面
                    </button>
                  )}
                  <Textarea
                    aria-label="卡片摘要"
                    value={actionMarkdown}
                    aria-invalid={actionMarkdown.length > ACTION_MARKDOWN_LIMIT || undefined}
                    placeholder="卡片摘要"
                    className="min-h-24 resize-none border-0 bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0"
                    onChange={(event) => setActionMarkdown(event.target.value)}
                  />
                  <div className="text-xs text-muted-foreground">{actionMarkdown.length}/{ACTION_MARKDOWN_LIMIT} 字符</div>
                  <div className="flex items-center rounded-md bg-primary px-3">
                    <Input
                      aria-label="按钮文字"
                      value={buttonText}
                      aria-invalid={buttonText.length > 20 || undefined}
                      maxLength={20}
                      placeholder="查看详情"
                      className="border-0 bg-transparent py-2 text-center text-sm font-medium text-primary-foreground shadow-none outline-none placeholder:text-primary-foreground/70 focus-visible:ring-0"
                      onChange={(event) => setButtonText(event.target.value)}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">{buttonText.length}/20 字符</div>
                </div>
                <FieldGroup>
                  <Field>
                    <FieldLabel>宣传承载页 (.zip 页面包 / .html)</FieldLabel>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip,.html,.htm,application/zip,application/x-zip-compressed,text/html"
                      className="sr-only"
                      onChange={(event) => void handleHtmlFile(event.target.files?.[0])}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyAction !== null}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {busyAction === 'upload' ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                        {htmlDraft ? '重新上传页面包' : '上传页面包 (.zip / .html)'}
                      </Button>
                      {htmlDraft ? (
                        <Badge variant="secondary">
                          <FileCode2 />
                          {htmlDraft.originalName} · {formatBytes(htmlDraft.htmlSize)}
                        </Badge>
                      ) : null}
                    </div>
                    <FieldDescription>
                      支持包含 index.html 及 assets/ 的页面包；压缩包最大50MB，解压后最大100MB、1000个文件。
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>承载页打开窗口</FieldLabel>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { value: 'slide', label: '侧边栏', desc: '右侧滑出侧边栏展示' },
                        { value: 'popupWindow', label: '独立窗口', desc: '桌面端独立弹窗，可最大化' },
                        { value: 'workbench', label: '工作台', desc: '在钉钉工作台打开' },
                        { value: 'browser', label: '第三方网页', desc: '调用外部浏览器打开' },
                      ].map((option) => {
                        const selected = openType === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={busyAction !== null}
                            className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors ${
                              selected
                                ? 'border-primary bg-primary/5 text-primary'
                                : 'border-border bg-background hover:bg-muted/40 text-foreground'
                            }`}
                            onClick={() => setOpenType(option.value as DingtalkPushOpenType)}
                          >
                            <span className="text-sm font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                    <FieldDescription>
                      桌面端按所选窗口打开；移动端统一在钉钉内全屏打开。
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>测试人员</FieldLabel>
                    <UserSelect
                      value={testRecipientIds}
                      mode="multiple"
                      users={activeUsers}
                      disabled={usersLoading || busyAction !== null}
                      placeholder={usersLoading ? '正在加载人员...' : '选择测试接收人'}
                      notFoundContent="没有可用人员"
                      onChange={(value) => setTestRecipientIds(Array.isArray(value) ? value : value ? [value] : [])}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!messageReady || testRecipientIds.length === 0 || busyAction !== null}
                  onClick={() => void handleTestPush()}
                >
                  {busyAction === 'test' ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                  测试推送
                </Button>
                <Button type="button" disabled={allDisabled} onClick={() => setConfirmOpen(true)}>
                  <Megaphone data-icon="inline-start" />
                  全员推送
                </Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>HTML承载页预览</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1">
                {htmlDraft ? (
                  <iframe
                    title="ActionCard HTML承载页预览"
                    src={`${htmlDraft.previewUrl}?v=${previewNonce}`}
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts"
                    referrerPolicy="no-referrer"
                    className="h-full min-h-96 w-full rounded-md border border-border bg-background"
                  />
                ) : (
                  <div className="flex h-full min-h-96 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                    尚未导入HTML
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认向全员推送？</AlertDialogTitle>
            <AlertDialogDescription>
              本次将把消息按每批20人分批发送给全部启用员工，提交后不可通过本页面撤销。发送失败的人员会在结果中列出。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={busyAction === 'all'}>取消</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={allDisabled}
                onClick={() => void handleAllPush()}
              >
                {busyAction === 'all' ? <Spinner data-icon="inline-start" /> : <Megaphone data-icon="inline-start" />}
                确认全员推送
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
