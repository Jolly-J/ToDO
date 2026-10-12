interface ShouldShowWhatsNewParams {
  currentVersion: string;
  seenVersion: string | null;
  enabled: boolean;
  pageCount: number;
  isAuthenticated: boolean;
  isLoginRoute: boolean;
}

function parseVersion(version: string) {
  const core = version.trim().split(/[+-]/)[0] || '';
  return core.split('.').map((part) => {
    const value = Number.parseInt(part, 10);
    return Number.isFinite(value) ? value : 0;
  });
}

export function isNewerVersion(remoteVersion: string, currentVersion: string) {
  const remoteParts = parseVersion(remoteVersion);
  const currentParts = parseVersion(currentVersion);
  const length = Math.max(remoteParts.length, currentParts.length);

  for (let index = 0; index < length; index += 1) {
    const remotePart = remoteParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;

    if (remotePart > currentPart) return true;
    if (remotePart < currentPart) return false;
  }

  return false;
}

export function shouldShowWhatsNew({
  currentVersion,
  seenVersion,
  enabled,
  pageCount,
  isAuthenticated,
  isLoginRoute,
}: ShouldShowWhatsNewParams) {
  return enabled && pageCount > 0 && isAuthenticated && !isLoginRoute && seenVersion !== currentVersion;
}
