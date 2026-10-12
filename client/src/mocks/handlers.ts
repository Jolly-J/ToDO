/** MSW 请求拦截处理器，定义各接口的 Mock 响应逻辑 */
import { http, HttpResponse, delay } from 'msw';
import {
  mockUsers,
  mockCurrentUser,
  mockTeams,
  mockTeamMembers,
  mockTasks,
  mockNotifications,
  mockComments,
  getTeamById,
  getCommentById,
  getTeamMembers,
  getTaskComments,
  getCommentAttachments,
  getTeamTasks,
  getMyTasksView,
  getMyTaskSummary,
  getTaskAttachments,
  getAttachmentById,
  getTrashTasksView,
  getTrashTaskDetail,
  getDashboardStats,
  getTrendData,
  enrichCommentCollection,
  enrichTaskCollectionMembers,
  enrichTaskMembers,
  isTaskDeleted,
  createTaskAttachments,
  createCommentAttachments,
  deleteAttachmentById,
  buildMemberTaskCheck,
  buildSelfExitCheck,
  removeMemberFromTeam,
  exitTeamById,
  buildTeamDissolveCheck,
  dissolveTeamById,
  shareTaskToDingTalk,
  createTeamWithMembers,
} from './data';
import type { MyTaskScope, MyTaskStatusFilter, TaskStatus, TaskPriority, CreateTeamPayload } from '@/types';

function toMockUploadFile(file: FormDataEntryValue) {
  if (typeof file === 'string') {
    return {
      name: file,
      size: file.length,
      type: 'text/plain',
    };
  }

  return {
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

async function handleMockDingTalkLogin(request: Request) {
  await delay(300);
  // 解析 body 但不使用（Mock 阶段：任意 authCode 都返回当前用户）
  await request.json();
  return HttpResponse.json({
    code: 0,
    message: 'success',
    data: {
      token: 'mock-token-' + Date.now(),
      user: mockCurrentUser,
    },
  });
}

export const handlers = [
  // ===== 认证 =====
  http.post('/api/auth/login', async ({ request }) => handleMockDingTalkLogin(request)),
  http.post('/api/auth/dingtalk/login', async ({ request }) => handleMockDingTalkLogin(request)),
  http.post('/api/auth/dingtalk/auto-login', async ({ request }) => handleMockDingTalkLogin(request)),

  http.get('/api/auth/me', async () => {
    await delay(200);
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: mockCurrentUser,
    });
  }),

  // ===== 用户搜索 =====
  http.get('/api/users', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const filtered = mockUsers.filter(
      u => u.name.includes(keyword) || u.department_name?.includes(keyword)
    );
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: filtered,
    });
  }),

  // ===== Team 相关 =====
  http.get('/api/teams', async () => {
    await delay(300);
    const teamsWithStats = mockTeams.map(team => {
      const members = mockTeamMembers.filter(m => m.team_id === team.id);
      const tasks = getTeamTasks(team.id);
      return {
        ...team,
        memberCount: members.length,
        taskCount: tasks.length,
        unfinishedCount: tasks.filter(t => !['done', 'delayed_done', 'canceled'].includes(t.status)).length,
        todoCount: tasks.filter(t => !['done', 'delayed_done', 'canceled'].includes(t.status)).length,
        doneCount: tasks.filter(t => t.status === 'done' || t.status === 'delayed_done').length,
      };
    });
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: teamsWithStats,
    });
  }),

  http.get('/api/teams/:id', async ({ params }) => {
    await delay(200);
    const team = getTeamById(params.id as string);
    if (!team) {
      return HttpResponse.json({ code: 404, message: 'Team not found', data: null }, { status: 404 });
    }
    const members = mockTeamMembers.filter(m => m.team_id === team.id);
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        ...team,
        memberCount: members.length,
      },
    });
  }),

  http.get('/api/teams/:id/members', async ({ params }) => {
    await delay(200);
    const members = getTeamMembers(params.id as string);
    const memberDetails = members.map(user => {
      const tm = mockTeamMembers.find(m => m.team_id === params.id && m.user_id === user.id);
      return {
        ...user,
        role_id: tm?.role_id || 'member',
        joined_at: tm?.joined_at,
      };
    });
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: memberDetails,
    });
  }),

  http.post('/api/teams', async ({ request }) => {
    await delay(300);
    const body = await request.json() as CreateTeamPayload;
    const newTeam = createTeamWithMembers({
      ...body,
      owner_id: mockCurrentUser.id,
    });
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: newTeam,
    });
  }),

  http.patch('/api/teams/:id', async ({ params, request }) => {
    await delay(200);
    const body = await request.json() as Record<string, unknown>;
    const team = getTeamById(params.id as string);
    if (!team) {
      return HttpResponse.json({ code: 404, message: 'Team not found', data: null }, { status: 404 });
    }
    Object.assign(team, body, { updated_at: new Date().toISOString() });
    return HttpResponse.json({ code: 0, message: 'success', data: team });
  }),

  // ===== 任务相关 =====
  http.get('/api/teams/:teamId/tasks', async ({ request, params }) => {
    await delay(300);
    const url = new URL(request.url);
    const view = url.searchParams.get('view') || 'list';
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const assigneeId = url.searchParams.get('assignee_id');
    const keyword = url.searchParams.get('keyword');

    let tasks = enrichTaskCollectionMembers(getTeamTasks(params.teamId as string));

    // 筛选
    if (status === 'unfinished' || status === 'todo') {
      tasks = tasks.filter(t => !['done', 'delayed_done', 'canceled'].includes(t.status));
    } else if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    if (priority) tasks = tasks.filter(t => t.priority === priority);
    if (assigneeId) tasks = tasks.filter(t => t.assignee_id === assigneeId);
    if (keyword) tasks = tasks.filter(t => t.title.includes(keyword));

    // 按 view 返回不同格式
    if (view === 'board') {
      const boardData = {
        in_progress: tasks.filter(t => t.status === 'in_progress').sort((a, b) => a.sort_order - b.sort_order),
        delayed_in_progress: tasks.filter(t => t.status === 'delayed_in_progress').sort((a, b) => a.sort_order - b.sort_order),
        done: tasks.filter(t => t.status === 'done').sort((a, b) => a.sort_order - b.sort_order),
        delayed_done: tasks.filter(t => t.status === 'delayed_done').sort((a, b) => a.sort_order - b.sort_order),
        canceled: tasks.filter(t => t.status === 'canceled').sort((a, b) => a.sort_order - b.sort_order),
      };
      return HttpResponse.json({ code: 0, message: 'success', data: boardData });
    }

    if (view === 'calendar') {
      const calendarData = tasks
        .filter(t => t.due_date)
        .map(t => ({
          id: t.id,
          title: t.title,
          date: t.due_date,
          priority: t.priority,
          status: t.status,
        }));
      return HttpResponse.json({ code: 0, message: 'success', data: calendarData });
    }

    // list view
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        list: tasks,
        total: tasks.length,
        page: 1,
        pageSize: 20,
      },
    });
  }),

  http.post('/api/teams/:teamId/tasks', async ({ params, request }) => {
    await delay(300);
    const body = await request.json() as {
      title: string;
      description?: string;
      priority: string;
      assignee_id?: string;
      participant_ids?: string[];
      start_date?: string;
      due_date?: string;
    };
    const newTask = {
      id: 'task' + Date.now(),
      title: body.title,
      description: body.description,
      status: 'in_progress' as TaskStatus,
      priority: body.priority as TaskPriority,
      team_id: params.teamId as string,
      creator_id: mockCurrentUser.id,
      assignee_id: body.assignee_id,
      participant_ids: body.participant_ids || [],
      start_date: body.start_date,
      due_date: body.due_date,
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      sort_order: mockTasks.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockTasks.push(newTask);
    return HttpResponse.json({ code: 0, message: 'success', data: enrichTaskMembers(newTask) });
  }),

  http.post('/api/tasks', async ({ request }) => {
    await delay(300);
    const body = await request.json() as {
      title: string;
      description?: string;
      priority: string;
      team_id?: string;
      assignee_id?: string;
      participant_ids?: string[];
      start_date?: string;
      due_date?: string;
    };
    const newTask = {
      id: 'task' + Date.now(),
      title: body.title,
      description: body.description,
      status: 'in_progress' as TaskStatus,
      priority: body.priority as TaskPriority,
      team_id: body.team_id || '',
      creator_id: mockCurrentUser.id,
      assignee_id: body.assignee_id,
      participant_ids: body.participant_ids || [],
      start_date: body.start_date,
      due_date: body.due_date,
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      sort_order: mockTasks.length + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockTasks.push(newTask);
    return HttpResponse.json({ code: 0, message: 'success', data: enrichTaskMembers(newTask) });
  }),

  http.get('/api/tasks/trash', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || undefined;
    const tasks = getTrashTasksView(mockCurrentUser.id, keyword);

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        list: tasks,
        total: tasks.length,
        page: 1,
        pageSize: 20,
      },
    });
  }),

  http.patch('/api/tasks/trash/:id/restore', async ({ params }) => {
    await delay(200);
    const task = mockTasks.find((item) => item.id === params.id && isTaskDeleted(item) && item.deleted_by === mockCurrentUser.id);

    if (!task) {
      return HttpResponse.json({ code: 404, message: 'Task not found', data: null }, { status: 404 });
    }

    task.is_deleted = false;
    task.deleted_at = null;
    task.deleted_by = null;
    task.updated_at = new Date().toISOString();

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: enrichTaskMembers(task),
    });
  }),

  http.get('/api/tasks/trash/:id', async ({ params }) => {
    await delay(200);
    const task = getTrashTaskDetail(params.id as string, mockCurrentUser.id);

    if (!task) {
      return HttpResponse.json({ code: 404, message: 'Task not found', data: null }, { status: 404 });
    }

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: task,
    });
  }),

  http.get('/api/tasks/:id', async ({ params }) => {
    await delay(200);
    const task = mockTasks.find((item) => item.id === params.id && !isTaskDeleted(item));
    if (!task) {
      return HttpResponse.json({ code: 404, message: 'Task not found', data: null }, { status: 404 });
    }
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        ...enrichTaskMembers(task),
        attachments: getTaskAttachments(task.id),
      },
    });
  }),

  http.get('/api/tasks/:taskId/comments', async ({ params }) => {
    await delay(180);
    const comments = enrichCommentCollection(getTaskComments(params.taskId as string));

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: comments,
    });
  }),

  http.post('*/api/tasks/:taskId/comments', async ({ params, request }) => {
    await delay(220);
    const contentType = request.headers.get('content-type') || '';
    const requestId = (request.headers.get('x-idempotency-key') || request.headers.get('x-request-id') || '').trim();
    let content = '';
    let parentId: string | null = null;
    let messageType: 'message' | 'progress' = 'message';
    let files: ReturnType<typeof toMockUploadFile>[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      content = String(formData.get('content') || '');
      const rawParentId = formData.get('parent_id');
      parentId = rawParentId ? String(rawParentId) : null;
      const rawMessageType = String(formData.get('message_type') || '').trim();
      messageType = rawMessageType === 'progress' ? 'progress' : 'message';
      files = formData.getAll('files').map(toMockUploadFile);
    } else {
      const body = await request.json() as { content: string; parent_id?: string | null; message_type?: 'message' | 'progress' };
      content = body.content;
      parentId = body.parent_id ?? null;
      messageType = body.message_type === 'progress' ? 'progress' : 'message';
    }

    if (requestId) {
      const existingComment = mockComments.find(
        (comment) =>
          comment.task_id === params.taskId &&
          comment.user_id === mockCurrentUser.id &&
          (comment as { request_id?: string }).request_id === requestId
      );

      if (existingComment) {
        return HttpResponse.json({
          code: 0,
          message: 'success',
          data: enrichCommentCollection([existingComment])[0],
        });
      }
    }

    const newComment = {
      id: `comment-${Date.now()}`,
      task_id: params.taskId as string,
      user_id: mockCurrentUser.id,
      content,
      message_type: messageType,
      parent_id: parentId,
      request_id: requestId || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    mockComments.push(newComment);
    createCommentAttachments(params.taskId as string, newComment.id, mockCurrentUser.id, files);

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: enrichCommentCollection([newComment])[0],
    });
  }),

  http.post('/api/tasks/:taskId/attachments', async ({ params, request }) => {
    await delay(220);
    const formData = await request.formData();
    const files = formData.getAll('files').map(toMockUploadFile);
    const attachments = createTaskAttachments(params.taskId as string, mockCurrentUser.id, files);

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        attachments,
        attachment_count: getTaskAttachments(params.taskId as string).length,
      },
    });
  }),

  http.patch('/api/comments/:id', async ({ params, request }) => {
    await delay(180);
    const body = await request.json() as { content: string };
    const comment = getCommentById(params.id as string);

    if (!comment) {
      return HttpResponse.json({ code: 404, message: 'Comment not found', data: null }, { status: 404 });
    }

    comment.content = body.content;
    comment.updated_at = new Date().toISOString();

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: enrichCommentCollection([comment])[0],
    });
  }),

  http.delete('/api/comments/:id', async ({ params }) => {
    await delay(180);
    const index = mockComments.findIndex((comment) => comment.id === params.id);

    if (index === -1) {
      return HttpResponse.json({ code: 404, message: 'Comment not found', data: null }, { status: 404 });
    }

    const [deletedComment] = mockComments.splice(index, 1);
    getCommentAttachments(deletedComment.id).forEach((attachment) => {
      deleteAttachmentById(attachment.id);
    });

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: null,
    });
  }),

  http.patch('/api/tasks/:id', async ({ params, request }) => {
    await delay(200);
    const body = await request.json() as Record<string, unknown>;
    const task = mockTasks.find((item) => item.id === params.id && !isTaskDeleted(item));
    if (!task) {
      return HttpResponse.json({ code: 404, message: 'Task not found', data: null }, { status: 404 });
    }
    Object.assign(task, body, { updated_at: new Date().toISOString() });
    if ((body.status === 'done' || body.status === 'delayed_done') && !task.completed_at) {
      task.completed_at = new Date().toISOString();
    }
    if (body.status !== 'done' && body.status !== 'delayed_done' && task.completed_at) {
      task.completed_at = undefined;
    }
    return HttpResponse.json({ code: 0, message: 'success', data: enrichTaskMembers(task) });
  }),

  http.patch('/api/tasks/:id/status', async ({ params, request }) => {
    await delay(200);
    const body = await request.json() as { status: string; sort_order?: number };
    const task = mockTasks.find((item) => item.id === params.id && !isTaskDeleted(item));
    if (!task) {
      return HttpResponse.json({ code: 404, message: 'Task not found', data: null }, { status: 404 });
    }
    task.status = body.status as TaskStatus;
    if (body.sort_order !== undefined) task.sort_order = body.sort_order;
    task.updated_at = new Date().toISOString();
    if (body.status === 'done' || body.status === 'delayed_done') {
      task.completed_at = new Date().toISOString();
    } else if (task.completed_at) {
      task.completed_at = undefined;
    }
    return HttpResponse.json({ code: 0, message: 'success', data: enrichTaskMembers(task) });
  }),

  http.post('/api/tasks/:id/share', async ({ params, request }) => {
    await delay(180);
    const body = await request.json() as { receiverIds?: string[] };

    try {
      const result = shareTaskToDingTalk(params.id as string, mockCurrentUser.id, body.receiverIds || []);
      return HttpResponse.json({ code: 0, message: 'success', data: result });
    } catch (error) {
      return HttpResponse.json(
        { code: 400, message: error instanceof Error ? error.message : '分享失败', data: null },
        { status: 400 }
      );
    }
  }),

  http.get('/api/attachments/:id/download', async ({ params }) => {
    await delay(120);
    const attachment = getAttachmentById(params.id as string);

    if (!attachment) {
      return HttpResponse.json({ code: 404, message: 'Attachment not found', data: null }, { status: 404 });
    }

    const content = [
      `Task: ${attachment.task_id}`,
      'comment_id' in attachment ? `Comment: ${attachment.comment_id}` : 'Comment: -',
      `Attachment: ${attachment.original_name}`,
      `GeneratedAt: ${new Date().toISOString()}`,
    ].join('\n');

    return new HttpResponse(content, {
      status: 200,
      headers: {
        'Content-Type': attachment.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.original_name)}"`,
      },
    });
  }),

  http.delete('/api/attachments/:id', async ({ params }) => {
    await delay(160);
    const attachment = deleteAttachmentById(params.id as string);

    if (!attachment) {
      return HttpResponse.json({ code: 404, message: 'Attachment not found', data: null }, { status: 404 });
    }

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: null,
    });
  }),

  http.delete('/api/tasks/:id', async ({ params }) => {
    await delay(200);
    const task = mockTasks.find((item) => item.id === params.id && !isTaskDeleted(item));
    if (!task) {
      return HttpResponse.json({ code: 404, message: 'Task not found', data: null }, { status: 404 });
    }
    task.is_deleted = true;
    task.deleted_at = new Date().toISOString();
    task.deleted_by = mockCurrentUser.id;
    task.updated_at = task.deleted_at;
    return HttpResponse.json({ code: 0, message: 'success', data: null });
  }),

  // ===== 我的任务 =====
  http.get('/api/my-tasks', async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const scope = (url.searchParams.get('scope') || 'all') as MyTaskScope;
    const status = (url.searchParams.get('status') || 'all') as MyTaskStatusFilter;
    const priority = url.searchParams.get('priority');
    const keyword = url.searchParams.get('keyword');

    const tasks = getMyTasksView(
      mockCurrentUser.id,
      scope,
      status,
      priority as TaskPriority | undefined,
      keyword || undefined
    );

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        list: tasks,
        total: tasks.length,
        page: 1,
        pageSize: 20,
        summary: getMyTaskSummary(mockCurrentUser.id),
      },
    });
  }),

  // ===== 驾驶舱 =====
  http.get('/api/dashboard/stats', async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const teamId = url.searchParams.get('team_id');
    const stats = getDashboardStats(teamId || undefined);
    return HttpResponse.json({ code: 0, message: 'success', data: stats });
  }),

  http.get('/api/dashboard/trend', async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const teamId = url.searchParams.get('team_id');
    const trend = getTrendData(teamId || undefined);
    return HttpResponse.json({ code: 0, message: 'success', data: trend });
  }),

  http.get('/api/dashboard/team-distribution', async () => {
    await delay(300);
    const distribution = mockTeams.map(team => ({
      name: team.name,
      unfinished: getTeamTasks(team.id).filter((task) => !['done', 'delayed_done', 'canceled'].includes(task.status)).length,
      in_progress: getTeamTasks(team.id).filter((task) => task.status === 'in_progress').length,
      delayed_in_progress: getTeamTasks(team.id).filter((task) => task.status === 'delayed_in_progress').length,
      done: getTeamTasks(team.id).filter((task) => task.status === 'done' || task.status === 'delayed_done').length,
      delayed_done: getTeamTasks(team.id).filter((task) => task.status === 'delayed_done').length,
      canceled: getTeamTasks(team.id).filter((task) => task.status === 'canceled').length,
    }));
    return HttpResponse.json({ code: 0, message: 'success', data: distribution });
  }),

  http.get('/api/dashboard/overdue', async () => {
    await delay(300);
    const today = new Date().toISOString().split('T')[0];
    const overdue = mockTasks
      .filter((task) => !isTaskDeleted(task))
      .filter(t => t.due_date && t.due_date < today && t.status !== 'done' && t.status !== 'canceled')
      .slice(0, 10)
      .map(t => ({
        ...t,
        team_name: t.team_id ? getTeamById(t.team_id)?.name : undefined,
      }));
    return HttpResponse.json({ code: 0, message: 'success', data: overdue });
  }),

  // ===== 通知 =====
  http.get('/api/notifications', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const isRead = url.searchParams.get('is_read');

    let notifications = mockNotifications.filter(n => n.user_id === mockCurrentUser.id);
    if (isRead !== undefined && isRead !== null) {
      notifications = notifications.filter(n => n.is_read === (isRead === '1' ? 1 : 0));
    }

    const start = (page - 1) * pageSize;
    const list = notifications.slice(start, start + pageSize);

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        list,
        total: notifications.length,
        page,
        pageSize,
      },
    });
  }),

  http.get('/api/notifications/unread-count', async () => {
    await delay(100);
    const count = mockNotifications.filter(n => n.user_id === mockCurrentUser.id && n.is_read === 0).length;
    return HttpResponse.json({ code: 0, message: 'success', data: { count } });
  }),

  http.patch('/api/notifications/:id/read', async ({ params }) => {
    await delay(100);
    const notification = mockNotifications.find(n => n.id === params.id);
    if (notification) {
      notification.is_read = 1;
    }
    return HttpResponse.json({ code: 0, message: 'success', data: null });
  }),

  http.post('/api/notifications/read-all', async () => {
    await delay(100);
    mockNotifications.forEach(n => {
      if (n.user_id === mockCurrentUser.id) n.is_read = 1;
    });
    return HttpResponse.json({ code: 0, message: 'success', data: null });
  }),

  // ===== Team 成员管理 =====
  http.post('/api/teams/:teamId/members', async ({ params, request }) => {
    await delay(300);
    const body = await request.json() as { user_ids: string[]; role_id: string };
    const newMembers = body.user_ids.map(userId => ({
      id: 'tm' + Date.now() + Math.random(),
      team_id: params.teamId as string,
      user_id: userId,
      role_id: body.role_id,
      joined_at: new Date().toISOString(),
    }));
    mockTeamMembers.push(...newMembers);
    return HttpResponse.json({ code: 0, message: 'success', data: newMembers });
  }),

  http.patch('/api/teams/:teamId/members/:userId', async ({ params, request }) => {
    await delay(200);
    const body = await request.json() as { role_id: string };
    const member = mockTeamMembers.find(
      m => m.team_id === params.teamId && m.user_id === params.userId
    );
    if (member) {
      member.role_id = body.role_id;
    }
    return HttpResponse.json({ code: 0, message: 'success', data: member });
  }),

  http.get('/api/teams/:teamId/members/:userId/removal-check', async ({ params }) => {
    await delay(180);
    const result = buildMemberTaskCheck(params.teamId as string, params.userId as string);
    return HttpResponse.json({ code: 0, message: 'success', data: result });
  }),

  http.post('/api/teams/:teamId/members/:userId/remove', async ({ params, request }) => {
    await delay(220);
    const body = await request.json() as {
      transferToUserId?: string;
      removeParticipantAssignments?: boolean;
    };

    try {
      removeMemberFromTeam(params.teamId as string, params.userId as string, body);
      return HttpResponse.json({ code: 0, message: 'success', data: null });
    } catch (error) {
      return HttpResponse.json(
        { code: 400, message: error instanceof Error ? error.message : '移除成员失败', data: null },
        { status: 400 }
      );
    }
  }),

  http.delete('/api/teams/:teamId/members/:userId', async ({ params }) => {
    await delay(200);
    try {
      removeMemberFromTeam(params.teamId as string, params.userId as string);
      return HttpResponse.json({ code: 0, message: 'success', data: null });
    } catch (error) {
      return HttpResponse.json(
        { code: 400, message: error instanceof Error ? error.message : '移除成员失败', data: null },
        { status: 400 }
      );
    }
  }),

  http.get('/api/teams/:teamId/members/me/exit-check', async ({ params }) => {
    await delay(180);
    const result = buildSelfExitCheck(params.teamId as string, mockCurrentUser.id);
    return HttpResponse.json({ code: 0, message: 'success', data: result });
  }),

  http.post('/api/teams/:teamId/members/me/exit', async ({ params }) => {
    await delay(220);
    try {
      exitTeamById(params.teamId as string, mockCurrentUser.id);
      return HttpResponse.json({ code: 0, message: 'success', data: null });
    } catch (error) {
      return HttpResponse.json(
        { code: 400, message: error instanceof Error ? error.message : '退出团队失败', data: null },
        { status: 400 }
      );
    }
  }),

  http.get('/api/teams/:teamId/dissolve-check', async ({ params }) => {
    await delay(180);
    const result = buildTeamDissolveCheck(params.teamId as string, mockCurrentUser.id);
    return HttpResponse.json({ code: 0, message: 'success', data: result });
  }),

  http.post('/api/teams/:teamId/dissolve', async ({ params }) => {
    await delay(220);
    try {
      dissolveTeamById(params.teamId as string, mockCurrentUser.id);
      return HttpResponse.json({ code: 0, message: 'success', data: null });
    } catch (error) {
      return HttpResponse.json(
        { code: 400, message: error instanceof Error ? error.message : '解散团队失败', data: null },
        { status: 400 }
      );
    }
  }),
];
