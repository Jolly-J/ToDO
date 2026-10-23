import { beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import { toast } from 'sonner';
import request from './request';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem() {} });
});

it('已取消的列表请求不显示迟到的全局错误，正常错误仍提示', async () => {
  const controller = new AbortController();
  const canceled = request.get('/synthetic', { signal: controller.signal, adapter: async config => {
    controller.abort();
    throw new axios.AxiosError('late', 'ERR_NETWORK', config);
  } });
  await expect(canceled).rejects.toThrow();
  expect(toast.error).not.toHaveBeenCalled();
  await expect(request.get('/synthetic', { adapter: async () => { throw new Error('current failure'); } })).rejects.toThrow();
  expect(toast.error).toHaveBeenCalledTimes(1);
});
