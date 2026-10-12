/** 可编辑表单模式 Hook，管理查看/编辑状态切换与快照回滚 */
import { useCallback, useRef, useState } from 'react';

type EditableSnapshot = Record<string, unknown>;

interface FormLike {
  getFieldsValue: (allValues?: boolean) => EditableSnapshot;
  setFieldsValue: (values: EditableSnapshot) => void;
  isFieldsTouched: (allTouched?: boolean) => boolean;
}

export function useEditableFormMode(form: FormLike) {
  const [isEditing, setIsEditing] = useState(false);
  const snapshotRef = useRef<EditableSnapshot | null>(null);

  const enterEdit = useCallback(() => {
    snapshotRef.current = form.getFieldsValue(true);
    setIsEditing(true);
  }, [form]);

  const cancelEdit = useCallback(() => {
    if (snapshotRef.current) {
      form.setFieldsValue(snapshotRef.current);
    }
    setIsEditing(false);
  }, [form]);

  const finishEdit = useCallback(() => {
    snapshotRef.current = null;
    setIsEditing(false);
  }, []);

  const resetSnapshot = useCallback(() => {
    snapshotRef.current = form.getFieldsValue(true);
  }, [form]);

  return {
    isEditing,
    isDirty: isEditing && form.isFieldsTouched(true),
    enterEdit,
    cancelEdit,
    finishEdit,
    resetSnapshot,
  };
}
