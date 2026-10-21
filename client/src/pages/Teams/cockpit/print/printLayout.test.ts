import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import {
  PRINT_PAGE_WIDTH_MM,
  PRINT_PAGE_WIDTH_PX,
  buildCockpitPdfFileName,
  buildPrintFilterSummary,
  pageHeightMm,
  pxToMm,
  splitCaptureSegments,
} from './printLayout';

describe('打印尺寸换算', () => {
  it('页宽对应的 PDF 高度与 A4 横向宽度一致', () => {
    expect(pageHeightMm(PRINT_PAGE_WIDTH_PX)).toBeCloseTo(PRINT_PAGE_WIDTH_MM, 1);
  });

  it('像素换算毫米误差控制在 0.2mm 以内', () => {
    expect(Math.abs(pxToMm(PRINT_PAGE_WIDTH_PX) - PRINT_PAGE_WIDTH_MM)).toBeLessThan(0.2);
  });

  it('页面高度按比例换算，长页不会失真', () => {
    const halfWidthHeight = pageHeightMm(PRINT_PAGE_WIDTH_PX / 2);
    expect(halfWidthHeight).toBeCloseTo(PRINT_PAGE_WIDTH_MM / 2, 1);
  });
});

describe('截图分段', () => {
  it('常规高度只生成一段', () => {
    expect(splitCaptureSegments(2000)).toEqual([{ topPx: 0, heightPx: 2000 }]);
  });

  it('超高内容按上限切分且覆盖完整高度', () => {
    const segments = splitCaptureSegments(15000, 6000);
    expect(segments.map((segment) => segment.heightPx)).toEqual([6000, 6000, 3000]);
    expect(segments.map((segment) => segment.topPx)).toEqual([0, 6000, 12000]);
  });
});

describe('导出文件名', () => {
  it('清理非法字符并附带时间戳', () => {
    const at = dayjs('2026-10-21 09:10:00');
    expect(buildCockpitPdfFileName('研发/中心', at)).toBe('团队驾驶舱_研发中心_20261021-0910.pdf');
  });

  it('空团队名回退为通用名称', () => {
    const at = dayjs('2026-10-21 09:10:00');
    expect(buildCockpitPdfFileName('   ', at)).toBe('团队驾驶舱_团队_20261021-0910.pdf');
  });
});

describe('页头筛选说明', () => {
  it('组合状态、风险筛选与任务数量', () => {
    expect(buildPrintFilterSummary({ statusLabel: '进行中', riskOnly: true, taskCount: 12 }))
      .toBe('进行中 · 仅看逾期/紧急 · 共 12 项');
  });

  it('未开启风险筛选时不追加说明', () => {
    expect(buildPrintFilterSummary({ statusLabel: '全部状态', riskOnly: false, taskCount: 0 }))
      .toBe('全部状态 · 共 0 项');
  });
});
