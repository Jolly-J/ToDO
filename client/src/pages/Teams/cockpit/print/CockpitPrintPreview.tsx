/**
 * 团队驾驶舱打印预览。
 * 文件作用：以 A4 横向固定宽度、内容自适应高度的纸张形式实时预览驾驶舱打印内容，
 *          可切换是否包含团队成员任务负载，并导出为多页 PDF。
 * 说明：预览中的甘特图强制全览、完整展示当前筛选后的全部任务行，不出现内部滚动。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { Check, FileDown, Loader2, Plus, Printer, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { useDashboardStats } from '@/pages/Dashboard/useDashboardStats';
import { useMemberTaskStats } from '@/pages/Teams/cockpit/useMemberTaskStats';
import { buildTeamGanttModel, type TeamGanttViewState } from '../teamGanttModel';
import PrintGanttSection from './PrintGanttSection';
import PrintHeader from './PrintHeader';
import PrintKpiSection from './PrintKpiSection';
import PrintMemberSection from './PrintMemberSection';
import PrintPage from './PrintPage';
import { exportCockpitPdf } from './exportCockpitPdf';
import {
  PRINT_GANTT_TIMELINE_WIDTH_PX,
  PRINT_PAGE_WIDTH_PX,
  buildCockpitPdfFileName,
  buildPrintFilterSummary,
} from './printLayout';
import type { Task } from '@/types';

interface CockpitPrintPreviewProps {
  onClose: () => void;
  teamId: string;
  teamName: string;
  teamLevelLabel?: string;
  tasks: Task[];
  viewState: TeamGanttViewState;
}

/** 关闭动画时长，与 index.css 中的 print-preview-out 保持一致。 */
const CLOSE_ANIMATION_MS = 160;

export default function CockpitPrintPreview({
  onClose,
  teamId,
  teamName,
  teamLevelLabel,
  tasks,
  viewState,
}: CockpitPrintPreviewProps) {
  const [includeMembers, setIncludeMembers] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [scale, setScale] = useState(0.6);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mainPageRef = useRef<HTMLDivElement | null>(null);
  const memberPageRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const printedAt = useMemo(() => dayjs(), []);
  const todayStr = printedAt.format('YYYY-MM-DD');
  const printedAtLabel = printedAt.format('YYYY-MM-DD HH:mm');

  const { stats, loading: statsLoading } = useDashboardStats(teamId);
  const { memberStats, loading: memberLoading, errorMsg: memberError } = useMemberTaskStats(teamId);

  // 打印版甘特图固定全览：时间轴按纸张宽度一次排满，高度等于全部任务行。
  const model = useMemo(
    () => buildTeamGanttModel({
      tasks,
      today: todayStr,
      statusFilter: viewState.statusFilter,
      riskOnly: viewState.riskOnly,
      collapsedIds: viewState.collapsedIds,
      availableWidth: PRINT_GANTT_TIMELINE_WIDTH_PX,
      scale: 'week',
      zoom: 100,
      fit: true,
    }),
    [tasks, todayStr, viewState]
  );

  const filterSummary = buildPrintFilterSummary({
    statusLabel: model.statusLabel,
    riskOnly: viewState.riskOnly,
    taskCount: model.filteredRows.length,
  });

  const totalPages = includeMembers ? 2 : 1;
  const footerLeft = `${teamName} · 团队驾驶舱 · ${printedAtLabel}`;

  // 按可视宽度计算纸张缩放比例，让 A4 横向纸完整落在屏幕内。
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const available = el.clientWidth - 80;
      setScale(Math.max(0.32, Math.min(0.86, available / PRINT_PAGE_WIDTH_PX)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // 锁定背景滚动；Esc 走带退出动画的关闭流程。
  const requestClose = useCallback(() => {
    if (exporting || closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => onClose(), CLOSE_ANIMATION_MS);
  }, [closing, exporting, onClose]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [requestClose]);

  const handleToggleMembers = useCallback((pressed: boolean) => {
    setIncludeMembers(pressed);
    setNotice(null);
  }, []);

  const handleExport = useCallback(async () => {
    if (exporting || closing) return;
    const targets = [mainPageRef.current];
    if (includeMembers) targets.push(memberPageRef.current);
    const pages = targets.filter((el): el is HTMLDivElement => Boolean(el));
    if (pages.length === 0) return;

    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      await exportCockpitPdf(pages, buildCockpitPdfFileName(teamName, printedAt));
      setNotice('PDF 已生成，请查看浏览器下载文件');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'PDF 生成失败，请重试');
    } finally {
      setExporting(false);
    }
  }, [closing, exporting, includeMembers, teamName, printedAt]);

  const memberReady = !includeMembers || (!memberLoading && !memberError);
  const dataReady = !statsLoading && memberReady;

  return createPortal(
    <div
      data-print-preview
      role="dialog"
      aria-modal="true"
      aria-label="团队驾驶舱打印预览"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        background: '#F3F4F6',
        animation: closing
          ? `print-preview-out ${CLOSE_ANIMATION_MS}ms ease-in forwards`
          : 'print-preview-in 180ms ease-out',
      }}
    >
      <div
        data-print-preview-panel
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          animation: closing
            ? `print-preview-panel-out ${CLOSE_ANIMATION_MS}ms ease-in forwards`
            : 'print-preview-panel-in 220ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        }}
      >
        {/* 顶部工具条 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Printer className="h-4 w-4 shrink-0 text-[#787774]" />
            <span className="text-sm font-semibold text-[#37352F]">打印预览</span>
            <Badge variant="secondary" className="max-w-[220px] truncate rounded-lg text-xs font-normal">
              {teamName}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle
              pressed={includeMembers}
              onPressedChange={handleToggleMembers}
              variant="outline"
              size="sm"
              aria-label="包含团队成员任务负载"
              className="gap-1.5 rounded-lg text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:aria-pressed:bg-primary/90"
            >
              {includeMembers ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              团队成员任务负载
            </Toggle>
            <Separator
              orientation="vertical"
              className="mx-0.5 h-[var(--tf-density-button-height-sm)] self-center"
            />
            <span className="px-0.5 text-xs text-[#9B9A97]">共 {totalPages} 页</span>
            <Button
              size="sm"
              className="text-xs"
              onClick={handleExport}
              disabled={!dataReady || exporting || closing}
            >
              {exporting ? (
                <>
                  <Loader2 className="animate-spin" />
                  正在生成 PDF…
                </>
              ) : (
                <>
                  <FileDown />
                  导出 PDF
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="关闭打印预览"
              onClick={requestClose}
              disabled={exporting || closing}
            >
              <X />
            </Button>
          </div>
        </div>

        {/* 状态提示 */}
        {error ? (
          <div className="border-b border-[#FCA5A5] bg-[#FEF2F2] px-5 py-2 text-xs text-[#991B1B]">{error}</div>
        ) : null}
        {notice ? (
          <div className="border-b border-[#A7F3D0] bg-[#ECFDF5] px-5 py-2 text-xs text-[#065F46]">{notice}</div>
        ) : null}
        {!dataReady && !error ? (
          <div className="border-b border-[#E5E7EB] bg-[#FFFBEB] px-5 py-2 text-xs text-[#92400E]">
            {memberError ? `成员任务数据加载失败：${memberError}` : '正在加载打印数据…'}
          </div>
        ) : null}

        {/* 纸张预览区 */}
        <div
          ref={scrollRef}
          style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px 16px 56px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
            <div
              data-print-page-wrapper="main"
              style={{
                zoom: exporting ? 1 : scale,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 10px 28px rgba(0, 0, 0, 0.08)',
                background: '#FFFFFF',
              }}
            >
              <PrintPage
                pageRef={mainPageRef}
                pageNo={1}
                totalPages={totalPages}
                footerLeft={footerLeft}
              >
                <PrintHeader
                  teamName={teamName}
                  teamLevelLabel={teamLevelLabel}
                  printedAt={printedAtLabel}
                  filterSummary={filterSummary}
                />
                <PrintKpiSection stats={stats} loading={statsLoading} />
                <PrintGanttSection
                  rows={model.filteredRows}
                  units={model.units}
                  renderScale={model.renderScale}
                  pxPerDay={model.pxPerDay}
                  placements={model.placements}
                  filterSummary={filterSummary}
                />
              </PrintPage>
            </div>

            {includeMembers ? (
              <div
                data-print-page-wrapper="member"
                style={{
                  zoom: exporting ? 1 : scale,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 10px 28px rgba(0, 0, 0, 0.08)',
                  background: '#FFFFFF',
                }}
              >
                <PrintPage
                  pageRef={memberPageRef}
                  pageNo={2}
                  totalPages={totalPages}
                  footerLeft={footerLeft}
                >
                  <PrintHeader
                    teamName={teamName}
                    teamLevelLabel={teamLevelLabel}
                    printedAt={printedAtLabel}
                    filterSummary={filterSummary}
                  />
                  <PrintMemberSection
                    memberStats={memberStats}
                    loading={memberLoading}
                    errorMsg={memberError}
                  />
                </PrintPage>
              </div>
            ) : null}
          </div>
        </div>

        {/* 底部说明 */}
        <div className="border-t border-[#E5E7EB] bg-white px-5 py-2 text-[11px] text-[#9B9A97]">
          页面宽度固定为 A4 横向 297mm，高度随内容自适应；导出文件可用于发送或直接打印。
        </div>
      </div>
    </div>,
    document.body
  );
}
