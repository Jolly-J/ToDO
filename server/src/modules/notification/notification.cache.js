/**
 * 模块名称：通知级数据缓存
 * 模块作用：提供任务关系人的短期缓存机制（使用简单 TTL），替换原先易污染的静态全局变量。
 *          对外暴漏主动失效接口供数据持久化层（DAO）在发生数据变更时主动调用。
 */

class StakeholderCache {
  constructor(ttlMs = 60000) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  get(taskId) {
    const entry = this.cache.get(taskId);
    if (!entry) return null;

    // 如果过期则失效
    if (Date.now() > entry.expiry) {
      this.cache.delete(taskId);
      return null;
    }

    return entry.result;
  }

  set(taskId, result) {
    this.cache.set(taskId, {
      result,
      expiry: Date.now() + this.ttlMs,
    });
  }

  invalidate(taskId) {
    if (taskId) {
      this.cache.delete(taskId);
    }
  }

  clear() {
    this.cache.clear();
  }
}

const stakeholderCache = new StakeholderCache();

module.exports = {
  stakeholderCache,
};
