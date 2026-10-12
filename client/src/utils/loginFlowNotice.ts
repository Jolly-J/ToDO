/** 登录流程通知工具，检测登录失败并在合适时机提示用户 */
const RECENT_LOGIN_SUCCESS_KEY = 'taskflow.recent-login-success-at';
const LOGIN_FAILURE_NOTICE_KEY = 'taskflow.login-failure-notice';
const LOGIN_FAILURE_WINDOW_MS = 15_000;

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

export function markRecentLoginSuccess(now = Date.now()) {
  getStorage()?.setItem(RECENT_LOGIN_SUCCESS_KEY, String(now));
}

export function clearRecentLoginSuccess() {
  getStorage()?.removeItem(RECENT_LOGIN_SUCCESS_KEY);
}

export function markLoginFailureNoticeIfNeeded(now = Date.now()) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const rawValue = storage.getItem(RECENT_LOGIN_SUCCESS_KEY);
  if (!rawValue) {
    return;
  }
  const loginAt = Number(rawValue);

  if (!Number.isFinite(loginAt) || now - loginAt > LOGIN_FAILURE_WINDOW_MS) {
    storage.removeItem(RECENT_LOGIN_SUCCESS_KEY);
    return;
  }

  storage.setItem(LOGIN_FAILURE_NOTICE_KEY, '1');
  storage.removeItem(RECENT_LOGIN_SUCCESS_KEY);
}

export function consumeLoginFailureNotice() {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  const shouldNotify = storage.getItem(LOGIN_FAILURE_NOTICE_KEY) === '1';
  if (shouldNotify) {
    storage.removeItem(LOGIN_FAILURE_NOTICE_KEY);
  }

  return shouldNotify;
}
