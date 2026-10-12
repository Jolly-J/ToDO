/**
 * 任务概览操作控制器
 * 管理任务详情页的分享、删除等操作入口及其确认弹窗流程
 */
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MoreHorizontal, Share2 } from 'lucide-react';
import { MorphingPopover, MorphingPopoverContent, MorphingPopoverTrigger } from '@/components/motion-primitives/morphing-popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ActionModalType = 'share' | 'delete' | null;

interface TaskOverviewActionControllerProps {
  canShare: boolean;
  canDelete: boolean;
  onShare: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}

function resolveActionPillWidthClassName(actionCount: number) {
  if (actionCount >= 2) {
    return 'w-[136px]';
  }

  return 'w-[80px]';
}

export default function TaskOverviewActionController({
  canShare,
  canDelete,
  onShare,
  onDelete,
}: TaskOverviewActionControllerProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActionModalType>(null);
  const [submittingAction, setSubmittingAction] = useState<ActionModalType>(null);
  const mountedRef = useRef(true);
  const actionCount = Number(canShare) + Number(canDelete);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (actionCount === 0) {
    return null;
  }

  const queueModal = (modal: Exclude<ActionModalType, null>) => {
    setActionsOpen(false);
    setActiveModal(modal);
  };

  const handleActionsOpenChange = (open: boolean) => {
    setActionsOpen(open);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSubmittingAction(null);
  };

  const handleShareConfirm = async () => {
    if (submittingAction) return;
    setSubmittingAction('share');
    try {
      await onShare();
      if (mountedRef.current) {
        closeModal();
      }
    } catch {
      if (mountedRef.current) {
        setSubmittingAction(null);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (submittingAction) return;

    setSubmittingAction('delete');
    try {
      await onDelete();
      if (mountedRef.current) {
        closeModal();
      }
    } catch {
      if (mountedRef.current) {
        setSubmittingAction(null);
      }
    }
  };

  return (
    <>
      <MorphingPopover
        open={actionsOpen}
        onOpenChange={handleActionsOpenChange}
        transition={{ type: 'spring', bounce: 0.14, duration: 0.28 }}
        className="justify-end"
      >
        <MorphingPopoverTrigger
          data-testid="task-detail-overview-action-trigger"
          aria-label="任务操作"
          aria-haspopup="dialog"
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-(--tf-border) bg-(--tf-card) text-(--tf-muted-foreground) transition-colors duration-200 hover:bg-(--tf-accent) hover:text-(--tf-foreground)',
            actionsOpen && 'text-(--tf-foreground)'
          )}
        >
          <MoreHorizontal className="size-3.5" aria-hidden="true" />
        </MorphingPopoverTrigger>
        <MorphingPopoverContent
          data-testid="task-detail-overview-action-pill"
          className={cn(
            'flex h-8 items-center gap-1 rounded-full border-(--tf-border) bg-(--tf-card) p-1',
            resolveActionPillWidthClassName(actionCount)
          )}
        >
          {canShare ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="task-detail-overview-action-share"
              className="h-6 flex-1 rounded-full px-0 text-[12px] text-(--tf-foreground)"
              onClick={() => queueModal('share')}
            >
              分享
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="task-detail-overview-action-delete"
              className="h-6 flex-1 rounded-full px-0 text-(--tf-destructive) hover:bg-(--tf-destructive)/10 hover:text-(--tf-destructive)"
              onClick={() => queueModal('delete')}
            >
              删除
            </Button>
          ) : null}
        </MorphingPopoverContent>
      </MorphingPopover>

      <Dialog open={activeModal === 'share'} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分享任务</DialogTitle>
            <DialogDescription>
              将通过钉钉分享给好友或群聊，接收方可直接跳转到任务详情。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal} disabled={submittingAction === 'share'}>
              取消
            </Button>
            <Button type="button" onClick={() => void handleShareConfirm()} disabled={submittingAction !== null}>
              {submittingAction === 'share' ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Share2 className="size-4" aria-hidden="true" />
              )}
              发送分享
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={activeModal === 'delete'} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除任务</AlertDialogTitle>
            <AlertDialogDescription>
              删除后任务会进入你的个人回收站，后续可以在回收站中恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={submittingAction === 'delete'}>
                取消
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={submittingAction !== null}
                onClick={() => void handleDeleteConfirm()}
              >
                移入回收站
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
