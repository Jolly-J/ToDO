/** 权限状态 Store，管理当前用户的角色与操作权限数据 */
import { create } from 'zustand';
import request from '@/api/request';

interface Role {
  id: string;
  name: string;
  description: string;
  level: string;
  permissions: string[];
}

interface PermissionState {
  roles: Role[];
  loading: boolean;
  fetchRoles: () => Promise<void>;
  createRole: (data: Partial<Role>) => Promise<void>;
  updateRole: (id: string, data: Partial<Role>) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  roles: [],
  loading: false,

  fetchRoles: async () => {
    set({ loading: true });
    try {
      const roles = await request.get<Role[]>('/roles');
      set({ roles, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createRole: async (data) => {
    const role = await request.post<Role>('/roles', data);
    const { roles } = get();
    set({ roles: [...roles, role] });
  },

  updateRole: async (id, data) => {
    const role = await request.patch<Role>(`/roles/${id}`, data);
    const { roles } = get();
    set({ roles: roles.map(r => (r.id === id ? { ...r, ...role } : r)) });
  },

  deleteRole: async (id) => {
    await request.delete(`/roles/${id}`);
    const { roles } = get();
    set({ roles: roles.filter(r => r.id !== id) });
  },
}));
