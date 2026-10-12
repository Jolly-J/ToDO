import ReleaseUpdateDialog from './ReleaseUpdateDialog';
import WhatsNewDialog from './WhatsNewDialog';
import { useReleaseExperience } from './useReleaseExperience';

export default function ReleaseExperience() {
  const {
    currentRelease,
    remoteRelease,
    updateOpen,
    whatsNewOpen,
    dismissUpdate,
    refresh,
    closeWhatsNew,
  } = useReleaseExperience();

  return (
    <>
      <ReleaseUpdateDialog
        open={updateOpen}
        currentVersion={currentRelease.version}
        remoteRelease={remoteRelease}
        onDismiss={dismissUpdate}
        onRefresh={refresh}
      />
      <WhatsNewDialog
        open={whatsNewOpen}
        title={currentRelease.whatsNew.title}
        version={currentRelease.version}
        releasedAt={currentRelease.releasedAt}
        pages={currentRelease.whatsNew.pages}
        onClose={closeWhatsNew}
      />
    </>
  );
}
