/**
 * 未保存变更守卫 Hook
 * 在用户离开含未保存编辑的页面时弹出确认对话框，防止意外丢失数据
 */
import { useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UnsavedChangesGuardOptions {
  enabled: boolean;
  confirmTitle?: string;
  confirmContent?: string;
  okText?: string;
  cancelText?: string;
}

export function useUnsavedChangesGuard({
  enabled,
  confirmTitle = '有未保存的修改',
  confirmContent = '离开后未保存的内容会丢失，是否继续？',
  okText = '放弃修改',
  cancelText = '继续编辑',
}: UnsavedChangesGuardOptions) {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);

  const confirmIfNeeded = (onConfirm: () => void) => {
    if (!enabled) {
      onConfirm();
      return;
    }

    const root = document.createElement('div');
    document.body.appendChild(root);

    const cleanup = () => {
      document.body.removeChild(root);
    };

    import('react-dom/client').then(({ createRoot }) => {
      const reactRoot = createRoot(root);
      reactRoot.render(
        <AlertDialog open onOpenChange={(open) => { if (!open) { reactRoot.unmount(); cleanup(); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirmContent}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { reactRoot.unmount(); cleanup(); }}>{cancelText}</AlertDialogCancel>
              <AlertDialogAction onClick={() => { onConfirm(); reactRoot.unmount(); cleanup(); }}>{okText}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    });
  };

  return {
    confirmIfNeeded,
  };
}
