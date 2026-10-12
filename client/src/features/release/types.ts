export interface ReleasePage {
  image: string;
  title: string;
  description: string;
  link?: {
    label: string;
    href: string;
  };
}

export interface ReleaseManifest {
  version: string;
  releasedAt: string;
  whatsNew: {
    enabled: boolean;
    title: string;
    pages: ReleasePage[];
  };
}
