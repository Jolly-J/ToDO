/**
 * 通用表单草稿 Hook
 * 使用 sessionStorage 存储草稿，关闭标签页自动清除。
 * 适用于需要在弹窗关闭后保留填写进度的表单场景。
 *
 * 注意：JSON.parse 结果以 T 断言，调用方需确保存储结构与 T 一致。
 */
import { useState, useCallback, useEffect } from 'react';

export function useFormDraft<T>(key: string): {
  draft: T | null;
  hasDraft: boolean;
  saveDraft: (value: T) => void;
  clearDraft: () => void;
} {
  const [draft, setDraft] = useState<T | null>(null);

  // key 变化时重新从 sessionStorage 读取
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      setDraft(raw ? (JSON.parse(raw) as T) : null);
    } catch {
      setDraft(null);
    }
  }, [key]);

  const saveDraft = useCallback((value: T) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      setDraft(value);
    } catch {
      // sessionStorage 写入失败时静默忽略（如隐私模式容量限制）
    }
  }, [key]);

  const clearDraft = useCallback(() => {
    sessionStorage.removeItem(key);
    setDraft(null);
  }, [key]);

  return {
    draft,
    hasDraft: draft !== null,
    saveDraft,
    clearDraft,
  };
}
