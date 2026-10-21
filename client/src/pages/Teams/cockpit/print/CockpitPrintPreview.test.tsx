import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CockpitPrintPreview from './CockpitPrintPreview';
import { exportCockpitPdf } from './exportCockpitPdf';
import request from '@/api/request';
import type { Task } from '@/types';

vi.mock('@/api/request', () => ({
  default: { get: vi.fn() },
}));

vi.mock('./exportCockpitPdf', () => ({
  exportCockpitPdf: vi.fn().mockResolvedValue(undefined),
}));

const dashboardStats = { total: 12, unfinished: 8, inProgress: 5, done: 4, overdue: 2 };
const memberStats = [
  {
    userId: 'u1',
    name: '张三',
    role: 'owner',
    department: '研发部',
    assignedTaskCount: 3,
    openTaskCount: 2,
    overdueTaskCount: 1,
    urgentTaskCount: 0,
    completedTaskCount: 1,
    completionRate: 33,
  },
];

const tasks = [
  {
    id: 't1',
    title: '任务一',
    status: 'in_progress',
    priority: 'medium',
    creator_id: 'u1',
    team_id: 'team-1',
    created_at: '2026-09-01',
    start_date: '2026-10-01',
    due_date: '2026-10-21',
  },
] as unknown as Task[];

function renderPreview(onClose = vi.fn()) {
  render(
    <CockpitPrintPreview
      onClose={onClose}
      teamId="team-1"
      teamName="研发中心"
      teamLevelLabel="一级团队"
      tasks={tasks}
      viewState={{ statusFilter: 'in_progress', riskOnly: false, collapsedIds: new Set() }}
    />
  );
  return onClose;
}

const requestGet = request.get as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  requestGet.mockImplementation(async (url: string) => {
    if (String(url).startsWith('/dashboard/stats')) return dashboardStats;
    if (String(url).includes('/cockpit/member-tasks')) return memberStats;
    return null;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.style.overflow = '';
});

describe('团队驾驶舱打印预览', () => {
  it('默认只打印一页，数据就绪后可导出 PDF', async () => {
    renderPreview();

    expect(screen.getByText('打印预览')).toBeInTheDocument();
    expect(screen.getByText('共 1 页')).toBeInTheDocument();

    const exportButton = screen.getByRole('button', { name: '导出 PDF' });
    await waitFor(() => expect(exportButton).toBeEnabled());

    expect(document.querySelectorAll('[data-print-page]')).toHaveLength(1);
    expect(screen.getAllByText('研发中心').length).toBeGreaterThan(0);
  });

  it('成员负载选择项是按钮，选中状态通过 aria-pressed 提示并实时增加第二页', async () => {
    renderPreview();
    await waitFor(() => expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled());

    const memberToggle = screen.getByRole('button', { name: '包含团队成员任务负载' });
    expect(memberToggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(memberToggle);

    expect(memberToggle).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByText('共 2 页')).toBeInTheDocument());
    expect(document.querySelectorAll('[data-print-page]')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: '团队成员任务负载' })).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '导出 PDF' }));

    await waitFor(() => expect(exportCockpitPdf).toHaveBeenCalledTimes(1));
    const pages = vi.mocked(exportCockpitPdf).mock.calls[0][0] as HTMLElement[];
    expect(pages).toHaveLength(2);
    await waitFor(() => expect(screen.getByText('PDF 已生成，请查看浏览器下载文件')).toBeInTheDocument());
  });

  it('关闭按钮播放退出动画后触发退出预览', async () => {
    const onClose = renderPreview();
    await waitFor(() => expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: '关闭打印预览' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('成员数据加载失败时禁用导出并给出提示', async () => {
    requestGet.mockImplementation(async (url: string) => {
      if (String(url).startsWith('/dashboard/stats')) return dashboardStats;
      if (String(url).includes('/cockpit/member-tasks')) throw new Error('无权限');
      return null;
    });

    renderPreview();
    fireEvent.click(screen.getByRole('button', { name: '包含团队成员任务负载' }));

    await waitFor(() => expect(screen.getAllByText(/成员任务数据加载失败/).length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeDisabled();
  });
});
