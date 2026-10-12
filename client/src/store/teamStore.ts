/** 团队状态 Store，管理团队列表、成员信息及相关操作 */
import { create } from 'zustand';
import type {
  Team,
  User,
  TeamMemberRole,
  TeamMemberTaskVisibilityScope,
  TeamMemberTaskCheck,
  TeamDissolveCheck,
  CreateTeamPayload,
  TeamGroupReminderSettings,
  TeamGroupReminderTaskPoolItem,
  SaveTeamGroupReminderPayload,
} from '@/types';
import request from '@/api/request';
import { useAuthStore } from './authStore';

interface TeamWithStats extends Team {
  memberCount: number;
  taskCount: number;
  unfinishedCount: number;
  todoCount?: number;
  doneCount: number;
}

interface TeamState {
  teams: TeamWithStats[];
  currentTeam: Team | null;
  groupReminder: TeamGroupReminderSettings | null;
  groupReminderTaskPool: TeamGroupReminderTaskPoolItem[];
  members: (User & {
    role_id: TeamMemberRole;
    task_visibility_scope?: TeamMemberTaskVisibilityScope;
    joined_at?: string;
    user_avatar?: string;
    user_name?: string;
    user_department?: string;
    role?: string;
  })[];
  loading: boolean;
  fetchTeams: () => Promise<void>;
  fetchTeam: (id: string) => Promise<void>;
  fetchTeamDetail: (id: string) => Promise<void>;
  createTeam: (data: CreateTeamPayload) => Promise<Team>;
  updateTeam: (id: string, data: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  setCurrentTeam: (team: Team | null) => void;
  fetchMembers: (teamId: string) => Promise<(User & {
    role_id: TeamMemberRole;
    task_visibility_scope?: TeamMemberTaskVisibilityScope;
    joined_at?: string;
  })[]>;
  addMembers: (teamId: string, userIds: string[], role_id?: TeamMemberRole) => Promise<void>;
  updateMemberRole: (teamId: string, userId: string, role_id: string) => Promise<void>;
  updateMemberTaskVisibilityScope: (
    teamId: string,
    userId: string,
    taskVisibilityScope: TeamMemberTaskVisibilityScope
  ) => Promise<void>;
  batchUpdateTaskVisibilityScope: (
    teamId: string,
    taskVisibilityScope: TeamMemberTaskVisibilityScope
  ) => Promise<void>;
  checkMemberRemoval: (teamId: string, userId: string) => Promise<TeamMemberTaskCheck>;
  removeMember: (
    teamId: string,
    userId: string,
    options?: { transferToUserId?: string; removeParticipantAssignments?: boolean }
  ) => Promise<void>;
  checkMyExit: (teamId: string) => Promise<TeamMemberTaskCheck>;
  exitTeam: (teamId: string) => Promise<void>;
  checkTeamDissolve: (teamId: string) => Promise<TeamDissolveCheck>;
  dissolveTeam: (teamId: string) => Promise<void>;
  fetchGroupReminder: (teamId: string) => Promise<TeamGroupReminderSettings | null>;
  fetchGroupReminderTaskPool: (teamId: string) => Promise<TeamGroupReminderTaskPoolItem[]>;
  saveGroupReminder: (teamId: string, payload: SaveTeamGroupReminderPayload) => Promise<void>;
  testSendGroupReminder: (teamId: string) => Promise<void>;
  syncGroupReminderCalendar: (teamId: string) => Promise<TeamGroupReminderSettings | null>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  currentTeam: null,
  groupReminder: null,
  groupReminderTaskPool: [],
  members: [],
  loading: false,

  fetchTeams: async () => {
    set({ loading: true });
    try {
      const teams = await request.get<TeamWithStats[]>('/teams');
      set({ teams, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchTeam: async (id: string) => {
    set({ loading: true });
    try {
      const team = await request.get<Team>(`/teams/${id}`);
      set({ currentTeam: team, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createTeam: async (data) => {
    const team = await request.post<Team>('/teams', data);
    await get().fetchTeams();
    return team;
  },

  updateTeam: async (id, data) => {
    const team = await request.patch<Team>(`/teams/${id}`, data);
    const { teams, currentTeam } = get();
    set({
      teams: teams.map(t => (t.id === id ? { ...t, ...team } : t)),
      currentTeam: currentTeam?.id === id ? { ...currentTeam, ...team } : currentTeam,
    });
  },

  setCurrentTeam: (team) => set({ currentTeam: team }),

  fetchMembers: async (teamId) => {
    set({ loading: true });
    try {
      const members = await request.get<(User & {
        role_id: TeamMemberRole;
        task_visibility_scope?: TeamMemberTaskVisibilityScope;
        joined_at?: string;
      })[]>(`/teams/${teamId}/members`);
      set({ members, loading: false });
      return members;
    } catch {
      set({ loading: false });
      return [];
    }
  },

  addMembers: async (teamId, userIds, role_id = 'member') => {
    await request.post(`/teams/${teamId}/members`, { user_ids: userIds, role_id });
    await get().fetchMembers(teamId);
    await get().fetchTeams();
  },

  updateMemberRole: async (teamId, userId, role_id) => {
    await request.patch(`/teams/${teamId}/members/${userId}`, { role_id });
    const { members } = get();
    set({ members: members.map(m => (m.id === userId ? { ...m, role_id: role_id as TeamMemberRole } : m)) });
  },

  updateMemberTaskVisibilityScope: async (teamId, userId, taskVisibilityScope) => {
    await request.patch(`/teams/${teamId}/members/${userId}/task-visibility-scope`, {
      task_visibility_scope: taskVisibilityScope,
    });
    const { members } = get();
    set({
      members: members.map(m => (
        m.id === userId ? { ...m, task_visibility_scope: taskVisibilityScope } : m
      )),
    });
  },

  batchUpdateTaskVisibilityScope: async (teamId, taskVisibilityScope) => {
    await request.patch(`/teams/${teamId}/task-visibility-scope`, {
      task_visibility_scope: taskVisibilityScope,
    });
    const { members } = get();
    set({
      members: members.map(m => (
        m.role_id === 'member' ? { ...m, task_visibility_scope: taskVisibilityScope } : m
      )),
    });
  },

  checkMemberRemoval: async (teamId, userId) => (
    request.get<TeamMemberTaskCheck>(`/teams/${teamId}/members/${userId}/removal-check`)
  ),

  fetchTeamDetail: async (id: string) => {
    await get().fetchTeam(id);
  },

  deleteTeam: async (id: string) => {
    await request.delete(`/teams/${id}`);
    const { teams } = get();
    set({ teams: teams.filter(t => t.id !== id), currentTeam: null });
  },

  removeMember: async (teamId, userId, options) => {
    await request.post(`/teams/${teamId}/members/${userId}/remove`, options || {});
    const { members } = get();
    set({ members: members.filter(m => m.id !== userId) });
    await get().fetchTeams();
  },

  checkMyExit: async (teamId) => (
    request.get<TeamMemberTaskCheck>(`/teams/${teamId}/members/me/exit-check`)
  ),

  exitTeam: async (teamId) => {
    await request.post(`/teams/${teamId}/members/me/exit`, {});
    const currentUserId = useAuthStore.getState().user?.id;
    const { members, teams } = get();
    set({
      members: currentUserId ? members.filter((member) => member.id !== currentUserId) : members,
      teams: teams.filter((team) => team.id !== teamId),
      currentTeam: null,
    });
  },

  checkTeamDissolve: async (teamId) => (
    request.get<TeamDissolveCheck>(`/teams/${teamId}/dissolve-check`)
  ),

  dissolveTeam: async (teamId) => {
    await request.post(`/teams/${teamId}/dissolve`, {});
    const { teams } = get();
    set({
      teams: teams.filter((team) => team.id !== teamId),
      currentTeam: null,
      members: [],
    });
  },

  fetchGroupReminder: async (teamId) => {
    const groupReminder = await request.get<TeamGroupReminderSettings>(`/teams/${teamId}/group-reminder`);
    set({ groupReminder });
    return groupReminder;
  },

  fetchGroupReminderTaskPool: async (teamId) => {
    const response = await request.get<{ list: TeamGroupReminderTaskPoolItem[] } | TeamGroupReminderTaskPoolItem[]>(
      `/teams/${teamId}/group-reminder/task-pool`,
      { params: { _ts: Date.now() } }
    );
    const groupReminderTaskPool = Array.isArray(response) ? response : response.list ?? [];
    set({ groupReminderTaskPool });
    return groupReminderTaskPool;
  },

  saveGroupReminder: async (teamId, payload) => {
    await request.put(`/teams/${teamId}/group-reminder/config`, payload.config);
    await request.put(`/teams/${teamId}/group-reminder/rule`, payload.rule);

    const current = get().groupReminder;
    set({
      groupReminder: {
        config: payload.config,
        rule: payload.rule,
        selectedTaskIds: payload.rule.task_ids,
        calendarSummary: current?.calendarSummary ?? null,
      },
    });
  },

  testSendGroupReminder: async (teamId) => {
    await request.post(`/teams/${teamId}/group-reminder/test-send`, {});
  },

  syncGroupReminderCalendar: async (teamId) => {
    await request.post(`/teams/${teamId}/group-reminder/calendar/sync`, {});
    return get().fetchGroupReminder(teamId);
  },
}));
