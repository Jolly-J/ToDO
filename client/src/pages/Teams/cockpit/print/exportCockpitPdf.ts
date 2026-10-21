/**
 * 团队驾驶舱 PDF 导出。
 * 文件作用：把打印预览中的每一页截图为高清图片，并按固定宽度、内容实际高度生成多页 PDF。
 * 说明：不依赖后端与系统打印对话框；图片按 2 倍像素比截取（约 192dpi），保证打印清晰度。
 */
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  PRINT_PAGE_WIDTH_MM,
  pageHeightMm,
  splitCaptureSegments,
} from './printLayout';

/** 截图输出倍率，2 倍约等于 192dpi。 */
const CAPTURE_PIXEL_RATIO = 2;

/**
 * 计算 PDF 页面方向。
 * jsPDF 会按方向自动交换宽高：内容高度小于固定页宽时用横向，长页用纵向，
 * 从而保证所有页面的宽度恒为 297mm，高度等于该页内容高度。
 */
function resolvePageOrientation(heightMm: number): 'portrait' | 'landscape' {
  return heightMm >= PRINT_PAGE_WIDTH_MM ? 'portrait' : 'landscape';
}

interface CapturedSegment {
  dataUrl: string;
  cssHeightPx: number;
}

/** 等待字体加载与两帧渲染，确保截图内容与预览一致。 */
export async function waitForPrintRender(): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    // 字体等待失败不阻塞导出
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** 截取单张打印页；内容超高时按段截取，避免超出画布限制。 */
async function capturePageSegments(element: HTMLElement): Promise<CapturedSegment[]> {
  const widthPx = Math.max(1, Math.round(element.offsetWidth));
  const heightPx = Math.max(1, Math.round(element.offsetHeight));
  const segments = splitCaptureSegments(heightPx);
  const captures: CapturedSegment[] = [];

  for (const segment of segments) {
    const dataUrl = await toPng(element, {
      pixelRatio: CAPTURE_PIXEL_RATIO,
      width: widthPx,
      height: segment.heightPx,
      backgroundColor: '#ffffff',
      cacheBust: true,
      style: segment.topPx === 0
        ? undefined
        : {
            transform: `translateY(-${segment.topPx}px)`,
            transformOrigin: 'top left',
          },
    });
    captures.push({ dataUrl, cssHeightPx: segment.heightPx });
  }

  return captures;
}

/**
 * 生成并下载 PDF。
 * 页面宽度固定为 A4 横向宽度，每一页的高度按该页内容实际高度等比换算。
 */
export async function exportCockpitPdf(pages: HTMLElement[], fileName: string): Promise<void> {
  if (pages.length === 0) {
    throw new Error('没有可导出的打印页');
  }

  await waitForPrintRender();

  const captures: CapturedSegment[] = [];
  for (const page of pages) {
    captures.push(...(await capturePageSegments(page)));
  }
  if (captures.length === 0) {
    throw new Error('打印页截图为空');
  }

  const [first, ...rest] = captures;
  const firstHeightMm = pageHeightMm(first.cssHeightPx);
  const pdf = new jsPDF({
    unit: 'mm',
    format: [PRINT_PAGE_WIDTH_MM, firstHeightMm],
    orientation: resolvePageOrientation(firstHeightMm),
    compress: true,
  });
  pdf.addImage(first.dataUrl, 'PNG', 0, 0, PRINT_PAGE_WIDTH_MM, firstHeightMm);

  for (const segment of rest) {
    const heightMm = pageHeightMm(segment.cssHeightPx);
    pdf.addPage(
      [PRINT_PAGE_WIDTH_MM, heightMm],
      resolvePageOrientation(heightMm)
    );
    pdf.addImage(segment.dataUrl, 'PNG', 0, 0, PRINT_PAGE_WIDTH_MM, heightMm);
  }

  pdf.save(fileName);
}
