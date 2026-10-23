/** Axios 请求封装，统一处理鉴权、错误提示与登录失效跳转 */
import axios from 'axios';
import { toast } from 'sonner';
import { markLoginFailureNoticeIfNeeded } from '@/utils/loginFlowNotice';

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
});
const mutationMethods = new Set(['post', 'put', 'patch', 'delete']);

// 请求拦截器：注入 token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = String(config.method || 'get').toLowerCase();
  if (import.meta.env.DEV && mutationMethods.has(method)) {
    console.info('[save][request]', {
      method: method.toUpperCase(),
      url: config.url,
      data: config.data,
      params: config.params,
    });
  }
  return config;
});

// 响应拦截器：统一错误处理 + 解包 data
request.interceptors.response.use(
  (response) => {
    if (response.config?.signal?.aborted) return Promise.reject(new axios.CanceledError());
    const method = String(response.config?.method || 'get').toLowerCase();
    if (import.meta.env.DEV && mutationMethods.has(method)) {
      console.info('[save][response]', {
        method: method.toUpperCase(),
        url: response.config?.url,
        status: response.status,
        payload: response.data,
      });
    }

    const data = response.data;
    // 统一 API 格式 { code, message, data }
    if (data && typeof data === 'object' && 'code' in data && 'data' in data) {
      if (data.code !== 0) {
        toast.error(data.message || '请求失败');
        return Promise.reject(new Error(data.message));
      }
      return data.data;
    }
    return data;
  },
  (error) => {
    if (axios.isCancel(error) || error.config?.signal?.aborted) return Promise.reject(error);
    const method = String(error.config?.method || 'get').toLowerCase();
    if (import.meta.env.DEV && mutationMethods.has(method)) {
      console.error('[save][error]', {
        method: method.toUpperCase(),
        url: error.config?.url,
        status: error.response?.status,
        payload: error.response?.data,
        message: error.message,
      });
    }

    if (error.response?.status === 401) {
      markLoginFailureNoticeIfNeeded();
      localStorage.removeItem('token');
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (window.location.pathname === '/login') {
        window.location.href = '/login';
      } else {
        window.location.href = `/login?from=${encodeURIComponent(currentPath)}`;
      }
      return Promise.reject(error);
    }
    const msg = error.response?.data?.message || '请求失败，请稍后重试';
    toast.error(msg);
    return Promise.reject(error);
  },
);

export default request;
