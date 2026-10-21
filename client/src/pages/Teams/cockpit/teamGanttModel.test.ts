import { describe, expect, it } from 'vitest';
import { buildTeamGanttModel, type BuildTeamGanttModelOptions } from './teamGanttModel';
import type { Task } from '@/types';

const base = {
  creator_id: 'u1',
  team_id: 'team-1',
  priority: 'medium',
  created_at: '2026-09-01',
} as const;

function makeTask(partial: Record<string, unknown>): Task {
  return { ...base, ...partial } as unknown as Task;
}

function buildModel(overrides: Partial<BuildTeamGanttModelOptions> = {}) {
  return buildTeamGanttModel({
    tasks: [],
    today: '2026-10-21',
    statusFilter: 'in_progress',
    riskOnly: false,
    collapsedIds: new Set<string>(),
    availableWidth: 800,
    scale: 'week',
    zoom: 100,
    fit: false,
    ...overrides,
  });
}

describe('团队甘特图共享模型', () => {
  it('默认按进行中筛选，排除已完成任务', () => {
    const model = buildModel({
      tasks: [
        makeTask({ id: 'p1', title: '进行中任务', status: 'in_progress', start_date: '2026-10-01', due_date: '2026-10-21' }),
        makeTask({ id: 'd1', title: '已完成任务', status: 'done', start_date: '2026-10-01', due_date: '2026-10-05' }),
      ],
    });

    expect(model.filteredRows.map((row) => row.name)).toEqual(['进行中任务']);
    expect(model.statusLabel).toBe('进行中');
  });

  it('父任务命中时保留子任务，折叠父任务后子任务隐藏', () => {
    const tasks = [
      makeTask({ id: 'parent', title: '父任务', status: 'in_progress', start_date: '2026-10-01', due_date: '2026-10-30' }),
      makeTask({ id: 'child', title: '子任务', status: 'done', parent_id: 'parent', start_date: '2026-10-02', due_date: '2026-10-03' }),
    ];

    const expanded = buildModel({ tasks });
    expect(expanded.filteredRows.map((row) => row.name)).toEqual(['父任务', '子任务']);
    expect(expanded.parentIds.has('parent')).toBe(true);

    const collapsed = buildModel({ tasks, collapsedIds: new Set(['parent']) });
    expect(collapsed.filteredRows.map((row) => row.name)).toEqual(['父任务']);
  });

  it('仅看逾期/紧急时同时收敛排期范围', () => {
    const model = buildModel({
      riskOnly: true,
      tasks: [
        makeTask({ id: 'normal', title: '普通任务', status: 'in_progress', start_date: '2026-10-01', due_date: '2026-11-05' }),
        makeTask({ id: 'delayed', title: '延期任务', status: 'delayed_in_progress', start_date: '2026-10-10', due_date: '2026-10-15' }),
        makeTask({ id: 'urgent', title: '紧急任务', status: 'in_progress', priority: 'urgent', start_date: '2026-10-14', due_date: '2026-10-25' }),
      ],
    });

    expect(model.filteredRows.map((row) => row.name)).toEqual(['延期任务', '紧急任务']);
    expect(model.rangeItems.map((item) => item.name)).toEqual(['延期任务', '紧急任务']);
    const visibleStart = model.units[0]?.startDate ?? '';
    expect(visibleStart <= '2026-10-10').toBe(true);
  });

  it('全览时时间轴宽度收敛到可用宽度', () => {
    const model = buildModel({
      fit: true,
      availableWidth: 800,
      scale: 'day',
      zoom: 200,
      tasks: [
        makeTask({ id: 'long', title: '长排期任务', status: 'in_progress', start_date: '2026-01-05', due_date: '2026-12-20' }),
      ],
    });

    expect(model.timelineWidth).toBeCloseTo(800, 0);
    expect(model.taskStart).toBe('2026-01-05');
    expect(model.taskEnd).toBe('2026-12-20');
  });

  it('左侧百分比按排期时间计算', () => {
    const model = buildModel({
      today: '2026-10-11',
      tasks: [
        makeTask({ id: 'time', title: '时间任务', status: 'in_progress', start_date: '2026-10-01', due_date: '2026-10-21' }),
      ],
    });

    expect(model.filteredRows[0]?.progress).toBe(50);
  });

  it('空任务时输出空行，不抛错', () => {
    const model = buildModel({ tasks: [] });

    expect(model.filteredRows).toEqual([]);
    expect(model.allRows).toEqual([]);
    expect(model.placements.size).toBe(0);
  });
});
