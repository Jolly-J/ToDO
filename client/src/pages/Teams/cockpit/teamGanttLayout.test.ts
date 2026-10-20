import { describe, expect, it } from 'vitest';
import { buildTeamGanttLayout, getTimeProgress } from './teamGanttLayout';
import { getItemGridPlacement, type GanttItem } from '@/components/gantt';

const item = (startDate: string, dueDate: string): GanttItem => ({
  id: startDate, type: 'task', name: '排期', startDate, dueDate,
  progress: 0, status: 'in_progress', depth: 0, sortOrder: 0, isDelayed: false, isCritical: false,
});
const base = { scale: 'week' as const, availableWidth: 720, today: '2026-10-20' };

describe('排期时间百分比', () => {
  it.each([
    ['2026-10-01', '2026-10-21', '2026-10-11', 50],
    ['2026-10-01', '2026-10-21', '2026-09-30', 0],
    ['2026-10-01', '2026-10-21', '2026-10-01', 0],
    ['2026-10-01', '2026-10-21', '2026-10-21', 100],
    ['2026-10-01', '2026-10-21', '2026-11-01', 100],
    ['2026-10-11', '2026-10-11', '2026-10-11', 100],
    ['2026-10-11', '2026-10-11', '2026-10-10', 0],
    ['2026-01-01', '2026-03-01', '2026-02-01', 53],
    ['2026-12-22', '2027-01-11', '2027-01-01', 50],
    ['2026-10-21', '2026-10-01', '2026-10-11', 0],
    ['invalid', '2026-10-21', '2026-10-11', 0],
  ])('%s 至 %s，在 %s 为 %i%%', (start, end, today, expected) => {
    expect(getTimeProgress(start, end, today)).toBe(expected);
  });
});

describe('团队甘特图布局', () => {
  it('默认仍采用原有周间距，手动缩放与默认恢复可逆', () => {
    const args = { ...base, items: [item('2026-01-01', '2027-12-31')] };
    const normal = buildTeamGanttLayout(args);
    const zoomed = buildTeamGanttLayout({ ...args, zoom: 50 });
    expect(normal.pxPerDay).toBe(18);
    expect(zoomed.timelineWidth).toBeCloseTo(normal.timelineWidth / 2);
    expect(buildTeamGanttLayout({ ...args, zoom: 100, fit: false })).toEqual(normal);
  });

  it.each([120, 480, 1000])('跨年全览覆盖最早起点和最晚终点，适配 %ipx 宽度', (availableWidth) => {
    const items = [item('2024-03-12', '2024-04-01'), item('2027-12-01', '2028-01-25')];
    const layout = buildTeamGanttLayout({ ...base, items, availableWidth, fit: true });
    expect(layout.timelineWidth).toBeCloseTo(availableWidth);
    expect(layout.units[0].startDate <= items[0].startDate!).toBe(true);
    expect(layout.units.at(-1)!.endDate >= items[1].dueDate!).toBe(true);
    for (const task of items) {
      const bar = getItemGridPlacement(task, layout.units, layout.pxPerDay);
      expect(bar.leftPx).toBeGreaterThanOrEqual(0);
      expect(bar.leftPx + bar.widthPx).toBeLessThanOrEqual(availableWidth + 0.001);
    }
    expect(layout.units.some((unit) => unit.label.includes('2028'))).toBe(true);
  });

  it('全览仅使用传入任务范围，不为今天额外拉长历史排期', () => {
    const layout = buildTeamGanttLayout({ ...base, items: [item('2023-01-10', '2023-01-10')], fit: true });
    expect(layout.units.at(-1)!.endDate).toBe('2023-01-12');
    expect(layout.timelineWidth).toBeCloseTo(720);
  });

  it('年视图默认覆盖当年，放大时间轴仍可滚动查看细节', () => {
    const normal = buildTeamGanttLayout({ ...base, items: [], scale: 'year' });
    expect(normal.units).toHaveLength(12);
    expect(normal.timelineWidth).toBeCloseTo(720);
    expect(buildTeamGanttLayout({ ...base, items: [], scale: 'year', zoom: 150 }).timelineWidth).toBeCloseTo(1080);
  });
});
