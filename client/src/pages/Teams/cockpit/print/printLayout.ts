/**
 * 团队驾驶舱打印布局常量与换算。
 * 文件作用：统一页面宽度、内边距、甘特打印尺寸与像素换算，供预览层与 PDF 导出共用。
 * 设计前提：宽度固定为 A4 横向宽（297mm），页面高度由内容实际高度决定，不做固定分页。
 */
import dayjs from 'dayjs';

/** PDF 页面宽度（毫米），与 A4 横向宽度一致。 */
export const PRINT_PAGE_WIDTH_MM = 297;
/** CSS 像素与毫米的换算基准（96dpi）。 */
export const PRINT_PX_PER_MM = 96 / 25.4;
/** 预览与截图使用的页面宽度（CSS 像素）。 */
export const PRINT_PAGE_WIDTH_PX = 1122;
/** 页面四周留白。 */
export const PRINT_PAGE_PADDING_PX = 36;
/** 页面内容宽度。 */
export const PRINT_CONTENT_WIDTH_PX = PRINT_PAGE_WIDTH_PX - PRINT_PAGE_PADDING_PX * 2;

/** 甘特图左侧任务名称列宽。 */
export const PRINT_GANTT_TREE_WIDTH_PX = 240;
/** 甘特图时间轴宽度（全览时恰好撑满）。 */
export const PRINT_GANTT_TIMELINE_WIDTH_PX = PRINT_CONTENT_WIDTH_PX - PRINT_GANTT_TREE_WIDTH_PX;
/** 甘特图行高。 */
export const PRINT_GANTT_ROW_HEIGHT_PX = 40;
/** 甘特图时间刻度表头高度。 */
export const PRINT_GANTT_HEADER_HEIGHT_PX = 36;

/** 成员负载卡片列数。 */
export const PRINT_MEMBER_COLUMNS = 3;
/** 成员负载卡片间距。 */
export const PRINT_MEMBER_GAP_PX = 16;
/** 成员负载卡片固定高度，保证网格分页整齐。 */
export const PRINT_MEMBER_CARD_HEIGHT_PX = 150;
/** 成员负载卡片宽度。 */
export const PRINT_MEMBER_CARD_WIDTH_PX = Math.floor(
  (PRINT_CONTENT_WIDTH_PX - PRINT_MEMBER_GAP_PX * (PRINT_MEMBER_COLUMNS - 1)) / PRINT_MEMBER_COLUMNS
);

/** 单张截图的安全高度上限；超过后分段生成多页 PDF，避免超出画布限制。 */
export const PRINT_CAPTURE_MAX_SEGMENT_PX = 6000;

/** 把 CSS 像素换算为毫米。 */
export function pxToMm(px: number): number {
  return (px * 25.4) / 96;
}

/** 按固定页宽换算 PDF 页面高度，保证预览宽度与 PDF 宽度严格一致。 */
export function pageHeightMm(heightPx: number): number {
  return (PRINT_PAGE_WIDTH_MM * heightPx) / PRINT_PAGE_WIDTH_PX;
}

export interface PrintCaptureSegment {
  topPx: number;
  heightPx: number;
}

/** 把单页高度切分为截图段；常规内容只有一段。 */
export function splitCaptureSegments(
  heightPx: number,
  maxSegmentPx = PRINT_CAPTURE_MAX_SEGMENT_PX
): PrintCaptureSegment[] {
  const safeHeight = Math.max(1, Math.round(heightPx));
  const safeMax = Math.max(1, Math.round(maxSegmentPx));
  if (safeHeight <= safeMax) {
    return [{ topPx: 0, heightPx: safeHeight }];
  }
  const segments: PrintCaptureSegment[] = [];
  for (let top = 0; top < safeHeight; top += safeMax) {
    segments.push({ topPx: top, heightPx: Math.min(safeMax, safeHeight - top) });
  }
  return segments;
}

/** 去掉文件系统不接受的字符。 */
function sanitizeFileNamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

/** 生成导出文件名，例如：团队驾驶舱_营销中心_20261021-0910.pdf */
export function buildCockpitPdfFileName(teamName: string, at: dayjs.Dayjs = dayjs()): string {
  const safeName = sanitizeFileNamePart(teamName) || '团队';
  return `团队驾驶舱_${safeName}_${at.format('YYYYMMDD-HHmm')}.pdf`;
}

/** 打印页头里的筛选说明，让打印件能看出数据口径。 */
export function buildPrintFilterSummary(options: {
  statusLabel: string;
  riskOnly: boolean;
  taskCount: number;
}): string {
  const parts = [options.statusLabel];
  if (options.riskOnly) parts.push('仅看逾期/紧急');
  parts.push(`共 ${options.taskCount} 项`);
  return parts.join(' · ');
}
