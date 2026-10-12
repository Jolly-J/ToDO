import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReleaseDialogSurface from './ReleaseDialogSurface';
import type { ReleaseManifest } from './types';

interface ReleaseUpdateDialogProps {
  open: boolean;
  currentVersion: string;
  remoteRelease: ReleaseManifest | null;
  onDismiss: () => void;
  onRefresh: () => void;
}

export default function ReleaseUpdateDialog({
  open,
  currentVersion,
  remoteRelease,
  onDismiss,
  onRefresh,
}: ReleaseUpdateDialogProps) {
  const nextVersion = remoteRelease?.version;
  const description = (
    <>
      当前版本 {currentVersion}
      {nextVersion ? `，服务器已发布 ${nextVersion}` : ''}。刷新后即可使用最新功能。
    </>
  );
  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onDismiss}>
        稍后
      </Button>
      <Button type="button" className="w-full sm:w-auto" onClick={onRefresh}>
        <RefreshCw data-icon="inline-start" aria-hidden="true" />
        立即刷新
      </Button>
    </div>
  );

  return (
    <ReleaseDialogSurface
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onDismiss(); }}
      title="发现新版本"
      description={description}
      closeLabel="关闭版本更新提示"
      desktopContentClassName="w-[min(92vw,420px)]"
      headerLeading={(
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <RefreshCw aria-hidden="true" />
        </div>
      )}
      footer={footer}
    />
  );
}
