/**
 * 组件名称：创建团队弹窗
 * 文件作用：承载创建团队时的表单录入与提交逻辑。
 * 主要功能：填写团队名称、层级和描述，并调用团队创建接口。
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore, useTeamStore } from '@/store';
import UserSelect from '@/components/shared/form/UserSelect';
import request from '@/api/request';
import { loadAllUsers, type UserListPayload } from '@/api/loadAllUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateTeamPayload, Team, User } from '@/types';

interface CreateTeamModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (team: Team) => void;
}

const levelOptions = [
  { label: '公司级', value: 'company' },
  { label: '部门级', value: 'department' },
  { label: '团队级', value: 'team' },
  { label: '小组级', value: 'group' },
  { label: '项目级', value: 'project' },
];

interface FormState {
  name: string;
  level: string;
  description: string;
  admin_user_ids: string[];
  member_user_ids: string[];
}

const defaultForm: FormState = {
  name: '',
  level: 'team',
  description: '',
  admin_user_ids: [],
  member_user_ids: [],
};

export default function CreateTeamModal({ visible, onClose, onSuccess }: CreateTeamModalProps) {
  const { createTeam } = useTeamStore();
  const { user } = useAuthStore();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [candidateUsers, setCandidateUsers] = useState<User[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const currentUserId = user?.id;
  const adminExcludeIds = [...form.member_user_ids].filter(Boolean) as string[];
  const memberExcludeIds = [currentUserId, ...form.admin_user_ids].filter(Boolean) as string[];

  useEffect(() => {
    if (!visible) return;
    let canceled = false;
    setUsersLoading(true);
    loadAllUsers((params) => request.get<UserListPayload>('/users', { params }))
      .then((payload) => {
        if (!canceled) {
          setCandidateUsers(payload);
        }
      })
      .catch(() => {
        if (!canceled) {
          setCandidateUsers([]);
        }
      })
      .finally(() => {
        if (!canceled) {
          setUsersLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [visible]);

  const validate = () => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = '请输入团队名称';
    if (!form.level) errs.level = '请选择团队层级';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const adminUserIds = [...new Set(form.admin_user_ids.filter((id) => id && id !== currentUserId))];
    const memberUserIds = [...new Set(
      form.member_user_ids.filter((id) => id && id !== currentUserId && !adminUserIds.includes(id))
    )];
    setLoading(true);
    try {
      const team = await createTeam({
        name: form.name.trim(),
        level: form.level,
        description: form.description.trim() || undefined,
        admin_user_ids: adminUserIds,
        member_user_ids: memberUserIds,
      } as CreateTeamPayload);
      toast.success('团队创建成功');
      setForm(defaultForm);
      setErrors({});
      onSuccess(team as Team);
    } catch {
      // toast 已在 request 拦截器处理
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(defaultForm);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent ref={dialogRef} className="max-w-md">
        <DialogHeader>
          <DialogTitle>创建团队</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">团队名称 <span className="text-destructive">*</span></label>
            <Input
              placeholder="请输入团队名称"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={50}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">团队层级 <span className="text-destructive">*</span></label>
            <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="请选择层级" />
              </SelectTrigger>
              <SelectContent>
                {levelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.level && <p className="text-xs text-destructive">{errors.level}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">团队描述</label>
            <Input
              placeholder="请输入团队描述（选填）"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">管理员</label>
            <UserSelect
              mode="single"
              value={form.admin_user_ids}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  admin_user_ids: typeof v === 'string' && v ? [v] : [],
                }))
              }
              excludeIds={adminExcludeIds}
              users={candidateUsers}
              placeholder={usersLoading ? '成员加载中…' : '选择管理员（选填）'}
              disabled={usersLoading}
              portalContainer={() => dialogRef.current}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">成员</label>
            <UserSelect
              mode="multiple"
              value={form.member_user_ids}
              onChange={(v) => setForm((f) => ({ ...f, member_user_ids: (v as string[]) ?? [] }))}
              excludeIds={memberExcludeIds}
              users={candidateUsers}
              placeholder={usersLoading ? '成员加载中…' : '选择成员（选填）'}
              disabled={usersLoading}
              portalContainer={() => dialogRef.current}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>取消</Button>
          <Button onClick={() => void handleSubmit()} disabled={loading}>
            {loading ? '创建中…' : '创建团队'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
