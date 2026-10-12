import type { ReleaseManifest } from './types';

export async function fetchLatestReleaseManifest() {
  const response = await fetch(`/version.json?ts=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<ReleaseManifest>;
}
