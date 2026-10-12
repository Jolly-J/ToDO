import * as dd from 'dingtalk-jsapi';

export type FeatureSupport = 'supported' | 'unsupported' | 'unavailable';

export interface BrowserBrandVersion {
  brand: string;
  version: string;
}

export interface BrowserIdentity {
  name: string;
  version: string;
  engine: string;
  source: 'UA-CH' | 'User-Agent' | '推断';
}

export interface OperatingSystemIdentity {
  name: string;
  version: string;
  architecture: string;
  bitness: string;
}

export interface DingTalkIdentity {
  detected: boolean;
  platform: string;
  subPlatform: string;
  version: string;
  appType: string;
  source: 'dd.env' | 'User-Agent' | '未检测到';
}

export interface FeatureDiagnostic {
  id: string;
  category: '布局与样式' | '浏览器 API' | '交互与显示';
  label: string;
  support: FeatureSupport;
  detail: string;
}

export interface EnvironmentReport {
  generatedAt: string;
  browser: BrowserIdentity;
  operatingSystem: OperatingSystemIdentity;
  dingTalk: DingTalkIdentity;
  display: {
    viewport: string;
    screen: string;
    devicePixelRatio: number;
    colorDepth: number;
    scrollbarWidth: number;
    rootScrollbarWidth: number;
    scrollbarMode: 'classic' | 'overlay';
    scrollbarModeLabel: string;
    colorScheme: string;
    reducedMotion: boolean;
    forcedColors: boolean;
  };
  runtime: {
    language: string;
    languages: string[];
    timezone: string;
    online: boolean;
    cookieEnabled: boolean;
    secureContext: boolean;
    touchPoints: number;
    hardwareConcurrency: number | null;
    deviceMemory: number | null;
  };
  features: FeatureDiagnostic[];
  notes: string[];
  raw: {
    userAgent: string;
    platform: string;
    userAgentData: Record<string, unknown> | null;
    dingTalkEnv: Record<string, unknown> | null;
  };
}

interface UserAgentDataLike {
  brands?: BrowserBrandVersion[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
  toJSON?: () => Record<string, unknown>;
}

interface NavigatorWithDiagnostics extends Navigator {
  deviceMemory?: number;
  userAgentData?: UserAgentDataLike;
}

const UNKNOWN = '未提供';

function safeString(value: unknown, fallback = UNKNOWN) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function parseVersion(userAgent: string, expression: RegExp) {
  return userAgent.match(expression)?.[1] || UNKNOWN;
}

function selectBrowserBrand(brands: BrowserBrandVersion[] = []) {
  const preferred = ['Microsoft Edge', 'Google Chrome', 'Chromium', 'Opera'];
  for (const name of preferred) {
    const match = brands.find((item) => item.brand === name);
    if (match) return match;
  }
  return brands.find((item) => !/not[\s_-]*a[\s_-]*brand/i.test(item.brand)) || null;
}

export function detectBrowserIdentity(
  userAgent: string,
  brands: BrowserBrandVersion[] = []
): BrowserIdentity {
  const brand = selectBrowserBrand(brands);
  if (brand) {
    const name = brand.brand === 'Chromium' && /DingTalk/i.test(userAgent)
      ? '钉钉内置 Chromium'
      : brand.brand;
    return {
      name,
      version: brand.version || UNKNOWN,
      engine: /Firefox/i.test(name) ? 'Gecko' : /Safari/i.test(name) ? 'WebKit' : 'Blink / Chromium',
      source: 'UA-CH',
    };
  }

  if (/Edg\//i.test(userAgent)) {
    return { name: 'Microsoft Edge', version: parseVersion(userAgent, /Edg\/([\d.]+)/i), engine: 'Blink / Chromium', source: 'User-Agent' };
  }
  if (/OPR\//i.test(userAgent)) {
    return { name: 'Opera', version: parseVersion(userAgent, /OPR\/([\d.]+)/i), engine: 'Blink / Chromium', source: 'User-Agent' };
  }
  if (/Chrome\//i.test(userAgent) || /Chromium\//i.test(userAgent)) {
    return {
      name: /DingTalk/i.test(userAgent) ? '钉钉内置 Chromium' : 'Google Chrome / Chromium',
      version: parseVersion(userAgent, /(?:Chrome|Chromium)\/([\d.]+)/i),
      engine: 'Blink / Chromium',
      source: 'User-Agent',
    };
  }
  if (/Firefox\//i.test(userAgent)) {
    return { name: 'Mozilla Firefox', version: parseVersion(userAgent, /Firefox\/([\d.]+)/i), engine: 'Gecko', source: 'User-Agent' };
  }
  if (/Safari\//i.test(userAgent) && /Version\//i.test(userAgent)) {
    return { name: 'Apple Safari', version: parseVersion(userAgent, /Version\/([\d.]+)/i), engine: 'WebKit', source: 'User-Agent' };
  }
  if (/AppleWebKit\//i.test(userAgent)) {
    return { name: 'WebKit 内嵌浏览器', version: parseVersion(userAgent, /AppleWebKit\/([\d.]+)/i), engine: 'WebKit', source: '推断' };
  }
  return { name: '未知浏览器', version: UNKNOWN, engine: UNKNOWN, source: '推断' };
}

export function detectOperatingSystem(
  userAgent: string,
  highEntropy: Record<string, unknown> = {},
  lowEntropyPlatform = ''
): OperatingSystemIdentity {
  const platform = safeString(highEntropy.platform || lowEntropyPlatform, '');
  let name = platform;
  let version = safeString(highEntropy.platformVersion);

  if (!name) {
    if (/Windows NT/i.test(userAgent)) name = 'Windows';
    else if (/Mac OS X/i.test(userAgent)) name = 'macOS';
    else if (/Android/i.test(userAgent)) name = 'Android';
    else if (/(iPhone|iPad|iPod)/i.test(userAgent)) name = 'iOS';
    else if (/Linux/i.test(userAgent)) name = 'Linux';
    else name = '未知系统';
  }

  if (version === UNKNOWN) {
    if (name === 'Windows') version = parseVersion(userAgent, /Windows NT ([\d.]+)/i);
    if (name === 'macOS') version = parseVersion(userAgent, /Mac OS X ([\d_]+)/i).replaceAll('_', '.');
    if (name === 'Android') version = parseVersion(userAgent, /Android ([\d.]+)/i);
    if (name === 'iOS') version = parseVersion(userAgent, /OS ([\d_]+)/i).replaceAll('_', '.');
  }

  return {
    name,
    version,
    architecture: safeString(highEntropy.architecture),
    bitness: safeString(highEntropy.bitness),
  };
}

export function detectDingTalkIdentity(userAgent: string): DingTalkIdentity {
  const env = dd.env;
  const detectedByUa = /DingTalk/i.test(userAgent);
  const detectedBySdk = Boolean(env?.platform && String(env.platform) !== 'notInDingTalk');
  const detected = detectedByUa || detectedBySdk;
  const uaVersion = parseVersion(userAgent, /DingTalk[/]([\d.]+)/i);

  if (detectedBySdk) {
    return {
      detected: true,
      platform: safeString(env.platform),
      subPlatform: safeString(env.platformSub),
      version: safeString(env.version, uaVersion),
      appType: safeString(env.appType),
      source: 'dd.env',
    };
  }

  return {
    detected,
    platform: detected ? 'pc / web' : 'notInDingTalk',
    subPlatform: UNKNOWN,
    version: detected ? uaVersion : UNKNOWN,
    appType: detected ? 'WEB' : UNKNOWN,
    source: detected ? 'User-Agent' : '未检测到',
  };
}

export function measureScrollbarWidth() {
  if (!document.body) return 0;
  const probe = document.createElement('div');
  const content = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:100px;height:100px;overflow:scroll;border:0;padding:0;visibility:hidden;';
  content.style.cssText = 'width:200px;height:200px;';
  probe.appendChild(content);
  document.body.appendChild(probe);
  const width = Math.max(0, probe.offsetWidth - probe.clientWidth);
  probe.remove();
  return width;
}

function supportsCss(property: string, value?: string) {
  try {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
    return value === undefined ? CSS.supports(property) : CSS.supports(property, value);
  } catch {
    return false;
  }
}

function mediaMatches(query: string) {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function buildFeatureDiagnostics(): FeatureDiagnostic[] {
  const checks: Array<[string, FeatureDiagnostic['category'], string, boolean, string]> = [
    ['css-grid', '布局与样式', 'CSS Grid', supportsCss('display', 'grid'), '复杂表格与页面栅格布局'],
    ['sticky', '布局与样式', 'position: sticky', supportsCss('position', 'sticky'), '表头和工具栏吸顶'],
    ['dynamic-viewport', '布局与样式', '动态视口单位 dvh', supportsCss('height', '100dvh'), '适配钉钉窗口和移动端可视高度'],
    ['container-query', '布局与样式', 'Container Query', supportsCss('container-type', 'inline-size'), '组件按容器宽度响应'],
    ['backdrop-filter', '布局与样式', 'backdrop-filter', supportsCss('backdrop-filter', 'blur(2px)') || supportsCss('-webkit-backdrop-filter', 'blur(2px)'), '半透明浮层效果'],
    ['scrollbar-gutter', '交互与显示', 'scrollbar-gutter', supportsCss('scrollbar-gutter', 'stable'), '为经典滚动条预留稳定空间'],
    ['scrollbar-width', '交互与显示', 'scrollbar-width', supportsCss('scrollbar-width', 'none'), '标准滚动条宽度控制'],
    ['webkit-scrollbar', '交互与显示', 'WebKit scrollbar 选择器', supportsCss('selector(::-webkit-scrollbar)'), 'Chromium / WebKit 滚动条样式入口'],
    ['resize-observer', '浏览器 API', 'ResizeObserver', 'ResizeObserver' in window, '监听容器尺寸变化'],
    ['intersection-observer', '浏览器 API', 'IntersectionObserver', 'IntersectionObserver' in window, '可见区域与懒加载检测'],
    ['visual-viewport', '浏览器 API', 'Visual Viewport', 'visualViewport' in window, '获取内嵌浏览器实际可视区域'],
    ['clipboard', '浏览器 API', 'Clipboard API', Boolean(navigator.clipboard?.writeText), '复制诊断报告'],
    ['service-worker', '浏览器 API', 'Service Worker', 'serviceWorker' in navigator, '离线能力与资源缓存'],
    ['web-share', '浏览器 API', 'Web Share', typeof navigator.share === 'function', '调用系统分享面板'],
  ];

  return checks.map(([id, category, label, supported, detail]) => ({
    id,
    category,
    label,
    support: supported ? 'supported' : 'unsupported',
    detail,
  }));
}

async function readUserAgentData(navigatorValue: NavigatorWithDiagnostics) {
  const userAgentData = navigatorValue.userAgentData;
  if (!userAgentData) return { low: null, high: {} as Record<string, unknown> };
  const low = userAgentData.toJSON?.() || {
    brands: userAgentData.brands || [],
    mobile: userAgentData.mobile,
    platform: userAgentData.platform,
  };
  if (!userAgentData.getHighEntropyValues) return { low, high: {} as Record<string, unknown> };
  try {
    const high = await userAgentData.getHighEntropyValues([
      'architecture',
      'bitness',
      'fullVersionList',
      'model',
      'platformVersion',
      'wow64',
    ]);
    return { low, high };
  } catch {
    return { low, high: {} as Record<string, unknown> };
  }
}

export async function collectEnvironmentReport(): Promise<EnvironmentReport> {
  const navigatorValue = navigator as NavigatorWithDiagnostics;
  const { low, high } = await readUserAgentData(navigatorValue);
  const lowBrands = Array.isArray(low?.brands) ? low.brands as BrowserBrandVersion[] : [];
  const highBrands = Array.isArray(high.fullVersionList) ? high.fullVersionList as BrowserBrandVersion[] : [];
  const brands = highBrands.length ? highBrands : lowBrands;
  const browser = detectBrowserIdentity(navigatorValue.userAgent, brands);
  const operatingSystem = detectOperatingSystem(
    navigatorValue.userAgent,
    high,
    safeString(high.platform || low?.platform, '')
  );
  const dingTalk = detectDingTalkIdentity(navigatorValue.userAgent);
  const scrollbarWidth = measureScrollbarWidth();
  const rootScrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  const scrollbarMode = scrollbarWidth > 0 ? 'classic' : 'overlay';
  const notes = [
    '检测结果只保留在当前页面内存中，不上传、不落库。',
    '浏览器或钉钉可能隐藏、冻结或改写版本字段；页面会标注数据来源。',
    '网页无法直接读取 Windows 或 macOS 的“始终显示滚动条”系统设置，只能通过实际占位宽度判断当前渲染模式。',
  ];

  return {
    generatedAt: new Date().toISOString(),
    browser,
    operatingSystem,
    dingTalk,
    display: {
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      screen: `${window.screen.width} × ${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio || 1,
      colorDepth: window.screen.colorDepth || 0,
      scrollbarWidth,
      rootScrollbarWidth,
      scrollbarMode,
      scrollbarModeLabel: scrollbarMode === 'classic' ? `经典占位式（${scrollbarWidth}px）` : '覆盖式 / 自动隐藏式（不占位）',
      colorScheme: mediaMatches('(prefers-color-scheme: dark)') ? '深色' : '浅色',
      reducedMotion: mediaMatches('(prefers-reduced-motion: reduce)'),
      forcedColors: mediaMatches('(forced-colors: active)'),
    },
    runtime: {
      language: navigatorValue.language || UNKNOWN,
      languages: [...(navigatorValue.languages || [])],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN,
      online: navigatorValue.onLine,
      cookieEnabled: navigatorValue.cookieEnabled,
      secureContext: window.isSecureContext,
      touchPoints: navigatorValue.maxTouchPoints || 0,
      hardwareConcurrency: navigatorValue.hardwareConcurrency || null,
      deviceMemory: navigatorValue.deviceMemory || null,
    },
    features: buildFeatureDiagnostics(),
    notes,
    raw: {
      userAgent: navigatorValue.userAgent,
      platform: navigatorValue.platform,
      userAgentData: low ? { ...low, ...high } : null,
      dingTalkEnv: dingTalk.detected ? {
        platform: dd.env?.platform,
        platformSub: dd.env?.platformSub,
        version: dd.env?.version,
        appType: dd.env?.appType,
      } : null,
    },
  };
}

export function serializeEnvironmentReport(report: EnvironmentReport) {
  return JSON.stringify(report, null, 2);
}
