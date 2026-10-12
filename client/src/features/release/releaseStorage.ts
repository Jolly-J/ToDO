const SEEN_RELEASE_VERSION_KEY = 'taskflow:last-seen-release-version';
const DISMISSED_UPDATE_VERSION_KEY = 'taskflow:dismissed-update-version';

function readStorage(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage may be unavailable in embedded browsers or strict privacy modes.
  }
}

export function getSeenReleaseVersion(storage = window.localStorage) {
  return readStorage(storage, SEEN_RELEASE_VERSION_KEY);
}

export function markReleaseSeen(version: string, storage = window.localStorage) {
  writeStorage(storage, SEEN_RELEASE_VERSION_KEY, version);
}

export function getDismissedUpdateVersion(storage = window.sessionStorage) {
  return readStorage(storage, DISMISSED_UPDATE_VERSION_KEY);
}

export function markUpdateDismissed(version: string, storage = window.sessionStorage) {
  writeStorage(storage, DISMISSED_UPDATE_VERSION_KEY, version);
}
