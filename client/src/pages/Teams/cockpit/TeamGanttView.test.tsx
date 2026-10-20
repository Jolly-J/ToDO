import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamGanttView from './TeamGanttView';
import type { Task } from '@/types';

const tasks: Task[] = [{
  id: 'a', title: '跨年任务', status: 'in_progress', priority: 'medium', creator_id: 'u',
  team_id: 'team', created_at: '2024-03-01', start_date: '2024-03-12', due_date: '2028-01-25',
} as Task];

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('团队甘特图交互', () => {
  it('左侧百分比和任务条填充均按排期时间计算，不受子任务和延期状态影响', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00+08:00'));
    render(<TeamGanttView tasks={[
      { ...tasks[0], id: 'time-a', title: '时间任务', start_date: '2026-10-01', due_date: '2026-10-21', subtask_count: 10, subtask_done_count: 2 },
      { ...tasks[0], id: 'time-b', title: '延期任务', status: 'delayed_in_progress', start_date: '2026-10-01', due_date: '2026-10-21' },
    ]} />);
    expect(screen.getAllByTitle('时间进度：50%')).toHaveLength(2);
    for (const title of ['时间任务', '延期任务']) {
      const bar = screen.getByTitle(`${title} · 2026-10-01 → 2026-10-21`);
      expect((bar.firstElementChild as HTMLElement).style.width).toBe('50%');
    }
  });

  it('全览包含跨年排期，缩放和恢复默认正常切换', () => {
    render(<TeamGanttView tasks={tasks} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全览' }));
    expect(screen.getByRole('button', { name: '全览' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('排期范围：2024-03-12 至 2028-01-25')).toBeInTheDocument();
    const viewport = screen.getByLabelText('任务排期时间轴');
    expect((viewport.firstElementChild as HTMLElement).style.width).toBe('1000px');
    fireEvent.change(screen.getByRole('slider', { name: '时间轴间距' }), { target: { value: '50' } });
    expect(screen.getByRole('slider', { name: '时间轴间距' })).toHaveValue('50');
    expect(screen.getByRole('button', { name: '全览' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: '恢复默认间距' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('右下角可通过键盘调高并恢复，向上调整有最小高度保护', () => {
    render(<TeamGanttView tasks={tasks} />);
    const grip = screen.getByRole('button', { name: '调整甘特图高度' });
    const viewport = screen.getByLabelText('任务排期时间轴');
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ height: 550 } as DOMRect);
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    expect(viewport.style.height).toBe('590px');
    for (let i = 0; i < 20; i++) fireEvent.keyDown(grip, { key: 'ArrowUp' });
    expect(viewport.style.height).toBe('200px');
    fireEvent.keyDown(grip, { key: 'Home' });
    expect(viewport.style.height).toBe('');
    expect(viewport.style.maxHeight).toBe('550px');
  });

  it('空数据禁用缩放；异步载入任务后全览可用', () => {
    const view = render(<TeamGanttView tasks={[]} />);
    expect(screen.getByRole('button', { name: '全览' })).toBeDisabled();
    view.rerender(<TeamGanttView tasks={tasks} />);
    fireEvent.click(screen.getByRole('button', { name: '全览' }));
    expect(screen.getByText('自适应')).toBeInTheDocument();
    expect(screen.getByText('排期范围：2024-03-12 至 2028-01-25')).toBeInTheDocument();
  });
});
