/** 认证状态 Store，管理当前登录用户信息及持久化登录态 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import request from '@/api/request';
import clientLogger from '@/utils/clientLogger';

type LoginMode = 'internal' | 'qr';
const LOGIN_ENDPOINT = '/auth/dingtalk/login';
const LEGACY_MOCK_TOKEN = 'mock-token-for-development';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (authCode: string, mode?: LoginMode) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateUserAvatarState: (avatar: string, avatarConfig?: any, avatarType?: 'custom' | 'dingtalk' | 'default') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      loading: false,
      isAuthenticated: false,

      updateUserAvatarState: (avatar: string, avatarConfig?: any, avatarType: 'custom' | 'dingtalk' | 'default' = 'custom') => {
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                avatar,
                avatar_config: typeof avatarConfig === 'string' ? avatarConfig : JSON.stringify(avatarConfig),
                avatar_type: avatarType,
              }
            : null,
        }));
      },

      login: async (authCode: string, mode: LoginMode = 'internal') => {
        const startTime = Date.now();
        set({ loading: true });
        try {
          const res = await request.post<{ token: string; user: User }>(LOGIN_ENDPOINT, {
            authCode,
            type: mode,
          });
          localStorage.setItem('token', res.token);
          set({
            token: res.token,
            user: res.user,
            isAuthenticated: true,
            loading: false,
          });
          // 日志上报：登录成功
          clientLogger.setUserId(res.user.id);
          clientLogger.success('frontend.login.success', {
            durationMs: Date.now() - startTime,
            meta: { mode, userName: res.user.name },
          });
        } catch (err) {
          set({ loading: false });
          // 日志上报：登录失败
          const realError = err instanceof Error ? err : new Error('登录失败');
          clientLogger.failed('frontend.login.failed', {
            durationMs: Date.now() - startTime,
            error: realError,
            meta: { mode },
          });
          throw realError;
        }
      },

      logout: () => {
        // 日志上报：用户注销（本地记录，不上报）
        clientLogger.info('用户注销');
        clientLogger.setUserId(undefined);
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      fetchMe: async () => {
        const token = localStorage.getItem('token') || useAuthStore.getState().token;
        if (!token) return;

        set({ loading: true });
        try {
          const user = await request.get<User>('/auth/me');
          set({ user, isAuthenticated: true, loading: false });
          // 更新日志用户ID
          clientLogger.setUserId(user.id);
        } catch {
          set({ user: null, token: null, isAuthenticated: false, loading: false });
          localStorage.removeItem('token');
          clientLogger.setUserId(undefined);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);

// 从持久化存储初始化时读取 token
const initToken = useAuthStore.getState().token;
if (initToken && initToken !== LEGACY_MOCK_TOKEN) {
  localStorage.setItem('token', initToken);
}
if (initToken === LEGACY_MOCK_TOKEN) {
  localStorage.removeItem('token');
  useAuthStore.setState({ token: null, user: null });
}
