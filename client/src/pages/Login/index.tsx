/**
 * 页面名称：登录页
 * 文件作用：提供系统登录入口。
 * 主要功能：处理钉钉扫码登录、登录中状态提示，以及登录后的页面跳转。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as dd from 'dingtalk-jsapi';
import { useAuthStore } from '@/store';
import { consumeLoginFailureNotice, markRecentLoginSuccess } from '@/utils/loginFlowNotice';
import clientLogger from '@/utils/clientLogger';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import styles from './Login.module.css';

const QR_CONTAINER_ID = 'login-container';
const DINGTALK_QR_CLIENT_ID = String(
  import.meta.env.VITE_DINGTALK_QR_CLIENT_ID || import.meta.env.VITE_DINGTALK_CLIENT_ID || ''
).trim();
const DINGTALK_CORP_ID = String(import.meta.env.VITE_DINGTALK_CORP_ID || '').trim();
const QR_SCRIPT_CANDIDATES = [
  '/ddlogin.js',
  'https://g.alicdn.com/dingding/dinglogin/0.0.5/ddlogin.js',
];

interface LoginRouteState {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
}


function isDingTalkEnvironment() {
  if (typeof navigator === 'undefined') return false;
  return /DingTalk/i.test(navigator.userAgent);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-dingtalk-src="${src}"]`) as HTMLScriptElement | null;
    if (existingScript?.dataset.loaded === 'true') { resolve(); return; }
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error(`failed to load ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.dingtalkSrc = src;
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error(`failed to load ${src}`)), { once: true });
    document.body.appendChild(script);
  });
}

async function ensureQrScriptLoaded() {
  if (typeof window.DTFrameLogin === 'function') return;
  let lastError: unknown = null;
  for (const src of QR_SCRIPT_CANDIDATES) {
    try {
      await loadScript(src);
      if (typeof window.DTFrameLogin === 'function') return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('DTFrameLogin not available');
}

function resolveRedirectPath(state: LoginRouteState | null, search: string) {
  const from = state?.from;
  const pathname = String(from?.pathname || '').trim();
  const normalizedPath = pathname.startsWith('/') ? pathname : '';
  if (normalizedPath && normalizedPath !== '/login') {
    return `${normalizedPath}${String(from?.search || '')}${String(from?.hash || '')}`;
  }
  const queryFrom = new URLSearchParams(search).get('from');
  if (queryFrom && queryFrom.startsWith('/') && queryFrom !== '/login') return queryFrom;
  return '/dashboard';
}

export default function Login() {
  const containerRef = useRef<HTMLDivElement>(null);
  const processedCodeRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuthStore();
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const redirectPath = useMemo(
    () => resolveRedirectPath(location.state as LoginRouteState | null, location.search),
    [location.state, location.search]
  );

  useEffect(() => {
    if (isAuthenticated) navigate(redirectPath, { replace: true });
  }, [isAuthenticated, navigate, redirectPath]);

  // 钉钉环境自动免登，无需用户手动点按钮
  useEffect(() => {
    if (isAuthenticated) return;
    if (!isDingTalkEnvironment()) return;

    let cancelled = false;
    setLoginLoading(true);
    setLoginError(null);

    async function autoLogin() {
      // 等待 dd.runtime 就绪，最多 5s
      let waited = 0;
      while ((!dd.runtime?.permission?.requestAuthCode) && waited < 5000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }
      if (cancelled) return;

      try {
        const result = await dd.runtime.permission.requestAuthCode({ corpId: DINGTALK_CORP_ID });
        if (cancelled) return;
        await login(result.code, 'internal');
        markRecentLoginSuccess();
        navigate(redirectPath, { replace: true });
      } catch (err: unknown) {
        if (cancelled) return;
        // 上报详细错误到后端，方便排查
        const errDetail = typeof err === 'object' && err !== null
          ? JSON.stringify(err, Object.getOwnPropertyNames(err))
          : String(err);
        clientLogger.failed('frontend.login.failed', {
          error: err instanceof Error ? err : new Error(errDetail),
          meta: { mode: 'internal', errDetail },
        });
        const msg = err instanceof Error ? err.message : `钉钉免登失败: ${errDetail}`;
        setLoginError(msg);
        setLoginLoading(false);
      }
    }

    void autoLogin();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const shouldNotify = consumeLoginFailureNotice();
    if (shouldNotify) {
      const msg = '您似乎在登录时遇到了问题，请重新登录';
      setLoginError(msg);
      toast.error(msg);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    let cancelled = false;

    async function initQr() {
      setQrLoading(true);
      setQrError(null);
      try {
        await ensureQrScriptLoaded();
        if (cancelled) return;

        const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/dingtalk/callback`);
        const DTFrameLogin = window.DTFrameLogin as any;
        DTFrameLogin(
          { id: QR_CONTAINER_ID, width: 300, height: 300 },
          {
            redirect_uri: redirectUri,
            client_id: DINGTALK_QR_CLIENT_ID,
            scope: 'openid corpid',
            response_type: 'code',
            state: 'login',
            prompt: 'consent',
            corpId: DINGTALK_CORP_ID || undefined,
          },
          async (loginResult: { redirectUrl: string }) => {
            if (cancelled) return;
            const url = new URL(loginResult.redirectUrl);
            const authCode = url.searchParams.get('authCode') || url.searchParams.get('code');
            if (!authCode || processedCodeRef.current === authCode) return;
            processedCodeRef.current = authCode;
            setLoginLoading(true);
            setLoginError(null);
            try {
              await login(authCode, 'qr');
              if (!cancelled) {
                markRecentLoginSuccess();
                navigate(redirectPath, { replace: true });
              }
            } catch (err) {
              if (!cancelled) {
                const msg = err instanceof Error ? err.message : '登录失败，请重试';
                setLoginError(msg);
                toast.error(msg);
                processedCodeRef.current = null;
              }
            } finally {
              if (!cancelled) setLoginLoading(false);
            }
          },
          (errorMsg: string) => {
            if (!cancelled) setQrError(errorMsg || '二维码加载失败');
          }
        );
      } catch {
        if (!cancelled) setQrError('登录组件加载失败，请刷新重试');
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    }

    void initQr();
    return () => { cancelled = true; };
  }, [isAuthenticated, login, navigate, redirectPath]);

  const isDingTalk = isDingTalkEnvironment();

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* 头部品牌区 */}
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <img src="/todo.svg" alt="ToDo" className={styles.logo} />
          </div>
          <h1 className={styles.brandTitle}>ToDo</h1>
        </div>

        {/* 内容区 */}
        <div className={styles.content}>
          {loginLoading ? (
            <div className={styles.loadingWrap}>
              <LoaderCircle className="h-10 w-10 animate-spin text-foreground" />
              <p className={styles.loadingText}>登录中，请稍候…</p>
            </div>
          ) : isDingTalk ? (
            <div className={styles.loadingWrap}>
              <p className={styles.loadingText}>检测到钉钉环境，请使用钉钉账号登录</p>
              <Button
                onClick={async () => {
                  setLoginLoading(true);
                  setLoginError(null);
                  try {
                    const result = await dd.runtime.permission.requestAuthCode({
                      corpId: DINGTALK_CORP_ID,
                    });
                    await login(result.code, 'internal');
                    markRecentLoginSuccess();
                    navigate(redirectPath, { replace: true });
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : '钉钉免登失败，请重试';
                    setLoginError(msg);
                    toast.error(msg);
                    setLoginLoading(false);
                  }
                }}
              >
                钉钉登录
              </Button>
            </div>
          ) : (
            <div className={styles.qrContent}>
              {loginError && (
                <div className="mb-4 w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {loginError}
                </div>
              )}
              {qrError && (
                <div className="mb-4 w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {qrError}
                  <Button
                    variant="link"
                    className="ml-2 h-auto p-0 text-sm"
                    onClick={() => window.location.reload()}
                  >
                    刷新重试
                  </Button>
                </div>
              )}
              <div className={styles.qrArea}>
                {qrLoading && (
                  <div className={styles.qrSkeleton}>
                    <Skeleton className="h-[240px] w-[240px] rounded-lg" />
                  </div>
                )}
                <div
                  id={QR_CONTAINER_ID}
                  ref={containerRef}
                  className={`${styles.qrContainer} ${qrLoading || qrError ? styles.qrHidden : styles.qrVisible}`}
                />
              </div>
              <p className="text-sm text-muted-foreground">使用钉钉扫码登录</p>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className={styles.footer}>
          <p className={styles.footerText}>团队任务协作平台</p>
        </div>
      </div>
    </div>
  );
}
