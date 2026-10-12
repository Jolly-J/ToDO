/**
 * 灵活团队组建状态管理
 * 基于 Zustand 管理团队创建、成员角色分配及团队列表的全局状态
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { 
  FlexibleTeam, 
  TeamMemberExtended, 
  TeamMemberRole, 
  PermissionLevel,
  LoadingState 
} from '@/types/multi-board';
import type { User } from '@/types';

// ===== 团队状态管理接口 =====
interface TeamStore {
  // 状态
  teams: FlexibleTeam[];
  currentTeam: FlexibleTeam | null;
  members: TeamMemberExtended[];
  availableUsers: User[];
  loading: LoadingState;
  error: string | null;
  
  // 团队操作
  fetchTeams: () => Promise<void>;
  fetchTeamMembers: (teamId: string) => Promise<void>;
  fetchAvailableUsers: (filters?: UserSearchFilters) => Promise<void>;
  createTeam: (team: Partial<FlexibleTeam>) => Promise<void>;
  updateTeam: (teamId: string, updates: Partial<FlexibleTeam>) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  
  // 成员管理
  addMember: (teamId: string, userId: string, role: TeamMemberRole) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  updateMemberRole: (teamId: string, userId: string, role: TeamMemberRole) => Promise<void>;
  updateMemberPermissions: (teamId: string, userId: string, permissions: PermissionLevel[]) => Promise<void>;
  
  // 批量操作
  addMultipleMembers: (teamId: string, members: Array<{ userId: string; role: TeamMemberRole }>) => Promise<void>;
  removeMultipleMembers: (teamId: string, userIds: string[]) => Promise<void>;
  
  // 工具方法
  getTeamById: (teamId: string) => FlexibleTeam | undefined;
  getMemberById: (userId: string) => TeamMemberExtended | undefined;
  getMembersByRole: (role: TeamMemberRole) => TeamMemberExtended[];
  getAvailableUsersBySkills: (skills: string[]) => User[];
  getTeamWorkloadStats: (teamId: string) => FlexibleTeam['workloadStats'] | null;
  
  // 搜索和过滤
  searchUsers: (query: string, filters?: UserSearchFilters) => User[];
  filterUsersByDepartment: (departmentId: string) => User[];
  filterUsersBySkills: (skills: string[]) => User[];
  
  // 设置当前团队
  setCurrentTeam: (team: FlexibleTeam | null) => void;
  
  // 重置状态
  reset: () => void;
}

// ===== 用户搜索过滤器 =====
interface UserSearchFilters {
  departmentId?: string;
  skills?: string[];
  availability?: 'available' | 'busy' | 'offline';
  excludeUserIds?: string[];
  includeWorkload?: boolean;
}

// ===== 初始状态 =====
const initialState = {
  teams: [],
  currentTeam: null,
  members: [],
  availableUsers: [],
  loading: {
    global: false,
    tasks: false,
    teams: false,
    dragOperation: false,
    saving: false,
  },
  error: null,
};

function normalizeSkills(skills: string[]) {
  return skills
    .map((skill) => skill.trim().toLowerCase())
    .filter(Boolean);
}

function filterUsersBySkillsList(users: User[], skills: string[]) {
  const normalizedSkills = normalizeSkills(skills);
  if (normalizedSkills.length === 0) {
    return users;
  }

  return users.filter((user) => {
    const userSkills = normalizeSkills((user as User & { skills?: string[] }).skills ?? []);
    return normalizedSkills.some((skill) => userSkills.includes(skill));
  });
}

// ===== 创建团队状态管理 =====
export const useTeamStore = create<TeamStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,
      
      // ===== 团队操作 =====
      fetchTeams: async () => {
        set((state) => ({
          loading: { ...state.loading, teams: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          const response = await fetch('/api/teams');
          const data = await response.json();
          
          set({
            teams: data.teams,
            loading: { ...get().loading, teams: false },
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '获取团队失败',
            loading: { ...get().loading, teams: false },
          });
        }
      },
      
      fetchTeamMembers: async (teamId: string) => {
        set((state) => ({
          loading: { ...state.loading, teams: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          const response = await fetch(`/api/teams/${teamId}/members`);
          const data = await response.json();
          
          set({
            members: data.members,
            loading: { ...get().loading, teams: false },
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '获取团队成员失败',
            loading: { ...get().loading, teams: false },
          });
        }
      },
      
      fetchAvailableUsers: async (filters?: UserSearchFilters) => {
        set((state) => ({
          loading: { ...state.loading, global: true },
          error: null,
        }));
        
        try {
          const queryParams = new URLSearchParams();
          if (filters?.departmentId) queryParams.append('department_id', filters.departmentId);
          if (filters?.skills) queryParams.append('skills', filters.skills.join(','));
          if (filters?.availability) queryParams.append('availability', filters.availability);
          if (filters?.excludeUserIds) queryParams.append('exclude', filters.excludeUserIds.join(','));
          if (filters?.includeWorkload) queryParams.append('include_workload', 'true');
          
          // TODO: 实现API调用
          const response = await fetch(`/api/users/available?${queryParams.toString()}`);
          const data = await response.json();
          
          set({
            availableUsers: data.users,
            loading: { ...get().loading, global: false },
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '获取可用用户失败',
            loading: { ...get().loading, global: false },
          });
        }
      },
      
      createTeam: async (team: Partial<FlexibleTeam>) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          const response = await fetch('/api/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(team),
          });
          const newTeam = await response.json();
          
          set((state) => ({
            teams: [...state.teams, newTeam],
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '创建团队失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      updateTeam: async (teamId: string, updates: Partial<FlexibleTeam>) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          const response = await fetch(`/api/teams/${teamId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          const updatedTeam = await response.json();
          
          set((state) => ({
            teams: state.teams.map(team => 
              team.id === teamId ? { ...team, ...updatedTeam } : team
            ),
            currentTeam: state.currentTeam?.id === teamId 
              ? { ...state.currentTeam, ...updatedTeam }
              : state.currentTeam,
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '更新团队失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      deleteTeam: async (teamId: string) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          await fetch(`/api/teams/${teamId}`, {
            method: 'DELETE',
          });
          
          set((state) => ({
            teams: state.teams.filter(team => team.id !== teamId),
            currentTeam: state.currentTeam?.id === teamId ? null : state.currentTeam,
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '删除团队失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      // ===== 成员管理 =====
      addMember: async (teamId: string, userId: string, role: TeamMemberRole) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          const response = await fetch(`/api/teams/${teamId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, role }),
          });
          const newMember = await response.json();
          
          set((state) => ({
            members: [...state.members, newMember],
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '添加成员失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      removeMember: async (teamId: string, userId: string) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          await fetch(`/api/teams/${teamId}/members/${userId}`, {
            method: 'DELETE',
          });
          
          set((state) => ({
            members: state.members.filter(member => member.userId !== userId),
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '移除成员失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      updateMemberRole: async (teamId: string, userId: string, role: TeamMemberRole) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          const response = await fetch(`/api/teams/${teamId}/members/${userId}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
          });
          const updatedMember = await response.json();
          
          set((state) => ({
            members: state.members.map(member =>
              member.userId === userId ? { ...member, ...updatedMember } : member
            ),
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '更新成员角色失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      updateMemberPermissions: async (teamId: string, userId: string, permissions: PermissionLevel[]) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          const response = await fetch(`/api/teams/${teamId}/members/${userId}/permissions`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions }),
          });
          const updatedMember = await response.json();
          
          set((state) => ({
            members: state.members.map(member =>
              member.userId === userId ? { ...member, ...updatedMember } : member
            ),
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '更新成员权限失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      // ===== 批量操作 =====
      addMultipleMembers: async (teamId: string, members: Array<{ userId: string; role: TeamMemberRole }>) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          const response = await fetch(`/api/teams/${teamId}/members/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ members }),
          });
          const newMembers = await response.json();
          
          set((state) => ({
            members: [...state.members, ...newMembers],
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '批量添加成员失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      removeMultipleMembers: async (teamId: string, userIds: string[]) => {
        set((state) => ({
          loading: { ...state.loading, saving: true },
          error: null,
        }));
        
        try {
          // TODO: 实现API调用
          await fetch(`/api/teams/${teamId}/members/batch`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds }),
          });
          
          set((state) => ({
            members: state.members.filter(member => !userIds.includes(member.userId)),
            loading: { ...state.loading, saving: false },
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '批量移除成员失败',
            loading: { ...get().loading, saving: false },
          });
        }
      },
      
      // ===== 工具方法 =====
      getTeamById: (teamId: string) => {
        return get().teams.find(team => team.id === teamId);
      },
      
      getMemberById: (userId: string) => {
        return get().members.find(member => member.userId === userId);
      },
      
      getMembersByRole: (role: TeamMemberRole) => {
        return get().members.filter(member => member.role === role);
      },
      
      getAvailableUsersBySkills: (skills: string[]) => {
        return filterUsersBySkillsList(get().availableUsers, skills);
      },
      
      getTeamWorkloadStats: (teamId: string) => {
        const team = get().getTeamById(teamId);
        return team?.workloadStats || null;
      },
      
      // ===== 搜索和过滤 =====
      searchUsers: (query: string, filters?: UserSearchFilters) => {
        const { availableUsers } = get();
        const lowerQuery = query.toLowerCase();
        
        return availableUsers.filter(user => {
          // 基本搜索匹配
          const matchesQuery = 
            user.name.toLowerCase().includes(lowerQuery) ||
            user.email?.toLowerCase().includes(lowerQuery) ||
            user.department_name?.toLowerCase().includes(lowerQuery);
          
          if (!matchesQuery) return false;
          
          // 应用过滤器
          if (filters?.departmentId && user.department_id !== filters.departmentId) {
            return false;
          }
          
          if (filters?.excludeUserIds && filters.excludeUserIds.includes(user.id)) {
            return false;
          }
          
          // TODO: 实现其他过滤逻辑
          
          return true;
        });
      },
      
      filterUsersByDepartment: (departmentId: string) => {
        return get().availableUsers.filter(user => user.department_id === departmentId);
      },
      
      filterUsersBySkills: (skills: string[]) => {
        return filterUsersBySkillsList(get().availableUsers, skills);
      },
      
      // ===== 设置当前团队 =====
      setCurrentTeam: (team: FlexibleTeam | null) => {
        set({ currentTeam: team });
      },
      
      // ===== 重置状态 =====
      reset: () => {
        set(initialState);
      },
    })),
    {
      name: 'multi-team-store',
    }
  )
);

// ===== 选择器 =====
export const useTeamsSelector = () => useTeamStore(state => state.teams);
export const useCurrentTeamSelector = () => useTeamStore(state => state.currentTeam);
export const useMembersSelector = () => useTeamStore(state => state.members);
export const useAvailableUsersSelector = () => useTeamStore(state => state.availableUsers);
export const useTeamLoadingSelector = () => useTeamStore(state => state.loading);
