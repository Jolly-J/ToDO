/// <reference types="vite/client" />

import type { ReleaseManifest } from './features/release/types';

declare global {
  const __TASKFLOW_RELEASE__: ReleaseManifest;
}

export {};
