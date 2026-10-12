import { useState } from 'react';

export interface MobileDeviceSignals {
  userAgent: string;
  userAgentDataMobile?: boolean;
  platform?: string;
  maxTouchPoints?: number;
}

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

/**
 * 判断真实设备形态，不把桌面端的窄窗口误认为移动设备。
 * iPadOS 可能使用 Macintosh UA，因此额外结合触摸点数识别。
 */
export function detectMobileDevice({
  userAgent,
  userAgentDataMobile,
  platform,
  maxTouchPoints = 0,
}: MobileDeviceSignals) {
  if (userAgentDataMobile === true) {
    return true;
  }

  if (MOBILE_USER_AGENT_PATTERN.test(userAgent)) {
    return true;
  }

  return platform === 'MacIntel' && maxTouchPoints > 1;
}

function getMobileDeviceSignals(): MobileDeviceSignals {
  if (typeof navigator === 'undefined') {
    return { userAgent: '' };
  }

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };

  return {
    userAgent: navigator.userAgent,
    userAgentDataMobile: navigatorWithUserAgentData.userAgentData?.mobile,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}

/**
 * 移动端环境检测 Hook
 * 仅识别真实移动设备。桌面端窗口变窄时继续使用桌面布局，
 * 由主内容画布通过滚动承载超出区域。
 * @returns {boolean} isMobile - 是否为移动端界面
 */
export function useIsMobile() {
  const [isMobile] = useState(() => detectMobileDevice(getMobileDeviceSignals()));

  return isMobile;
}
