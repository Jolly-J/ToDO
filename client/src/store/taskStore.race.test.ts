import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from '@/api/request';
import { useTaskStore } from './taskStore';

vi.mock('@/api/request', () => ({ default: { get: vi.fn() } }));
vi.mock('@/utils/clientLogger', () => ({ default: {} }));

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function nextRequest() {
  const pending = deferred();
  vi.mocked(request.get).mockReturnValueOnce(pending.promise as ReturnType<typeof request.get>);
  return pending;
}

const list = (id: string) => ({ list: [{ id }], total: 1, summary: { all: 1 } });

describe('共享任务集合只接收最新请求', () => {
  beforeEach(() => {
    vi.mocked(request.get).mockReset();
    useTaskStore.getState().setView('list');
    useTaskStore.setState({ tasks: [], total: 0, loading: false, filtersByView: { list: {}, board: {}, calendar: {}, cockpit: {} } });
  });

  it('B 先返回时 A 不覆盖跨团队、个人、回收站切换', async () => {
    const old = nextRequest(); const current = nextRequest();
    const a = useTaskStore.getState().fetchTasks('A');
    const b = useTaskStore.getState().fetchMyTasks();
    current.resolve(list('B')); await b;
    old.resolve(list('A')); await a;
    expect(useTaskStore.getState().tasks[0].id).toBe('B');
    expect(useTaskStore.getState().activeTeamId).toBeNull();
    const c = nextRequest(); const d = nextRequest();
    const third = useTaskStore.getState().fetchMyTasks();
    const fourth = useTaskStore.getState().fetchTrashTasks();
    d.resolve(list('trash')); await fourth;
    c.resolve(list('my')); await third;
    expect(useTaskStore.getState().tasks[0].id).toBe('trash');
  });

  it('过时错误不结束新请求 loading；过时成功不覆盖同团队新筛选', async () => {
    const old = nextRequest(); const current = nextRequest();
    const a = useTaskStore.getState().fetchTasks('team');
    useTaskStore.getState().setFilters({ keyword: 'new' });
    const b = useTaskStore.getState().fetchTasks('team');
    old.reject(new Error('过时失败')); await a;
    expect(useTaskStore.getState().loading).toBe(true);
    current.resolve(list('new')); await b;
    expect(useTaskStore.getState().tasks[0].id).toBe('new');
    expect(useTaskStore.getState().loading).toBe(false);
  });

  it('离开页面中止请求并阻止迟到响应，旧个人请求失败不结束新请求', async () => {
    const old = nextRequest(); const current = nextRequest();
    const a = useTaskStore.getState().fetchMyTasks();
    const b = useTaskStore.getState().fetchMyTasks({ keyword: 'B' });
    const signal = vi.mocked(request.get).mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(true);
    old.reject(new Error('旧个人请求')); await a;
    expect(useTaskStore.getState().loading).toBe(true);
    useTaskStore.getState().cancelCollectionFetch();
    current.resolve(list('late')); await b;
    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useTaskStore.getState().loading).toBe(false);
  });

  it('view 和筛选变化立即作废旧请求，尚未开始下一次 fetch 也安全', async () => {
    for (const change of [() => useTaskStore.getState().setView('board'), () => useTaskStore.getState().setFilters({ keyword:'changed' }), () => useTaskStore.getState().setViewFilters('list', { status:'done' })]) {
      useTaskStore.getState().setView('list');
      const old = nextRequest();
      const a = useTaskStore.getState().fetchTasks('team');
      change();
      old.resolve(list('obsolete')); await a;
      expect(useTaskStore.getState().tasks).toEqual([]);
      expect(useTaskStore.getState().loading).toBe(false);
    }
  });

  it('看板、日历和驾驶舱分别保护目标集合', async () => {
    for (const view of ['board', 'calendar', 'cockpit'] as const) {
      useTaskStore.getState().setView(view);
      const old = nextRequest(); const current = nextRequest();
      const a = useTaskStore.getState().fetchTasks('A');
      const b = useTaskStore.getState().fetchTasks('B');
      const value = view === 'board' ? { in_progress:[{id:'B'}], delayed_in_progress:[], done:[], delayed_done:[], canceled:[] } : view === 'calendar' ? [{id:'B'}] : list('B');
      current.resolve(value); await b;
      old.resolve(view === 'board' ? { in_progress:[{id:'A'}] } : view === 'calendar' ? [{id:'A'}] : list('A')); await a;
      const state = useTaskStore.getState();
      expect((view === 'board' ? state.boardData.in_progress : view === 'calendar' ? state.calendarData : state.tasks)[0].id).toBe('B');
    }
  });
});
