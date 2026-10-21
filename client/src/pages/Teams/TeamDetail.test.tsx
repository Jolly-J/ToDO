import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TeamDetail from './TeamDetail';

const store = vi.hoisted(() => ({
  currentView: 'cockpit' as string,
  openTour: vi.fn(),
}));

vi.mock('@/store', () => ({
  useTeamStore: () => ({
    currentTeam: {
      id: 'team-1',
      name: '研发中心',
      level: 'company',
      owner_id: 'u1',
      description: '测试团队',
    },
    fetchTeamDetail: vi.fn(),
    fetchMembers: vi.fn(),
    members: [],
  }),
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = { user: { id: 'u1' } };
    return selector ? selector(state) : state;
  },
  useTaskStore: (selector?: (state: unknown) => unknown) => {
    const state = { currentView: store.currentView, tasks: [] };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/components/onboarding/tourStore', () => ({
  useTourStore: (selector?: (state: unknown) => unknown) => {
    const state = { openTour: store.openTour };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/pages/Tasks/TaskWorkspace', () => ({
  default: () => <div data-testid="task-workspace" />,
}));

vi.mock('@/pages/Teams/cockpit/print/CockpitPrintPreview', () => ({
  default: () => <div data-testid="print-preview" />,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/teams/team-1']}>
      <Routes>
        <Route path="/teams/:id" element={<TeamDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

describe('团队空间页头打印入口', () => {
  it('驾驶舱视图中在设置按钮左侧显示主色打印按钮', () => {
    store.currentView = 'cockpit';
    renderPage();

    const printButton = screen.getByRole('button', { name: '打印此页' });
    const settingsButton = screen.getByRole('button', { name: '设置' });

    expect(printButton).toHaveAttribute('data-variant', 'default');
    expect(
      printButton.compareDocumentPosition(settingsButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('非驾驶舱视图不显示打印按钮', () => {
    store.currentView = 'list';
    renderPage();

    expect(screen.queryByRole('button', { name: '打印此页' })).toBeNull();
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
  });

  it('点击打印按钮打开打印预览', async () => {
    store.currentView = 'cockpit';
    renderPage();

    expect(screen.queryByTestId('print-preview')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '打印此页' }));
    await waitFor(() => expect(screen.getByTestId('print-preview')).toBeInTheDocument());
  });
});
