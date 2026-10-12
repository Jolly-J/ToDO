/**
 * 请求 ID 生成工具
 * 为每次 API 请求生成唯一标识符，用于日志追踪和请求去重
 */
export function createRequestId(prefix = 'req') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
