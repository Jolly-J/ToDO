/**
 * 钉钉运行时环境 Hook
 * 封装钉钉 JSAPI 签名获取、SDK 配置初始化及鉴权状态管理
 */
import { useCallback, useRef, useState } from 'react';
import request from '@/api/request';

interface DingTalkJsapiSignPayload {
  corpId: string;
  agentId: string;
  nonceStr: string;
  timeStamp: number;
  signature: string;
  url: string;
}

interface UseDingTalkRuntimeResult {
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  isDingTalkEnvironment: boolean;
  ensureReady: () => Promise<boolean>;
}

function detectDingTalkEnvironment() {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /DingTalk/i.test(navigator.userAgent);
}

function getCurrentPageUrl() {
  const url = new URL(window.location.href);
  url.hash = '';
  return url.toString();
}

function stringifyDingTalkError(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const known = error as { errorMessage?: string; message?: string };
    if (known.errorMessage) return known.errorMessage;
    if (known.message) return known.message;
    try {
      return JSON.stringify(error);
    } catch {
      return '未知错误';
    }
  }
  return '未知错误';
}

export function useDingTalkRuntime(): UseDingTalkRuntimeResult {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initializedUrlRef = useRef<string | null>(null);
  const initializingRef = useRef<Promise<boolean> | null>(null);
  const isDingTalkEnvironment = detectDingTalkEnvironment();

  const ensureReady = useCallback(async () => {
    if (!isDingTalkEnvironment) {
      return false;
    }

    const currentUrl = getCurrentPageUrl();
    if (status === 'ready' && initializedUrlRef.current === currentUrl) {
      return true;
    }

    if (initializingRef.current) {
      return initializingRef.current;
    }

    setStatus('loading');
    setErrorMessage(null);

    const task = (async () => {
      const dd = window.dd;
      if (!dd?.config || !dd.ready || !dd.error) {
        setStatus('error');
        setErrorMessage('钉钉 JSAPI 未就绪');
        return false;
      }
      const ddConfig = dd.config;
      const ddReady = dd.ready;
      const ddError = dd.error;

      try {
        const signed = await request.get<DingTalkJsapiSignPayload>(
          `/dingtalk/jsapi/sign?url=${encodeURIComponent(currentUrl)}`
        );

        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const settleResolve = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          const settleReject = (err: unknown) => {
            if (settled) return;
            settled = true;
            reject(err);
          };

          ddError((err) => {
            settleReject(err);
          });
          ddReady(() => {
            settleResolve();
          });
          ddConfig({
            agentId: signed.agentId,
            corpId: signed.corpId,
            timeStamp: signed.timeStamp,
            timestamp: signed.timeStamp,
            nonceStr: signed.nonceStr,
            signature: signed.signature,
            jsApiList: ['biz.util.share'],
            type: 0,
          });

          setTimeout(() => {
            settleReject(new Error('钉钉 JSAPI 初始化超时'));
          }, 7000);
        });

        initializedUrlRef.current = currentUrl;
        setStatus('ready');
        return true;
      } catch (err) {
        setStatus('error');
        setErrorMessage(`钉钉 JSAPI 初始化失败：${stringifyDingTalkError(err)}`);
        return false;
      } finally {
        initializingRef.current = null;
      }
    })();

    initializingRef.current = task;
    return task;
  }, [isDingTalkEnvironment, status]);

  return {
    status,
    errorMessage,
    isDingTalkEnvironment,
    ensureReady,
  };
}
