/**
 * TaskFlow 前端日志 SDK
 *
 * 功能特性：
 * - 分级日志 (debug/info/warn/error)
 * - 批量上报队列 (累积10条或5秒刷新)
 * - 关键操作上报
 * - 全局错误捕获
 * - 中文动作标签
 */

// ==================== 类型定义 ====================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type FrontendAction =
  // 登录相关
  | 'frontend.login.success'
  | 'frontend.login.failed'
  // 任务相关
  | 'frontend.task.create.success'
  | 'frontend.task.create.failed'
  | 'frontend.task.update.success'
  | 'frontend.task.update.failed'
  | 'frontend.task.delete.success'
  | 'frontend.task.delete.failed'
  // 评论相关
  | 'frontend.comment.submit.success'
  | 'frontend.comment.submit.failed'
  // 错误上报
  | 'frontend.error.js'
  | 'frontend.error.api'
  | 'frontend.error.network';

type LogResult = 'success' | 'failed';

interface LogEntry {
  clientTime: string;
  level: LogLevel;
  action: FrontendAction;
  actionLabel: string;
  result: LogResult;
  reqId?: string;
  userId?: string;
  durationMs?: number;
  taskId?: string;
  commentId?: string;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  meta?: Record<string, unknown>;
}

interface ReporterConfig {
  endpoint: string;
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  enabled: boolean;
}

// ==================== 动作标签映射 ====================

const ACTION_LABELS: Record<FrontendAction, string> = {
  'frontend.login.success': '登录成功',
  'frontend.login.failed': '登录失败',
  'frontend.task.create.success': '任务创建成功',
  'frontend.task.create.failed': '任务创建失败',
  'frontend.task.update.success': '任务更新成功',
  'frontend.task.update.failed': '任务更新失败',
  'frontend.task.delete.success': '任务删除成功',
  'frontend.task.delete.failed': '任务删除失败',
  'frontend.comment.submit.success': '评论提交成功',
  'frontend.comment.submit.failed': '评论提交失败',
  'frontend.error.js': 'JS异常',
  'frontend.error.api': 'API异常',
  'frontend.error.network': '网络异常',
};

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: ReporterConfig = {
  endpoint: '/api/logs/frontend',
  batchSize: 10,
  flushInterval: 5000,
  maxRetries: 3,
  enabled: true,
};

// ==================== ClientLogger 类 ====================

class ClientLogger {
  private queue: LogEntry[] = [];
  private config: ReporterConfig;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;
  private currentUserId: string | undefined;

  constructor(config: Partial<ReporterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化日志SDK
   */
  init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 启动定时刷新
    this.startFlushTimer();

    // 设置全局错误捕获
    this.setupGlobalErrorHandler();

    // 开发环境提示
    if (import.meta.env.DEV) {
      console.log('[ClientLogger] 初始化完成，日志系统已启动');
    }
  }

  /**
   * 设置当前用户ID
   */
  setUserId(userId: string | undefined): void {
    this.currentUserId = userId;
  }

  /**
   * 本地日志输出 (开发环境)
   */
  private localLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!import.meta.env.DEV) return;

    const prefix = {
      debug: '[DEBUG]',
      info: '[INFO]',
      warn: '[WARN]',
      error: '[ERROR]',
    }[level];

    const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    method(prefix, message, meta ?? '');
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.localLog('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.localLog('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.localLog('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.localLog('error', message, meta);
  }

  /**
   * 关键操作上报
   */
  report(
    action: FrontendAction,
    result: LogResult,
    meta: {
      reqId?: string;
      taskId?: string;
      commentId?: string;
      durationMs?: number;
      error?: Error;
      meta?: Record<string, unknown>;
    } = {}
  ): void {
    const entry: LogEntry = {
      clientTime: new Date().toISOString(),
      level: result === 'failed' ? 'error' : 'info',
      action,
      actionLabel: ACTION_LABELS[action] || action,
      result,
      userId: this.currentUserId,
      ...meta,
    };

    // 处理Error对象
    if (meta.error instanceof Error) {
      entry.error = {
        message: meta.error.message,
        stack: meta.error.stack,
        code: (meta.error as Error & { code?: string }).code,
      };
    }

    // 本地输出
    this.localLog(entry.level, `[${entry.actionLabel}] ${result}`, meta.meta);

    // 加入上报队列
    if (this.config.enabled) {
      this.queue.push(entry);
      this.maybeFlush();
    }
  }

  /**
   * 快捷方法：成功上报
   */
  success(action: FrontendAction, meta?: Parameters<ClientLogger['report']>[2]): void {
    this.report(action, 'success', meta);
  }

  /**
   * 快捷方法：失败上报
   */
  failed(action: FrontendAction, meta?: Parameters<ClientLogger['report']>[2]): void {
    this.report(action, 'failed', meta);
  }

  /**
   * 判断是否需要刷新
   */
  private maybeFlush(): void {
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
  }

  /**
   * 停止定时刷新
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 刷新队列，上报日志
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.config.batchSize);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: batch }),
      });

      if (!response.ok) {
        // 上报失败，重新加入队列
        this.queue.unshift(...batch);
        this.localLog('warn', `日志上报失败: ${response.status}`);
      }
    } catch (err) {
      // 网络错误，重新加入队列
      this.queue.unshift(...batch);
      this.localLog('warn', `日志上报网络错误: ${(err as Error).message}`);
    }
  }

  /**
   * 设置全局错误捕获
   */
  private setupGlobalErrorHandler(): void {
    // 捕获JS错误
    window.addEventListener('error', (event) => {
      this.report('frontend.error.js', 'failed', {
        error: event.error || new Error(event.message),
        meta: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // 捕获Promise未处理异常
    window.addEventListener('unhandledrejection', (event) => {
      this.report('frontend.error.js', 'failed', {
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        meta: {
          type: 'unhandledrejection',
        },
      });
    });
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.stopFlushTimer();
    this.flush(); // 最后一次刷新
    this.isInitialized = false;
  }
}

// ==================== 单例导出 ====================

let instance: ClientLogger | null = null;

function getClientLogger(config?: Partial<ReporterConfig>): ClientLogger {
  if (!instance) {
    instance = new ClientLogger(config);
  }
  return instance;
}

// 默认实例
const clientLogger = getClientLogger();

export { ClientLogger, getClientLogger, ACTION_LABELS };
export type { FrontendAction, LogResult, LogEntry, ReporterConfig };
export default clientLogger;
