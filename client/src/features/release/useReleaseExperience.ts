import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store';
import { fetchLatestReleaseManifest } from './releaseApi';
import {
  getDismissedUpdateVersion,
  getSeenReleaseVersion,
  markReleaseSeen,
  markUpdateDismissed,
} from './releaseStorage';
import { isNewerVersion, shouldShowWhatsNew } from './releaseVersion';
import type { ReleaseManifest } from './types';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CURRENT_RELEASE = __TASKFLOW_RELEASE__;

export function useReleaseExperience(currentRelease: ReleaseManifest = CURRENT_RELEASE) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => Boolean(state.token && state.user));
  const [remoteRelease, setRemoteRelease] = useState<ReleaseManifest | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  const pages = currentRelease.whatsNew.pages;
  const isLoginRoute = location.pathname === '/login';

  const shouldOpenWhatsNew = useMemo(() => {
    return shouldShowWhatsNew({
      currentVersion: currentRelease.version,
      seenVersion: getSeenReleaseVersion(),
      enabled: currentRelease.whatsNew.enabled,
      pageCount: pages.length,
      isAuthenticated,
      isLoginRoute,
    });
  }, [currentRelease.version, currentRelease.whatsNew.enabled, isAuthenticated, isLoginRoute, pages.length]);

  const checkLatestRelease = useCallback(async () => {
    try {
      const latestRelease = await fetchLatestReleaseManifest();

      if (!latestRelease || !isNewerVersion(latestRelease.version, currentRelease.version)) {
        return;
      }

      if (getDismissedUpdateVersion() === latestRelease.version) {
        return;
      }

      setRemoteRelease(latestRelease);
      setUpdateOpen(true);
      setWhatsNewOpen(false);
    } catch {
      // Version checks should never interrupt task workflows.
    }
  }, [currentRelease.version]);

  useEffect(() => {
    const initialCheckId = window.setTimeout(() => {
      void checkLatestRelease();
    }, 0);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkLatestRelease();
      }
    };

    const handleOnline = () => {
      void checkLatestRelease();
    };

    const intervalId = window.setInterval(() => {
      void checkLatestRelease();
    }, CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [checkLatestRelease]);

  useEffect(() => {
    if (updateOpen || remoteRelease) return;

    const openTimerId = window.setTimeout(() => {
      if (shouldOpenWhatsNew) {
        setWhatsNewOpen(true);
      }
    }, 0);

    return () => window.clearTimeout(openTimerId);
  }, [remoteRelease, shouldOpenWhatsNew, updateOpen]);

  const dismissUpdate = useCallback(() => {
    if (remoteRelease) {
      markUpdateDismissed(remoteRelease.version);
    }
    setUpdateOpen(false);
  }, [remoteRelease]);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  const closeWhatsNew = useCallback(() => {
    markReleaseSeen(currentRelease.version);
    setWhatsNewOpen(false);
  }, [currentRelease.version]);

  return {
    currentRelease,
    remoteRelease,
    updateOpen,
    whatsNewOpen,
    dismissUpdate,
    refresh,
    closeWhatsNew,
  };
}
