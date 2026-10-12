/**
 * 钉钉 JSAPI 类型声明
 * 为钉钉客户端 dd.runtime / dd.biz 等全局 API 提供 TypeScript 类型定义
 */
interface DingTalkAuthCodeSuccess {
  code: string;
}

interface DingTalkRequestAuthCodeParams {
  corpId: string;
  onSuccess: (payload: DingTalkAuthCodeSuccess) => void;
  onFail?: (error: unknown) => void;
}

interface DingTalkBizUtilShareParams {
  type: 0 | 1 | 2; // 0=全部渠道；1=只能分享到钉钉；2=不能分享（仅刷新）
  url: string;
  title: string;
  content: string;
  image?: string;
  onSuccess?: () => void;
  onFail?: (err: unknown) => void;
}

interface DingTalkGlobal {
  config?: (params: {
    agentId?: string;
    corpId?: string;
    timeStamp?: number;
    timestamp?: number;
    nonceStr?: string;
    signature?: string;
    jsApiList?: string[];
    type?: number;
  }) => void;
  ready?: (callback: () => void) => void;
  error?: (callback: (err: unknown) => void) => void;
  runtime?: {
    permission?: {
      requestAuthCode?: (params: DingTalkRequestAuthCodeParams) => void;
    };
  };
  biz?: {
    util?: {
      share?: (params: DingTalkBizUtilShareParams) => void;
    };
  };
}

interface DingTalkFrameLoginPayload {
  authCode?: string;
}

type DingTalkFrameLoginHandler = (
  container: {
    id: string;
    width: number;
    height: number;
  },
  config: {
    redirect_uri: string;
    client_id: string;
    scope: string;
    response_type: string;
    state: string;
    prompt: string;
  },
  onSuccess: (payload: DingTalkFrameLoginPayload) => void,
  onError: (error: string) => void
) => void;

declare global {
  interface Window {
    dd?: DingTalkGlobal;
    DTFrameLogin?: DingTalkFrameLoginHandler;
  }
}

export {};
