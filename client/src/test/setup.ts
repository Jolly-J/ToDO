/**
 * 测试环境设置
 * 初始化 Vitest 全局配置，注入 jest-dom 匹配器及浏览器 API 模拟
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 设置全局测试环境
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock getComputedStyle for pseudo-elements used by antd internals
const originalGetComputedStyle = window.getComputedStyle.bind(window);
Object.defineProperty(window, 'getComputedStyle', {
  writable: true,
  value: ((element: Element, pseudoElt?: string) => originalGetComputedStyle(element, pseudoElt ? undefined : pseudoElt)) as typeof window.getComputedStyle,
});
